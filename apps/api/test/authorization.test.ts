import express from 'express';
import { createServer, type Server } from 'node:http';
import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), deleteMany: vi.fn() }));
vi.mock('../src/lib/prisma', () => ({
  prisma: {
    match: { findFirst: mocks.findFirst },
    scorerAssignment: { deleteMany: mocks.deleteMany },
  },
}));
vi.mock('../src/lib/lock', () => ({
  matchLockKey: (id: string) => id,
  tournamentLockKey: (id: string) => id,
  withLock: async (_key: string, fn: () => unknown) => fn(),
}));
vi.mock('../src/lib/logger', () => ({ logger: { error: vi.fn() } }));
vi.mock('../src/middleware/auth', () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { id: 'organizer', email: 'test@example.com' };
    next();
  },
}));
vi.mock('../src/middleware/requireScorerForMatch', () => ({ invalidateMatchAuthz: vi.fn() }));
vi.mock('../src/modules/tournaments/guards', () => ({
  loadOwnedTournament: async () => ({ id: 'owned' }),
}));
vi.mock('../src/modules/fixtures/service', () => ({
  generateFixtures: vi.fn(),
  previewFixtures: vi.fn(),
}));
vi.mock('../src/modules/notifications/service', () => ({ notifyScorerAssignment: vi.fn() }));
import { fixturesRouter } from '../src/modules/fixtures/routes';
let server: Server | undefined;
afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
});
it('refuses to remove a scorer from a match outside the owned tournament', async () => {
  mocks.findFirst.mockResolvedValue(null);
  const app = express();
  app.use('/tournaments', fixturesRouter);
  app.use(
    (
      error: { status?: number },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => res.status(error.status ?? 500).end(),
  );
  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('address');
  const response = await fetch(
    `http://127.0.0.1:${address.port}/tournaments/owned/matches/foreign/scorers/victim`,
    { method: 'DELETE' },
  );
  expect(response.status).toBe(404);
  expect(mocks.findFirst).toHaveBeenCalledWith({
    where: { id: 'foreign', tournamentId: 'owned' },
    select: { id: true },
  });
  expect(mocks.deleteMany).not.toHaveBeenCalled();
});
