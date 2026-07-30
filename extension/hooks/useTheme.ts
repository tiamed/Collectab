import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'theme';
type Theme = 'light' | 'dark';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEY).then((stored) => {
      const saved = stored[STORAGE_KEY] as Theme | undefined;
      if (saved) {
        setThemeState(saved);
        applyTheme(saved);
      }
    });
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    chrome.storage.local.set({ [STORAGE_KEY]: t });
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return { theme, setTheme, toggle };
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
  } else {
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
  }
}
