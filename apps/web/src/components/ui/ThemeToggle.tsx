import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

type Theme = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'howzat-theme';

const OPTIONS: ReadonlyArray<{ value: Theme; label: string; glyph: string }> = [
  { value: 'system', label: 'System', glyph: '◐' },
  { value: 'light', label: 'Light', glyph: '☀' },
  { value: 'dark', label: 'Dark', glyph: '☾' },
];

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

/**
 * A three-way segmented control rather than a cycling button.
 *
 * Cycling hides the current state behind a guess — you press it and find out. All
 * three options visible means the choice is legible before you make it, and
 * "System" is a real, selectable position rather than an implied default.
 *
 * Choosing "System" removes the attribute entirely so the prefers-color-scheme
 * query in tokens.css takes back over, which is what makes the OS toggle
 * live-update the page.
 */
export function ThemeToggle({ tone = 'default' }: { tone?: 'default' | 'inverse' }) {
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme());

  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'system') {
      root.removeAttribute('data-theme');
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* private mode */
      }
    } else {
      root.setAttribute('data-theme', theme);
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        /* private mode */
      }
    }
  }, [theme]);

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full border p-0.5',
        tone === 'inverse'
          ? 'border-[var(--line-inverse)] bg-transparent'
          : 'border-line bg-raised',
      )}
    >
      {OPTIONS.map((option) => {
        const active = theme === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            title={option.label}
            onClick={() => setTheme(option.value)}
            className={cn(
              'grid size-7 place-items-center rounded-full text-[0.8125rem] leading-none',
              'transition-colors duration-[var(--dur-fast)]',
              active
                ? 'bg-accent-soft text-accent'
                : 'text-muted hover:bg-hover hover:text-secondary',
            )}
          >
            <span aria-hidden>{option.glyph}</span>
          </button>
        );
      })}
    </div>
  );
}
