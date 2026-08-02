import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import {
  matchRoom,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@howzat/shared';
import { allowedOrigins } from '../config/env';
import { logger } from '../lib/logger';
import { createRedisClient, redis } from '../lib/redis';
import { setMatchEventPublisher } from './bus';

export type MatchServer = Server<ClientToServerEvents, ServerToClientEvents>;
type MatchSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

let io: MatchServer | null = null;

/** Must match `path` in apps/web/src/lib/socket.ts and the Vite dev proxy. */
export const SOCKET_PATH = '/api/socket.io';

/**
 * Real-time fan-out.
 *
 * The Redis adapter is what makes horizontal scaling work: a ball recorded on
 * instance A reaches viewers connected to instance B, because the emit is
 * published to Redis and every instance re-emits to its own local sockets.
 * The adapter needs two dedicated connections — one blocks on SUBSCRIBE and
 * cannot be used for anything else — so these are separate from the main client.
 */
export function attachRealtime(server: HttpServer): MatchServer {
  const instance: MatchServer = new Server(server, {
    cors: { origin: allowedOrigins, credentials: true },
    // The API is mounted under /api on the deployed origin, so the socket
    // endpoint lives there too. Kept identical in dev (via the Vite proxy) so
    // there is one path to reason about rather than two.
    path: SOCKET_PATH,
    // A ground has bad signal; let a dropped connection recover its session
    // instead of forcing a full resubscribe.
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true,
    },
    // Websocket only, no long-polling fallback. Polling establishes a session
    // in one process's memory and then requires every subsequent poll to reach
    // that same process — behind a load balancer that spreads requests, the
    // second poll lands elsewhere and the handshake dies with "session ID
    // unknown". A single upgraded connection has no such affinity problem.
    transports: ['websocket'],
  });

  const pubClient = createRedisClient('socket-pub');
  const subClient = createRedisClient('socket-sub');

  instance.adapter(createAdapter(pubClient, subClient));

  instance.on('connection', (socket) => registerHandlers(instance, socket));

  // Hand the write path a real transport. Until this runs, publishMatchEvent
  // logs and drops — which is exactly what happens in a test or a worker.
  setMatchEventPublisher({
    publish(envelope) {
      const room = instance.to(matchRoom(envelope.payload.matchId));

      // Switching on the discriminant is what narrows the payload to the
      // shape each event's signature demands — no casts needed.
      switch (envelope.event) {
        case 'ball':
          room.emit('ball', envelope.payload);
          break;
        case 'innings:complete':
          room.emit('innings:complete', envelope.payload);
          break;
        case 'match:completed':
          room.emit('match:completed', envelope.payload);
          break;
        case 'football:event':
          room.emit('football:event', envelope.payload);
          break;
        case 'football:clock':
          room.emit('football:clock', envelope.payload);
          break;
      }
    },
  });

  io = instance;
  logger.info('Realtime attached (socket.io + Redis adapter)');

  return instance;
}

/**
 * Public viewers connect with no token at all — that is the point of the
 * share link. There is nothing to authorize because the socket only ever
 * receives; it cannot write.
 */
function registerHandlers(instance: MatchServer, socket: MatchSocket): void {
  logger.debug({ socketId: socket.id }, 'Socket connected');

  socket.on('join', async ({ matchId }) => {
    if (typeof matchId !== 'string' || matchId.length === 0 || matchId.length > 64) {
      socket.emit('error', { message: 'A valid matchId is required to join' });
      return;
    }

    await socket.join(matchRoom(matchId));

    const viewers = await addViewer(matchId, socket.id);

    socket.emit('joined', { matchId, viewers });
    instance.to(matchRoom(matchId)).emit('viewers', { matchId, count: viewers });
  });

  socket.on('leave', async ({ matchId }) => {
    if (typeof matchId !== 'string') return;

    await socket.leave(matchRoom(matchId));
    instance
      .to(matchRoom(matchId))
      .emit('viewers', { matchId, count: await removeViewer(matchId, socket.id) });
  });

  socket.on('disconnecting', () => {
    // Rooms are still attached during 'disconnecting'; on 'disconnect' they
    // are gone and there would be nothing left to recount.
    for (const room of socket.rooms) {
      if (!room.startsWith('match:')) continue;

      const matchId = room.slice('match:'.length);

      void removeViewer(matchId, socket.id).then((count) => {
        instance.to(room).emit('viewers', { matchId, count });
      });
    }
  });
}

// ─────────────────────────────────────────────────── viewer counting ──

/**
 * Viewers are counted in Redis rather than by asking the other server
 * instances.
 *
 * The obvious implementation is the adapter's `fetchSockets()`, which
 * broadcasts a request and waits for every subscribed instance to answer. That
 * cannot work on a platform that freezes idle instances: a frozen instance
 * still holds its Redis subscription, so it is counted among the expected
 * responders but never replies, and the call stalls for its full timeout before
 * failing. A sorted set has no such dependency on who happens to be awake.
 *
 * The score is the join timestamp, which is what makes the set self-healing:
 * an instance killed without a disconnect event leaves its members behind, and
 * they are pruned on the next count rather than inflating it forever.
 */
const VIEWER_TTL_SECONDS = 15 * 60;
const VIEWER_STALE_MS = VIEWER_TTL_SECONDS * 1000;

const viewerKey = (matchId: string): string => `viewers:${matchId}`;

async function addViewer(matchId: string, socketId: string): Promise<number> {
  const key = viewerKey(matchId);

  try {
    const count = await redis
      .multi()
      .zadd(key, Date.now(), socketId)
      .zremrangebyscore(key, 0, Date.now() - VIEWER_STALE_MS)
      // Refreshed on every join so a room that empties out expires on its own
      // instead of lingering as a dead key.
      .expire(key, VIEWER_TTL_SECONDS)
      .zcard(key)
      .exec()
      .then((results) => Number(results?.[3]?.[1] ?? 0));

    return count;
  } catch (err) {
    logger.warn({ err, matchId }, 'Could not add viewer');
    return 0;
  }
}

async function removeViewer(matchId: string, socketId: string): Promise<number> {
  const key = viewerKey(matchId);

  try {
    const results = await redis.multi().zrem(key, socketId).zcard(key).exec();
    return Number(results?.[1]?.[1] ?? 0);
  } catch (err) {
    logger.warn({ err, matchId }, 'Could not remove viewer');
    return 0;
  }
}

export async function closeRealtime(): Promise<void> {
  if (!io) return;
  await io.close();
  io = null;
}
