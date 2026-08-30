import { createServer } from 'node:http';
import express from 'express';
import { createApp } from './app';
import { shareHandler } from './modules/public/share';
import { logger } from './lib/logger';
import { attachRealtime } from './realtime/io';
import { registerStandingsSubscriber } from './modules/standings/service';
import { registerPlayerStatsSubscriber } from './modules/stats/service';

const outer = express();
outer.get('/live/:slug', shareHandler);
outer.use('/api', createApp());

const server = createServer(outer);

attachRealtime(server);

registerStandingsSubscriber();
registerPlayerStatsSubscriber();

logger.info('Howzat API ready (serverless instance booted)');

export default server;
