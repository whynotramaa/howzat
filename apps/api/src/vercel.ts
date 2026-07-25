import { createServer } from 'node:http';
import express from 'express';
import { createApp } from './app';
import { logger } from './lib/logger';
import { attachRealtime } from './realtime/io';
import { registerStandingsSubscriber } from './modules/standings/service';
import { registerPlayerStatsSubscriber } from './modules/stats/service';

/**
 * Serverless entrypoint.
 *
 * The counterpart to index.ts: same wiring, but the server is exported rather
 * than listened on, because the platform owns the socket and hands us the
 * upgrade. Everything here runs once per instance, at cold start.
 *
 * index.ts stays the entrypoint for local development and any long-lived host,
 * so `npm run dev` is unaffected by anything in this file.
 */

// The platform routes /api/* to this function and preserves the prefix, so the
// real app is mounted underneath and Express strips it back off. That keeps
// every route in app.ts mounted at the bare path it already expects.
const outer = express();
outer.use('/api', createApp());

const server = createServer(outer);

attachRealtime(server);

// Registered at module scope so a cold start has its subscribers in place
// before the request that woke it up reaches the write path.
registerStandingsSubscriber();
registerPlayerStatsSubscriber();

logger.info('Howzat API ready (serverless instance booted)');

// No listen() and no signal handlers: the platform starts the server, and it
// freezes or discards the instance rather than sending SIGTERM.
export default server;
