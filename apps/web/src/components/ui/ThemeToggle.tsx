import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

type Theme = 'light' | 'dark';

function storedTheme(): Theme {
  try {
    return localStorage.getItem('howzat-theme') === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function ThemeToggle({ tone = 'default' }: { tone?: 'default' | 'inverse' }) {
  const [theme, setTheme] = useState<Theme>(storedTheme);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('howzat-theme', theme);
    } catch {}
  }, [theme]);
  useEffect(() => {
    const update = (event: StorageEvent) => {
      if (event.key === 'howzat-theme') setTheme(storedTheme());
    };
    window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, []);
  return (
    <button
      type="button"
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      onClick={() => setTheme(next)}
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-[var(--radius-md)] transition-colors',
        tone === 'inverse'
          ? 'text-on-inverse hover:bg-white/10'
          : 'text-muted hover:bg-hover hover:text-primary',
      )}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        aria-hidden="true"
      >
        {theme === 'dark' ? (
          <path d="M20.9 13a9 9 0 0 1-9.9-9.9A9 9 0 1 0 20.9 13Z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
          </>
        )}
      </svg>
    </button>
  );
}
