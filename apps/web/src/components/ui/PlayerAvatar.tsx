import { cn } from '@/lib/cn';

const avatars = [
  '/avatars/player-avatar-1.png',
  '/avatars/player-avatar-2.png',
  '/avatars/player-avatar-3.png',
  '/avatars/player-avatar-4.png',
] as const;

const rings = ['#3b6d48', '#b0793a', '#9b2a20', '#6b7d4a', '#8a5a14', '#4f5f6b'] as const;

function slotFor(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1)
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
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
        'avatar-ring shrink-0 rounded-full bg-sunken bg-cover bg-center bg-no-repeat',
        size === 'xs' && 'size-7',
        size === 'sm' && 'size-9',
        size === 'md' && 'size-12',
      )}
      style={{
        backgroundImage: `url('${avatars[slotFor(seed)]}')`,
        ['--ring' as string]: rings[Math.abs(slotFor(seed + name) * 7 + name.length) % rings.length],
      }}
    />
  );
}
