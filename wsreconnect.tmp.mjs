import { io } from 'socket.io-client';
// Mirrors apps/web/src/lib/socket.ts, reconnection included.
const s = io('https://howzat-zeta.vercel.app', {
  path: '/api/socket.io', transports: ['websocket'],
  reconnection: true, reconnectionDelay: 500, reconnectionDelayMax: 5000,
});
const t0 = Date.now();
const at = () => ((Date.now() - t0) / 1000).toFixed(0) + 's';
let connects = 0, disconnects = 0;
s.on('connect', () => { connects++; console.log(`[${at()}] connect #${connects}`); s.emit('join', { matchId: 'reconnect-probe' }); });
s.on('joined', p => console.log(`[${at()}] joined viewers=${p.viewers}`));
s.on('disconnect', r => { disconnects++; console.log(`[${at()}] disconnect #${disconnects}: ${r}`); });
setTimeout(() => { console.log(`\nRESULT connects=${connects} disconnects=${disconnects}`); s.close(); process.exit(0); }, 400000);
