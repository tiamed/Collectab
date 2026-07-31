import { useState, useCallback, useEffect } from 'react';
import {
  applyTheme,
  persistTheme,
  readThemeSync,
  isTheme,
  THEME_STORAGE_KEY,
  type Theme,
} from '@/lib/theme';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readThemeSync);

  // One-time migrate: chrome.storage → localStorage when sync cache is empty.
  useEffect(() => {
    try {
      if (localStorage.getItem(THEME_STORAGE_KEY)) return;
    } catch {
      return;
    }
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
    void chrome.storage.local.get(THEME_STORAGE_KEY).then((stored) => {
      const saved = stored[THEME_STORAGE_KEY];
      if (!isTheme(saved)) return;
      setThemeState(saved);
      applyTheme(saved);
      persistTheme(saved);
    });
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    persistTheme(t);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return { theme, setTheme, toggle };
}
