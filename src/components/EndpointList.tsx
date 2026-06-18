'use client';

import { useState } from 'react';
import { EndpointInfo, FRMConfig, DashboardTheme } from '@/lib/types';
import { buildUrl } from '@/lib/api';
import { useTheme } from '@/lib/useTheme';

interface EndpointCardProps {
  endpoint: EndpointInfo;
  config: FRMConfig;
  theme: DashboardTheme;
}

const CATEGORY_ICONS: Record<string, string> = {
  power: '⚡',
  generators: '🔥',
  factory: '🏭',
  resources: '⛏️',
  logistics: '🔧',
  vehicles: '🚗',
  transport: '🚂',
  support: '🏢',
  session: '👤',
  inventory: '📦',
  research: '🔬',
  events: '🎄',
  creatures: '🐾',
};

const CATEGORY_COLORS: Record<string, string> = {
  power: 'border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10',
  generators: 'border-orange-500/30 bg-orange-500/5 hover:bg-orange-500/10',
  factory: 'border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10',
  resources: 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10',
  logistics: 'border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/10',
  vehicles: 'border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10',
  transport: 'border-pink-500/30 bg-pink-500/5 hover:bg-pink-500/10',
  support: 'border-gray-500/30 bg-gray-500/5 hover:bg-gray-500/10',
  session: 'border-green-500/30 bg-green-500/5 hover:bg-green-500/10',
  inventory: 'border-teal-500/30 bg-teal-500/5 hover:bg-teal-500/10',
  research: 'border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10',
  events: 'border-red-500/30 bg-red-500/5 hover:bg-red-500/10',
  creatures: 'border-lime-500/30 bg-lime-500/5 hover:bg-lime-500/10',
};

/**
 * Displays a single API endpoint as a collapsible card.
 * Clicking fetches live data from the FRM server and shows the JSON response.
 */
function EndpointCard({ endpoint, config, theme }: EndpointCardProps) {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchData = async () => {
    if (data !== null) {
      setExpanded(!expanded);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const url = buildUrl(config, endpoint.path);
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (config.password) {
        headers['X-FRM-Authorization'] = config.password;
      }
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const json = await res.json();
      setData(json);
      setExpanded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  };

  const color = CATEGORY_COLORS[endpoint.category] || CATEGORY_COLORS.factory;

  return (
    <div className={`rounded-xl border transition-all ${color}`}>
      <button
        onClick={fetchData}
        className="w-full text-left p-4 flex items-center gap-3"
      >
        <div
          className="text-lg flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border"
          style={{ backgroundColor: theme.bgPrimary, borderColor: theme.borderColor }}
        >
          {CATEGORY_ICONS[endpoint.category] || '📊'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <code className="text-sm font-mono font-semibold" style={{ color: theme.accent }}>/{endpoint.path}</code>
            {endpoint.requiresGameThread && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-medium uppercase tracking-wider">
                Thread
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>{endpoint.description}</p>
        </div>
        <div className="flex-shrink-0">
          {loading ? (
            <svg className="animate-spin w-5 h-5" style={{ color: theme.textSecondary }} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`} style={{ color: theme.textSecondary }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t p-4" style={{ borderColor: theme.borderColor }}>
          {error ? (
            <div className="text-sm p-3 rounded-lg" style={{ color: theme.danger, backgroundColor: theme.danger + '10' }}>
              {error}
            </div>
          ) : data !== null ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider" style={{ color: theme.textSecondary }}>
                  {Array.isArray(data) ? `${data.length} results` : 'Response'}
                </span>
                <span className="text-xs font-mono" style={{ color: theme.textSecondary }}>
                  GET {buildUrl(config, endpoint.path)}
                </span>
              </div>
              <pre className="text-xs rounded-lg p-4 overflow-auto max-h-96 border font-mono leading-relaxed" style={{ backgroundColor: theme.bgPrimary, borderColor: theme.borderColor, color: theme.textPrimary }}>
                {JSON.stringify(data, null, 2)}
              </pre>
              {Array.isArray(data) && data.length > 0 && (
                <div className="text-xs px-3 py-2 rounded-lg border" style={{ color: theme.success, backgroundColor: theme.success + '10', borderColor: theme.success + '20' }}>
                  ✓ Successfully loaded {data.length} {data.length === 1 ? 'entry' : 'entries'}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

interface EndpointListProps {
  config: FRMConfig;
  endpoints: EndpointInfo[];
  categories: Map<string, EndpointInfo[]>;
}

/**
 * Lists all available FRM API endpoints grouped by category. Supports
 * text search and category filter buttons. Each endpoint card can be
 * expanded to fetch and display live JSON data from the game server.
 */
export function EndpointList({ config, endpoints, categories }: EndpointListProps) {
  const { theme } = useTheme();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredEndpoints = endpoints.filter((ep) => {
    if (selectedCategory && ep.category !== selectedCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        ep.path.toLowerCase().includes(q) ||
        ep.description.toLowerCase().includes(q) ||
        ep.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const categoryNames = Array.from(categories.keys());

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: theme.textPrimary }}>
          Available Statistics
        </h1>
        <p style={{ color: theme.textSecondary }}>
          {endpoints.length} endpoints across {categoryNames.length} categories.
          Click any endpoint to fetch and view live data from your Satisfactory game.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: theme.textSecondary }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search endpoints..."
            className="w-full rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none transition-colors search-input"
            style={{ backgroundColor: theme.bgSecondary, borderColor: theme.borderColor, color: theme.textPrimary, borderWidth: '1px', borderStyle: 'solid' }}
          />
        </div>
        {categoryNames.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            className="px-3 py-2 rounded-lg text-xs font-medium capitalize transition-all border"
            style={{
              backgroundColor: selectedCategory === cat ? theme.accent : theme.bgSecondary,
              color: selectedCategory === cat ? '#000' : theme.textSecondary,
              borderColor: selectedCategory === cat ? theme.accent : theme.borderColor,
            }}
          >
            {CATEGORY_ICONS[cat] || ''} {cat}
          </button>
        ))}
        {selectedCategory && (
          <button
            onClick={() => setSelectedCategory(null)}
            className="px-3 py-2 rounded-lg text-xs font-medium border border-transparent transition-all"
            style={{ color: theme.danger }}
          >
            ✕ Clear filter
          </button>
        )}
      </div>

      {/* Results */}
      {filteredEndpoints.length === 0 ? (
        <div className="text-center py-16" style={{ color: theme.textSecondary }}>
          <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-lg font-medium">No endpoints found</p>
          <p className="text-sm mt-1">Try adjusting your search or filter</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredEndpoints.map((ep) => (
            <EndpointCard key={ep.path} endpoint={ep} config={config} theme={theme} />
          ))}
        </div>
      )}
    </div>
  );
}
