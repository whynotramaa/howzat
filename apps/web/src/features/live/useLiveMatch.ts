import { isNewerSnapshot } from '@howzat/shared';
import { useLiveSnapshot } from './useLiveSnapshot';
export type { ConnectionState } from './useLiveSnapshot';
export function useLiveMatch(slug: string) {
  return useLiveSnapshot(slug, 'snapshot', isNewerSnapshot);
}
