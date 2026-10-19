import { isNewerFootballSnapshot } from '@howzat/shared';
import { useLiveSnapshot } from '@/features/live/useLiveSnapshot';
export function useLiveFootball(slug: string) {
  return useLiveSnapshot(slug, 'football', isNewerFootballSnapshot);
}
