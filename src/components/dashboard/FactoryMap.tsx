'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FRMConfig, FactoryBuilding, Generator, Extractor, Player, AppSettings } from '@/lib/types';
import { fetchEndpoint } from '@/lib/api';
import { useTheme } from '@/lib/useTheme';

interface Props {
  config: FRMConfig;
  settings: AppSettings;
  saveSettings: (partial: Partial<AppSettings>) => void;
}

interface MapPoint {
  x: number;
  z: number;
  type: 'factory' | 'generator' | 'extractor' | 'player';
  className: string;
  name: string;
  subType: string;
}

const LAYERS = [
  { id: 'factory', label: 'Factory Buildings', color: '#4A90D9' },
  { id: 'generator', label: 'Generators', color: '#E8833A' },
  { id: 'extractor', label: 'Extractors', color: '#F5C842' },
  { id: 'player', label: 'Players', color: '#00E5FF' },
] as const;

// Satisfactory world map bounds (Unreal cm) — matches SCIM community map
const MAP_MIN = -425000;
const MAP_MAX = 425000;
const MAP_SIZE = 8192;
const MAP_RANGE = MAP_MAX - MAP_MIN;

// ─── Wiki map image ─────────────────────────────────────
const MAP_IMAGE_URL = 'https://static.wikia.nocookie.net/satisfactory_gamepedia_en/images/e/ea/Map.jpg';

// World bounds covered by the wiki Map.jpg (matches SCIM tile extents)
const IMG_WORLD_WEST = -418448;
const IMG_WORLD_EAST = 519051;
const IMG_WORLD_NORTH = -468750;
const IMG_WORLD_SOUTH = 468750;
const IMG_WORLD_WIDTH = IMG_WORLD_EAST - IMG_WORLD_WEST;
const IMG_WORLD_HEIGHT = IMG_WORLD_SOUTH - IMG_WORLD_NORTH;

/* ─── coordinate helpers ─── */

function worldToMap(wx: number, wz: number): [number, number] {
  return [
    ((wx - MAP_MIN) / MAP_RANGE) * MAP_SIZE,
    ((wz - MAP_MIN) / MAP_RANGE) * MAP_SIZE,
  ];
}

function mapToScreen(
  mx: number, my: number,
  cx: number, cy: number,
  scale: number,
  canvasW: number, canvasH: number,
): [number, number] {
  return [
    (mx - cx) * scale + canvasW / 2,
    (my - cy) * scale + canvasH / 2,
  ];
}

function classNameToIconPath(className: string): string | null {
  // Build_ConstructorMk1_C → Desc_ConstructorMk1_C.png
  const desc = className.replace(/^Build_/, 'Desc_');
  return `./Icons/${desc}.png`;
}

