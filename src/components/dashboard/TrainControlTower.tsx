'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FRMConfig, TrainStation, TrainResponse, Railcar } from '@/lib/types';
import { fetchEndpoint } from '@/lib/api';
import { formatNumber } from '@/lib/formatters';
import { cleanName } from '@/lib/names';
import { ItemIcon } from '@/components/ui/ItemIcon';

interface Props {
  config: FRMConfig;
}

/* ─── Constants ─── */
const WORLD_MIN = -425000;
const WORLD_MAX = 425000;
const REFRESH_MS = 4000;
const CTRL_GREEN = '#00ff88';
const CTRL_AMBER = '#ffb020';
const CTRL_RED = '#ff4444';
const CTRL_BG = '#0a0f0a';

/* ═══════════════════════════════════════════════════════
   Utility Helpers
   ═══════════════════════════════════════════════════════ */

/** Maps Satisfactory world coordinates (UE cm) to a normalized [0,1] range. */
function worldToGrid(wx: number, wz: number): [number, number] {
  return [
    (wx - WORLD_MIN) / (WORLD_MAX - WORLD_MIN),
    (wz - WORLD_MIN) / (WORLD_MAX - WORLD_MIN),
  ];
}

/** Formats train speed in km/h. Speeds >= 100 show no decimals. */
function fmtSpeed(kmh: number): string {
  if (kmh >= 100) return `${kmh.toFixed(0)}`;
  return kmh.toFixed(1);
}

/**
 * Classify a railcar by its ClassName: locomotive (`loco`) or freight wagon (`freight`).
 * Matches common Satisfactory naming patterns.
 */
function getCarType(className: string): 'loco' | 'freight' {
  const c = className.toLowerCase();
  if (/loco(motive)?|electric/i.test(c)) return 'loco';
  return 'freight';
}

/** Calculate overall train load percentage from PayloadMass / MaxPayloadMass. */
function getLoadPercent(train: Pick<TrainResponse, 'PayloadMass' | 'MaxPayloadMass'>): number {
  if (!train.MaxPayloadMass || train.MaxPayloadMass <= 0) return 0;
  return Math.min(100, Math.max(0, (train.PayloadMass / train.MaxPayloadMass) * 100));
}

/** Calculate a single railcar's load percentage. */
function getCarLoadPercent(car: Pick<Railcar, 'PayloadMass' | 'MaxPayloadMass'>): number {
  if (!car.MaxPayloadMass || car.MaxPayloadMass <= 0) return 0;
  return Math.min(100, Math.max(0, (car.PayloadMass / car.MaxPayloadMass) * 100));
}

/** Map train status string to a display color. */
function getStatusColor(status: string): string {
  switch (status) {
    case 'Self-Driving': return CTRL_GREEN;
    case 'Parked':
    case 'Manual Driving': return CTRL_AMBER;
    case 'Derailed': return CTRL_RED;
    default: return '#555';
  }
}

/** Map train status string to a short human-readable label. */
function getStatusLabel(status: string): string {
  switch (status) {
    case 'Self-Driving': return 'Moving';
    case 'Parked': return 'Parked';
    case 'Manual Driving': return 'Manual';
    case 'Derailed': return 'Derailed';
    default: return status || 'Unknown';
  }
}

/** Snapshot entry used for dwell-time tracking (mirrors useTimeBuffer format). */
interface DwellSnapshot {
  timestamp: number;
  data: TrainResponse[];
}

/**
 * Compute how long a train has been docked at a station by walking
 * the buffered snapshots newest→oldest. Returns elapsed ms if the
 * train is currently docked and stopped, otherwise null.
 */
function computeDwellTime(
  trainId: string,
  buffer: DwellSnapshot[],
): number | null {
  if (buffer.length < 2) return null;

  let ms = 0;
  // Walk newest→oldest, stopping at first interval where train is not docked
  for (let i = buffer.length - 1; i >= 1; i--) {
    const current = buffer[i].data.find((t) => t.ID === trainId);
    if (!current) break;

    const isDocked =
      (current.Docking === 'YES' || current.Docking === 'Yes') &&
      (current.ForwardSpeed ?? 0) < 1;
    if (!isDocked) break;

    ms += buffer[i].timestamp - buffer[i - 1].timestamp;
  }

  // Only return dwell time if currently docked (latest snapshot)
  const latest = buffer[buffer.length - 1].data.find((t) => t.ID === trainId);
  if (!latest) return null;
  const currentlyDocked =
    (latest.Docking === 'YES' || latest.Docking === 'Yes') &&
    (latest.ForwardSpeed ?? 0) < 1;
  if (!currentlyDocked) return null;

  return ms > 0 ? ms : null;
}

