import type { NotificationDto } from '@howzat/shared';
import type { Notification } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { sendSquadAdditionEmail } from '../auth/mailer';

/**
 * Telling someone they are now in a squad.
 *
 * Two channels, one write path. The in-app notice is the durable one — it is a
 * row, it survives a bounced address, and it is what the bell reads. Email is
 * the nudge on top for the far more common case that the person is not sitting
 * in the app when the organizer builds the squad.
 *
 * Neither channel is allowed to fail the thing it is describing. The player is
 * already in the team by the time this runs; a mail provider having a bad
 * afternoon must not turn an organizer's paste of eleven names into a 500.
 */

export interface SquadAdditionTarget {
  userId: string;
  email: string;
  name: string;
}

export interface SquadAdditionContext {
  teamId: string;
  teamName: string;
  tournamentId: string;
  tournamentName: string;
  organizerName: string;
}

export async function notifySquadAdditions(
  targets: SquadAdditionTarget[],
  context: SquadAdditionContext,
): Promise<void> {
  if (targets.length === 0) return;

  const body =
    `${context.organizerName} added you to ${context.teamName} in ${context.tournamentName}. ` +
    `Your fixtures and live scores are on your dashboard.`;

  await prisma.notification.createMany({
    data: targets.map((target) => ({
      userId: target.userId,
      type: 'SQUAD_ADDED' as const,
      title: 'Hey, you have been added to this tournament!',
      body,
      link: '/dashboard',
      tournamentId: context.tournamentId,
      teamId: context.teamId,
    })),
  });

  // Detached on purpose: the organizer's request returns as soon as the squad
  // is written and the notices exist. Waiting on an SMTP round trip per player
  // would put a mail provider on the critical path of a database write.
  void Promise.allSettled(
    targets.map((target) =>
      sendSquadAdditionEmail({
        to: target.email,
        name: target.name,
        teamName: context.teamName,
        tournamentName: context.tournamentName,
        organizerName: context.organizerName,
        dashboardUrl: `${env.WEB_BASE_URL}/dashboard`,
      }),
    ),
  ).then((results) => {
    const failed = results.filter((result) => result.status === 'rejected').length;
    if (failed > 0) {
      logger.warn(
        { failed, total: targets.length, teamId: context.teamId },
        'Some squad notification emails did not send; the in-app notices are unaffected',
      );
    }
  });
}

export interface ScorerAssignmentContext {
  matchId: string;
  tournamentId: string;
  tournamentName: string;
  fixtureLabel: string;
  organizerName: string;
}

/** The other side of the same coin: you are not playing, you are scoring. */
export async function notifyScorerAssignment(
  userId: string,
  context: ScorerAssignmentContext,
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId,
      type: 'SCORER_ASSIGNED',
      title: 'You have been assigned to score a match',
      body: `${context.organizerName} assigned you to score ${context.fixtureLabel} in ${context.tournamentName}.`,
      link: `/score/${context.matchId}`,
      tournamentId: context.tournamentId,
      matchId: context.matchId,
    },
  });
}

export function toNotificationDto(row: Notification): NotificationDto {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
