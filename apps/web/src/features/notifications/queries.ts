import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationFeedDto } from '@howzat/shared';
import { api } from '@/lib/api';

const POLL_MS = 60_000;

export const notificationKeys = {
  feed: ['notifications'] as const,
};

export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.feed,
    queryFn: () => api.get<NotificationFeedDto>('/notifications'),
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.post<void>(`/notifications/${id}/read`),
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
