'use client';

import { useTheme } from '@/lib/useTheme';
import { DashboardTheme, DEFAULT_THEME, LIGHT_THEME, DEFAULT_SETTINGS, FRMConfig, AppSettings } from '@/lib/types';
import { defaultConfig } from '@/lib/useConfig';

interface ColorRowProps {
  label: string;
  cssVar: string;
  value: string;
  onChange: (val: string) => void;
  theme: DashboardTheme;
}

/**
 * A single theme color row: label, CSS variable name, color swatch,
 * color picker, and hex text input. Uses theme tokens for consistent
 * appearance in both dark and light modes.
 */
function ColorRow({ label, cssVar, value, onChange, theme }: ColorRowProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <div
          className="w-6 h-6 rounded-md border shrink-0"
          style={{ backgroundColor: value, borderColor: theme.borderColor }}
        />
        <div>
          <p className="text-sm" style={{ color: theme.textPrimary }}>{label}</p>
          <p className="text-xs font-mono" style={{ color: theme.textSecondary }}>{cssVar}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded-md border cursor-pointer bg-transparent p-0
            [&::-webkit-color-swatch-wrapper]:p-0
            [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0"
          style={{ borderColor: theme.borderColor }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-20 rounded-md px-2 py-1 text-xs font-mono text-center border"
          style={{
            backgroundColor: theme.bgPrimary,
            borderColor: theme.borderColor,
            color: theme.textPrimary,
          }}
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
  settings: AppSettings;
  saveSettings: (partial: Partial<AppSettings>) => void;
}

/**
 * Application settings panel: theme color customization,
 * icon size preferences, map scale, and other user preferences
 * persisted via useAppSettings.
 */
export function SettingsPanel({ config, saveConfig, settings, saveSettings }: SettingsPanelProps) {
  const { theme, updateTheme, resetTheme } = useTheme();

  const isDefault = Object.keys(DEFAULT_THEME).every(
    (k) => theme[k as keyof DashboardTheme] === DEFAULT_THEME[k as keyof DashboardTheme]
  );

  const isLightDefault = Object.keys(LIGHT_THEME).every(
    (k) => theme[k as keyof DashboardTheme] === LIGHT_THEME[k as keyof DashboardTheme]
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
          <h2 className="text-xl font-bold" style={{ color: theme.textPrimary }}>Settings</h2>
          <p className="text-sm mt-1" style={{ color: theme.textSecondary }}>
            Dashboard preferences and theme customization.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => saveConfig(defaultConfig)}
            className="px-4 py-2 text-xs font-medium rounded-lg border transition-all"
            style={{
              backgroundColor: theme.bgSecondary,
              borderColor: theme.borderColor,
              color: theme.textPrimary,
            }}
          >
            Reset Settings
          </button>
          <button
            onClick={resetTheme}
            disabled={isDefault || isLightDefault}
            className="px-4 py-2 text-xs font-medium rounded-lg border transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              backgroundColor: theme.bgSecondary,
              borderColor: theme.borderColor,
              color: theme.textPrimary,
            }}
          >
            Reset Theme
          </button>
        </div>
      </div>

      {/* General Settings */}
      <div className="rounded-xl p-5" style={{ backgroundColor: theme.bgSecondary, border: `1px solid ${theme.borderColor}` }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: theme.textPrimary }}>General</h3>

        {/* Refresh Rate */}
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm" style={{ color: theme.textPrimary }}>Refresh Rate</p>
            <p className="text-xs" style={{ color: theme.textSecondary }}>How often data is polled from the server</p>
          </div>
          <select
            value={config.refreshRate}
            onChange={(e) => saveConfig({ ...config, refreshRate: Number(e.target.value) })}
            className="rounded-md px-3 py-1.5 text-xs cursor-pointer border"
            style={{
              backgroundColor: theme.bgPrimary,
              borderColor: theme.borderColor,
              color: theme.textPrimary,
            }}
          >
            {RATE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Appearance Settings */}
      <div className="rounded-xl p-5" style={{ backgroundColor: theme.bgSecondary, border: `1px solid ${theme.borderColor}` }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: theme.textPrimary }}>Appearance</h3>

        {/* Icon Size */}
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm" style={{ color: theme.textPrimary }}>Icon Size</p>
            <p className="text-xs" style={{ color: theme.textSecondary }}>Card icon size for Production &amp; Inventory views</p>
          </div>
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: theme.borderColor }}>
            {ICON_SIZE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => saveSettings({ iconSize: opt.value })}
                className="px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  backgroundColor: settings.iconSize === opt.value ? theme.accent : theme.bgPrimary,
                  color: settings.iconSize === opt.value ? (settings.themeMode === 'dark' ? '#000' : '#fff') : theme.textSecondary,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Theme Mode — Dark / Light toggle */}
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm" style={{ color: theme.textPrimary }}>Color Mode</p>
            <p className="text-xs" style={{ color: theme.textSecondary }}>Switch between dark and light visual themes</p>
          </div>
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: theme.borderColor }}>
            {(['dark', 'light'] as const).map((mode) => {
              const active = settings.themeMode === mode;
              const isDark = mode === 'dark';
              return (
                <button
                  key={mode}
                  onClick={() => {
                    saveSettings({ themeMode: mode });
                    updateTheme(isDark ? DEFAULT_THEME : LIGHT_THEME);
                  }}
                  className="px-3 py-1.5 text-xs font-medium transition-all capitalize"
                  style={{
                    backgroundColor: active ? theme.accent : theme.bgPrimary,
                    color: active ? (isDark ? '#000' : '#fff') : theme.textSecondary,
                    borderRight: !isDark ? 'none' : `1px solid ${theme.borderColor}`,
                  }}
                >
                  {isDark ? '🌙 Dark' : '☀️ Light'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Map Icon Scale */}
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm" style={{ color: theme.textPrimary }}>Map Icon Scale</p>
            <p className="text-xs" style={{ color: theme.textSecondary }}>Size of building icons on the Factory Map</p>
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
            <span className="text-xs font-mono w-8 text-right" style={{ color: theme.textPrimary }}>{settings.mapIconScale.toFixed(1)}x</span>
          </div>
        </div>

        {/* Reset Appearance */}
        <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${theme.borderColor}` }}>
          <button
            onClick={() => saveSettings(DEFAULT_SETTINGS)}
            disabled={isSettingsDefault}
            className="px-4 py-2 text-xs font-medium rounded-lg border transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              backgroundColor: theme.bgPrimary,
              borderColor: theme.borderColor,
              color: theme.textPrimary,
            }}
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
        <div key={key} className="rounded-xl p-5" style={{ backgroundColor: theme.bgSecondary, border: `1px solid ${theme.borderColor}` }}>
          <h3 className="text-sm font-semibold mb-1" style={{ color: theme.textPrimary }}>{section.label}</h3>
          <div className="divide-y" style={{ borderColor: theme.borderColor }}>
            {section.keys.map((themeKey) => (
              <ColorRow
                key={themeKey}
                theme={theme}
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
      <div className="rounded-xl p-5" style={{ backgroundColor: theme.bgSecondary, border: `1px solid ${theme.borderColor}` }}>
        <h3 className="text-sm font-semibold mb-1" style={{ color: theme.textPrimary }}>Export / Import Theme</h3>
        <p className="text-xs mb-3" style={{ color: theme.textSecondary }}>Copy this JSON to share your theme, or paste one to import.</p>
        <textarea
          readOnly
          value={JSON.stringify(theme, null, 2)}
          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
          className="w-full h-32 font-mono text-xs rounded-lg p-3 resize-none select-all border"
          style={{
            backgroundColor: theme.bgPrimary,
            borderColor: theme.borderColor,
            color: theme.textPrimary,
          }}
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
          className="mt-2 px-4 py-2 text-xs font-medium rounded-lg transition-all"
          style={{
            backgroundColor: theme.accent,
            color: settings.themeMode === 'dark' ? '#000' : '#fff',
          }}
        >
          Import Theme JSON
        </button>
      </div>
    </div>
  );
}
