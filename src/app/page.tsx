'use client';

import { useState } from 'react';
import { ConnectionBar } from '@/components/ConnectionBar';
import { EndpointList } from '@/components/EndpointList';
import { PowerDashboard } from '@/components/dashboard/PowerDashboard';
import { ProductionMonitor } from '@/components/dashboard/ProductionMonitor';
import { FactoryEfficiency } from '@/components/dashboard/FactoryEfficiency';
import { ResourceTracker } from '@/components/dashboard/ResourceTracker';
import { GeneratorStatus } from '@/components/dashboard/GeneratorStatus';
import { PlayerMap } from '@/components/dashboard/PlayerMap';
import { FactoryMap } from '@/components/dashboard/FactoryMap';
import { ChatPanel } from '@/components/dashboard/ChatPanel';
import { SettingsPanel } from '@/components/dashboard/SettingsPanel';
import { useConfig } from '@/lib/useConfig';
import { ThemeProvider, useTheme } from '@/lib/useTheme';
import { testConnection, getEndpoints, getEndpointsByCategory } from '@/lib/api';
import { TimeWindowSelector, type TimeWindowMs } from '@/components/TimeWindowSelector';

const TABS = [
  { id: 'power', label: '⚡ Power', icon: '⚡' },
  { id: 'production', label: '📊 Production', icon: '📊' },
  { id: 'factory', label: '🏭 Factory', icon: '🏭' },
  { id: 'resources', label: '⛏️ Resources', icon: '⛏️' },
  { id: 'generators', label: '🔥 Generators', icon: '🔥' },
  { id: 'map', label: '🗺️ Map', icon: '🗺️' },
  { id: 'players', label: '👤 Players', icon: '👤' },
  { id: 'chat', label: '💬 Chat', icon: '💬' },
  { id: 'settings', label: '🎨 Settings', icon: '🎨' },
  { id: 'api', label: '🔧 API Explorer', icon: '🔧' },
] as const;

type TabId = typeof TABS[number]['id'];

export default function Home() {
  const { config, saveConfig, loaded } = useConfig();
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('power');
  const [timeWindow, setTimeWindow] = useState<TimeWindowMs>(0);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    const result = await testConnection(config);
    setConnecting(false);
    if (result.ok) {
      setConnected(true);
    } else {
      setConnected(false);
      setError(result.error || 'Connection failed');
    }
  };

  const handleConfigChange = (newConfig: typeof config) => {
    saveConfig(newConfig);
    setConnected(false);
    setError(null);
  };

  const endpoints = getEndpoints();
  const categories = getEndpointsByCategory();

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider>
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Title Bar */}
      <div className="px-6 py-3 flex items-center gap-3" style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))' }}>
          <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Statusfactory</h1>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Ficsit Remote Monitoring</p>
        </div>
        {connected && (
          <div className="ml-auto flex items-center gap-2 px-3 py-1 rounded-full border" style={{ backgroundColor: 'color-mix(in srgb, var(--success) 15%, transparent)', borderColor: 'color-mix(in srgb, var(--success) 30%, transparent)' }}>
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--success)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--success)' }}>Live</span>
          </div>
        )}
      </div>

      {/* Connection Bar */}
      <ConnectionBar
        config={config}
        onConfigChange={handleConfigChange}
        onConnect={handleConnect}
        connected={connected}
        connecting={connecting}
        error={error}
      />

      {/* Main Content */}
      {!connected && !connecting && !error && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <svg className="w-10 h-10" style={{ color: 'var(--accent)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Connect to Your Factory</h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Enter your Satisfactory server&apos;s address and port where the{' '}
              <strong>Ficsit Remote Monitoring</strong> mod is running.
              The default port is <code className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--accent)' }}>8080</code>.
            </p>
            <div className="mt-6 p-4 rounded-xl text-left" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>In-Game Setup</p>
              <ol className="text-xs space-y-1.5 list-decimal list-inside" style={{ color: 'var(--text-primary)' }}>
                <li>Install the <strong>Ficsit Remote Monitoring</strong> mod</li>
                <li>In-game, open chat and type <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--accent)' }}>/frm http start</code></li>
                <li>Find the token in <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--accent)' }}>Configs/FicsitRemoteMonitoring/WebServer.cfg</code></li>
                <li>Enter the IP, port, and token above and click Connect</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard Tabs */}
      {connected && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab Bar */}
          <div className="px-4 flex gap-1 overflow-x-auto items-center" style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-all"
                style={{
                  borderColor: activeTab === tab.id ? 'var(--accent)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== tab.id) {
                    e.currentTarget.style.color = 'var(--text-primary)';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab.id) {
                    e.currentTarget.style.color = 'var(--text-secondary)';
                    e.currentTarget.style.borderColor = 'transparent';
                  }
                }}
              >
                {tab.label}
              </button>
            ))}
            <div className="ml-auto pr-2">
              <TimeWindowSelector value={timeWindow} onChange={setTimeWindow} />
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-auto p-6">
            {activeTab === 'power' && <PowerDashboard config={config} timeWindow={timeWindow} />}
            {activeTab === 'production' && <ProductionMonitor config={config} timeWindow={timeWindow} />}
            {activeTab === 'factory' && <FactoryEfficiency config={config} timeWindow={timeWindow} />}
            {activeTab === 'resources' && <ResourceTracker config={config} timeWindow={timeWindow} />}
            {activeTab === 'generators' && <GeneratorStatus config={config} timeWindow={timeWindow} />}
            {activeTab === 'map' && <FactoryMap config={config} />}
            {activeTab === 'players' && <PlayerMap config={config} />}
            {activeTab === 'chat' && <ChatPanel config={config} />}
            {activeTab === 'settings' && <SettingsPanel config={config} saveConfig={saveConfig} />}
            {activeTab === 'api' && (
              <EndpointList
                config={config}
                endpoints={endpoints}
                categories={categories}
              />
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-2 text-center text-xs" style={{ backgroundColor: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', color: 'var(--muted)' }}>
        Statusfactory v1.0.0 — Powered by Ficsit Remote Monitoring
      </div>
    </div>
    </ThemeProvider>
  );
}
