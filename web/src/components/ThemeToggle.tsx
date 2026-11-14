import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon.tsx';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'mm-theme';
const SYSTEM_DARK = '(prefers-color-scheme: dark)';

function readSaved(): Theme | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return window.matchMedia(SYSTEM_DARK).matches ? 'dark' : 'light';
}

/** The theme index.html applied, or the system's if that script did not run. */
function currentTheme(): Theme {
  const applied = document.documentElement.dataset.theme;
  return applied === 'dark' || applied === 'light' ? applied : systemTheme();
}

/** Light and dark switch. index.html sets data-theme before first paint; this keeps it in step and saves the choice. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  // Remembers a choice made this visit even when storage is blocked, so system changes never override it.
  const chosen = useRef(readSaved() !== null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Until the user picks a theme, follow the system setting as it changes.
  useEffect(() => {
    const media = window.matchMedia(SYSTEM_DARK);
    const onChange = () => {
      if (!chosen.current) setTheme(media.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  const toggle = () => {
    chosen.current = true;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing can block storage; the switch still works for this visit.
    }
    setTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 sm:size-11 text-muted ring-1 ring-line transition-colors hover:text-ink"
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
    </button>
  );
}
