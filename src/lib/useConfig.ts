'use client';

import { useState, useEffect, useCallback } from 'react';
import { FRMConfig } from './types';

const STORAGE_KEY = 'frm-config';

export const defaultConfig: FRMConfig = {
  host: 'localhost',
  port: '8080',
  password: '',
  refreshRate: 5000,
};

/**
 * Hook that persists FRM connection config (host, port, auth token)
 * to localStorage and provides setter + persistence callbacks.
 */
export function useConfig() {
  const [config, setConfig] = useState<FRMConfig>(defaultConfig);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setConfig({ ...defaultConfig, ...JSON.parse(stored) });
      }
    } catch {
      // ignore
    }
    setLoaded(true);
  }, []);

  const saveConfig = useCallback((newConfig: FRMConfig) => {
    setConfig(newConfig);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
  }, []);

  return { config, saveConfig, loaded };
}
