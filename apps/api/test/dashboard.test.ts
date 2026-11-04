import express from 'express';
import { createServer, type Server } from 'node:http';
import { afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ assignments: vi.fn() }));
vi.mock('../src/lib/prisma', () => ({
  prisma: {
    user: { findUnique: async () => ({ id: 'scorer', username: 'scorer', name: 'Scorer' }) },
    player: { findMany: async () => [] },
    scorerAssignment: { findMany: mocks.assignments },
    tournament: { count: async () => 0, findMany: async () => [] },
    playerMatchStats: { findMany: async () => [] },
    notification: { count: async () => 0 },
  },
}));
vi.mock('../src/middleware/auth', () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { id: 'scorer', email: 'test@example.com' };
    next();
  },
}));
vi.mock('../src/modules/fixtures/service', () => ({ toTeamRef: (team: unknown) => team }));
vi.mock('../src/modules/tournaments/serialize', () => ({ toTournamentDto: (t: unknown) => t }));
import { meRouter } from '../src/modules/me/routes';

let server: Server | undefined;
afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
});

it.each([
  [{ id: 'home', name: 'Home' }, { id: 'away', name: 'Away' }, 'home', 'away'],
  [null, { id: 'away', name: 'Away' }, 'away', undefined],
])(
  'shows the actual sides for a scorer who belongs to neither squad',
  async (team1, team2, firstId, secondId) => {
    mocks.assignments.mockResolvedValue([
      {
        matchId: 'match',
        match: {
          id: 'match',
          publicSlug: 'match',
          status: 'LIVE',
          scheduledAt: null,
          tournament: { id: 't', name: 'League', sport: 'CRICKET' },
          team1,
          team2,
        },
      },
    ]);
    const app = express();
    app.use('/me', meRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No server address');
    const response = await fetch(`http://127.0.0.1:${address.port}/me/dashboard`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.live[0].myTeam?.id).toBe(firstId);
    expect(body.live[0].opponent?.id).toBe(secondId);
    expect(body.live[0].isScorer).toBe(true);
    expect(body.live[0].isPlayer).toBe(false);
  },
);
