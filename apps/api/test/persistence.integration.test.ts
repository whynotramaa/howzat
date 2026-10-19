import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BallRequestInput } from '@howzat/shared';
import type * as PrismaModule from '../src/lib/prisma';
import type * as RedisModule from '../src/lib/redis';
import type * as ScoringModule from '../src/modules/scoring/service';
import type * as LifecycleModule from '../src/modules/matches/lifecycle';
import type * as SnapshotModule from '../src/modules/snapshot';

describe.skipIf(process.env.HOWZAT_INTEGRATION !== '1')('PostgreSQL and Redis persistence', () => {
  let prisma: typeof PrismaModule.prisma;
  let redis: typeof RedisModule.redis;
  let scoring: typeof ScoringModule;
  let lifecycle: typeof LifecycleModule;
  let snapshots: typeof SnapshotModule;
  let userId: string, tournamentId: string, matchId: string, firstInnings: string;
  let batters: string[], bowlers: string[];
  const ball = (id: string, runs = 0, chasing = false): BallRequestInput => ({
    clientEventId: id,
    strikerId: (chasing ? bowlers : batters)[0]!,
    nonStrikerId: (chasing ? bowlers : batters)[1]!,
    bowlerId: (chasing ? batters : bowlers)[0]!,
    runsOffBat: runs,
    extraRuns: 0,
    extraType: null,
    isWicket: false,
    wicketType: null,
    dismissedPlayerId: null,
    fielderId: null,
  });
  beforeAll(async () => {
    ({ prisma } = await import('../src/lib/prisma'));
    ({ redis } = await import('../src/lib/redis'));
    scoring = await import('../src/modules/scoring/service');
    lifecycle = await import('../src/modules/matches/lifecycle');
    snapshots = await import('../src/modules/snapshot');
    const suffix = randomUUID();
    const user = await prisma.user.create({
      data: {
        email: `${suffix}@test.invalid`,
        username: `test_${suffix.replaceAll('-', '').slice(0, 12)}`,
        name: 'Integration scorer',
        passwordHash: 'unused',
        emailVerifiedAt: new Date(),
      },
    });
    userId = user.id;
    const tournament = await prisma.tournament.create({
      data: {
        organizerId: userId,
        name: 'Persistence test',
        teamsCount: 2,
        oversPerInnings: 1,
        teams: {
          create: ['Home', 'Away'].map((name) => ({
            name,
            shortName: name.slice(0, 3),
            players: {
              create: Array.from({ length: 11 }, (_, i) => ({
                name: `${name} ${i}`,
                username: `guest_${i}`,
              })),
            },
          })),
        },
      },
      include: { teams: { include: { players: true } } },
    });
    tournamentId = tournament.id;
    const home = tournament.teams[0]!,
      away = tournament.teams[1]!;
    batters = home.players.map((p) => p.id);
    bowlers = away.players.map((p) => p.id);
    const match = await prisma.match.create({
      data: {
        tournamentId,
        round: 1,
        team1Id: home.id,
        team2Id: away.id,
        oversPerInnings: 1,
        publicSlug: randomUUID(),
      },
    });
    matchId = match.id;
    await lifecycle.recordToss(matchId, { tossWinnerId: home.id, decision: 'BAT' });
    await lifecycle.setPlayingXi(matchId, {
      teams: [home, away].map((team) => ({
        teamId: team.id,
        players: team.players.map((player, i) => ({
          playerId: player.id,
          battingOrder: i + 1,
          isCaptain: i === 0,
          isKeeper: i === 1,
        })),
      })),
    });
    firstInnings = (await lifecycle.openFirstInnings(matchId)).id;
  });
  afterAll(async () => {
    if (prisma && tournamentId) await prisma.match.deleteMany({ where: { tournamentId } });
    if (prisma && tournamentId) await prisma.tournament.delete({ where: { id: tournamentId } });
    if (prisma && userId) await prisma.user.delete({ where: { id: userId } });
    if (redis && matchId) await redis.del(snapshots.snapshotKey(matchId));
    if (prisma) await prisma.$disconnect();
    if (redis) await redis.quit();
  });
  it('serializes simultaneous distinct submissions without losing either event', async () => {
    const results = await Promise.all([
      scoring.recordBall(matchId, ball(randomUUID()), userId),
      scoring.recordBall(matchId, ball(randomUUID()), userId),
    ]);
    expect(results.every((r) => !r.duplicate)).toBe(true);
    expect(await prisma.ballEvent.count({ where: { matchId } })).toBe(2);
    expect((await snapshots.rebuildState(firstInnings)).state.legalBalls).toBe(2);
  });
  it('rolls back all match writes and deferred cache work on failure', async () => {
    const { withLock, matchLockKey } = await import('../src/lib/lock');
    const before = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
    const event = await prisma.ballEvent.findFirstOrThrow({ where: { matchId } });
    await expect(
      withLock(matchLockKey(matchId), async () => {
        const { id: _id, createdAt: _createdAt, ...data } = event;
        await prisma.ballEvent.create({ data: { ...data, clientEventId: randomUUID(), seq: 3 } });
        await snapshots.writeSnapshot({
          ...(await snapshots.getSnapshot(matchId)!),
          revision: 999,
        } as never);
        throw new Error('simulated interruption');
      }),
    ).rejects.toThrow('simulated interruption');
    expect(await prisma.ballEvent.count({ where: { matchId } })).toBe(2);
    expect((await prisma.match.findUniqueOrThrow({ where: { id: matchId } })).revision).toBe(
      before.revision,
    );
    expect((await snapshots.readCachedSnapshot(matchId))?.revision).not.toBe(999);
  });
  it('atomically closes the first innings and creates the chase', async () => {
    for (let i = 0; i < 4; i++) await scoring.recordBall(matchId, ball(randomUUID()), userId);
    const match = await prisma.match.findUniqueOrThrow({
      where: { id: matchId },
      include: { innings: true },
    });
    expect(match.status).toBe('INNINGS_BREAK');
    expect(match.innings).toHaveLength(2);
    expect(match.innings.find((i) => i.number === 2)?.targetRuns).toBe(1);
  });
  it('publishes the first chase score despite the lower event sequence and acknowledges its final-ball retry', async () => {
    await import('../src/modules/matches/state');
    const { withLock, matchLockKey } = await import('../src/lib/lock');
    await withLock(matchLockKey(matchId), async () => {
      await prisma.match.update({ where: { id: matchId }, data: { status: 'LIVE' } });
    });
    const input = ball(randomUUID(), 1, true);
    const result = await scoring.recordBall(matchId, input, userId);
    expect(result.matchCompleted).toBe(true);
    const current = await snapshots.getSnapshot(matchId);
    expect(current?.inningsNumber).toBe(2);
    expect(current?.batting.runs).toBe(1);
    expect(current?.status).toBe('COMPLETED');
    expect((await scoring.recordBall(matchId, input, userId)).duplicate).toBe(true);
    expect(await prisma.ballEvent.count({ where: { matchId } })).toBe(7);
  });
  it('rejects stale cache writes atomically and repairs a stale cache on read', async () => {
    const current = (await snapshots.getSnapshot(matchId))!;
    await snapshots.writeSnapshot({ ...current, revision: 0, lastEventSeq: 999 });
    expect((await snapshots.readCachedSnapshot(matchId))?.revision).toBe(current.revision);
    await redis.set(
      snapshots.snapshotKey(matchId),
      JSON.stringify({ ...current, revision: 0, status: 'LIVE' }),
    );
    expect((await snapshots.getSnapshot(matchId))?.status).toBe('COMPLETED');
  });
  it('retries persisted projection work and clears the flag only after success', async () => {
    const { reconcileTournament } = await import('../src/modules/standings/reconcile');
    await reconcileTournament(tournamentId);
    expect(
      (await prisma.match.findUniqueOrThrow({ where: { id: matchId } })).projectionPending,
    ).toBe(false);
    expect(await prisma.playerMatchStats.count({ where: { matchId } })).toBe(22);
    expect(
      (await prisma.pointsTable.findMany({ where: { tournamentId } })).map((row) => row.played),
    ).toEqual([1, 1]);
  });
  it('allows only one concurrent rotation of a refresh token', async () => {
    const { issueRefreshToken, rotateRefreshToken } = await import('../src/modules/auth/tokens');
    const token = await issueRefreshToken(userId);
    const outcomes = await Promise.allSettled([
      rotateRefreshToken(token),
      rotateRefreshToken(token),
    ]);
    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.refreshToken.count({ where: { userId, revokedAt: null } })).toBe(1);
  });
  it('consumes a verification code only once and enforces concurrent attempt limits', async () => {
    const { issueOtp, verifyOtp } = await import('../src/modules/auth/otp');
    const email = `${userId}@test.invalid`,
      code = await issueOtp(email);
    const valid = await Promise.allSettled([verifyOtp(email, code), verifyOtp(email, code)]);
    expect(valid.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
    await issueOtp(email);
    await Promise.allSettled(Array.from({ length: 12 }, () => verifyOtp(email, 'not-a-code')));
    const row = await prisma.otpCode.findFirstOrThrow({ where: { email, consumedAt: null } });
    expect(row.attempts).toBe(5);
    await prisma.otpCode.deleteMany({ where: { email } });
  });
});