export function FactoryMap({ config, settings, saveSettings }: Props) {
  const { theme } = useTheme();

  const [factories, setFactories] = useState<FactoryBuilding[] | null>(null);
  const [generators, setGenerators] = useState<Generator[] | null>(null);
  const [extractors, setExtractors] = useState<Extractor[] | null>(null);
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Pan/zoom state — center in map-pixel coordinates
  const stateRef = useRef({
    cx: MAP_SIZE / 2,
    cy: MAP_SIZE / 2,
    scale: 0.02,
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
  });

  // Map image (loaded async, drawn on canvas)
  const mapImageRef = useRef<HTMLImageElement | null>(null);

  const visibleLayers = new Set(settings.mapVisibleLayers);

  // ─── Preload map image ─────────────────────────────────

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => { mapImageRef.current = img; };
    img.src = MAP_IMAGE_URL;
  }, []);

  // ─── Icon cache ────────────────────────────────────────

  const iconCache = useRef<Map<string, HTMLImageElement | null>>(new Map());

  const getIcon = useCallback((className: string): HTMLImageElement | null => {
    const cache = iconCache.current;
    if (cache.has(className)) return cache.get(className) ?? null;

    const path = classNameToIconPath(className);
    if (!path) {
      cache.set(className, null);
      return null;
    }

    const img = new Image();
    img.onload = () => cache.set(className, img);
    img.onerror = () => cache.set(className, null);
    img.src = path;
    cache.set(className, null); // placeholder while loading
    return null;
  }, []);

  // ─── Build point list ──────────────────────────────────

  const points: MapPoint[] = useMemo(() => {
    const result: MapPoint[] = [];
    if (factories) {
      for (const f of factories) {
        if (f.location) {
          result.push({
            x: f.location.x,
            z: f.location.z,
            type: 'factory',
            className: f.ClassName,
            name: f.Name,
            subType: f.ClassName.replace('Build_', '').replace('_C', ''),
          });
        }
      }
    }
    if (generators) {
      for (const g of generators) {
        if (g.location) {
          result.push({
            x: g.location.x,
            z: g.location.z,
            type: 'generator',
            className: g.ClassName,
            name: g.Name,
            subType: g.ClassName.replace('Build_', '').replace('_C', ''),
          });
        }
      }
    }
    if (extractors) {
      for (const e of extractors) {
        if (e.location) {
          result.push({
            x: e.location.x,
            z: e.location.z,
            type: 'extractor',
            className: e.ClassName,
            name: e.Name,
            subType: e.ClassName.replace('Build_', '').replace('_C', ''),
          });
        }
      }
    }
    if (players) {
      for (const p of players) {
        if (p.location) {
          result.push({
            x: p.location.x,
            z: p.location.z,
            type: 'player',
            className: '',
            name: p.Name || 'Player',
            subType: 'player',
          });
        }
      }
    }
    return result;
  }, [factories, generators, extractors, players]);

  // Compute world bounds for auto-center
  const bounds = useMemo(() => {
    if (points.length === 0) return { minX: -5000, maxX: 5000, minZ: -5000, maxZ: 5000 };
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
    const padX = Math.max((maxX - minX) * 0.1, 2000);
    const padZ = Math.max((maxZ - minZ) * 0.1, 2000);
    return { minX: minX - padX, maxX: maxX + padX, minZ: minZ - padZ, maxZ: maxZ + padZ };
  }, [points]);

  const pointCounts = useMemo(() => ({
    factory: factories?.length ?? 0,
    generator: generators?.length ?? 0,
    extractor: extractors?.length ?? 0,
    player: players?.length ?? 0,
  }), [factories, generators, extractors, players]);

  // ─── Initial auto-center (once) ────────────────────────

  const hasCentered = useRef(false);
  useEffect(() => {
    if (!hasCentered.current && points.length > 0) {
      const s = stateRef.current;
      const [cx, cy] = worldToMap(
        (bounds.minX + bounds.maxX) / 2,
        (bounds.minZ + bounds.maxZ) / 2,
      );
      s.cx = cx;
      s.cy = cy;
      hasCentered.current = true;
    }
  }, [bounds, points.length]);

  // ─── Drawing ───────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const w = rect.width;
    const h = rect.height;
    const s = stateRef.current;

    // ── Dark background ──
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    // ── Draw wiki map image (canvas-based, same coordinate system as buildings) ──
    const mapImg = mapImageRef.current;
    if (mapImg && mapImg.complete && mapImg.naturalWidth > 0) {
      const [imgMx, imgMy] = worldToMap(IMG_WORLD_WEST, IMG_WORLD_NORTH);
      const [imgSx, imgSy] = mapToScreen(imgMx, imgMy, s.cx, s.cy, s.scale, w, h);
      const imgSw = (IMG_WORLD_WIDTH / MAP_RANGE) * MAP_SIZE * s.scale;
      const imgSh = (IMG_WORLD_HEIGHT / MAP_RANGE) * MAP_SIZE * s.scale;
      ctx.globalAlpha = 0.85;
      ctx.drawImage(mapImg, imgSx, imgSy, imgSw, imgSh);
      ctx.globalAlpha = 1;
    }

    if (points.length === 0) {
      ctx.fillStyle = theme.textSecondary;
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No building data yet', w / 2, h / 2);
      return;
    }

    // ── Draw building icons ──
    const iconSize = Math.max(16, Math.min(48, 32 * s.scale / 0.02 * settings.mapIconScale));
    const playerRadius = Math.max(6, iconSize * 0.5);

    const layerOrder: MapPoint['type'][] = ['extractor', 'factory', 'generator', 'player'];
    for (const layer of layerOrder) {
      if (!visibleLayers.has(layer)) continue;
      const layerDef = LAYERS.find(l => l.id === layer);
      if (!layerDef) continue;

      const layerPoints = points.filter(p => p.type === layer);

      for (const p of layerPoints) {
        const [mx, my] = worldToMap(p.x, p.z);
        const [sx, sy] = mapToScreen(mx, my, s.cx, s.cy, s.scale, w, h);

        if (sx < -iconSize || sx > w + iconSize || sy < -iconSize || sy > h + iconSize) continue;

        if (p.type === 'player') {
          // Player marker — pulsing circle
          ctx.beginPath();
          ctx.arc(sx, sy, playerRadius + 3, 0, Math.PI * 2);
          ctx.fillStyle = layerDef.color + '22';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(sx, sy, playerRadius, 0, Math.PI * 2);
          ctx.fillStyle = layerDef.color;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(sx, sy, playerRadius + 2, 0, Math.PI * 2);
          ctx.strokeStyle = layerDef.color;
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          // Try icon, fallback to colored dot
          const icon = getIcon(p.className);
          if (icon && icon.complete && icon.naturalWidth > 0) {
            const half = iconSize / 2;
            ctx.drawImage(icon, sx - half, sy - half, iconSize, iconSize);
          } else {
            // Fallback dot while icon loads
            const r = iconSize / 3;
            ctx.beginPath();
            ctx.arc(sx, sy, r + 2, 0, Math.PI * 2);
            ctx.fillStyle = layerDef.color + '15';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(sx, sy, r, 0, Math.PI * 2);
            ctx.fillStyle = layerDef.color;
            ctx.fill();
          }
        }
      }
    }

    // ── Scale bar ──
    const barWorld = 200; // meters
    const barPx = barWorld * 100 * (MAP_SIZE / MAP_RANGE) * s.scale;
    if (barPx > 40) {
      const barX = 16;
      const barY = h - 24;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(barX, barY);
      ctx.lineTo(barX + barPx, barY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(barX, barY - 6);
      ctx.lineTo(barX, barY + 6);
      ctx.moveTo(barX + barPx, barY - 6);
      ctx.lineTo(barX + barPx, barY + 6);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${barWorld}m`, barX + barPx / 2, barY - 8);
    }
  }, [points, visibleLayers, theme, getIcon, settings.mapIconScale]);

  // ─── Animation loop ────────────────────────────────────

  const animRef = useRef<number>(0);
  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running) return;
      draw();
      animRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [draw]);

  // ─── Canvas ref callback — attaches wheel listener ────

  const attachCanvas = useCallback((el: HTMLCanvasElement | null) => {
    // Detach previous listener if any
    const prev = canvasRef.current;
    if (prev && (prev as any).__wheelHandler) {
      prev.removeEventListener('wheel', (prev as any).__wheelHandler);
    }
    canvasRef.current = el;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = stateRef.current;
      const rect = el.getBoundingClientRect();
      const mx = s.cx + (e.clientX - rect.left - rect.width / 2) / s.scale;
      const my = s.cy + (e.clientY - rect.top - rect.height / 2) / s.scale;
      const zoomFactor = 1.15;
      const newScale = e.deltaY < 0
        ? Math.min(5, s.scale * zoomFactor)
        : Math.max(0.005, s.scale / zoomFactor);
      s.cx = mx - (mx - s.cx) * (s.scale / newScale);
      s.cy = my - (my - s.cy) * (s.scale / newScale);
      s.scale = newScale;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    (el as any).__wheelHandler = onWheel;
  }, []);

  // ─── Mouse handlers ────────────────────────────────────

  const getMapFromEvent = useCallback((e: React.MouseEvent): [number, number] => {
    const canvas = canvasRef.current;
    if (!canvas) return [MAP_SIZE / 2, MAP_SIZE / 2];
    const rect = canvas.getBoundingClientRect();
    const s = stateRef.current;
    return [
      s.cx + (e.clientX - rect.left - rect.width / 2) / s.scale,
      s.cy + (e.clientY - rect.top - rect.height / 2) / s.scale,
    ];
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const s = stateRef.current;
    s.dragging = true;
    s.dragStartX = e.clientX;
    s.dragStartY = e.clientY;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const s = stateRef.current;
    if (!s.dragging) return;
    const dx = e.clientX - s.dragStartX;
    const dy = e.clientY - s.dragStartY;
    s.cx -= dx / s.scale;
    s.cy -= dy / s.scale;
    s.dragStartX = e.clientX;
    s.dragStartY = e.clientY;
  }, []);

  const handleMouseUp = useCallback(() => {
    stateRef.current.dragging = false;
  }, []);

  // Wheel handler is attached manually via useEffect (see above)

  const toggleLayer = (id: string) => {
    const next = new Set(visibleLayers);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    saveSettings({ mapVisibleLayers: Array.from(next) });
  };

  // Fit to bounds
  const fitToBounds = useCallback(() => {
    if (points.length === 0) return;
    const [cx, cy] = worldToMap(
      (bounds.minX + bounds.maxX) / 2,
      (bounds.minZ + bounds.maxZ) / 2,
    );
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const bw = ((bounds.maxX - bounds.minX) / MAP_RANGE) * MAP_SIZE;
    const bh = ((bounds.maxZ - bounds.minZ) / MAP_RANGE) * MAP_SIZE;
    const scale = Math.min(rect.width / bw, rect.height / bh) * 0.85;
    const s = stateRef.current;
    s.cx = cx;
    s.cy = cy;
    s.scale = Math.max(0.005, Math.min(5, scale));
  }, [bounds, points.length]);

  // ─── Data fetching ─────────────────────────────────────

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

  // ─── Render ────────────────────────────────────────────

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
      <div className="rounded-xl p-6 text-center" style={{ backgroundColor: theme.danger + '18', border: `1px solid ${theme.danger}33` }}>
        <p className="text-sm" style={{ color: theme.danger }}>{error}</p>
        <button onClick={fetchAll} className="mt-3 text-xs hover:underline" style={{ color: theme.accent }}>Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {LAYERS.map(l => (
          <button
            key={l.id}
            onClick={() => toggleLayer(l.id)}
            className="text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5"
            style={{
              backgroundColor: visibleLayers.has(l.id) ? l.color + '22' : 'transparent',
              borderColor: visibleLayers.has(l.id) ? l.color : theme.borderColor,
              color: visibleLayers.has(l.id) ? l.color : theme.textSecondary,
            }}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
            {l.label}
            <span className="opacity-60 ml-0.5">({pointCounts[l.id as keyof typeof pointCounts]})</span>
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-xs" style={{ color: theme.textSecondary, opacity: 0.6 }}>Wiki map</span>
        <button
          onClick={fitToBounds}
          className="text-xs px-3 py-1.5 rounded-full border transition-colors"
          style={{ backgroundColor: theme.bgCard, borderColor: theme.borderColor, color: theme.textSecondary }}
          title="Fit all buildings in view"
        >
          ⊞ Fit
        </button>
      </div>

      {/* Canvas + Tile container */}
      <div
        className="relative w-full rounded-xl overflow-hidden"
        style={{ height: '650px', backgroundColor: '#1a1a2e', border: `1px solid ${theme.borderColor}` }}
      >
        {/* Canvas for building markers + scale bar (map image drawn underneath via ctx.drawImage) */}
        <canvas
          ref={attachCanvas}
          className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
          style={{ pointerEvents: 'auto' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />

        <div className="absolute bottom-3 left-3 text-[10px] font-mono pointer-events-none opacity-50" style={{ color: theme.textSecondary }}>
          {points.length > 0
            ? `${points.length} entities · Pan + zoom to explore`
            : 'No data — connect to a game'}
        </div>
      </div>

      <div className="text-xs flex flex-wrap gap-x-4 gap-y-1" style={{ color: theme.textSecondary }}>
        <span>🖱️ Drag to pan · Scroll to zoom · ⊞ Fit to reset</span>
        <span className="ml-auto">{points.length} entities</span>
      </div>
    </div>
  );
}