/** Format dwell-time milliseconds as "Xm Ys" or "Xs". */
function fmtDwell(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Count total items across all cargo slots in a railcar. */
function countRailcarItems(car: Railcar): number {
  return (car.Inventory ?? []).reduce((s, i) => s + i.Amount, 0);
}

/* ═══════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════ */

/**
 * Train Control Tower — a dispatch-board style view of every train
 * on the network. Each train is a sortable row in a full-width table
 * with expandable per-railcar breakdown. The track map is a secondary
 * collapsible panel. Dwell time (how long a train has been docked at
 * a station) is derived from the polling buffer.
 */
export function TrainControlTower({ config }: Props) {
  const [stations, setStations] = useState<TrainStation[] | null>(null);
  const [trains, setTrains] = useState<TrainResponse[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Rolling buffer for dwell-time computation
  const dwellBuffer = useRef<DwellSnapshot[]>([]);

  // UI state
  const [expandedTrain, setExpandedTrain] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'Self-Driving' | 'Parked' | 'Derailed'>('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'name' | 'speed' | 'load' | 'station' | 'dwell' | 'cars' | 'throttle'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedStation, setSelectedStation] = useState<TrainStation | null>(null);

  /* ── Data fetching ── */

  /** Fetch train and station data from the FRM API. Also pushes new snapshots into the dwell-time buffer. */
  const fetchData = useCallback(async () => {
    try {
      const [stationData, trainData] = await Promise.all([
        fetchEndpoint<TrainStation[]>(config, 'getTrainStation'),
        fetchEndpoint<TrainResponse[]>(config, 'getTrains'),
      ]);
      const trainArr = trainData ?? [];

      // Push snapshot into dwell-time buffer (5 min retention)
      const now = Date.now();
      dwellBuffer.current = [
        ...dwellBuffer.current.filter((e) => e.timestamp > now - 5 * 60 * 1000),
        { timestamp: now, data: trainArr },
      ];

      setStations(stationData ?? []);
      setTrains(trainArr);
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

  /* ── Lookup maps ── */

  /** Station name → TrainStation lookup for O(1) access. */
  const stationMap = useMemo(() => {
    const map = new Map<string, TrainStation>();
    if (stations) {
      for (const s of stations) map.set(s.Name, s);
    }
    return map;
  }, [stations]);

  /** Train ID → current dwell ms, precomputed per render cycle. */
  const dwellTimes = useMemo(() => {
    const map = new Map<string, number | null>();
    if (trains) {
      for (const t of trains) {
        map.set(t.ID, computeDwellTime(t.ID, dwellBuffer.current));
      }
    }
    return map;
  }, [trains]);

  /* ── Derived counts ── */

  const activeTrains = useMemo(
    () => (trains ?? []).filter((t) => t.Status === 'Self-Driving'),
    [trains],
  );

  const dockedTrains = useMemo(
    () =>
      (trains ?? []).filter(
        (t) =>
          (t.Docking === 'YES' || t.Docking === 'Yes') &&
          (t.ForwardSpeed ?? 0) < 1,
      ),
    [trains],
  );

  const derailedCount = useMemo(
    () => (trains ?? []).filter((t) => t.Derailed).length,
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

  /* ── Filter & Sort pipeline ── */

  const displayTrains = useMemo(() => {
    let result = trains ?? [];

    if (statusFilter !== 'all') {
      result = result.filter((t) => t.Status === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.Name.toLowerCase().includes(q) ||
          (t.TrainStation || '').toLowerCase().includes(q),
      );
    }

    // Sort
    const sorter = (a: TrainResponse, b: TrainResponse): number => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = (a.Name || '').localeCompare(b.Name || '');
          break;
        case 'speed':
          cmp = (a.ForwardSpeed ?? 0) - (b.ForwardSpeed ?? 0);
          break;
        case 'load':
          cmp = getLoadPercent(a) - getLoadPercent(b);
          break;
        case 'station':
          cmp = (a.TrainStation || '').localeCompare(b.TrainStation || '');
          break;
        case 'dwell': {
          const da = dwellTimes.get(a.ID) ?? 0;
          const db = dwellTimes.get(b.ID) ?? 0;
          cmp = da - db;
          break;
        }
        case 'cars':
          cmp = (a.Vehicles?.length ?? 0) - (b.Vehicles?.length ?? 0);
          break;
        case 'throttle':
          cmp = (a.ThrottlePercent ?? 0) - (b.ThrottlePercent ?? 0);
          break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    };

    return [...result].sort(sorter);
  }, [trains, statusFilter, search, sortKey, sortDir, dwellTimes]);

  /** Toggle sort direction or switch column. */
  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  /** Returns a sort indicator character for the header, if active. */
  const sortIndicator = (key: typeof sortKey): string => {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  };

  /* ── Loading / Error / Empty ── */

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
      <div
        className="rounded-xl p-6 text-center"
        style={{ backgroundColor: '#1a1111', border: `1px solid ${CTRL_RED}33` }}
      >
        <p className="text-sm" style={{ color: CTRL_RED }}>
          {error}
        </p>
        <button onClick={fetchData} className="mt-3 text-xs hover:underline" style={{ color: CTRL_AMBER }}>
          Retry
        </button>
      </div>
    );
  }

  if (!trains || trains.length === 0) {
    return (
      <div
        className="rounded-xl p-8 text-center"
        style={{ backgroundColor: '#080e08', border: `1px solid ${CTRL_GREEN}15` }}
      >
        <p className="text-sm" style={{ color: CTRL_GREEN }}>
          No trains detected
        </p>
        <p className="text-[13px] mt-1 opacity-50" style={{ color: CTRL_GREEN }}>
          Place a locomotive and freight station to see train data
        </p>
      </div>
    );
  }

  /* ── Render ── */

  return (
    <div className="flex flex-col gap-3" style={{ backgroundColor: CTRL_BG, minHeight: 650 }}>
      {/* Status Bar */}
      <StatusBar
        trains={trains.length}
        stations={stations?.length ?? 0}
        activeTrains={activeTrains.length}
        dockedTrains={dockedTrains.length}
        derailedCount={derailedCount}
        totalCargo={totalCargo}
      />

      {/* Filter Bar */}
      <FilterBar
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
        search={search}
        onSearch={setSearch}
        trains={trains}
      />

      {/* Train Table */}
      <div
        className="rounded-lg border overflow-hidden"
        style={{ borderColor: `${CTRL_GREEN}20`, backgroundColor: '#080e08' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] font-mono">
            <thead>
              <tr className="border-b" style={{ borderColor: `${CTRL_GREEN}10` }}>
                <SortHeader
                  label="TRAIN"
                  sortKey="name"
                  currentKey={sortKey}
                  onClick={() => handleSort('name')}
                  indicator={sortIndicator('name')}
                />
                <th className="text-center px-2 py-2 font-normal opacity-40" style={{ color: CTRL_GREEN }}>STATUS</th>
                <SortHeader
                  label="STATION"
                  sortKey="station"
                  currentKey={sortKey}
                  onClick={() => handleSort('station')}
                  indicator={sortIndicator('station')}
                />
                <SortHeader label="KM/H" sortKey="speed" currentKey={sortKey} onClick={() => handleSort('speed')} indicator={sortIndicator('speed')} />
                <SortHeader label="THR%" sortKey="throttle" currentKey={sortKey} onClick={() => handleSort('throttle')} indicator={sortIndicator('throttle')} />
                <SortHeader label="LOAD" sortKey="load" currentKey={sortKey} onClick={() => handleSort('load')} indicator={sortIndicator('load')} />
                <SortHeader label="CARS" sortKey="cars" currentKey={sortKey} onClick={() => handleSort('cars')} indicator={sortIndicator('cars')} />
                <th className="text-center px-2 py-2 font-normal opacity-40" style={{ color: CTRL_GREEN }}>DOCK</th>
                <SortHeader
                  label="DWELL"
                  sortKey="dwell"
                  currentKey={sortKey}
                  onClick={() => handleSort('dwell')}
                  indicator={sortIndicator('dwell')}
                />
                <th className="text-center px-2 py-2 font-normal opacity-40" style={{ color: CTRL_RED }}>!</th>
              </tr>
            </thead>
            <tbody>
              {displayTrains.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 opacity-40" style={{ color: CTRL_GREEN }}>
                    {search.trim() ? 'No trains match your search' : 'No trains match the current filter'}
                  </td>
                </tr>
              ) : (
                displayTrains.map((train) => (
                  <TrainRow
                    key={train.ID}
                    train={train}
                    stationMap={stationMap}
                    isExpanded={expandedTrain === train.ID}
                    onToggleExpand={() =>
                      setExpandedTrain(expandedTrain === train.ID ? null : train.ID)
                    }
                    onSelectStation={(s) => setSelectedStation(s)}
                    dwellMs={dwellTimes.get(train.ID) ?? null}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Map Toggle */}
      <div>
        <button
          onClick={() => setShowMap(!showMap)}
          className="text-[13px] font-mono uppercase tracking-wider px-3 py-1.5 rounded border transition-colors"
          style={{
            color: CTRL_GREEN,
            borderColor: `${CTRL_GREEN}30`,
            backgroundColor: showMap ? `${CTRL_GREEN}10` : 'transparent',
          }}
        >
          {showMap ? '▲ Hide Track Map' : '▼ Show Track Map'}
        </button>
      </div>

      {/* Collapsible Map Panel */}
      {showMap && (
        <CollapsibleMap
          stations={stations ?? []}
          trains={trains}
        />
      )}

      {/* Station Detail Modal */}
      {selectedStation && (
        <StationModal
          station={selectedStation}
          trains={trains ?? []}
          onClose={() => setSelectedStation(null)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Status Bar
   ═══════════════════════════════════════════════════════ */

/** Top status bar with train network summary statistics. */
function StatusBar({
  trains,
  stations,
  activeTrains,
  dockedTrains,
  derailedCount,
  totalCargo,
}: {
  trains: number;
  stations: number;
  activeTrains: number;
  dockedTrains: number;
  derailedCount: number;
  totalCargo: number;
}) {
  return (
    <div
      className="flex items-center gap-4 px-4 py-3 rounded-lg border"
      style={{ borderColor: `${CTRL_GREEN}20`, backgroundColor: '#080e08' }}
    >
      <div className="flex items-center gap-2">
        <span
          className="text-[13px] uppercase tracking-widest opacity-60"
          style={{ color: CTRL_GREEN }}
        >
          SYS OK
        </span>
        <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: CTRL_GREEN }} />
      </div>
      <div className="h-4 w-px" style={{ backgroundColor: `${CTRL_GREEN}20` }} />
      <StatBlock label="Trains" value={trains} sub={`${activeTrains} active`} />
      <StatBlock label="Docked" value={dockedTrains} color={CTRL_AMBER} />
      <StatBlock label="Stations" value={stations} />
      {derailedCount > 0 && (
        <StatBlock label="Derailed" value={derailedCount} color={CTRL_RED} />
      )}
      <StatBlock label="Cargo" value={totalCargo} color={CTRL_AMBER} />
      <div className="ml-auto text-[13px] font-mono opacity-40" style={{ color: CTRL_GREEN }}>
        {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
}

/** A single statistic label/value pair in the status bar. */
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
      <span className="text-[13px] uppercase tracking-wider opacity-50" style={{ color }}>
        {label}
      </span>
      <span className="text-lg font-bold font-mono" style={{ color }}>
        {formatNumber(value)}
      </span>
      {sub && (
        <span className="text-[11px] opacity-50" style={{ color }}>
          {sub}
        </span>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Filter Bar
   ═══════════════════════════════════════════════════════ */

/** Top filter bar with status pills and train name search. */
function FilterBar({
  statusFilter,
  onStatusFilter,
  search,
  onSearch,
  trains,
}: {
  statusFilter: 'all' | 'Self-Driving' | 'Parked' | 'Derailed';
  onStatusFilter: (v: typeof statusFilter) => void;
  search: string;
  onSearch: (v: string) => void;
  trains: TrainResponse[];
}) {
  const counts = useMemo(() => {
    const selfDriving = trains.filter((t) => t.Status === 'Self-Driving').length;
    const parked = trains.filter((t) => t.Status === 'Parked').length;
    const derailed = trains.filter((t) => t.Derailed).length;
    return { all: trains.length, selfDriving, parked, derailed };
  }, [trains]);

  const pills: { key: typeof statusFilter; label: string }[] = [
    { key: 'all', label: `All (${counts.all})` },
    { key: 'Self-Driving', label: `Moving (${counts.selfDriving})` },
    { key: 'Parked', label: `Parked (${counts.parked})` },
    { key: 'Derailed', label: `Derailed (${counts.derailed})` },
  ];

  const pillColors: Record<typeof statusFilter, string> = {
    all: CTRL_GREEN,
    'Self-Driving': CTRL_GREEN,
    Parked: CTRL_AMBER,
    Derailed: CTRL_RED,
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Status filter pills */}
      <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: `${CTRL_GREEN}20` }}>
        {pills.map(({ key, label }, i) => {
          const active = statusFilter === key;
          const color = pillColors[key];
          return (
            <button
              key={key}
              onClick={() => onStatusFilter(key)}
              className="text-[11px] font-mono font-bold px-2.5 py-1.5 uppercase tracking-wider transition-colors"
              style={{
                backgroundColor: active ? `${color}18` : 'transparent',
                color: active ? color : '#445',
                borderRight:
                  i < pills.length - 1 ? `1px solid ${CTRL_GREEN}15` : 'none',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Search input */}
      <div className="relative">
        <svg
          className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none"
          style={{ color: `${CTRL_GREEN}40` }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search trains…"
          className="text-[13px] font-mono rounded-lg pl-7 pr-3 py-1.5 border w-48 outline-none transition-colors"
          style={{
            backgroundColor: '#080e08',
            color: CTRL_GREEN,
            borderColor: `${CTRL_GREEN}20`,
          }}
          aria-label="Search trains"
        />
        {search && (
          <button
            onClick={() => onSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[13px] hover:opacity-80"
            style={{ color: `${CTRL_GREEN}60` }}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Sort Header
   ═══════════════════════════════════════════════════════ */

/** Clickable table header cell with sort direction indicator. */
function SortHeader({
  label,
  sortKey,
  currentKey,
  onClick,
  indicator,
}: {
  label: string;
  sortKey: string;
  currentKey: string;
  onClick: () => void;
  indicator: string;
}) {
  const active = sortKey === currentKey;
  return (
    <th
      onClick={onClick}
      className="text-left px-2 py-2 font-normal cursor-pointer select-none hover:opacity-80 transition-opacity"
      style={{ color: active ? CTRL_GREEN : `${CTRL_GREEN}60`, opacity: active ? 1 : 0.4 }}
    >
      {label}
      <span className="text-[10px]">{indicator}</span>
    </th>
  );
}

/* ═══════════════════════════════════════════════════════
   Train Row
   ═══════════════════════════════════════════════════════ */

/**
 * A single train table row. Clicking expands to show per-railcar
 * cargo breakdown and timetable inline below the row.
 */
function TrainRow({
  train,
  stationMap,
  isExpanded,
  onToggleExpand,
  onSelectStation,
  dwellMs,
}: {
  train: TrainResponse;
  stationMap: Map<string, TrainStation>;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSelectStation: (station: TrainStation) => void;
  dwellMs: number | null;
}) {
  const status = train.Status;
  const statusColor = getStatusColor(status);
  const stationName = train.TrainStation && train.TrainStation !== 'No Station' ? train.TrainStation : null;
  const speed = train.ForwardSpeed ?? 0;
  const moving = speed > 1;
  const loadPct = getLoadPercent(train);
  const throttle = train.ThrottlePercent ?? 0;
  const derailed = train.Derailed;
  const docking = train.Docking === 'YES' || train.Docking === 'Yes';

  const handleStationClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (stationName) {
      const station = stationMap.get(stationName);
      if (station) onSelectStation(station);
    }
  };

  return (
    <>
      <tr
        onClick={onToggleExpand}
        className="cursor-pointer border-b transition-colors hover:brightness-110"
        style={{
          borderColor: `${CTRL_GREEN}08`,
          backgroundColor: isExpanded ? `${CTRL_GREEN}08` : 'transparent',
        }}
      >
        {/* Name + expand */}
        <td className="px-2 py-1.5 whitespace-nowrap" style={{ color: moving ? '#ccd' : '#556' }}>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px]" style={{ color: `${CTRL_GREEN}40` }}>
              {isExpanded ? '▼' : '▶'}
            </span>
            <div
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: derailed ? CTRL_RED : moving ? CTRL_GREEN : '#333' }}
            />
            <span className="truncate max-w-[180px]" title={train.Name}>
              {train.Name || 'Train'}
            </span>
          </div>
        </td>
        {/* Status */}
        <td className="px-2 py-1.5 whitespace-nowrap">
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase"
            style={{
              backgroundColor: `${statusColor}18`,
              color: statusColor,
            }}
          >
            {getStatusLabel(status)}
          </span>
        </td>
        {/* Station */}
        <td className="px-2 py-1.5 truncate max-w-[160px]">
          {stationName ? (
            <button
              onClick={handleStationClick}
              className="hover:underline text-left truncate block max-w-full"
              style={{ color: isExpanded ? CTRL_GREEN : '#889' }}
              title={stationName}
            >
              {cleanName(stationName)}
            </button>
          ) : (
            <span style={{ color: '#333' }}>—</span>
          )}
        </td>
        {/* Speed */}
        <td className="px-2 py-1.5 text-right whitespace-nowrap" style={{ color: moving ? CTRL_GREEN : '#444' }}>
          {moving ? fmtSpeed(speed) : '—'}
        </td>
        {/* Throttle */}
        <td className="px-2 py-1.5 text-right whitespace-nowrap" style={{ color: moving ? '#889' : '#333' }}>
          {moving ? `${Math.round(throttle)}%` : '—'}
        </td>
        {/* Load % */}
        <td className="px-2 py-1.5 min-w-[80px]">
          <LoadBar pct={loadPct} width={60} />
        </td>
        {/* Cars */}
        <td className="px-2 py-1.5 text-right whitespace-nowrap" style={{ color: CTRL_AMBER }}>
          {train.Vehicles?.length ?? 0}
        </td>
        {/* Docking */}
        <td className="px-2 py-1.5 text-center">
          <div
            className="w-1.5 h-1.5 rounded-full mx-auto"
            style={{ backgroundColor: docking ? CTRL_GREEN : '#333' }}
          />
        </td>
        {/* Dwell */}
        <td className="px-2 py-1.5 text-right whitespace-nowrap" style={{ color: dwellMs ? CTRL_AMBER : '#333' }}>
          {dwellMs ? fmtDwell(dwellMs) : '—'}
        </td>
        {/* Derailed */}
        <td className="px-2 py-1.5 text-center">
          {derailed && (
            <span title="Derailed" style={{ color: CTRL_RED }}>
              ⚠
            </span>
          )}
        </td>
      </tr>

      {/* Expanded detail row */}
      {isExpanded && (
        <tr>
          <td colSpan={10} className="p-3" style={{ backgroundColor: `${CTRL_GREEN}04` }}>
            <ExpandedDetail train={train} stationMap={stationMap} onSelectStation={onSelectStation} />
          </td>
        </tr>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   Load Bar
   ═══════════════════════════════════════════════════════ */

/** Small inline load-percentage progress bar. */
function LoadBar({ pct, width = 80 }: { pct: number; width?: number }) {
  const color = pct > 80 ? CTRL_AMBER : pct > 40 ? CTRL_GREEN : '#445';
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="h-1.5 rounded-full border overflow-hidden"
        style={{ width, backgroundColor: '#111', borderColor: `${CTRL_GREEN}15` }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(1, pct)}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[11px] font-bold" style={{ color }}>
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Expanded Detail (railcar breakdown + timetable)
   ═══════════════════════════════════════════════════════ */

/**
 * Inline expanded panel showing per-railcar cargo with item icons
 * and the train's timetable. Rendered below the train row when expanded.
 */
function ExpandedDetail({
  train,
  stationMap,
  onSelectStation,
}: {
  train: TrainResponse;
  stationMap: Map<string, TrainStation>;
  onSelectStation: (station: TrainStation) => void;
}) {
  const vehicles = train.Vehicles ?? [];
  const timetable = train.TimeTable ?? [];
  const currentStopIdx = train.TimeTableIndex ?? -1;
  const locos = vehicles.filter((v) => getCarType(v.ClassName) === 'loco');
  const freights = vehicles.filter((v) => getCarType(v.ClassName) === 'freight');

  const totalMass = train.TotalMass ?? 0;

  return (
    <div className="space-y-3">
      {/* Summary row */}
      <div className="flex items-center gap-6 text-[11px] font-mono flex-wrap">
        <span style={{ color: '#556' }}>
          {locos.length} loco{locos.length !== 1 ? 's' : ''} · {freights.length} freight{freights.length !== 1 ? 's' : ''}
        </span>
        <span style={{ color: '#556' }}>
          Mass: {formatNumber(totalMass, { decimals: 1 })}
        </span>
        <span style={{ color: '#556' }}>
          Payload: {formatNumber(train.PayloadMass ?? 0)} / {formatNumber(train.MaxPayloadMass ?? 0)}
        </span>
        {train.Derailed && (
          <span className="font-bold" style={{ color: CTRL_RED }}>
            ⚠ DERAILED
          </span>
        )}
        {train.PendingDerail && (
          <span style={{ color: CTRL_AMBER }}>
            ⚠ Pending derail
          </span>
        )}
      </div>

      {/* Railcar breakdown */}
      {vehicles.length > 0 && (
        <div>
          <div
            className="text-[10px] uppercase tracking-wider mb-2 opacity-50"
            style={{ color: CTRL_GREEN }}
          >
            Railcars ({vehicles.length})
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {vehicles.map((car, i) => {
              const type = getCarType(car.ClassName);
              const loadPct = getCarLoadPercent(car);
              const itemCount = countRailcarItems(car);
              const inv = car.Inventory ?? [];

              return (
                <div
                  key={car.Name || i}
                  className="rounded-lg p-2 border"
                  style={{
                    backgroundColor: '#060a06',
                    borderColor: `${CTRL_GREEN}10`,
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className="text-[10px] font-bold uppercase px-1 rounded"
                      style={{
                        backgroundColor: type === 'loco' ? `${CTRL_GREEN}15` : `${CTRL_AMBER}15`,
                        color: type === 'loco' ? CTRL_GREEN : CTRL_AMBER,
                      }}
                    >
                      {type === 'loco' ? 'LOCO' : 'FRT'}
                    </span>
                    <span className="text-[11px] truncate" style={{ color: '#888' }}>
                      {car.Name || `Car ${i + 1}`}
                    </span>
                  </div>
                  <LoadBar pct={loadPct} width={70} />
                  {/* Cargo items (freight cars only) */}
                  {type === 'freight' && (
                    <div className="mt-1.5 space-y-0.5">
                      {inv.length === 0 ? (
                        <span className="text-[10px] opacity-30" style={{ color: CTRL_GREEN }}>
                          Empty
                        </span>
                      ) : (
                        inv.map((item, j) => (
                          <div key={item.ClassName || j} className="flex items-center gap-1.5">
                            <ItemIcon
                              className={item.ClassName}
                              name={item.Name}
                              size="sm"
                            />
                            <span
                              className="text-[11px] truncate flex-1"
                              style={{ color: '#889' }}
                            >
                              {item.Name.replace(/^Desc_/, '').replace(/_C$/, '')}
                            </span>
                            <span
                              className="text-[11px] font-bold shrink-0"
                              style={{ color: CTRL_AMBER }}
                            >
                              {formatNumber(item.Amount)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Timetable */}
      {timetable.length > 0 && (
        <div>
          <div
            className="text-[10px] uppercase tracking-wider mb-2 opacity-50"
            style={{ color: CTRL_GREEN }}
          >
            Timetable ({timetable.length} stops)
          </div>
          <div className="flex flex-wrap gap-1">
            {timetable.map((stop, i) => {
              const isCurrent = i === currentStopIdx;
              return (
                <div
                  key={i}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono"
                  style={{
                    backgroundColor: isCurrent ? `${CTRL_GREEN}12` : 'transparent',
                    border: `1px solid ${isCurrent ? CTRL_GREEN : `${CTRL_GREEN}08`}`,
                    color: isCurrent ? CTRL_GREEN : '#445',
                  }}
                >
                  <span className="opacity-40">{i + 1}</span>
                  <span>{cleanName(stop.StationName)}</span>
                  {isCurrent && (
                    <span
                      className="text-[8px] px-1 rounded"
                      style={{ backgroundColor: `${CTRL_GREEN}20`, color: CTRL_GREEN }}
                    >
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

/* ═══════════════════════════════════════════════════════
   Collapsible Map (SVG)
   ═══════════════════════════════════════════════════════ */

/** Collapsible SVG track map with zoom +/- buttons and pan support. */
function CollapsibleMap({
  stations,
  trains,
}: {
  stations: TrainStation[];
  trains: TrainResponse[];
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 1000, h: 1000 });
  const [drag, setDrag] = useState<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  // Compute display bounds from stations + trains
  const allPoints = useMemo(() => {
    const pts: { x: number; z: number }[] = [];
    for (const s of stations) {
      if (s.location) pts.push({ x: s.location.x, z: s.location.z });
    }
    for (const t of trains) {
      if (t.location) pts.push({ x: t.location.x, z: t.location.z });
    }
    return pts;
  }, [stations, trains]);

  // Convert world coords → SVG coords
  const toSvg = useCallback(
    (wx: number, wz: number): [number, number] => {
      const [nx, nz] = worldToGrid(wx, wz);
      return [viewBox.x + nx * viewBox.w, viewBox.y + nz * viewBox.h];
    },
    [viewBox],
  );

  // Auto-fit to all points on first render
  useEffect(() => {
    if (allPoints.length === 0) return;
    const xs = allPoints.map((p) => p.x);
    const zs = allPoints.map((p) => p.z);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const [sx, sz] = worldToGrid(minX, minZ);
    const [ex, ez] = worldToGrid(maxX, maxZ);
    const pad = 0.05;
    const nx = sx - pad;
    const nz = sz - pad;
    const nw = (ex - sx) + pad * 2;
    const nh = (ez - sz) + pad * 2;
    setViewBox({ x: nx, y: nz, w: Math.max(100, nw * 1000), h: Math.max(100, nh * 1000) });
  // Run only once when points stabilize
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPoints.length]);

  /** Zoom the viewport by a factor (0.5–3×), keeping the center fixed. */
  const zoomBy = useCallback((factor: number) => {
    setViewBox((vb) => {
      const cx = vb.x + vb.w / 2;
      const cy = vb.y + vb.h / 2;
      const newW = vb.w * factor;
      const newH = vb.h * factor;
      return {
        x: cx - newW / 2,
        y: cy - newH / 2,
        w: newW,
        h: newH,
      };
    });
  }, []);

  /** Reset view to fit all points. */
  const resetView = useCallback(() => {
    if (allPoints.length === 0) return;
    const xs = allPoints.map((p) => p.x);
    const zs = allPoints.map((p) => p.z);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const [sx, sz] = worldToGrid(minX, minZ);
    const [ex, ez] = worldToGrid(maxX, maxZ);
    const pad = 0.05;
    const nx = sx - pad;
    const nz = sz - pad;
    const nw = (ex - sx) + pad * 2;
    const nh = (ez - sz) + pad * 2;
    setViewBox({ x: nx, y: nz, w: Math.max(100, nw * 1000), h: Math.max(100, nh * 1000) });
  }, [allPoints]);

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setDrag({ startX: e.clientX, startY: e.clientY, origX: viewBox.x, origY: viewBox.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    setViewBox((vb) => ({
      ...vb,
      x: drag.origX - dx * (vb.w / 600),
      y: drag.origY - dy * (vb.h / 600),
    }));
  };
  const handleMouseUp = () => setDrag(null);
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.15 : 0.87;
    zoomBy(factor);
  };

  // Grid lines
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

  const activeTrains = trains.filter((t) => (t.ForwardSpeed ?? 0) > 1);

  return (
    <div
      className="relative rounded-lg border overflow-hidden"
      style={{ borderColor: `${CTRL_GREEN}20`, backgroundColor: '#060a06', height: 400 }}
    >
      {/* Zoom controls */}
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <button
          onClick={() => zoomBy(0.7)}
          className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold border transition-colors"
          style={{
            color: CTRL_GREEN,
            borderColor: `${CTRL_GREEN}30`,
            backgroundColor: '#080e08',
          }}
          title="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => zoomBy(1.4)}
          className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold border transition-colors"
          style={{
            color: CTRL_GREEN,
            borderColor: `${CTRL_GREEN}30`,
            backgroundColor: '#080e08',
          }}
          title="Zoom out"
        >
          −
        </button>
        <button
          onClick={resetView}
          className="w-6 h-6 rounded flex items-center justify-center text-[11px] font-bold border transition-colors"
          style={{
            color: CTRL_AMBER,
            borderColor: `${CTRL_AMBER}30`,
            backgroundColor: '#080e08',
          }}
          title="Reset view"
        >
          ↺
        </button>
      </div>

      {/* Title */}
      <div
        className="absolute top-2 left-3 z-10 text-[13px] uppercase tracking-widest opacity-50"
        style={{ color: CTRL_GREEN }}
      >
        Track Monitor
      </div>

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
          <line
            key={i}
            {...l}
            stroke={`${CTRL_GREEN}10`}
            strokeWidth={viewBox.w / 500}
          />
        ))}

        {/* Station dots */}
        {stations.map((s) => {
          if (!s.location) return null;
          const [sx, sy] = toSvg(s.location.x, s.location.z);
          const r = viewBox.w / 90;
          return (
            <g key={s.ID}>
              <circle
                cx={sx}
                cy={sy}
                r={r}
                fill="#000"
                stroke={`${CTRL_GREEN}60`}
                strokeWidth={r / 3}
              />
              <text
                x={sx}
                y={sy - r * 1.8}
                textAnchor="middle"
                fontSize={viewBox.w / 70}
                fill={`${CTRL_GREEN}60`}
                fontFamily="monospace"
                style={{ userSelect: 'none' }}
              >
                {cleanName(s.Name).slice(0, 12)}
              </text>
            </g>
          );
        })}

        {/* Train dots */}
        {activeTrains.map((t) => {
          if (!t.location) return null;
          const [tx, tz] = toSvg(t.location.x, t.location.z);
          const r = viewBox.w / 70;
          return (
            <g key={t.ID}>
              {/* Pulse ring for moving trains */}
              <circle cx={tx} cy={tz} r={r * 2.5} fill="none" stroke={CTRL_GREEN} strokeWidth={1} opacity={0.15}>
                <animate attributeName="r" from={r * 2} to={r * 5} dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.3" to="0" dur="1.5s" repeatCount="indefinite" />
              </circle>
              <rect
                x={tx - r}
                y={tz - r * 0.6}
                width={r * 2}
                height={r * 1.2}
                rx={r * 0.3}
                ry={r * 0.3}
                fill={CTRL_GREEN}
                stroke={CTRL_GREEN}
                strokeWidth={r / 4}
              />
              <text
                x={tx}
                y={tz + r * 2}
                textAnchor="middle"
                fontSize={viewBox.w / 80}
                fill={CTRL_GREEN}
                fontFamily="monospace"
                style={{ userSelect: 'none' }}
              >
                {t.Name || 'Train'}
              </text>
            </g>
          );
        })}

        {/* Dock/station marker for docked trains (non-moving, at a station) */}
        {trains
          .filter((t) => (t.ForwardSpeed ?? 0) < 1 && t.TrainStation && t.TrainStation !== 'No Station' && t.location)
          .map((t) => {
            if (!t.location) return null;
            const [tx, tz] = toSvg(t.location.x, t.location.z);
            const r = viewBox.w / 70;
            return (
              <g key={`docked-${t.ID}`}>
                <rect
                  x={tx - r}
                  y={tz - r * 0.6}
                  width={r * 2}
                  height={r * 1.2}
                  rx={r * 0.3}
                  ry={r * 0.3}
                  fill="#111"
                  stroke={CTRL_AMBER}
                  strokeWidth={r / 4}
                />
              </g>
            );
          })}
      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Station Modal
   ═══════════════════════════════════════════════════════ */

/**
 * Modal overlay showing detailed info about a selected train station:
 * cargo inventory (with ItemIcon), fuel, docked train name, and location.
 */
function StationModal({
  station,
  trains,
  onClose,
}: {
  station: TrainStation;
  trains: TrainResponse[];
  onClose: () => void;
}) {
  const dockedTrain = trains.find((t) => t.ID === station.coupled_train_id);
  const sortedCargo = [...(station.cargo ?? [])].sort((a, b) => b.Amount - a.Amount);
  const sortedFuel = [...(station.fuel ?? [])].sort((a, b) => b.Amount - a.Amount);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="rounded-xl p-5 max-w-md w-full mx-4 max-h-[80vh] overflow-auto"
        style={{ backgroundColor: '#080e08', border: `1px solid ${CTRL_GREEN}20` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-bold" style={{ color: CTRL_AMBER }}>
            {cleanName(station.Name)}
          </span>
          <button
            onClick={onClose}
            className="text-xs hover:opacity-80 font-mono"
            style={{ color: `${CTRL_GREEN}60` }}
          >
            ✕ Close
          </button>
        </div>

        {/* Station info grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-4 text-[13px] font-mono">
          <span className="opacity-50" style={{ color: CTRL_GREEN }}>
            Type
          </span>
          <span className="text-right" style={{ color: CTRL_GREEN }}>
            {station.station_type ?? '—'}
          </span>
          <span className="opacity-50" style={{ color: CTRL_GREEN }}>
            Location
          </span>
          <span className="text-right" style={{ color: '#667' }}>
            {station.location
              ? `${station.location.x.toFixed(0)}, ${station.location.z.toFixed(0)}`
              : '—'}
          </span>
          <span className="opacity-50" style={{ color: CTRL_GREEN }}>
            Train
          </span>
          <span className="text-right" style={{ color: station.coupled_train_id ? CTRL_GREEN : '#555' }}>
            {dockedTrain ? dockedTrain.Name || 'Docked' : station.coupled_train_id ? 'Docked' : 'Vacant'}
          </span>
        </div>

        {/* Cargo */}
        {sortedCargo.length > 0 && (
          <div className="mb-3">
            <div
              className="text-[11px] uppercase tracking-widest mb-2 opacity-50"
              style={{ color: CTRL_AMBER }}
            >
              Cargo ({sortedCargo.length})
            </div>
            <div className="space-y-1">
              {sortedCargo.map((item, i) => (
                <div
                  key={item.ClassName || i}
                  className="flex items-center gap-2 px-2 py-1 rounded"
                  style={{ backgroundColor: `${CTRL_GREEN}06` }}
                >
                  <ItemIcon className={item.ClassName} name={item.Name} size="sm" />
                  <span className="text-[13px] truncate flex-1" style={{ color: '#889' }}>
                    {item.Name.replace(/^Desc_/, '').replace(/_C$/, '')}
                  </span>
                  <span className="text-[13px] font-bold font-mono shrink-0" style={{ color: CTRL_AMBER }}>
                    {formatNumber(item.Amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fuel */}
        {sortedFuel.length > 0 && (
          <div>
            <div
              className="text-[11px] uppercase tracking-widest mb-2 opacity-50"
              style={{ color: CTRL_GREEN }}
            >
              Fuel ({sortedFuel.length})
            </div>
            <div className="space-y-1">
              {sortedFuel.map((item, i) => (
                <div
                  key={item.ClassName || i}
                  className="flex items-center gap-2 px-2 py-1 rounded"
                  style={{ backgroundColor: `${CTRL_GREEN}06` }}
                >
                  <ItemIcon className={item.ClassName} name={item.Name} size="sm" />
                  <span className="text-[13px] truncate flex-1" style={{ color: '#889' }}>
                    {item.Name.replace(/^Desc_/, '').replace(/_C$/, '')}
                  </span>
                  <span className="text-[13px] font-bold font-mono shrink-0" style={{ color: CTRL_GREEN }}>
                    {formatNumber(item.Amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {sortedCargo.length === 0 && sortedFuel.length === 0 && (
          <p className="text-[13px] text-center py-4 opacity-40" style={{ color: CTRL_GREEN }}>
            No cargo or fuel at this station
          </p>
        )}
      </div>
    </div>
  );
}
