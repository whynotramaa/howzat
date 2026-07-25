import { Router } from 'express';
import { z } from 'zod';
import type { NotificationFeedDto } from '@howzat/shared';
import { prisma } from '../../lib/prisma';
import { asyncHandler, parseQuery, requireParam } from '../../lib/http';
import { notFound } from '../../lib/errors';
import { requireAuth } from '../../middleware/auth';
import { toNotificationDto } from './service';

/**
 * The bell.
 *
 * Every route here is scoped to `req.user.id` in the where clause rather than
 * loaded-then-checked. There is no such thing as reading someone else's notice
 * and then being refused: the query cannot see it in the first place.
 */
export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

const FEED_LIMIT = 30;

const feedSchema = z.object({
  unreadOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { unreadOnly } = parseQuery(feedSchema, req.query);
    const userId = req.user!.id;

    const [rows, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
        orderBy: { createdAt: 'desc' },
        take: FEED_LIMIT,
      }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    const feed: NotificationFeedDto = { items: rows.map(toNotificationDto), unread };
    res.json(feed);
  }),
);

notificationsRouter.post(
  '/:notificationId/read',
  asyncHandler(async (req, res) => {
    const notificationId = requireParam(req, 'notificationId');

    // updateMany, not update: a composite where lets ownership and the update
    // be one statement, and a miss is a 404 rather than a leaked existence.
    const { count } = await prisma.notification.updateMany({
      where: { id: notificationId, userId: req.user!.id, readAt: null },
      data: { readAt: new Date() },
    });

    if (count === 0) {
      const exists = await prisma.notification.findFirst({
        where: { id: notificationId, userId: req.user!.id },
        select: { id: true },
      });
      if (!exists) throw notFound('Notification');
    }

    res.status(204).end();
  }),
);

notificationsRouter.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    const { count } = await prisma.notification.updateMany({
      where: { userId: req.user!.id, readAt: null },
      data: { readAt: new Date() },
    });

    res.json({ marked: count });
  }),
);
