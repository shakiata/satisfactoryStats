'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FRMConfig, FactoryBuilding, Generator, Extractor, Player, AppSettings } from '@/lib/types';
import { fetchEndpoint } from '@/lib/api';
import { useTheme } from '@/lib/useTheme';
import { cleanName } from '@/lib/names';
import { formatNumber } from '@/lib/formatters';
import styles from './FactoryMap.module.css';

interface Props {
  config: FRMConfig;
  settings: AppSettings;
  saveSettings: (partial: Partial<AppSettings>) => void;
}

/* ─── Constants ─── */

const MAP_MIN = -425000;
const MAP_MAX = 425000;
const MAP_RANGE = MAP_MAX - MAP_MIN;
const MAP_SIZE = 8192;

const MAP_IMAGE_URL =
  'https://static.wikia.nocookie.net/satisfactory_gamepedia_en/images/e/ea/Map.jpg';

const IMG_WORLD_WEST = -418448;
const IMG_WORLD_EAST = 519051;
const IMG_WORLD_NORTH = -468750;
const IMG_WORLD_SOUTH = 468750;

const LAYERS = [
  { id: 'factory', label: 'Factory Buildings', color: '#4A90D9' },
  { id: 'generator', label: 'Generators', color: '#E8833A' },
  { id: 'extractor', label: 'Extractors', color: '#F5C842' },
  { id: 'player', label: 'Players', color: '#00E5FF' },
] as const;

type LayerId = (typeof LAYERS)[number]['id'];

/* Precompute map-image pixel bounds (static — computed once) */
const IMG_MAP_X = ((IMG_WORLD_WEST - MAP_MIN) / MAP_RANGE) * MAP_SIZE;
const IMG_MAP_Y = ((IMG_WORLD_NORTH - MAP_MIN) / MAP_RANGE) * MAP_SIZE;
const IMG_MAP_W = ((IMG_WORLD_EAST - IMG_WORLD_WEST) / MAP_RANGE) * MAP_SIZE;
const IMG_MAP_H = ((IMG_WORLD_SOUTH - IMG_WORLD_NORTH) / MAP_RANGE) * MAP_SIZE;

/* ─── Utility functions ─── */

/** Convert world coordinates (Unreal cm) to map-pixel coordinates (0…MAP_SIZE).
 *  Z maps directly to Y because the wiki map image is oriented so that
 *  Y increases as world Z increases (north = positive Z = lower in the image). */
export function worldToMap(wx: number, wz: number): [number, number] {
  return [
    ((wx - MAP_MIN) / MAP_RANGE) * MAP_SIZE,
    ((wz - MAP_MIN) / MAP_RANGE) * MAP_SIZE,
  ];
}

/** Convert map-pixel coordinates back to world coordinates (inverse of worldToMap). */
export function mapToWorld(mx: number, my: number): { x: number; z: number } {
  return {
    x: (mx / MAP_SIZE) * MAP_RANGE + MAP_MIN,
    z: (my / MAP_SIZE) * MAP_RANGE + MAP_MIN,
  };
}

/**
 * Convert a mouse event over the SVG to world coordinates.
 * svgEl and viewBox must be the current values at the time of the event.
 */
function screenToWorld(
  clientX: number,
  clientY: number,
  svgEl: SVGSVGElement,
  vb: { x: number; y: number; w: number; h: number },
): { x: number; z: number } {
  const rect = svgEl.getBoundingClientRect();
  const vbX = ((clientX - rect.left) / rect.width) * vb.w + vb.x;
  const vbY = ((clientY - rect.top) / rect.height) * vb.h + vb.y;
  return mapToWorld(vbX, vbY);
}

/**
 * Derive the icon file path from a Satisfactory class name.
 * Converts Build_* → Desc_* and keeps Desc_* as-is.
 */
export function classNameToIconPath(className: string): string {
  const desc = className.replace(/^Build_/, 'Desc_');
  return `./Icons/${desc}.png`;
}

/** Human-readable label for a Recipe string. */
export function cleanRecipe(recipe: string): string {
  return recipe.replace(/^Recipe_/, '').replace(/_C$/, '').replace(/_/g, ' ');
}

/**
 * Extract the best icon ClassName for a building.
 * For buildings with production output, prefer the first output item's icon.
 */
function bestIconClassName(
  building: FactoryBuilding | Generator | Extractor,
): string {
  if ('production' in building && building.production?.length > 0) {
    return building.production[0].ClassName;
  }
  return building.ClassName;
}

