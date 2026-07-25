import { cn } from '@/lib/cn';

const avatars = [
  '/avatars/player-avatar-1.png',
  '/avatars/player-avatar-2.png',
  '/avatars/player-avatar-3.png',
  '/avatars/player-avatar-4.png',
] as const;

function slotFor(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) | 0;
  return Math.abs(hash) % avatars.length;
}

export function PlayerAvatar({
  seed,
  name,
  size = 'sm',
}: {
  seed: string;
  name: string;
  size?: 'xs' | 'sm' | 'md';
}) {
  return (
    <span
      role="img"
      aria-label={`${name} avatar`}
      className={cn(
        'shrink-0 rounded-full border border-line-strong bg-[#f5f0e8] bg-cover bg-center bg-no-repeat shadow-[inset_0_0_0_1px_rgba(255,255,255,.35)]',
        size === 'xs' && 'size-7',
        size === 'sm' && 'size-9',
        size === 'md' && 'size-12',
      )}
      style={{
        backgroundImage: `url('${avatars[slotFor(seed)]}')`,
      }}
    />
  );
}
