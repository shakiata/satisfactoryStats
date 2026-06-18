'use client';

import { useState, useEffect, useCallback } from 'react';
import { FRMConfig, Player } from '@/lib/types';
import { fetchEndpoint } from '@/lib/api';
import { useTheme } from '@/lib/useTheme';

interface Props {
  config: FRMConfig;
}

/**
 * Displays connected players on a stylized grid map showing
 * health, location, and equipped items.
 */
export function PlayerMap({ config }: Props) {
  const { theme } = useTheme();
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const data = await fetchEndpoint<Player[]>(config, 'getPlayer');
      setPlayers(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch player data');
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

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
        <button onClick={fetchData} className="mt-3 text-xs hover:underline" style={{ color: theme.accent }}>Retry</button>
      </div>
    );
  }

  if (!players || players.length === 0) {
    return (
      <div className="text-center py-16" style={{ color: theme.textSecondary }}>
        <p className="text-lg font-medium">No players online</p>
        <p className="text-sm mt-1">Join the game to see player data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="rounded-xl p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider mb-1" style={{ color: theme.textSecondary }}>Online Players</p>
            <p className="text-2xl font-bold font-mono" style={{ color: theme.textPrimary }}>{players.length}</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full" style={{ backgroundColor: theme.success + '18', border: `1px solid ${theme.success}33` }}>
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: theme.success }} />
            <span className="text-xs font-medium" style={{ color: theme.success }}>Live</span>
          </div>
        </div>
      </div>

      {/* Player List */}
      <div className="grid gap-3">
        {players.map((p, i) => (
          <div key={p.ID || i} className="rounded-xl p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderColor}` }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-black font-bold text-lg" style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentHover})` }}>
                {p.Name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: theme.textPrimary }}>{p.Name || 'Unknown'}</p>
                <p className="text-xs font-mono" style={{ color: theme.textSecondary }}>ID: {p.ID?.slice(0, 12) || 'N/A'}</p>
              </div>
            </div>

            {p.location && (
              <div className="rounded-lg p-3" style={{ backgroundColor: theme.bgPrimary, border: `1px solid ${theme.borderColor}` }}>
                <p className="text-xs uppercase tracking-wider mb-2" style={{ color: theme.textSecondary }}>Location</p>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-xs" style={{ color: theme.textSecondary }}>X</span>
                    <p className="font-mono" style={{ color: theme.textPrimary }}>{p.location.x.toFixed(1)}</p>
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: theme.textSecondary }}>Y</span>
                    <p className="font-mono" style={{ color: theme.textPrimary }}>{p.location.y.toFixed(1)}</p>
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: theme.textSecondary }}>Z</span>
                    <p className="font-mono" style={{ color: theme.textPrimary }}>{p.location.z.toFixed(1)}</p>
                  </div>
                </div>
                {p.location.rotation !== undefined && (
                  <div className="mt-2 text-xs" style={{ color: theme.textSecondary }}>
                    Rotation: <span className="font-mono" style={{ color: theme.textPrimary }}>{p.location.rotation.toFixed(1)}°</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
