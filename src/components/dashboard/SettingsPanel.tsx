'use client';

import { useTheme } from '@/lib/useTheme';
import { useAppSettings } from '@/lib/useAppSettings';
import { DashboardTheme, DEFAULT_THEME, DEFAULT_SETTINGS, FRMConfig } from '@/lib/types';
import { defaultConfig } from '@/lib/useConfig';

interface ColorRowProps {
  label: string;
  cssVar: string;
  value: string;
  onChange: (val: string) => void;
}

function ColorRow({ label, cssVar, value, onChange }: ColorRowProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <div
          className="w-6 h-6 rounded-md border border-[#2a2a2e] shrink-0"
          style={{ backgroundColor: value }}
        />
        <div>
          <p className="text-sm text-[#f0f0f0]">{label}</p>
          <p className="text-xs text-[#a0a0a0] font-mono">{cssVar}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded-md border border-[#2a2a2e] cursor-pointer bg-transparent p-0
            [&::-webkit-color-swatch-wrapper]:p-0
            [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-20 bg-[#0a0a0a] border border-[#2a2a2e] rounded-md px-2 py-1 text-xs font-mono text-[#f0f0f0]
            focus:outline-none focus:border-[#e6a720] text-center"
        />
      </div>
    </div>
  );
}

const SECTION_LABELS: Record<string, { label: string; keys: (keyof DashboardTheme)[] }> = {
  backgrounds: {
    label: 'Backgrounds',
    keys: ['bgPrimary', 'bgSecondary', 'bgCard'],
  },
  text: {
    label: 'Text',
    keys: ['textPrimary', 'textSecondary', 'muted'],
  },
  accents: {
    label: 'Accent Colors',
    keys: ['accent', 'accentHover'],
  },
  status: {
    label: 'Status Colors',
    keys: ['success', 'danger', 'info'],
  },
  border: {
    label: 'Borders',
    keys: ['borderColor'],
  },
};

const LABELS: Record<keyof DashboardTheme, string> = {
  bgPrimary: 'Primary Background',
  bgSecondary: 'Secondary Background',
  bgCard: 'Card Background',
  borderColor: 'Border Color',
  textPrimary: 'Primary Text',
  textSecondary: 'Secondary Text',
  accent: 'Accent / Orange',
  accentHover: 'Accent Hover',
  success: 'Success / Green',
  danger: 'Danger / Red',
  info: 'Info / Blue',
  muted: 'Muted / Footer',
};

const CSS_VARS: Record<keyof DashboardTheme, string> = {
  bgPrimary: '--bg-primary',
  bgSecondary: '--bg-secondary',
  bgCard: '--bg-card',
  borderColor: '--border-color',
  textPrimary: '--text-primary',
  textSecondary: '--text-secondary',
  accent: '--accent',
  accentHover: '--accent-hover',
  success: '--success',
  danger: '--danger',
  info: '--info',
  muted: '--muted',
};

interface SettingsPanelProps {
  config: FRMConfig;
  saveConfig: (config: FRMConfig) => void;
}

export function SettingsPanel({ config, saveConfig }: SettingsPanelProps) {
  const { theme, updateTheme, resetTheme } = useTheme();
  const { settings, saveSettings, resetSettings } = useAppSettings();

  const isDefault = Object.keys(DEFAULT_THEME).every(
    (k) => theme[k as keyof DashboardTheme] === DEFAULT_THEME[k as keyof DashboardTheme]
  );

  const isSettingsDefault =
    settings.iconSize === DEFAULT_SETTINGS.iconSize &&
    settings.mapIconScale === DEFAULT_SETTINGS.mapIconScale;

  const RATE_OPTIONS = [
    { value: 1000, label: '1s' },
    { value: 2000, label: '2s' },
    { value: 3000, label: '3s' },
    { value: 5000, label: '5s' },
    { value: 10000, label: '10s' },
    { value: 15000, label: '15s' },
    { value: 30000, label: '30s' },
    { value: 60000, label: '60s' },
  ];

  const ICON_SIZE_OPTIONS = [
    { value: 'sm' as const, label: 'Small' },
    { value: 'md' as const, label: 'Medium' },
    { value: 'lg' as const, label: 'Large' },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#f0f0f0]">Settings</h2>
          <p className="text-sm text-[#a0a0a0] mt-1">
            Dashboard preferences and theme customization.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => saveConfig(defaultConfig)}
            className="px-4 py-2 text-xs font-medium rounded-lg border transition-all
              bg-[#141414] border-[#2a2a2e] text-[#f0f0f0] hover:border-[#e6a720] hover:text-[#e6a720]"
          >
            Reset Settings
          </button>
          <button
            onClick={resetTheme}
            disabled={isDefault}
            className="px-4 py-2 text-xs font-medium rounded-lg border transition-all
              bg-[#141414] border-[#2a2a2e] text-[#f0f0f0] hover:border-[#e74c3c] hover:text-[#e74c3c]
              disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Reset Theme
          </button>
        </div>
      </div>

      {/* General Settings */}
      <div className="bg-[#141414] border border-[#2a2a2e] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[#f0f0f0] mb-4">General</h3>

        {/* Refresh Rate */}
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm text-[#f0f0f0]">Refresh Rate</p>
            <p className="text-xs text-[#a0a0a0]">How often data is polled from the server</p>
          </div>
          <select
            value={config.refreshRate}
            onChange={(e) => saveConfig({ ...config, refreshRate: Number(e.target.value) })}
            className="bg-[#0a0a0a] border border-[#2a2a2e] rounded-md px-3 py-1.5 text-xs text-[#f0f0f0]
              focus:outline-none focus:border-[#e6a720] cursor-pointer"
          >
            {RATE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Appearance Settings */}
      <div className="bg-[#141414] border border-[#2a2a2e] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[#f0f0f0] mb-4">Appearance</h3>

        {/* Icon Size */}
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm text-[#f0f0f0]">Icon Size</p>
            <p className="text-xs text-[#a0a0a0]">Card icon size for Production &amp; Inventory views</p>
          </div>
          <div className="flex rounded-lg overflow-hidden border border-[#2a2a2e]">
            {ICON_SIZE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => saveSettings({ iconSize: opt.value })}
                className="px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  backgroundColor: settings.iconSize === opt.value ? theme.accent : '#0a0a0a',
                  color: settings.iconSize === opt.value ? '#000' : theme.textSecondary,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Map Icon Scale */}
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm text-[#f0f0f0]">Map Icon Scale</p>
            <p className="text-xs text-[#a0a0a0]">Size of building icons on the Factory Map</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={settings.mapIconScale}
              onChange={(e) => saveSettings({ mapIconScale: parseFloat(e.target.value) })}
              className="w-24 h-1.5 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, ${theme.accent} 0%, ${theme.accent} ${((settings.mapIconScale - 0.5) / 1.5) * 100}%, ${theme.borderColor} ${((settings.mapIconScale - 0.5) / 1.5) * 100}%, ${theme.borderColor} 100%)`,
                accentColor: theme.accent,
              }}
            />
            <span className="text-xs font-mono text-[#f0f0f0] w-8 text-right">{settings.mapIconScale.toFixed(1)}x</span>
          </div>
        </div>

        {/* Reset Appearance */}
        <div className="mt-3 pt-3 border-t border-[#2a2a2e]">
          <button
            onClick={resetSettings}
            disabled={isSettingsDefault}
            className="px-4 py-2 text-xs font-medium rounded-lg border transition-all
              bg-[#0a0a0a] border-[#2a2a2e] text-[#f0f0f0] hover:border-[#e74c3c] hover:text-[#e74c3c]
              disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Reset Appearance
          </button>
        </div>
      </div>

      {/* Preview Card */}
      <div className="rounded-xl p-6 space-y-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}>
        <p className="text-xs uppercase tracking-wider font-medium" style={{ color: theme.textSecondary }}>Live Preview</p>
        <div className="flex gap-2">
          <span
            className="px-3 py-1 rounded-full text-xs font-medium"
            style={{ backgroundColor: theme.success + '20', color: theme.success, border: `1px solid ${theme.success}40` }}
          >
            Success
          </span>
          <span
            className="px-3 py-1 rounded-full text-xs font-medium"
            style={{ backgroundColor: theme.danger + '20', color: theme.danger, border: `1px solid ${theme.danger}40` }}
          >
            Danger
          </span>
          <span
            className="px-3 py-1 rounded-full text-xs font-medium"
            style={{ backgroundColor: theme.info + '20', color: theme.info, border: `1px solid ${theme.info}40` }}
          >
            Info
          </span>
          <span
            className="px-3 py-1 rounded-full text-xs font-medium"
            style={{ backgroundColor: theme.accent + '20', color: theme.accent, border: `1px solid ${theme.accent}40` }}
          >
            Accent
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: theme.bgPrimary, border: `1px solid ${theme.borderColor}` }}>
          <div className="h-full w-3/5 rounded-full transition-all" style={{ backgroundColor: theme.success }} />
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: theme.bgPrimary, border: `1px solid ${theme.borderColor}` }}>
          <div className="h-full w-2/5 rounded-full transition-all" style={{ backgroundColor: theme.danger }} />
        </div>
        <p className="text-sm" style={{ color: theme.textPrimary }}>
          Primary text on <span style={{ color: theme.textSecondary }}>secondary text</span> and{' '}
          <span style={{ color: theme.accent }}>accent links</span>.
        </p>
        <p className="text-xs" style={{ color: theme.muted }}>Muted footer text — {new Date().toLocaleDateString()}</p>
      </div>

      {/* Color Sections */}
      {Object.entries(SECTION_LABELS).map(([key, section]) => (
        <div key={key} className="bg-[#141414] border border-[#2a2a2e] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#f0f0f0] mb-1">{section.label}</h3>
          <div className="divide-y divide-[#2a2a2e]">
            {section.keys.map((themeKey) => (
              <ColorRow
                key={themeKey}
                label={LABELS[themeKey]}
                cssVar={CSS_VARS[themeKey]}
                value={theme[themeKey]}
                onChange={(val) => updateTheme({ [themeKey]: val } as Partial<DashboardTheme>)}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Export / Import */}
      <div className="bg-[#141414] border border-[#2a2a2e] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[#f0f0f0] mb-1">Export / Import Theme</h3>
        <p className="text-xs text-[#a0a0a0] mb-3">Copy this JSON to share your theme, or paste one to import.</p>
        <textarea
          readOnly
          value={JSON.stringify(theme, null, 2)}
          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
          className="w-full h-32 bg-[#0a0a0a] border border-[#2a2a2e] rounded-lg p-3 text-xs font-mono text-[#f0f0f0]
            focus:outline-none resize-none select-all"
        />
        <button
          onClick={() => {
            try {
              const imported = JSON.parse(prompt('Paste your theme JSON:') || '');
              if (imported && typeof imported === 'object') {
                updateTheme(imported);
              }
            } catch { alert('Invalid theme JSON'); }
          }}
          className="mt-2 px-4 py-2 text-xs font-medium rounded-lg bg-[#e6a720] text-black hover:bg-[#f4c542] transition-all"
        >
          Import Theme JSON
        </button>
      </div>
    </div>
  );
}
