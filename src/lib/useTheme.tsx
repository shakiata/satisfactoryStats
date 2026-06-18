'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { DashboardTheme, DEFAULT_THEME, LIGHT_THEME } from './types';

const STORAGE_KEY = 'frm-theme';
const SETTINGS_KEY = 'frm-app-settings';

interface ThemeContextType {
  theme: DashboardTheme;
  updateTheme: (partial: Partial<DashboardTheme>) => void;
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: DEFAULT_THEME,
  updateTheme: () => {},
  resetTheme: () => {},
});

/** Applies DashboardTheme values as CSS custom properties on :root. */
function applyThemeCssVars(t: DashboardTheme) {
  const root = document.documentElement;
  root.style.setProperty('--bg-primary', t.bgPrimary);
  root.style.setProperty('--bg-secondary', t.bgSecondary);
  root.style.setProperty('--bg-card', t.bgCard);
  root.style.setProperty('--border-color', t.borderColor);
  root.style.setProperty('--text-primary', t.textPrimary);
  root.style.setProperty('--text-secondary', t.textSecondary);
  root.style.setProperty('--accent', t.accent);
  root.style.setProperty('--accent-hover', t.accentHover);
  root.style.setProperty('--success', t.success);
  root.style.setProperty('--danger', t.danger);
  root.style.setProperty('--info', t.info);
  root.style.setProperty('--muted', t.muted);
}

/**
 * Loads theme from localStorage, falling back to DEFAULT_THEME.
 * Also checks app settings for themeMode — if no custom theme is
 * saved but themeMode is 'light', returns LIGHT_THEME instead.
 */
function loadTheme(): DashboardTheme {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      return { ...DEFAULT_THEME, ...saved };
    }
  } catch { /* ignore parse errors */ }

  // No custom theme saved — check app settings for themeMode
  try {
    const settingsRaw = localStorage.getItem(SETTINGS_KEY);
    if (settingsRaw) {
      const settings = JSON.parse(settingsRaw);
      if (settings.themeMode === 'light') return LIGHT_THEME;
    }
  } catch { /* ignore */ }

  return DEFAULT_THEME;
}

/**
 * Context provider that holds the current theme, applies CSS
 * variables to :root on change, and persists to localStorage.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<DashboardTheme>(DEFAULT_THEME);
  const [mounted, setMounted] = useState(false);

  // Load saved theme on mount (avoid SSR mismatch)
  useEffect(() => {
    const saved = loadTheme();
    setTheme(saved);
    applyThemeCssVars(saved);
    setMounted(true);
  }, []);

  const updateTheme = useCallback((partial: Partial<DashboardTheme>) => {
    setTheme(prev => {
      const next = { ...prev, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      applyThemeCssVars(next);
      return next;
    });
  }, []);

  const resetTheme = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setTheme(DEFAULT_THEME);
    applyThemeCssVars(DEFAULT_THEME);
  }, []);

  // Don't render children until we've loaded the saved theme to avoid
  // a flash of default colors then switching to saved.
  if (!mounted) return null;

  return (
    <ThemeContext.Provider value={{ theme, updateTheme, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Returns the current theme object and the updateTheme + resetTheme callbacks. */
export function useTheme() {
  return useContext(ThemeContext);
}
