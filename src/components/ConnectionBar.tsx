'use client';

import { useState } from 'react';
import { FRMConfig } from '@/lib/types';
import { useTheme } from '@/lib/useTheme';
import { testConnection } from '@/lib/api';

interface ConnectionBarProps {
  config: FRMConfig;
  onConfigChange: (config: FRMConfig) => void;
  onConnect: () => void;
  connected: boolean;
  connecting: boolean;
  error: string | null;
}

export function ConnectionBar({ config, onConfigChange, onConnect, connected, connecting, error }: ConnectionBarProps) {
  const { theme } = useTheme();
  return (
    <div className="p-4" style={{ backgroundColor: theme.bgSecondary, borderBottom: `1px solid ${theme.borderColor}` }}>
      <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 border" style={{ backgroundColor: theme.bgPrimary, borderColor: theme.borderColor }}>
            <svg className="w-5 h-5" style={{ color: theme.accent }} fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
            <span className="text-sm font-semibold" style={{ color: theme.textSecondary }}>FRM</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium uppercase tracking-wider" style={{ color: theme.textSecondary }}>Host</label>
          <input
            type="text"
            value={config.host}
            onChange={(e) => onConfigChange({ ...config, host: e.target.value })}
            placeholder="localhost"
            className="rounded-lg px-3 py-2 text-sm w-40 focus:outline-none transition-colors"
            style={{ backgroundColor: theme.bgPrimary, border: `1px solid ${theme.borderColor}`, color: theme.textPrimary }}
            onFocus={(e) => (e.target.style.borderColor = theme.accent)}
            onBlur={(e) => (e.target.style.borderColor = theme.borderColor)}
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium uppercase tracking-wider" style={{ color: theme.textSecondary }}>Port</label>
          <input
            type="text"
            value={config.port}
            onChange={(e) => onConfigChange({ ...config, port: e.target.value })}
            placeholder="8080"
            className="rounded-lg px-3 py-2 text-sm w-24 focus:outline-none transition-colors"
            style={{ backgroundColor: theme.bgPrimary, border: `1px solid ${theme.borderColor}`, color: theme.textPrimary }}
            onFocus={(e) => (e.target.style.borderColor = theme.accent)}
            onBlur={(e) => (e.target.style.borderColor = theme.borderColor)}
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium uppercase tracking-wider" style={{ color: theme.textSecondary }}>Auth Token</label>
          <input
            type="password"
            value={config.password || ''}
            onChange={(e) => onConfigChange({ ...config, password: e.target.value })}
            placeholder="From WebServer.cfg"
            className="rounded-lg px-3 py-2 text-sm w-36 focus:outline-none transition-colors"
            style={{ backgroundColor: theme.bgPrimary, border: `1px solid ${theme.borderColor}`, color: theme.textPrimary }}
            onFocus={(e) => (e.target.style.borderColor = theme.accent)}
            onBlur={(e) => (e.target.style.borderColor = theme.borderColor)}
          />
        </div>

        <button
          onClick={onConnect}
          disabled={connecting}
          className="px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          style={{
            backgroundColor: connected ? theme.success + '20' : theme.accent,
            color: connected ? theme.success : 'black',
            border: connected ? `1px solid ${theme.success}40` : 'none',
          }}
          onMouseEnter={(e) => {
            if (!connected && !connecting) e.currentTarget.style.backgroundColor = theme.accentHover;
          }}
          onMouseLeave={(e) => {
            if (!connected && !connecting) e.currentTarget.style.backgroundColor = theme.accent;
          }}
        >
          {connecting ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Connecting...
            </span>
          ) : connected ? (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              Connected
            </span>
          ) : (
            'Connect'
          )}
        </button>

        {error && (
          <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border" style={{ color: theme.danger, backgroundColor: theme.danger + '18', borderColor: theme.danger + '33' }}>
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
