'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FRMConfig, TrainStation, TrainResponse, Railcar } from '@/lib/types';
import { fetchEndpoint } from '@/lib/api';
import { useTheme } from '@/lib/useTheme';
import { formatNumber } from '@/lib/formatters';
import { cleanName } from '@/lib/names';

interface Props {
  config: FRMConfig;
}

/* ─── Constants ─── */
const WORLD_MIN = -425000;
const WORLD_MAX = 425000;
const GRID_SIZE = 100000; // grid cell size in UE cm
const REFRESH_MS = 4000;
const CTRL_GREEN = '#00ff88';
const CTRL_AMBER = '#ffb020';
const CTRL_RED = '#ff4444';
const CTRL_BG = '#0a0f0a';

/* ─── Helpers ─── */

/**
 * Maps Satisfactory world coordinates (UE cm) to a normalized [0,1] range
 * based on known world bounds. Used by TrackMap to position stations and
 * trains within the SVG viewport.
 */
function worldToGrid(wx: number, wz: number): [number, number] {
  return [
    (wx - WORLD_MIN) / (WORLD_MAX - WORLD_MIN),
    (wz - WORLD_MIN) / (WORLD_MAX - WORLD_MIN),
  ];
}

/**
 * Formats train speed in km/h with appropriate precision:
 * speeds >= 100 show no decimals; slower speeds show one decimal.
 */
function fmtSpeed(kmh: number): string {
  if (kmh >= 100) return `${kmh.toFixed(0)}`;
  return kmh.toFixed(1);
}

