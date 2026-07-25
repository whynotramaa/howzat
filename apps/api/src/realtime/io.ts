import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import {
  matchRoom,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@howzat/shared';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { createRedisClient } from '../lib/redis';
import { setMatchEventPublisher } from './bus';

export type MatchServer = Server<ClientToServerEvents, ServerToClientEvents>;
type MatchSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

let io: MatchServer | null = null;

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
    cors: { origin: [env.WEB_BASE_URL], credentials: true },
    // A ground has bad signal; let a dropped connection recover its session
    // instead of forcing a full resubscribe.
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true,
    },
    transports: ['websocket', 'polling'],
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

    const viewers = await countViewers(instance, matchId);

    socket.emit('joined', { matchId, viewers });
    instance.to(matchRoom(matchId)).emit('viewers', { matchId, count: viewers });
  });

  socket.on('leave', async ({ matchId }) => {
    if (typeof matchId !== 'string') return;

    await socket.leave(matchRoom(matchId));
    instance
      .to(matchRoom(matchId))
      .emit('viewers', { matchId, count: await countViewers(instance, matchId) });
  });

  socket.on('disconnecting', () => {
    // Rooms are still attached during 'disconnecting'; on 'disconnect' they
    // are gone and there would be nothing left to recount.
    for (const room of socket.rooms) {
      if (!room.startsWith('match:')) continue;

      const matchId = room.slice('match:'.length);

      void countViewers(instance, matchId).then((count) => {
        instance.to(room).emit('viewers', { matchId, count: Math.max(0, count - 1) });
      });
    }
  });
}

/** Counts across every instance, not just this one — the adapter aggregates. */
async function countViewers(instance: MatchServer, matchId: string): Promise<number> {
  try {
    const sockets = await instance.in(matchRoom(matchId)).fetchSockets();
    return sockets.length;
  } catch (err) {
    logger.warn({ err, matchId }, 'Could not count viewers');
    return 0;
  }
}

export function getIo(): MatchServer | null {
  return io;
}

export async function closeRealtime(): Promise<void> {
  if (!io) return;
  await io.close();
  io = null;
}
