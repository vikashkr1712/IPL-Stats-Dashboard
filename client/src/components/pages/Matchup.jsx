import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, PieChart, Pie, Cell
} from 'recharts';
import { Swords, Search } from 'lucide-react';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import ErrorMessage from '../ui/ErrorMessage';
import { searchPlayers, fetchMatchup, fetchPlayerImagesWithCache } from '../../services/api';

const playerAvatar = (name, size = 32) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1B2A72&color=fff&size=${size}&bold=true&format=svg`;

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{label}</p>
      {payload.map((entry, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color || entry.fill }} />
          <span style={{ color: '#aaa' }}>{entry.name}:</span>
          <span style={{ color: '#fff', fontWeight: 600 }}>{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

function PlayerSearchBox({ label, value, onChange, color }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [show, setShow] = useState(false);
  const [images, setImages] = useState({});

  useEffect(() => {
    if (query.length < 1) { setSuggestions([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await searchPlayers(query);
        if (!cancelled) {
          setSuggestions(res.data || []);
          setShow(true);
          if (res.data?.length) {
            fetchPlayerImagesWithCache(res.data.slice(0, 5), (batch) => {
              if (!cancelled) setImages(prev => ({ ...prev, ...batch }));
            });
          }
        }
      } catch {}
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  const select = (name) => { onChange(name); setQuery(''); setSuggestions([]); setShow(false); };

  return (
    <div className="flex-1 w-full" style={{ position: 'relative' }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{label}</label>
      <div className="search-box">
        <Search size={14} style={{ color: '#aaa', flexShrink: 0 }} />
        <input
          type="text"
          placeholder={value || 'Search player...'}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShow(true)}
          onBlur={() => setTimeout(() => setShow(false), 200)}
          className="search-input"
          style={{ fontSize: 13 }}
        />
      </div>
      {value && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
          <span style={{ fontSize: 14, fontWeight: 600, color }}>{value}</span>
        </div>
      )}
      {show && suggestions.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: 250, overflowY: 'auto', zIndex: 999 }}>
          {suggestions.map((name, i) => (
            <button key={i} onMouseDown={() => select(name)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', fontSize: 13, color: '#555', background: 'none', border: 'none', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', textAlign: 'left' }}
              onMouseOver={e => e.currentTarget.style.background = '#f5f5f5'} onMouseOut={e => e.currentTarget.style.background = 'none'}>
              <img src={images[name] || playerAvatar(name)} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} onError={e => { e.target.src = playerAvatar(name); }} />
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const PIE_COLORS = ['#f59e0b', '#ef4444', '#6366f1', '#06b6d4', '#10b981', '#888'];

export default function Matchup() {
  const [batter, setBatter] = useState('V Kohli');
  const [bowler, setBowler] = useState('JJ Bumrah');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [batterImage, setBatterImage] = useState(null);
  const [bowlerImage, setBowlerImage] = useState(null);

  // Fetch real player images when selection changes
  useEffect(() => {
    if (!batter) { setBatterImage(null); return; }
    let c = false;
    fetchPlayerImagesWithCache([batter], (batch) => { if (!c && batch[batter]) setBatterImage(batch[batter]); });
    return () => { c = true; };
  }, [batter]);

  useEffect(() => {
    if (!bowler) { setBowlerImage(null); return; }
    let c = false;
    fetchPlayerImagesWithCache([bowler], (batch) => { if (!c && batch[bowler]) setBowlerImage(batch[bowler]); });
    return () => { c = true; };
  }, [bowler]);

  const loadMatchup = useCallback(async () => {
    if (!batter || !bowler) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMatchup(batter, bowler);
      setData(res.data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [batter, bowler]);

  useEffect(() => { loadMatchup(); }, [loadMatchup]);

  // Derive chart data — API returns dots/fours/sixes; singles/doubles/threes inferred
  const otherBalls = data ? Math.max(0, (data.balls || 0) - (data.dots || 0) - (data.fours || 0) - (data.sixes || 0)) : 0;
  const runDist = data ? [
    { name: 'Dots', value: data.dots || 0 },
    { name: '1s/2s/3s', value: otherBalls },
    { name: 'Fours', value: data.fours || 0 },
    { name: 'Sixes', value: data.sixes || 0 }
  ].filter(d => d.value > 0) : [];

  const radarData = data ? [
    { stat: 'Strike Rate', value: Math.min(data.strikeRate || 0, 250), max: 250 },
    { stat: 'Boundary %', value: data.balls > 0 ? Math.min(((data.fours * 4 + data.sixes * 6) / (data.runs || 1)) * 100, 100) : 0, max: 100 },
    { stat: 'Dot %', value: data.balls > 0 ? Math.min(((data.dots || 0) / data.balls) * 100, 100) : 0, max: 100 },
    { stat: 'Control', value: Math.min(100 - (data.wickets || 0) * 10, 100), max: 100 }
  ] : [];

  return (
    <div className="space-y-4">
      {/* Player Selection */}
      <div className="card" style={{ overflow: 'visible' }}>
        <div className="card-header">
          <h3 className="card-title">Batsman vs Bowler Matchup</h3>
        </div>
        <div className="card-body" style={{ overflow: 'visible' }}>
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <PlayerSearchBox label="Batsman" value={batter} onChange={setBatter} color="#1B2A72" />
            <div className="flex items-center justify-center w-10 h-10 rounded-lg mt-2 sm:mt-5 flex-shrink-0" style={{ background: 'rgba(27,42,114,0.08)', border: '1px solid rgba(27,42,114,0.15)' }}>
              <Swords size={16} style={{ color: '#1B2A72' }} />
            </div>
            <PlayerSearchBox label="Bowler" value={bowler} onChange={setBowler} color="#ef4444" />
          </div>

          {/* Player Photos VS Banner */}
          {batter && bowler && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 24, padding: '20px 0' }}>
              {/* Batsman Photo */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', border: '3px solid #1B2A72', boxShadow: '0 4px 12px rgba(27,42,114,0.25)', background: '#f0f2f8' }}>
                  <img
                    src={batterImage || playerAvatar(batter, 80)}
                    alt={batter}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { e.target.onerror = null; e.target.src = playerAvatar(batter, 80); }}
                  />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1B2A72', maxWidth: 100, textAlign: 'center', lineHeight: 1.2 }}>{batter}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Batsman</span>
              </div>

              {/* VS Badge */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1B2A72, #ef4444)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
                }}>
                  <span style={{ fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: '0.05em' }}>VS</span>
                </div>
              </div>

              {/* Bowler Photo */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', border: '3px solid #ef4444', boxShadow: '0 4px 12px rgba(239,68,68,0.25)', background: '#fef2f2' }}>
                  <img
                    src={bowlerImage || playerAvatar(bowler, 80)}
                    alt={bowler}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { e.target.onerror = null; e.target.src = playerAvatar(bowler, 80); }}
                  />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', maxWidth: 100, textAlign: 'center', lineHeight: 1.2 }}>{bowler}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bowler</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <LoadingSkeleton count={4} type="card" />
          <LoadingSkeleton type="chart" />
        </div>
      ) : error ? (
        <ErrorMessage message={error} onRetry={loadMatchup} />
      ) : data ? (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Balls Faced', value: data.balls, color: '#1B2A72' },
              { label: 'Runs Scored', value: data.runs, color: '#f59e0b' },
              { label: 'Strike Rate', value: data.strikeRate, color: '#6366f1' },
              { label: 'Dismissals', value: data.wickets, color: '#ef4444' }
            ].map((s, i) => (
              <div key={i} className="stat-card text-center">
                <p className="stat-label" style={{ marginBottom: 6 }}>{s.label}</p>
                <p style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Detailed Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Fours', value: data.fours || 0, color: '#06b6d4' },
              { label: 'Sixes', value: data.sixes || 0, color: '#ef4444' },
              { label: 'Dots', value: data.dots || 0, color: '#999' },
              { label: 'Dot Ball %', value: data.balls > 0 ? `${Math.round(((data.dots || 0) / data.balls) * 10000) / 100}%` : '0%', color: '#a855f7' },
              { label: 'Boundary %', value: data.runs > 0 ? `${Math.round(((data.fours * 4 + data.sixes * 6) / data.runs) * 10000) / 100}%` : '0%', color: '#10b981' }
            ].map((s, i) => (
              <div key={i} className="stat-card text-center">
                <p className="stat-label" style={{ marginBottom: 6 }}>{s.label}</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Run Distribution Pie */}
            {runDist.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Run Distribution</h3>
                </div>
                <div className="card-body flex justify-center">
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={runDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={50} paddingAngle={2}>
                        {runDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-3 pb-3">
                  {runDist.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#666' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {d.name}: {d.value}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Radar */}
            {radarData.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Matchup Profile</h3>
                </div>
                <div className="card-body flex justify-center">
                  <ResponsiveContainer width="100%" height={260}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="rgba(0,0,0,0.08)" />
                      <PolarAngleAxis dataKey="stat" stroke="#777" fontSize={11} />
                      <PolarRadiusAxis tick={false} stroke="rgba(0,0,0,0.04)" />
                      <Radar name="Matchup" dataKey="value" stroke="#1B2A72" fill="#1B2A72" fillOpacity={0.12} strokeWidth={2} />
                      <Tooltip content={<ChartTooltip />} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Match count info */}
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center', padding: '16px' }}>
              <p style={{ fontSize: 12, color: '#888' }}>Data from <span style={{ fontWeight: 700, color: '#1B2A72' }}>{data.matches}</span> match{data.matches !== 1 ? 'es' : ''} · Dot Ball % <span style={{ fontWeight: 700, color: '#6366f1' }}>{data.dotBallPercentage}%</span> · Boundary % <span style={{ fontWeight: 700, color: '#10b981' }}>{data.boundaryPercentage}%</span></p>
            </div>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
          <Swords size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <p style={{ fontSize: 14 }}>Select a batsman and bowler to see their matchup</p>
        </div>
      )}
    </div>
  );
}
