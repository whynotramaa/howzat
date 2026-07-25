/** Minimal class joiner — no dependency needed for what clsx does here. */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}
