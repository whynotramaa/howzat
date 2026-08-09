import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@howzat/shared';

export type MatchSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: MatchSocket | null = null;

const SOCKET_URL = import.meta.env.PROD
  ? (import.meta.env.VITE_SOCKET_URL ?? '')
  : window.location.origin;

export function getSocket(): MatchSocket {
  socket ??= io(SOCKET_URL, {
    path: '/api/socket.io',
    transports: ['websocket'],
    withCredentials: true,
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5_000,
  });

  return socket;
}
