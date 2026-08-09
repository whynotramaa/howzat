import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { matchRoom, type ClientToServerEvents, type ServerToClientEvents } from '@howzat/shared';
import { allowedOrigins } from '../config/env';
import { logger } from '../lib/logger';
import { createRedisClient, redis } from '../lib/redis';
import { setMatchEventPublisher } from './bus';

export type MatchServer = Server<ClientToServerEvents, ServerToClientEvents>;
type MatchSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

let io: MatchServer | null = null;

export const SOCKET_PATH = '/api/socket.io';

export function attachRealtime(server: HttpServer): MatchServer {
  const instance: MatchServer = new Server(server, {
    cors: { origin: allowedOrigins, credentials: true },
    path: SOCKET_PATH,
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true,
    },
    transports: ['websocket'],
  });

  const pubClient = createRedisClient('socket-pub');
  const subClient = createRedisClient('socket-sub');

  instance.adapter(createAdapter(pubClient, subClient));

  instance.on('connection', (socket) => registerHandlers(instance, socket));

  setMatchEventPublisher({
    publish(envelope) {
      const room = instance.to(matchRoom(envelope.payload.matchId));

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
    for (const room of socket.rooms) {
      if (!room.startsWith('match:')) continue;

      const matchId = room.slice('match:'.length);

      void removeViewer(matchId, socket.id).then((count) => {
        instance.to(room).emit('viewers', { matchId, count });
      });
    }
  });
}

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
