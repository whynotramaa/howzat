import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationFeedDto } from '@howzat/shared';
import { api } from '@/lib/api';

/**
 * The bell polls rather than subscribing.
 *
 * The socket exists for one thing — a live match, where a delta a second late is
 * a wrong score. Being told you joined a squad is not that: a minute is fine,
 * and a per-user socket room would be a second realtime surface to keep correct
 * for no gain the recipient can perceive.
 */
const POLL_MS = 60_000;

export const notificationKeys = {
  feed: ['notifications'] as const,
};

export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.feed,
    queryFn: () => api.get<NotificationFeedDto>('/notifications'),
    refetchInterval: POLL_MS,
    // Coming back to the tab is exactly when someone wants the current count.
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.post<void>(`/notifications/${id}/read`),
    // Optimistic: the user has just clicked the thing. Waiting for a round trip
    // to dim it makes the click feel like it missed.
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.feed });
      const previous = queryClient.getQueryData<NotificationFeedDto>(notificationKeys.feed);

      if (previous) {
        queryClient.setQueryData<NotificationFeedDto>(notificationKeys.feed, {
          unread: Math.max(0, previous.unread - 1),
          items: previous.items.map((item) =>
            item.id === id && !item.readAt ? { ...item, readAt: new Date().toISOString() } : item,
          ),
        });
      }

      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(notificationKeys.feed, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.feed });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<{ marked: number }>('/notifications/read-all'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.feed });
    },
  });
}
