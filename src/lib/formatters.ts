/**
 * Shared number formatting utilities for Statusfactory dashboards.
 *
 * Consolidates formatting helpers previously duplicated across InventoryPanel
 * (fmt), ProductionMonitor (formatRate), TrainControlTower (fmtNum), and
 * PowerDashboard (formatPower) into one configurable function.
 */

/**
 * Options for {@link formatNumber}.
 */
export interface FormatNumberOptions {
  /** Number of decimal places to show (default: 1 for compact, 0 for plain). */
  decimals?: number;
  /** Optional unit label appended after the number (e.g. "MW", "GW"). */
  unit?: string;
  /** Use compact notation with k/M suffixes for large numbers (default: true). */
  compact?: boolean;
  /** Force sign prefix for positive numbers (e.g. "+1.2k"). Default: false. */
  forceSign?: boolean;
}

/**
 * Formats a number for dashboard display with optional compact notation,
 * unit suffix, and configurable decimal places.
 *
 * When `compact` is true (the default), numbers >= 1,000 are suffixed with
 * "k" and numbers >= 1,000,000 with "M". Numbers < 1 keep one decimal.
 *
 * @param n - The raw numeric value to format.
 * @param opts - Optional formatting preferences.
 * @returns A human-readable string suitable for dashboard display.
 *
 * @example
 * formatNumber(1234)                // "1.2k"
 * formatNumber(1234567)             // "1.2M"
 * formatNumber(5)                   // "5.0"
 * formatNumber(0.5)                 // "0.5"
 * formatNumber(420, { unit: 'MW' }) // "420 MW"
 * formatNumber(1500, { unit: 'GW', decimals: 1 })  // "1.5 GW"
 * formatNumber(42, { forceSign: true })             // "+42"
 */
export function formatNumber(n: number, opts: FormatNumberOptions = {}): string {
  const { decimals, unit, compact = true, forceSign = false } = opts;

  if (!compact) {
    const d = decimals ?? 0;
    const sign = forceSign && n >= 0 ? '+' : '';
    const num = n.toFixed(d);
    return unit ? `${sign}${num} ${unit}` : `${sign}${num}`;
  }

  const abs = Math.abs(n);
  const sign = forceSign && n >= 0 ? '+' : n < 0 ? '-' : '';

  if (abs >= 1_000_000) {
    const d = decimals ?? 1;
    const val = sign ? `${sign}${(abs / 1_000_000).toFixed(d)}M` : `${(n / 1_000_000).toFixed(d)}M`;
    return unit ? `${val} ${unit}` : val;
  }

  if (abs >= 1_000) {
    const d = decimals ?? 1;
    const val = sign ? `${sign}${(abs / 1_000).toFixed(d)}k` : `${(n / 1_000).toFixed(d)}k`;
    return unit ? `${val} ${unit}` : val;
  }

  // Sub-1000: no compact suffix
  if (abs >= 1) {
    const d = decimals ?? 0;
    const val = sign ? `${sign}${abs.toFixed(d)}` : n.toFixed(d);
    return unit ? `${val} ${unit}` : val;
  }

  // Sub-1: always show 1 decimal
  const val = sign ? `${sign}${abs.toFixed(1)}` : n.toFixed(1);
  return unit ? `${val} ${unit}` : val;
}

/**
 * Convenience wrapper for formatting power values with MW/GW auto-scaling.
 * Uses {@link formatNumber} internally with compact=false and manual
 * threshold logic for GW vs MW.
 *
 * @param mw - Power in megawatts.
 * @returns A string like "500 MW" or "1.5 GW".
 */
export function formatPower(mw: number): string {
  if (mw >= 1000) return formatNumber(mw / 1000, { unit: 'GW', decimals: 1, compact: false });
  return formatNumber(mw, { unit: 'MW', decimals: 0, compact: false });
}