/** Format a production rate for display (items/min). */
function fmtRate(amount: number): string {
  return formatNumber(amount, { decimals: amount < 10 ? 1 : 0 });
}

/** Format power in watts to MW/GW. */
function fmtWatts(w: number): string {
  const mw = w / 1_000_000;
  if (mw >= 1000) return formatNumber(mw / 1000, { unit: 'GW', decimals: 2, compact: false });
  return formatNumber(mw, { unit: 'MW', decimals: mw < 1 ? 2 : 1, compact: false });
}

/* ─── Tooltip data model ─── */

interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

interface TooltipData {
  id: string;
  title: string;
  subtitle?: string;
  typeBadge: { label: string; color: string } | null;
  rows: TooltipRow[];
  coords: { x: number; y: number; z: number };
}

/** Build tooltip data for a factory building. */
function buildFactoryTooltip(f: FactoryBuilding): TooltipData {
  const rows: TooltipRow[] = [];

  if (f.production?.length > 0) {
    for (const p of f.production) {
      rows.push({
        label: 'Output',
        value: `${cleanName(p.ClassName)}  ${fmtRate(p.CurrentProd)}/min`,
        color: 'var(--success)',
      });
    }
  }

  if (f.ingredients?.length > 0) {
    for (const ing of f.ingredients) {
      rows.push({
        label: 'Input',
        value: `${cleanName(ing.ClassName)}  ${fmtRate(ing.CurrentConsumed)}/min`,
        color: 'var(--info)',
      });
    }
  }

  if (f.PowerInfo) {
    rows.push({ label: 'Power', value: fmtWatts(f.PowerInfo.PowerConsumed) });
  }

  rows.push({ label: 'Productivity', value: `${(f.Productivity ?? 0).toFixed(0)}%` });
  rows.push({ label: 'Speed', value: `×${(f.ManuSpeed ?? 1).toFixed(1)}` });

  if ((f.PowerShards ?? 0) > 0) {
    rows.push({ label: 'Shards', value: `${f.PowerShards}` });
  }
  if ((f.Somersloops ?? 0) > 0) {
    rows.push({ label: 'Sloops', value: `${f.Somersloops}` });
  }

  let badge: TooltipData['typeBadge'] = null;
  if (f.IsPaused) {
    badge = { label: 'Paused', color: 'var(--danger)' };
  } else if (!f.IsConfigured) {
    badge = { label: 'Unconfigured', color: 'var(--muted)' };
  } else if (f.IsProducing) {
    badge = { label: 'Producing', color: 'var(--success)' };
  } else {
    badge = { label: 'Stopped', color: 'var(--muted)' };
  }

  return {
    id: f.ID,
    title: cleanName(f.ClassName),
    subtitle: f.Recipe ? cleanRecipe(f.Recipe) : undefined,
    typeBadge: badge,
    rows,
    coords: f.location,
  };
}

/** Build tooltip data for a generator. */
function buildGeneratorTooltip(g: Generator): TooltipData {
  const rows: TooltipRow[] = [];

  if (g.FuelResource) {
    rows.push({
      label: 'Fuel',
      value: `${cleanName(g.FuelResource)}  ${formatNumber(g.FuelAmount ?? 0, { decimals: 0 })}`,
    });
  }

  if (g.PowerProductionPotential != null) {
    rows.push({ label: 'Output', value: fmtWatts(g.PowerProductionPotential) });
  }

  if (g.LoadPercentage != null) {
    rows.push({ label: 'Load', value: `${g.LoadPercentage.toFixed(0)}%` });
  }

  if ((g.PowerShards ?? 0) > 0) {
    rows.push({ label: 'Shards', value: `${g.PowerShards}` });
  }
  if ((g.Somersloops ?? 0) > 0) {
    rows.push({ label: 'Sloops', value: `${g.Somersloops}` });
  }

  let badge: TooltipData['typeBadge'] = null;
  if (g.IsFullSpeed) {
    badge = { label: 'Full speed', color: 'var(--success)' };
  } else if (g.CanStart) {
    badge = { label: 'Can start', color: 'var(--accent)' };
  } else {
    badge = { label: 'Stopped', color: 'var(--muted)' };
  }

  return {
    id: g.ID,
    title: cleanName(g.ClassName),
    typeBadge: badge,
    rows,
    coords: g.location,
  };
}

