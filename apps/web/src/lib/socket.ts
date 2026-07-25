import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@howzat/shared';

export type MatchSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * One socket per tab, shared by every subscriber. Opening a connection per
 * component would multiply connections on a page showing several matches.
 */
let socket: MatchSocket | null = null;

const SOCKET_URL = import.meta.env.PROD
  ? (import.meta.env.VITE_SOCKET_URL ?? '')
  : // Dev goes through the Vite proxy origin, so same-origin — no CORS.
    window.location.origin;

export function getSocket(): MatchSocket {
  socket ??= io(SOCKET_URL, {
    // The API is served under /api on the deployed origin, sockets included.
    path: '/api/socket.io',
    // Websocket only — the long-polling handshake is process-sticky and breaks
    // when consecutive polls reach different server instances. See the matching
    // comment in apps/api/src/realtime/io.ts.
    transports: ['websocket'],
    withCredentials: true,
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5_000,
  });

  return socket;
}
