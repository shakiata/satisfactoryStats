'use client';

import { useState, useCallback, useEffect } from 'react';
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

/**
 * Top-of-page connection bar for entering FRM server details and
 * managing the connection state. Shows host, port, and auth token
 * inputs. When running inside Electron, also provides ngrok tunnel
 * start/stop controls with copy-to-clipboard for sharing the URL.
 */
export function ConnectionBar({ config, onConfigChange, onConnect, connected, connecting, error }: ConnectionBarProps) {
  const { theme } = useTheme();
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  // ─── ngrok tunnel state (Electron only) ───
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null);
  const [tunnelLoading, setTunnelLoading] = useState(false);
  const [tunnelError, setTunnelError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Check for existing tunnel on mount
  useEffect(() => {
    if (isElectron && window.electronAPI) {
      window.electronAPI.tunnelStatus().then((s) => {
        if (s.active && s.url) setTunnelUrl(s.url);
      });
    }
  }, [isElectron]);

  const startTunnel = useCallback(async () => {
    if (!window.electronAPI) return;
    setTunnelLoading(true);
    setTunnelError(null);
    const host = config.host || 'localhost';
    const port = config.port || '8080';
    console.log('[tunnel] startTunnel called', { host, port });
    const result = await window.electronAPI.tunnelStart(host, port, undefined);
    console.log('[tunnel] result', result);
    setTunnelLoading(false);
    if (result.ok && result.url) {
      setTunnelUrl(result.url);
    } else {
      setTunnelError(result.error || 'Failed to start tunnel');
    }
  }, [config.host, config.port]);

  const stopTunnel = useCallback(async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.tunnelStop();
    setTunnelUrl(null);
  }, []);

  const copyUrl = useCallback(() => {
    if (tunnelUrl) {
      navigator.clipboard.writeText(tunnelUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [tunnelUrl]);

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
            className="rounded-lg px-3 py-2 text-sm w-40 focus:outline-none transition-colors conn-input"
            style={{ backgroundColor: theme.bgPrimary, borderColor: theme.borderColor, color: theme.textPrimary, borderWidth: '1px', borderStyle: 'solid' }}
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium uppercase tracking-wider" style={{ color: theme.textSecondary }}>Port</label>
          <input
            type="text"
            value={config.port}
            onChange={(e) => onConfigChange({ ...config, port: e.target.value })}
            placeholder="8080"
            className="rounded-lg px-3 py-2 text-sm w-24 focus:outline-none transition-colors conn-input"
            style={{ backgroundColor: theme.bgPrimary, borderColor: theme.borderColor, color: theme.textPrimary, borderWidth: '1px', borderStyle: 'solid' }}
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium uppercase tracking-wider" style={{ color: theme.textSecondary }}>Auth Token</label>
          <input
            type="password"
            value={config.password || ''}
            onChange={(e) => onConfigChange({ ...config, password: e.target.value })}
            placeholder="From WebServer.cfg"
            className="rounded-lg px-3 py-2 text-sm w-36 focus:outline-none transition-colors conn-input"
            style={{ backgroundColor: theme.bgPrimary, borderColor: theme.borderColor, color: theme.textPrimary, borderWidth: '1px', borderStyle: 'solid' }}
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

        {/* ─── ngrok Tunnel ─── */}
          <div className="flex items-center gap-2 ml-auto">
            <div className="h-6 w-px" style={{ backgroundColor: theme.borderColor }} />

            {tunnelUrl ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ backgroundColor: theme.success + '15', border: `1px solid ${theme.success}30` }}>
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: theme.success }} />
                  <span className="text-xs font-mono truncate max-w-[260px]" style={{ color: theme.success }}>
                    {tunnelUrl.replace('https://', '')}
                  </span>
                </div>
                <button
                  onClick={copyUrl}
                  className="px-2 py-1.5 rounded text-xs font-medium transition-colors"
                  style={{ color: theme.accent, border: `1px solid ${theme.borderColor}` }}
                  title="Copy URL"
                >
                  {copied ? '✓ Copied!' : '📋'}
                </button>
                <button
                  onClick={stopTunnel}
                  className="px-2 py-1.5 rounded text-xs font-medium transition-colors"
                  style={{ color: theme.danger, border: `1px solid ${theme.borderColor}` }}
                  title="Stop tunnel"
                >
                  ⏹
                </button>
              </div>
            ) : (
              <button
                onClick={startTunnel}
                disabled={tunnelLoading || !isElectron}
                title={isElectron ? undefined : 'Run in Electron desktop app to share'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                style={{ backgroundColor: theme.accent + '18', color: theme.accent, border: `1px solid ${theme.accent}30` }}
              >
                {tunnelLoading ? (
                  <>
                    <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Starting…
                  </>
                ) : (
                  <>🌐 Share</>
                )}
              </button>
            )}
            {tunnelError && (
              <span className="text-xs" style={{ color: theme.danger }}>{tunnelError}</span>
            )}
          </div>
      </div>
    </div>
  );
}
