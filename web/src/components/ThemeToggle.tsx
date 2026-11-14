import { useEffect, useState } from 'react';
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

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** Light and dark switch. index.html sets data-theme before first paint; this keeps it in step and saves the choice. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Until the user picks a theme, follow the system setting as it changes.
  useEffect(() => {
    const media = window.matchMedia(SYSTEM_DARK);
    const onChange = () => {
      if (!readSaved()) setTheme(media.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  const toggle = () => {
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
      className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-muted ring-1 ring-line transition-colors hover:text-ink"
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
    </button>
  );
}
