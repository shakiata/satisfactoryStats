'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppSettings, DEFAULT_SETTINGS } from './types';

const STORAGE_KEY = 'frm-app-settings';

/**
 * Hook that persists user app settings (icon size, map scale,
 * active tab, time window) to localStorage.
 */
export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      }
    } catch {
      // ignore
    }
    setLoaded(true);
  }, []);

  const saveSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return { settings, saveSettings, resetSettings, loaded };
}