/* ═══════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════ */
export function TrainControlTower({ config }: Props) {
  const { theme } = useTheme();

  const [stations, setStations] = useState<TrainStation[] | null>(null);
  const [trains, setTrains] = useState<TrainResponse[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ type: 'train' | 'station'; id: string } | null>(null);
  const [showAllTrains, setShowAllTrains] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [stationData, trainData] = await Promise.all([
        fetchEndpoint<TrainStation[]>(config, 'getTrainStation'),
        fetchEndpoint<TrainResponse[]>(config, 'getTrains'),
      ]);

      setStations(stationData ?? []);
      setTrains(trainData ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch rail data');
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ── Derived ──
  const activeTrains = useMemo(
    () => (trains ?? []).filter((t) => t.Status === 'Self-Driving'),
    [trains],
  );
  const totalCargo = useMemo(
    () =>
      (trains ?? []).reduce(
        (sum, t) =>
          sum +
          (t.Vehicles ?? []).reduce(
            (cs, v) => cs + (v.Inventory ?? []).reduce((c, i) => c + i.Amount, 0),
            0,
          ),
        0,
      ),
    [trains],
  );

  const stationsWithTrains = useMemo(
    () => (stations ?? []).filter((s) => (trains ?? []).some((t) => t.TrainStation === s.Name)),
    [stations, trains],
  );

  // ── Loading / Error ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" style={{ backgroundColor: CTRL_BG }}>
        <svg className="animate-spin w-8 h-8" style={{ color: CTRL_GREEN }} fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl p-6 text-center" style={{ backgroundColor: '#1a1111', border: `1px solid ${CTRL_RED}33` }}>
        <p className="text-sm" style={{ color: CTRL_RED }}>{error}</p>
        <button onClick={fetchData} className="mt-3 text-xs hover:underline" style={{ color: CTRL_AMBER }}>Retry</button>
      </div>
    );
  }

  // ── Render ──
  return (
    <div className="flex flex-col h-full gap-3" style={{ backgroundColor: CTRL_BG, minHeight: 650 }}>
      {/* ─── Status Bar ─── */}
      <StatusBar
        trains={trains?.length ?? 0}
        stations={stations?.length ?? 0}
        activeTrains={activeTrains.length}
        totalCargo={totalCargo}
      />

      {/* ─── Main Grid ─── */}
      <div className="flex-1 grid grid-cols-12 gap-3 min-h-0">
        {/* Left: Departures Board */}
        <div className="col-span-3 flex flex-col min-h-0 overflow-hidden rounded-lg border" style={{ borderColor: `${CTRL_GREEN}20`, backgroundColor: '#080e08' }}>
          <div className="px-3 py-2 border-b flex items-center gap-2" style={{ borderColor: `${CTRL_GREEN}15` }}>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: CTRL_GREEN }}>Departures</span>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse ml-auto" style={{ backgroundColor: CTRL_GREEN }} />
          </div>
          <div className="flex-1 overflow-auto">
            <DeparturesBoard
              trains={activeTrains}
              selected={selected}
              onSelect={(id) => setSelected(selected?.id === id && selected?.type === 'train' ? null : { type: 'train', id })}
              showAll={showAllTrains}
              onToggleAll={() => setShowAllTrains(!showAllTrains)}
            />
          </div>
        </div>

        {/* Center: Track Map */}
        <div className="col-span-6 rounded-lg border overflow-hidden relative" style={{ borderColor: `${CTRL_GREEN}20`, backgroundColor: '#060a06' }}>
          <div className="absolute top-2 left-3 z-10 text-[10px] uppercase tracking-widest opacity-60" style={{ color: CTRL_GREEN }}>
            Track Monitor
          </div>
          <TrackMap
            stations={stations ?? []}
            trains={activeTrains}
            selected={selected}
            onSelectTrain={(id) => setSelected(selected?.id === id && selected?.type === 'train' ? null : { type: 'train', id })}
            onSelectStation={(id) => setSelected(selected?.id === id && selected?.type === 'station' ? null : { type: 'station', id })}
          />
        </div>

        {/* Right: Detail Panel */}
        <div className="col-span-3 flex flex-col min-h-0 overflow-hidden rounded-lg border" style={{ borderColor: `${CTRL_GREEN}20`, backgroundColor: '#080e08' }}>
          <div className="px-3 py-2 border-b" style={{ borderColor: `${CTRL_GREEN}15` }}>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: CTRL_GREEN }}>
              {selected?.type === 'train' ? 'Train Detail' : selected?.type === 'station' ? 'Station Detail' : 'Overview'}
            </span>
          </div>
          <div className="flex-1 overflow-auto p-3">
            {selected?.type === 'train' ? (
              <TrainDetail
                train={trains?.find((t) => t.ID === selected.id) ?? null}
                onSelectStation={(id) => setSelected({ type: 'station', id })}
              />
            ) : selected?.type === 'station' ? (
              <StationDetail station={stations?.find((s) => s.ID === selected.id) ?? null} />
            ) : (
              <OverviewPanel stations={stations ?? []} trains={trains ?? []} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Status Bar
   ═══════════════════════════════════════════════════════ */
/**
 * Status indicator bar showing train statistics: total trains,
 * active vs. self-driving, stations, and next departure.
 */
function StatusBar({
  trains,
  stations,
  activeTrains,
  totalCargo,
}: {
  trains: number;
  stations: number;
  activeTrains: number;
  totalCargo: number;
}) {
  return (
    <div
      className="flex items-center gap-6 px-4 py-3 rounded-lg border"
      style={{ borderColor: `${CTRL_GREEN}20`, backgroundColor: '#080e08' }}
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest opacity-60" style={{ color: CTRL_GREEN }}>
          SYS OK
        </span>
        <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: CTRL_GREEN }} />
      </div>
      <div className="h-4 w-px" style={{ backgroundColor: `${CTRL_GREEN}20` }} />
      <StatBlock label="Trains" value={trains} sub={`${activeTrains} active`} />
      <StatBlock label="Stations" value={stations} />
      <StatBlock label="Cargo" value={totalCargo} color={CTRL_AMBER} />
      <div className="ml-auto text-[10px] font-mono opacity-40" style={{ color: CTRL_GREEN }}>
        {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
}

/**
 * Single statistic block with icon, label, value, and optional
 * delta change indicator. Used in StatusBar and detail panels.
 */
function StatBlock({
  label,
  value,
  sub,
  color = CTRL_GREEN,
}: {
  label: string;
  value: number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] uppercase tracking-wider opacity-50" style={{ color }}>
        {label}
      </span>
      <span className="text-lg font-bold font-mono" style={{ color }}>
        {formatNumber(value)}
      </span>
      {sub && (
        <span className="text-[9px] opacity-50" style={{ color }}>
          {sub}
        </span>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Departures Board
   ═══════════════════════════════════════════════════════ */
/**
 * Departures board showing the next few trains arriving at or
 * departing from stations, with ETA countdown timers.
 */
function DeparturesBoard({
  trains,
  selected,
  onSelect,
  showAll,
  onToggleAll,
}: {
  trains: TrainResponse[];
  selected: { type: 'train' | 'station'; id: string } | null;
  onSelect: (id: string) => void;
  showAll: boolean;
  onToggleAll: () => void;
}) {
  const displayTrains = showAll ? trains : trains.filter((t) => t.ForwardSpeed > 1);

  if (displayTrains.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-[11px] opacity-40" style={{ color: CTRL_GREEN }}>
          {showAll ? 'No trains detected' : 'No trains in motion'}
        </p>
        <button
          onClick={onToggleAll}
          className="mt-2 text-[9px] underline opacity-50 hover:opacity-100"
          style={{ color: CTRL_GREEN }}
        >
          Show all trains
        </button>
      </div>
    );
  }

  return (
    <table className="w-full text-[10px] font-mono">
      <thead>
        <tr className="border-b" style={{ borderColor: `${CTRL_GREEN}10` }}>
          <th className="text-left px-3 py-2 font-normal opacity-40" style={{ color: CTRL_GREEN }}>TRAIN</th>
          <th className="text-left px-3 py-2 font-normal opacity-40" style={{ color: CTRL_GREEN }}>STATION</th>
          <th className="text-right px-3 py-2 font-normal opacity-40" style={{ color: CTRL_GREEN }}>KM/H</th>
          <th className="text-right px-3 py-2 font-normal opacity-40" style={{ color: CTRL_GREEN }}>CARS</th>
        </tr>
      </thead>
      <tbody>
        {displayTrains.map((train) => {
          const isSelected = selected?.type === 'train' && selected.id === train.ID;
          const stationName = train.TrainStation !== 'No Station' ? train.TrainStation : null;
          const speed = train.ForwardSpeed ?? 0;
          const moving = speed > 1;

          return (
            <tr
              key={train.ID}
              onClick={() => onSelect(train.ID)}
              className={`cursor-pointer border-b transition-colors train-row ${isSelected ? 'train-selected' : ''}`}
              style={{
                borderColor: `${CTRL_GREEN}08`,
                backgroundColor: isSelected ? `${CTRL_GREEN}15` : 'transparent',
              }}
            >
              <td className="px-3 py-1.5" style={{ color: isSelected ? CTRL_GREEN : moving ? '#ccd' : '#556' }}>
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: moving ? CTRL_GREEN : '#333' }}
                  />
                  {train.Name || 'Train'}
                </div>
              </td>
              <td className="px-3 py-1.5 truncate max-w-[120px]" style={{ color: stationName ? (isSelected ? CTRL_GREEN : '#889') : '#333' }}>
                {stationName || '—'}
              </td>
              <td className="px-3 py-1.5 text-right" style={{ color: moving ? CTRL_GREEN : '#444' }}>
                {moving ? fmtSpeed(speed) : '—'}
              </td>
              <td className="px-3 py-1.5 text-right" style={{ color: CTRL_AMBER }}>
                {train.Vehicles?.length ?? 0}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ═══════════════════════════════════════════════════════
   Track Map (SVG)
   ═══════════════════════════════════════════════════════ */
/**
 * SVG track map rendering all stations and active trains on a
 * top-down grid view of the Satisfactory world. Supports pan
 * and hover tooltips.
 */
function TrackMap({
  stations,
  trains,
  selected,
  onSelectTrain,
  onSelectStation,
}: {
  stations: TrainStation[];
  trains: TrainResponse[];
  selected: { type: 'train' | 'station'; id: string } | null;
  onSelectTrain: (id: string) => void;
  onSelectStation: (id: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 1000, h: 1000 });
  const [drag, setDrag] = useState<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Compute bounds to auto-fit
  const allPoints = useMemo(() => {
    const pts: { id: string; type: 'station' | 'train'; x: number; z: number }[] = [];
    for (const s of stations) {
      if (s.location) pts.push({ id: s.ID, type: 'station', x: s.location.x, z: s.location.z });
    }
    for (const t of trains) {
      if (t.location) pts.push({ id: t.ID, type: 'train', x: t.location.x, z: t.location.z });
    }
    return pts;
  }, [stations, trains]);

  // Map world coords → SVG coords
  const toSvg = useCallback(
    (wx: number, wz: number): [number, number] => {
      const [nx, nz] = worldToGrid(wx, wz);
      return [
        viewBox.x + nx * viewBox.w,
        viewBox.y + nz * viewBox.h,
      ];
    },
    [viewBox],
  );

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setDrag({ startX: e.clientX, startY: e.clientY, origX: viewBox.x, origY: viewBox.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    setViewBox((vb) => ({ ...vb, x: drag.origX - dx * (vb.w / 600), y: drag.origY - dy * (vb.h / 600) }));
  };
  const handleMouseUp = () => setDrag(null);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.15 : 0.87;
    const newW = viewBox.w * factor;
    const newH = viewBox.h * factor;
    setViewBox((vb) => ({ ...vb, w: newW, h: newH }));
  };

  // Draw grid lines
  const gridLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const step = 100000;
    for (let wx = Math.floor(WORLD_MIN / step) * step; wx <= WORLD_MAX; wx += step) {
      const [sx] = toSvg(wx, 0);
      lines.push({ x1: sx, y1: viewBox.y, x2: sx, y2: viewBox.y + viewBox.h });
    }
    for (let wz = Math.floor(WORLD_MIN / step) * step; wz <= WORLD_MAX; wz += step) {
      const [, sy] = toSvg(0, wz);
      lines.push({ x1: viewBox.x, y1: sy, x2: viewBox.x + viewBox.w, y2: sy });
    }
    return lines;
  }, [viewBox, toSvg]);

  return (
    <svg
      ref={svgRef}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
      className="w-full h-full cursor-grab"
      style={drag ? { cursor: 'grabbing' } : undefined}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Grid */}
      {gridLines.map((l, i) => (
        <line key={i} {...l} stroke={`${CTRL_GREEN}10`} strokeWidth={viewBox.w / 500} />
      ))}

      {/* Train → Station connection lines */}
      {trains.map((t) => {
        if (!t.location || !t.TrainStation || t.TrainStation === 'No Station') return null;
        // Find matching station by name
        const station = stations.find((s) => s.Name === t.TrainStation);
        if (!station?.location) return null;
        const [tx, tz] = toSvg(t.location.x, t.location.z);
        const [sx, sy] = toSvg(station.location.x, station.location.z);
        return (
          <line
            key={`conn-${t.ID}`}
            x1={tx} y1={tz} x2={sx} y2={sy}
            stroke={`${CTRL_GREEN}20`}
            strokeWidth={viewBox.w / 500}
            strokeDasharray={`${viewBox.w / 80},${viewBox.w / 100}`}
          />
        );
      })}

      {/* Station dots */}
      {stations.map((s) => {
        if (!s.location) return null;
        const [sx, sy] = toSvg(s.location.x, s.location.z);
        const isSel = selected?.type === 'station' && selected.id === s.ID;
        const r = isSel ? viewBox.w / 60 : viewBox.w / 90;
        return (
          <g key={s.ID} onClick={() => onSelectStation(s.ID)} className="cursor-pointer">
            <circle
              cx={sx} cy={sy} r={r}
              fill={isSel ? CTRL_GREEN : '#000'}
              stroke={isSel ? CTRL_GREEN : `${CTRL_GREEN}60`}
              strokeWidth={isSel ? r / 2 : r / 3}
            />
            <text
              x={sx} y={sy - r * 1.8}
              textAnchor="middle"
              fontSize={viewBox.w / 70}
              fill={isSel ? CTRL_GREEN : `${CTRL_GREEN}60`}
              fontFamily="monospace"
              style={{ userSelect: 'none' }}
            >
              {cleanName(s.Name).slice(0, 12)}
            </text>
          </g>
        );
      })}

      {/* Train dots */}
      {trains.map((t) => {
        if (!t.location) return null;
        const [tx, tz] = toSvg(t.location.x, t.location.z);
        const isSel = selected?.type === 'train' && selected.id === t.ID;
        const moving = (t.ForwardSpeed ?? 0) > 1;
        const r = isSel ? viewBox.w / 50 : viewBox.w / 70;
        return (
          <g key={t.ID} onClick={() => onSelectTrain(t.ID)} className="cursor-pointer">
            {/* Direction indicator for moving trains */}
            {moving && (
              <circle
                cx={tx} cy={tz} r={r * 2.5}
                fill="none"
                stroke={CTRL_GREEN}
                strokeWidth={1}
                opacity={0.15}
              >
                <animate attributeName="r" from={r * 2} to={r * 5} dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.3" to="0" dur="1.5s" repeatCount="indefinite" />
              </circle>
            )}
            <rect
              x={tx - r} y={tz - r * 0.6} width={r * 2} height={r * 1.2}
              rx={r * 0.3} ry={r * 0.3}
              fill={moving ? CTRL_GREEN : '#222'}
              stroke={isSel ? CTRL_AMBER : moving ? CTRL_GREEN : '#444'}
              strokeWidth={r / 4}
            />
            <text
              x={tx} y={tz + r * 2}
              textAnchor="middle"
              fontSize={viewBox.w / 80}
              fill={moving ? CTRL_GREEN : '#333'}
              fontFamily="monospace"
              style={{ userSelect: 'none' }}
            >
              {t.Name || 'Train'}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════
   Train Detail Panel
   ═══════════════════════════════════════════════════════ */
/**
 * Detailed view of a single train showing its railcars, cargo,
 * and current status. Clicking a station navigates to its detail.
 */
function TrainDetail({ train, onSelectStation }: { train: TrainResponse | null; onSelectStation: (id: string) => void }) {
  if (!train) {
    return <p className="text-[10px] opacity-40" style={{ color: CTRL_GREEN }}>Select a train</p>;
  }

  const moving = (train.ForwardSpeed ?? 0) > 1;
  const stationName = train.TrainStation && train.TrainStation !== 'No Station' ? train.TrainStation : null;

  return (
    <div className="space-y-3 text-[10px] font-mono">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: moving ? CTRL_GREEN : '#333' }} />
        <span className="text-sm font-bold" style={{ color: CTRL_GREEN }}>
          {train.Name || 'Train'}
        </span>
      </div>

      {/* Status */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <DetailRow label="Status" value={train.Status ?? 'Unknown'} color={moving ? CTRL_GREEN : '#555'} />
        <DetailRow label="Speed" value={moving ? `${fmtSpeed(train.ForwardSpeed ?? 0)} km/h` : '—'} color={moving ? CTRL_GREEN : '#555'} />
        <DetailRow label="Docking" value={train.Docking ? 'YES' : 'NO'} color={train.Docking ? CTRL_GREEN : '#555'} />
        <DetailRow label="Station" value={stationName ?? '—'} color={CTRL_AMBER} />
        <DetailRow label="Location" value={train.location ? `${train.location.x.toFixed(0)}, ${train.location.z.toFixed(0)}` : '—'} color="#667" />
      </div>

      {/* TimeTable */}
      {train.TimeTable && train.TimeTable.length > 0 && (
        <div>
          <div className="flex items-center gap-1 mb-2">
            <span className="text-[9px] uppercase tracking-widest opacity-50" style={{ color: CTRL_GREEN }}>
              Timetable
            </span>
          </div>
          <div className="space-y-0.5">
            {train.TimeTable.map((stop, i) => {
              const isCurrent = i === train.TimeTableIndex;
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 px-2 py-1 rounded text-[9px]"
                  style={{
                    backgroundColor: isCurrent ? `${CTRL_GREEN}10` : 'transparent',
                    color: isCurrent ? CTRL_GREEN : '#556',
                  }}
                >
                  <span className="w-4 text-right opacity-40">{i + 1}</span>
                  <span>{cleanName(stop.StationName)}</span>
                  {isCurrent && (
                    <span className="ml-auto text-[8px] px-1 rounded" style={{ backgroundColor: `${CTRL_GREEN}20`, color: CTRL_GREEN }}>
                      NOW
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
  color = CTRL_GREEN,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <>
      <span className="opacity-50" style={{ color }}>{label}</span>
      <span className="text-right" style={{ color }}>{value}</span>
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   Station Detail Panel
   ═══════════════════════════════════════════════════════ */
/**
 * Detailed view of a single train station showing cargo inventory,
 * fuel, connected trains, and location on the grid.
 */
function StationDetail({ station }: { station: TrainStation | null }) {
  if (!station) {
    return <p className="text-[10px] opacity-40" style={{ color: CTRL_GREEN }}>Select a station</p>;
  }

  const sortedCargo = [...(station.cargo ?? [])].sort((a, b) => b.Amount - a.Amount);

  return (
    <div className="space-y-3 text-[10px] font-mono">
      <div>
        <span className="text-sm font-bold" style={{ color: CTRL_AMBER }}>{cleanName(station.Name)}</span>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <DetailRow label="Type" value={station.station_type ?? '—'} color={CTRL_GREEN} />
        <DetailRow label="Location" value={station.location ? `${station.location.x.toFixed(0)}, ${station.location.z.toFixed(0)}` : '—'} color="#667" />
        <DetailRow label="Train" value={station.coupled_train_id ? 'Docked' : 'Vacant'} color={station.coupled_train_id ? CTRL_GREEN : '#555'} />
      </div>

      {/* Cargo */}
      {sortedCargo.length > 0 && (
        <div>
          <div className="text-[9px] uppercase tracking-widest mb-2 opacity-50" style={{ color: CTRL_AMBER }}>
            Cargo ({sortedCargo.length})
          </div>
          <div className="space-y-1">
            {sortedCargo.map((item, i) => (
              <div
                key={item.ClassName || i}
                className="flex items-center justify-between px-2 py-1 rounded"
                style={{ backgroundColor: `${CTRL_GREEN}08` }}
              >
                <span className="truncate" style={{ color: '#889' }}>{item.Name}</span>
                <span className="font-bold shrink-0" style={{ color: CTRL_AMBER }}>
                  {formatNumber(item.Amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Overview Panel (no selection)
   ═══════════════════════════════════════════════════════ */
/**
 * Overview panel showing a summary of all trains and stations
 * in a compact card layout. Serves as the default view when
 * no train or station is selected.
 */
function OverviewPanel({
  stations,
  trains,
}: {
  stations: TrainStation[];
  trains: TrainResponse[];
}) {
  const topStations = [...stations]
    .sort((a, b) => (b.cargo ?? []).reduce((s, i) => s + i.Amount, 0) - (a.cargo ?? []).reduce((s, i) => s + i.Amount, 0))
    .slice(0, 8);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[9px] uppercase tracking-widest mb-2 opacity-50" style={{ color: CTRL_GREEN }}>
          Top Stations
        </div>
        <div className="space-y-1">
          {topStations.map((s) => {
            const total = (s.cargo ?? []).reduce((sum, i) => sum + i.Amount, 0);
            return (
              <div
                key={s.ID}
                className="flex items-center justify-between px-2 py-1 rounded"
                style={{ backgroundColor: `${CTRL_GREEN}06` }}
              >
                <span className="text-[10px] truncate" style={{ color: '#778' }}>{cleanName(s.Name)}</span>
                <span className="text-[10px] font-bold font-mono shrink-0" style={{ color: CTRL_AMBER }}>
                  {formatNumber(total)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-[9px] text-center opacity-30" style={{ color: CTRL_GREEN }}>
        {trains.length} trains · {stations.length} stations
      </div>
    </div>
  );
}
