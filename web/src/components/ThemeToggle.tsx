import { useEffect, useState } from 'react';
import { Icon } from './Icon.tsx';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'mm-theme';

/** The theme index.html applied before first paint; light unless the visitor chose dark. */
function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** Light and dark switch. Light is the default; a choice of dark is saved and kept across visits. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

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
      className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-muted ring-1 ring-line transition-colors hover:text-ink sm:size-11"
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
    </button>
  );
}
