import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env, emailEnabled, allowedOrigins } from './config/env';
import { logger } from './lib/logger';
import { pingDatabase } from './lib/prisma';
import { pingRedis } from './lib/redis';
import { asyncHandler } from './lib/http';
import { errorHandler, notFoundHandler } from './middleware/error';
import { publicRouter } from './modules/public/routes';
import { authRouter } from './modules/auth/routes';
import { tournamentsRouter } from './modules/tournaments/routes';
import { fixturesRouter } from './modules/fixtures/routes';
import { standingsRouter } from './modules/standings/routes';
import { usersRouter } from './modules/users/routes';
import { meRouter } from './modules/me/routes';
import { notificationsRouter } from './modules/notifications/routes';
import { teamsRouter } from './modules/teams/routes';
import { playersRouter } from './modules/players/routes';
import { matchesRouter } from './modules/matches/routes';
import { scoringRouter } from './modules/scoring/routes';
import { footballRouter } from './modules/football/routes';
import { statsRouter } from './modules/stats/routes';

export function createApp() {
  const app = express();

  // Behind Render/Railway/Fly there is always a proxy; without this, req.ip is
  // the proxy's address and every rate limit collapses into one bucket.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());
  app.use(
    pinoHttp({
      logger,
      // Health checks would otherwise drown the log at one line per second.
      autoLogging: { ignore: (req) => req.url === '/health' || req.url === '/health/live' },
    }),
  );

  /**
   * Liveness vs readiness are different questions. /health/live says the
   * process is up; /health says its dependencies answer, and returns 503 if
   * they don't — which is what a load balancer should act on.
   */
  app.get('/health/live', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.get(
    '/health',
    asyncHandler(async (_req, res) => {
      const [database, redisOk] = await Promise.all([pingDatabase(), pingRedis()]);
      const healthy = database && redisOk;

      res.status(healthy ? 200 : 503).json({
        status: healthy ? 'ok' : 'degraded',
        version: '0.1.0',
        env: env.NODE_ENV,
        uptime: Math.round(process.uptime()),
        dependencies: {
          postgres: database ? 'ok' : 'unreachable',
          redis: redisOk ? 'ok' : 'unreachable',
        },
        email: emailEnabled ? 'resend' : 'console (codes are printed to the server log)',
      });
    }),
  );

  // Public share links: no auth, addressed by random slug.
  app.use('/public', publicRouter);

  app.use('/auth', authRouter);
  // Fixtures mount on the same prefix as tournaments and must come first:
  // tournamentsRouter has a catch-all /:tournamentId that would otherwise
  // swallow /:tournamentId/fixtures.
  app.use('/tournaments', fixturesRouter);
  app.use('/tournaments', standingsRouter);
  app.use('/tournaments', statsRouter);
  app.use('/tournaments', tournamentsRouter);
  app.use('/users', usersRouter);
  app.use('/me', meRouter);
  app.use('/notifications', notificationsRouter);
  app.use('/teams', teamsRouter);
  app.use('/players', playersRouter);
  app.use('/matches', matchesRouter);
  app.use('/matches', scoringRouter);
  app.use('/matches', footballRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
