'use client';

export const TIME_WINDOWS = [
  { value: 0, label: 'Live' },
  { value: 60_000, label: '1m' },
  { value: 300_000, label: '5m' },
  { value: 600_000, label: '10m' },
  { value: 900_000, label: '15m' },
  { value: 1_800_000, label: '30m' },
  { value: 3_600_000, label: '1h' },
] as const;

export type TimeWindowMs = (typeof TIME_WINDOWS)[number]['value'];

interface TimeWindowSelectorProps {
  value: TimeWindowMs;
  onChange: (v: TimeWindowMs) => void;
}

export function TimeWindowSelector({ value, onChange }: TimeWindowSelectorProps) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider">
      <span className="text-[var(--text-secondary)]">Period</span>
      <div className="flex rounded-md overflow-hidden border border-[var(--border-color)]">
        {TIME_WINDOWS.map((w) => {
          const active = value === w.value;
          return (
            <button
              key={w.value}
              onClick={() => onChange(w.value)}
              className="px-2 py-1 transition-colors border-r border-[var(--border-color)] last:border-r-0"
              style={{
                backgroundColor: active ? 'var(--accent)' : 'transparent',
                color: active ? '#000' : 'var(--text-secondary)',
              }}
            >
              {w.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
