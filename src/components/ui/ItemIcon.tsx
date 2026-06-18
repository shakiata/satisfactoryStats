'use client';

import { useState } from 'react';

/**
 * Props for the shared {@link ItemIcon} component.
 */
interface ItemIconProps {
  /** The Satisfactory class name used to derive the icon path (e.g. "Desc_IronPlate_C"). */
  className: string;
  /** Display name for the item (used as fallback initials and alt text). */
  name: string;
  /** Icon size variant: small, medium, or large. */
  size?: 'sm' | 'md' | 'lg';
  /** Optional production rate — when set with `cons`, the background tint indicates surplus/deficit. */
  prod?: number;
  /** Optional consumption rate — when set with `prod`, the background tint indicates surplus/deficit. */
  cons?: number;
}

/**
 * Shared item icon component with PNG loading and fallback initials.
 *
 * Tries to load an icon from `public/Icons/{className}.png`. On error
 * (missing or broken icon), renders the first two capital letters of
 * the item's short name as a fallback. When both `prod` and `cons` are
 * provided, the background color indicates whether production is in
 * surplus (green tint), deficit (red tint), or balanced (neutral hash
 * color derived from the class name). When neither is provided, a
 * neutral secondary-background color is used.
 *
 * Extracted from InventoryPanel and ProductionMonitor to satisfy the
 * AGENTS.md "Reusable Code" rule.
 */
export function ItemIcon({ className, name, size = 'md', prod, cons }: ItemIconProps) {
  const [errored, setErrored] = useState(false);

  // Derive fallback initials from the short class name
  const short = name.replace(/^Desc_/, '').replace(/_C$/, '');
  const initials = (short.match(/[A-Z]/g) || short.slice(0, 2).split('')).slice(0, 2).join('');

  // Determine background:
  // - No prod/cons → neutral secondary background
  // - With prod/cons → balance-based tint (surplus green / deficit red / neutral hash)
  const hasBalance = prod !== undefined && cons !== undefined;
  const bgColor = (() => {
    if (errored) return hasBalance ? nameToColor(className) : 'var(--bg-secondary)';
    if (hasBalance) {
      if (prod! > cons!) return '#1a4d2e'; // surplus green
      if (cons! > prod!) return '#5c1a1a'; // deficit red
      return nameToColor(className);
    }
    return 'var(--bg-secondary)';
  })();

  // Size variant presets (ProductionMonitor conventions)
  const sizes: Record<NonNullable<ItemIconProps['size']>, { box: string; img: string; text: string }> = {
    sm: { box: 'w-8 h-8', img: 'w-6 h-6', text: 'text-[10px]' },
    md: { box: 'w-12 h-12', img: 'w-10 h-10', text: 'text-sm' },
    lg: { box: 'w-16 h-16', img: 'w-14 h-14', text: 'text-base' },
  };
  const s = sizes[size];

  return (
    <div
      className={`${s.box} rounded-lg flex items-center justify-center shrink-0 relative overflow-hidden`}
      style={{ backgroundColor: bgColor }}
    >
      {!errored && (
        <img
          src={`./Icons/${className}.png`}
          alt={name}
          className={`${s.img} object-contain`}
          onError={() => setErrored(true)}
        />
      )}
      {errored && (
        <span className={`text-white font-bold drop-shadow-md select-none ${s.text}`}>
          {initials}
        </span>
      )}
    </div>
  );
}

/**
 * Deterministic color hash — included here rather than importing from lib/colors.ts
 * to avoid a dependency on the 'use client' boundary for this pure utility.
 *
 * @see {@link ../lib/colors.ts} for the canonical version.
 * @internal
 */
function nameToColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return `hsl(${Math.abs(h) % 360}, 45%, 38%)`;
}
