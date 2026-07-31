const STORAGE_KEY = 'theme';

export type Theme = 'light' | 'dark';

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

/** Sync read for React initial state (mirrors boot script). */
export function readThemeSync(): Theme {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (isTheme(cached)) return cached;
  } catch {
    // ignore
  }
  const attr = document.documentElement.getAttribute('data-theme');
  if (isTheme(attr)) return attr;
  return 'dark';
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
  } else {
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
  }
}

export function persistTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore
  }
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    void chrome.storage.local.set({ [STORAGE_KEY]: theme });
  }
}

export { STORAGE_KEY as THEME_STORAGE_KEY };