/** Build tooltip data for an extractor. */
function buildExtractorTooltip(e: Extractor): TooltipData {
  const rows: TooltipRow[] = [];

  if (e.production?.length > 0) {
    for (const p of e.production) {
      rows.push({
        label: 'Output',
        value: `${cleanName(p.ClassName)}  ${fmtRate(p.CurrentProd)}/min`,
        color: 'var(--success)',
      });
    }
  }

  rows.push({ label: 'Speed', value: `×${(e.ManuSpeed ?? 1).toFixed(1)}` });

  if ((e.PowerShards ?? 0) > 0) {
    rows.push({ label: 'Shards', value: `${e.PowerShards}` });
  }
  if ((e.Somersloops ?? 0) > 0) {
    rows.push({ label: 'Sloops', value: `${e.Somersloops}` });
  }

  let badge: TooltipData['typeBadge'] = null;
  if (e.IsPaused) {
    badge = { label: 'Paused', color: 'var(--danger)' };
  } else if (!e.IsConfigured) {
    badge = { label: 'Unconfigured', color: 'var(--muted)' };
  } else if (e.IsProducing) {
    badge = { label: 'Producing', color: 'var(--success)' };
  } else {
    badge = { label: 'Stopped', color: 'var(--muted)' };
  }

  return {
    id: e.ID,
    title: cleanName(e.ClassName),
    subtitle: e.Recipe ? cleanRecipe(e.Recipe) : undefined,
    typeBadge: badge,
    rows,
    coords: e.location,
  };
}

/** Build tooltip data for a player. */
function buildPlayerTooltip(p: Player): TooltipData {
  return {
    id: p.ID,
    title: p.Name || 'Player',
    typeBadge: { label: 'Player', color: '#00E5FF' },
    rows: [],
    coords: p.location,
  };
}

/**
 * Build a TooltipData from any building/player entity, dispatching on type.
 */
function buildTooltip(
  entity:
    | { type: 'factory'; data: FactoryBuilding }
    | { type: 'generator'; data: Generator }
    | { type: 'extractor'; data: Extractor }
    | { type: 'player'; data: Player },
): TooltipData {
  switch (entity.type) {
    case 'factory':
      return buildFactoryTooltip(entity.data);
    case 'generator':
      return buildGeneratorTooltip(entity.data);
    case 'extractor':
      return buildExtractorTooltip(entity.data);
    case 'player':
      return buildPlayerTooltip(entity.data);
  }
}

/**
 * Calculate the visual icon size in viewBox units.
 * Targets roughly constant screen-pixel size: ~20px at moderate zoom.
 * Formula: screenPx = iconSizeVb * (containerW / vbW) ≅ vbW/50 * containerW/vbW = containerW/50
 */
export function calcIconSize(vbW: number, iconScale: number): number {
  return Math.max(8, Math.min(32, vbW / 50)) * iconScale;
}

/**
 * Calculate the hit-test circle radius in viewBox units for mouse events.
 * Targets ~40px screen hit area at moderate zoom.
 */
export function calcHitRadius(vbW: number): number {
  return Math.max(12, Math.min(64, vbW / 25));
}

/**
 * Compute entity counts per layer from data arrays.
 */
function countEntities(
  factories: FactoryBuilding[] | null,
  generators: Generator[] | null,
  extractors: Extractor[] | null,
  players: Player[] | null,
): Record<LayerId, number> {
  return {
    factory: factories?.length ?? 0,
    generator: generators?.length ?? 0,
    extractor: extractors?.length ?? 0,
    player: players?.length ?? 0,
  };
}

/* ═══════════════════════════════════════════════════════
   Tooltip Component
   ═══════════════════════════════════════════════════════ */

/**
 * DOM-positioned tooltip overlay that displays detailed building info.
 * Rendered outside the SVG for natural DOM event handling.
 */
function TooltipPanel({
  data,
  pinned,
  onClose,
}: {
  data: TooltipData;
  pinned: boolean;
  onClose: () => void;
}) {
  const { theme } = useTheme();

  return (
    <div
      className={`${styles.tooltip} ${pinned ? styles.tooltipPinned : ''}`}
      onClick={(e) => {
        if (pinned) e.stopPropagation();
      }}
    >
      <div
        className="rounded-xl border shadow-2xl p-3 min-w-[200px]"
        style={{
          backgroundColor: theme.bgCard,
          borderColor: theme.borderColor,
          color: theme.textPrimary,
        }}
      >
        {/* Title row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">{data.title}</div>
            {data.subtitle && (
              <div className="text-[11px] opacity-60 truncate">{data.subtitle}</div>
            )}
          </div>
          {data.typeBadge && (
            <span
              className="shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: `${data.typeBadge.color}22`,
                color: data.typeBadge.color,
              }}
            >
              {data.typeBadge.label}
            </span>
          )}
        </div>

        {/* Data rows */}
        <div className="space-y-0.5 text-[11px] font-mono">
          {data.rows.length > 0 && (
            <div className="h-px opacity-20 my-1.5" style={{ backgroundColor: theme.textSecondary }} />
          )}
          {data.rows.map((row, i) => (
            <div key={i} className="flex justify-between gap-4">
              <span className="opacity-50 shrink-0">{row.label}</span>
              <span
                className="font-semibold text-right truncate"
                style={{ color: row.color ?? theme.textPrimary }}
              >
                {row.value}
              </span>
            </div>
          ))}

          {/* Coordinates */}
          <div className="h-px opacity-20 my-1.5" style={{ backgroundColor: theme.textSecondary }} />
          <div className="flex justify-between gap-4">
            <span className="opacity-50">Location</span>
            <span className="font-semibold text-right opacity-70">
              {data.coords.x.toFixed(0)}, {data.coords.y.toFixed(0)}, {data.coords.z.toFixed(0)}
            </span>
          </div>
        </div>

        {/* Close button for pinned tooltip */}
        {pinned && (
          <button
            onClick={onClose}
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold hover:opacity-80"
            style={{
              backgroundColor: theme.bgCard,
              border: `1px solid ${theme.borderColor}`,
              color: theme.textSecondary,
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════ */

/**
 * Compute a viewBox that fits all given world-coordinate points
 * with padding. If containerAspectRatio is provided, expands the
 * tighter dimension so the viewBox matches the container's aspect
 * ratio — prevents SVG meet-scaling from squishing icons.
 */
function computeViewBoxBounds(
  points: { x: number; z: number }[],
  containerAspectRatio?: number,
): { x: number; y: number; w: number; h: number } {
  if (points.length === 0) return { x: 0, y: 0, w: MAP_SIZE, h: MAP_SIZE };

  // Convert all world points to map-pixel coords, then find min/max
  let minMx = Infinity, maxMx = -Infinity, minMy = Infinity, maxMy = -Infinity;
  for (const p of points) {
    const [mx, my] = worldToMap(p.x, p.z);
    if (mx < minMx) minMx = mx;
    if (mx > maxMx) maxMx = mx;
    if (my < minMy) minMy = my;
    if (my > maxMy) maxMy = my;
  }

  const pad = Math.max(Math.max(maxMx - minMx, maxMy - minMy) * 0.1, 50);
  let x = Math.max(0, minMx - pad);
  let y = Math.max(0, minMy - pad);
  let w = Math.max(100, maxMx - minMx + pad * 2);
  let h = Math.max(100, maxMy - minMy + pad * 2);

  // Match container aspect ratio (prevents SVG meet-scaling squish)
  if (containerAspectRatio && containerAspectRatio > 0) {
    const boundsAspect = w / h;
    if (boundsAspect < containerAspectRatio) {
      // Bounds are relatively taller → expand width
      const newW = h * containerAspectRatio;
      x = Math.max(0, x - (newW - w) / 2);
      w = newW;
    } else {
      // Bounds are relatively wider → expand height
      const newH = w / containerAspectRatio;
      y = Math.max(0, y - (newH - h) / 2);
      h = newH;
    }
  }

  return { x, y, w, h };
}

/**
 * Interactive SVG-based map of the Satisfactory world showing
 * factory buildings, generators, extractors, and players with
 * hover tooltips, pan/zoom, layer toggles, and a coordinate readout.
 */
export function FactoryMap({ config, settings, saveSettings }: Props) {
  const { theme } = useTheme();

  /* ── Data state ── */

  const [factories, setFactories] = useState<FactoryBuilding[] | null>(null);
  const [generators, setGenerators] = useState<Generator[] | null>(null);
  const [extractors, setExtractors] = useState<Extractor[] | null>(null);
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ── ViewBox pan/zoom state ── */

  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: MAP_SIZE, h: MAP_SIZE });

  /** Mirror viewBox in a ref so drag handlers always read the latest value. */
  const viewBoxRef = useRef(viewBox);
  useEffect(() => { viewBoxRef.current = viewBox; }, [viewBox]);

  /** Mutable drag state — avoids re-renders during pan. */
  const dragRef = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    vbStart: { x: 0, y: 0 },
  });

  /** Ref on the map container to measure its dimensions for aspect-ratio matching. */
  const mapContainerRef = useRef<HTMLDivElement>(null);

  /* ── Tooltip state ── */

  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [cursorWorld, setCursorWorld] = useState<{ x: number; z: number } | null>(null);

  /** Ref to the SVG element for coordinate conversions. */
  const svgRef = useRef<SVGSVGElement>(null);

  /** Map image (preloaded for immediate rendering). */
  const mapImageRef = useRef<HTMLImageElement | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  /** Preload the map background image on mount. */
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      mapImageRef.current = img;
      setMapLoaded(true);
    };
    img.src = MAP_IMAGE_URL;
  }, []);

  /** Flag to track first auto-fit on initial data load. */
  const hasCentered = useRef(false);

  /* ── Visible layers ── */

  const visibleLayers = useMemo(() => new Set(settings.mapVisibleLayers), [settings.mapVisibleLayers]);

  /* ── Entity counts ── */

  const pointCounts = useMemo(
    () => countEntities(factories, generators, extractors, players),
    [factories, generators, extractors, players],
  );

  /* ── Data fetching ── */

  const fetchAll = useCallback(async () => {
    try {
      const [fac, gen, ext, ply] = await Promise.all([
        fetchEndpoint<FactoryBuilding[]>(config, 'getFactory'),
        fetchEndpoint<Generator[]>(config, 'getGenerators'),
        fetchEndpoint<Extractor[]>(config, 'getExtractor'),
        fetchEndpoint<Player[]>(config, 'getPlayer'),
      ]);
      setFactories(fac);
      setGenerators(gen);
      setExtractors(ext);
      setPlayers(ply);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch map data');
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  /* ── Auto-fit to building bounds on first data load ── */

  useEffect(() => {
    if (hasCentered.current) return;

    // Collect all points with valid locations
    const allPoints: { x: number; z: number }[] = [];
    if (factories) for (const f of factories) if (f.location) allPoints.push(f.location);
    if (generators) for (const g of generators) if (g.location) allPoints.push(g.location);
    if (extractors) for (const e of extractors) if (e.location) allPoints.push(e.location);
    if (players) for (const p of players) if (p.location) allPoints.push(p.location);

    if (allPoints.length === 0) return;

    const container = mapContainerRef.current;
    const aspect = container ? container.offsetWidth / container.offsetHeight : undefined;
    setViewBox(computeViewBoxBounds(allPoints, aspect));
    hasCentered.current = true;
  }, [factories, generators, extractors, players]);

  /* ── Zoom helpers ── */

  /** Zoom the viewBox by a factor (0.5–3×), keeping the center fixed. */
  const zoomBy = useCallback((factor: number) => {
    setViewBox((vb) => {
      const cx = vb.x + vb.w / 2;
      const cy = vb.y + vb.h / 2;
      const newW = Math.max(50, Math.min(MAP_SIZE * 3, vb.w * factor));
      const newH = newW * (vb.h / vb.w); // maintain aspect ratio
      return {
        x: cx - newW / 2,
        y: cy - newH / 2,
        w: newW,
        h: newH,
      };
    });
  }, []);

  /** Reset view to fit all building bounds (re-centers). */
  const fitToBounds = useCallback(() => {
    const allPoints: { x: number; z: number }[] = [];
    if (factories) for (const f of factories) if (f.location) allPoints.push(f.location);
    if (generators) for (const g of generators) if (g.location) allPoints.push(g.location);
    if (extractors) for (const e of extractors) if (e.location) allPoints.push(e.location);
    if (players) for (const p of players) if (p.location) allPoints.push(p.location);
    if (allPoints.length === 0) return;

    const container = mapContainerRef.current;
    const aspect = container ? container.offsetWidth / container.offsetHeight : undefined;
    setViewBox(computeViewBoxBounds(allPoints, aspect));
  }, [factories, generators, extractors, players]);

  /* ── Pan handlers ── */

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const d = dragRef.current;
    d.dragging = true;
    d.startX = e.clientX;
    d.startY = e.clientY;
    setViewBox((vb) => {
      d.vbStart = { x: vb.x, y: vb.y };
      return vb;
    });
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return;

      // Read latest viewBox from ref (avoids stale-closure issues during drag)
      const vb = viewBoxRef.current;

      // Update cursor world coordinates
      const world = screenToWorld(e.clientX, e.clientY, svg, vb);
      setCursorWorld(world);

      // Handle drag (pan)
      const d = dragRef.current;
      if (d.dragging) {
        const rect = svg.getBoundingClientRect();
        setViewBox((latestVb) => ({
          ...latestVb,
          x: d.vbStart.x - (e.clientX - d.startX) * (latestVb.w / rect.width),
          y: d.vbStart.y - (e.clientY - d.startY) * (latestVb.h / rect.height),
        }));
      }
    },
    [],
  );

  const handleMouseUp = useCallback(() => {
    dragRef.current.dragging = false;
  }, []);

  /** Handle zoom on mouse wheel (centered on cursor). */
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const factor = e.deltaY > 0 ? 1.15 : 0.87;

      setViewBox((vb) => {
        // Zoom toward cursor position
        const cursorVbX = ((e.clientX - rect.left) / rect.width) * vb.w + vb.x;
        const cursorVbY = ((e.clientY - rect.top) / rect.height) * vb.h + vb.y;
        const newW = Math.max(50, Math.min(MAP_SIZE * 3, vb.w * factor));
        const newH = newW * (vb.h / vb.w);

        return {
          x: cursorVbX - (cursorVbX - vb.x) * (newW / vb.w),
          y: cursorVbY - (cursorVbY - vb.y) * (newH / vb.h),
          w: newW,
          h: newH,
        };
      });
    },
    [],
  );

  /* ── Building hover/click handlers ── */

  /** Build the tooltip data for a hovered entity and position the tooltip. */
  const handleEntityHover = useCallback(
    (
      entity:
        | { type: 'factory'; data: FactoryBuilding }
        | { type: 'generator'; data: Generator }
        | { type: 'extractor'; data: Extractor }
        | { type: 'player'; data: Player },
      e: React.MouseEvent,
    ) => {
      setTooltipData(buildTooltip(entity));
      setTooltipPos({ x: e.clientX, y: e.clientY });
    },
    [],
  );

  /** Hide the tooltip (unless the entity is pinned). */
  const handleEntityLeave = useCallback(
    (id: string) => {
      if (pinnedId !== id) {
        setTooltipData(null);
      }
    },
    [pinnedId],
  );

  /** Track mouse position for tooltip repositioning. */
  const handleEntityMove = useCallback((e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, []);

  /** Toggle pinned tooltip on click. */
  const handleEntityClick = useCallback(
    (
      id: string,
      entity:
        | { type: 'factory'; data: FactoryBuilding }
        | { type: 'generator'; data: Generator }
        | { type: 'extractor'; data: Extractor }
        | { type: 'player'; data: Player },
      e: React.MouseEvent,
    ) => {
      e.stopPropagation();
      if (pinnedId === id) {
        // Unpin
        setPinnedId(null);
        setTooltipData(null);
      } else {
        setPinnedId(id);
        setTooltipData(buildTooltip(entity));
        setTooltipPos({ x: e.clientX, y: e.clientY });
      }
    },
    [pinnedId],
  );

  /** Click on the SVG background — unpin tooltip. */
  const handleSvgClick = useCallback(() => {
    if (pinnedId) {
      setPinnedId(null);
      setTooltipData(null);
    }
  }, [pinnedId]);

  /* ── Layer toggle ── */

  const toggleLayer = useCallback(
    (id: string) => {
      const next = new Set(visibleLayers);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveSettings({ mapVisibleLayers: Array.from(next) });
    },
    [visibleLayers, saveSettings],
  );

  /* ── Derived icon sizes ── */

  const iconSize = calcIconSize(viewBox.w, settings.mapIconScale);
  const hitRadius = calcHitRadius(viewBox.w);

  /* ── Render ── */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg className="animate-spin w-8 h-8" style={{ color: theme.accent }} fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-xl p-6 text-center"
        style={{ backgroundColor: theme.danger + '18', border: `1px solid ${theme.danger}33` }}
      >
        <p className="text-sm" style={{ color: theme.danger }}>
          {error}
        </p>
        <button
          onClick={fetchAll}
          className="mt-3 text-xs hover:underline"
          style={{ color: theme.accent }}
        >
          Retry
        </button>
      </div>
    );
  }

  const totalPoints =
    (factories?.length ?? 0) +
    (generators?.length ?? 0) +
    (extractors?.length ?? 0) +
    (players?.length ?? 0);

  const containerClasses = `${styles.mapContainer} ${dragRef.current.dragging ? styles.dragging : ''}`;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {LAYERS.map((l) => {
          const visible = visibleLayers.has(l.id);
          return (
            <button
              key={l.id}
              onClick={() => toggleLayer(l.id)}
              className="text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5"
              style={{
                backgroundColor: visible ? l.color + '22' : 'transparent',
                borderColor: visible ? l.color : theme.borderColor,
                color: visible ? l.color : theme.textSecondary,
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
              {l.label}
              <span className="opacity-60 ml-0.5">({pointCounts[l.id]})</span>
            </button>
          );
        })}
        <div className="flex-1" />
        <button
          onClick={fitToBounds}
          className="text-xs px-3 py-1.5 rounded-full border transition-colors"
          style={{
            backgroundColor: theme.bgCard,
            borderColor: theme.borderColor,
            color: theme.textSecondary,
          }}
          title="Fit all buildings in view"
        >
          ⊞ Fit
        </button>
      </div>

      {/* Map container */}
      <div ref={mapContainerRef} className={containerClasses} style={{ height: '650px' }}>
        {/* SVG map */}
        <svg
          ref={svgRef}
          className={styles.mapSvg}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          style={{ backgroundColor: '#1a1a2e' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onClick={handleSvgClick}
        >
          {/* Map background image */}
          {mapLoaded && (
            <image
              href={MAP_IMAGE_URL}
              x={IMG_MAP_X}
              y={IMG_MAP_Y}
              width={IMG_MAP_W}
              height={IMG_MAP_H}
              opacity={0.85}
              preserveAspectRatio="xMidYMid slice"
            />
          )}

          {/* Factory layer */}
          {visibleLayers.has('factory') && (
            <g id="factory-layer" data-layer="factory">
              {(factories ?? []).map((f) => {
                if (!f.location) return null;
                const [mx, my] = worldToMap(f.location.x, f.location.z);
                const iconPath = classNameToIconPath(bestIconClassName(f));
                return (
                  <g
                    key={f.ID}
                    onMouseEnter={(e) => handleEntityHover({ type: 'factory', data: f }, e)}
                    onMouseMove={handleEntityMove}
                    onMouseLeave={() => handleEntityLeave(f.ID)}
                    onClick={(e) => handleEntityClick(f.ID, { type: 'factory', data: f }, e)}
                  >
                    <circle cx={mx} cy={my} r={iconSize * 0.5} fill="#4A90D9" opacity={0.3} />
                    <image
                      href={iconPath}
                      width={iconSize}
                      height={iconSize}
                      x={mx - iconSize / 2}
                      y={my - iconSize / 2}
                    />
                    <circle
                      cx={mx}
                      cy={my}
                      r={hitRadius}
                      fill="transparent"
                      style={{ cursor: 'pointer' }}
                    />
                  </g>
                );
              })}
            </g>
          )}

          {/* Generator layer */}
          {visibleLayers.has('generator') && (
            <g id="generator-layer" data-layer="generator">
              {(generators ?? []).map((g) => {
                if (!g.location) return null;
                const [mx, my] = worldToMap(g.location.x, g.location.z);
                const iconPath = classNameToIconPath(bestIconClassName(g));
                return (
                  <g
                    key={g.ID}
                    onMouseEnter={(e) => handleEntityHover({ type: 'generator', data: g }, e)}
                    onMouseMove={handleEntityMove}
                    onMouseLeave={() => handleEntityLeave(g.ID)}
                    onClick={(e) => handleEntityClick(g.ID, { type: 'generator', data: g }, e)}
                  >
                    <circle cx={mx} cy={my} r={iconSize * 0.5} fill="#E8833A" opacity={0.3} />
                    <image
                      href={iconPath}
                      width={iconSize}
                      height={iconSize}
                      x={mx - iconSize / 2}
                      y={my - iconSize / 2}
                    />
                    <circle
                      cx={mx}
                      cy={my}
                      r={hitRadius}
                      fill="transparent"
                      style={{ cursor: 'pointer' }}
                    />
                  </g>
                );
              })}
            </g>
          )}

          {/* Extractor layer */}
          {visibleLayers.has('extractor') && (
            <g id="extractor-layer" data-layer="extractor">
              {(extractors ?? []).map((e) => {
                if (!e.location) return null;
                const [mx, my] = worldToMap(e.location.x, e.location.z);
                const iconPath = classNameToIconPath(bestIconClassName(e));
                return (
                  <g
                    key={e.ID}
                    onMouseEnter={(eve) => handleEntityHover({ type: 'extractor', data: e }, eve)}
                    onMouseMove={handleEntityMove}
                    onMouseLeave={() => handleEntityLeave(e.ID)}
                    onClick={(evt) => handleEntityClick(e.ID, { type: 'extractor', data: e }, evt)}
                  >
                    <circle cx={mx} cy={my} r={iconSize * 0.5} fill="#F5C842" opacity={0.3} />
                    <image
                      href={iconPath}
                      width={iconSize}
                      height={iconSize}
                      x={mx - iconSize / 2}
                      y={my - iconSize / 2}
                    />
                    <circle
                      cx={mx}
                      cy={my}
                      r={hitRadius}
                      fill="transparent"
                      style={{ cursor: 'pointer' }}
                    />
                  </g>
                );
              })}
            </g>
          )}

          {/* Player layer */}
          {visibleLayers.has('player') && (
            <g id="player-layer" data-layer="player">
              {(players ?? []).map((p) => {
                if (!p.location) return null;
                const [mx, my] = worldToMap(p.location.x, p.location.z);
                const pr = iconSize * 0.35;
                return (
                  <g
                    key={p.ID}
                    onMouseEnter={(e) => handleEntityHover({ type: 'player', data: p }, e)}
                    onMouseMove={handleEntityMove}
                    onMouseLeave={() => handleEntityLeave(p.ID)}
                    onClick={(e) => handleEntityClick(p.ID, { type: 'player', data: p }, e)}
                  >
                    {/* Pulse ring */}
                    <circle cx={mx} cy={my} className={styles.playerPulse} style={{ '--ping-r': `${pr * 2}px` } as React.CSSProperties} fill="none" stroke="#00E5FF" strokeWidth={pr * 0.3}>
                      <animate attributeName="r" values={`${pr * 2};${pr * 5}`} dur="1.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.3;0" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                    {/* Core dot */}
                    <circle cx={mx} cy={my} r={pr} fill="#00E5FF" />
                    {/* Hit area */}
                    <circle cx={mx} cy={my} r={hitRadius} fill="transparent" style={{ cursor: 'pointer' }} />
                  </g>
                );
              })}
            </g>
          )}

          {/* Empty state overlay */}
          {totalPoints === 0 && (
            <text
              x={viewBox.w / 2}
              y={viewBox.h / 2}
              textAnchor="middle"
              fill={theme.textSecondary}
              fontSize={Math.max(14, viewBox.w / 200)}
              fontFamily="sans-serif"
            >
              No building data yet
            </text>
          )}
        </svg>

        {/* Zoom controls */}
        <div className={styles.zoomControls}>
          <button className={styles.zoomBtn} onClick={() => zoomBy(0.7)} title="Zoom in">
            +
          </button>
          <button className={styles.zoomBtn} onClick={() => zoomBy(1.4)} title="Zoom out">
            −
          </button>
          <button className={styles.zoomBtn} onClick={fitToBounds} title="Fit to bounds">
            ⊞
          </button>
        </div>

        {/* Cursor coordinates */}
        <div className={styles.coordinates}>
          {cursorWorld ? (
            <>
              <div>X: {cursorWorld.x.toFixed(1)}</div>
              <div>Z: {cursorWorld.z.toFixed(1)}</div>
            </>
          ) : (
            <div className="opacity-40">X: — Z: —</div>
          )}
        </div>

        {/* Tooltip overlay */}
        {tooltipData && (
          <TooltipPanel
            data={tooltipData}
            pinned={pinnedId === tooltipData.id}
            onClose={() => {
              setPinnedId(null);
              setTooltipData(null);
            }}
          />
        )}
      </div>

      {/* Legend footer */}
      <div className="text-xs flex flex-wrap gap-x-4 gap-y-1" style={{ color: theme.textSecondary }}>
        <span>🖱️ Hover for details · Drag to pan · Scroll to zoom · Click to pin</span>
        <span className="ml-auto">{totalPoints} entities</span>
      </div>
    </div>
  );
}
