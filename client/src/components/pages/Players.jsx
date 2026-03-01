import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, AreaChart, Area
} from 'recharts';
import { Search, Crosshair, Target, ArrowLeft } from 'lucide-react';

const playerAvatar = (name, size = 32) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1B2A72&color=fff&size=${size}&bold=true&format=svg`;
import LoadingSkeleton from '../ui/LoadingSkeleton';
import ErrorMessage from '../ui/ErrorMessage';
import TeamLogo from '../ui/TeamLogo';
import { searchPlayers, fetchBattingStats, fetchBowlingStats, fetchPlayerSeasonWise, fetchPhaseStats, fetchPlayerImage, fetchPlayerImagesWithCache, fetchPlayerTeams } from '../../services/api';
import { getTeamInfo } from '../../utils/teamLogos';

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{label}</p>
      {payload.map((entry, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color }} />
          <span style={{ color: '#aaa' }}>{entry.name}:</span>
          <span style={{ color: '#fff', fontWeight: 600 }}>{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function Players() {
  const [searchParams] = useSearchParams();
  const playerFromUrl = searchParams.get('name');
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(playerFromUrl || 'V Kohli');
  const [battingStats, setBattingStats] = useState(null);
  const [bowlingStats, setBowlingStats] = useState(null);
  const [seasonWise, setSeasonWise] = useState([]);
  const [phaseStats, setPhaseStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [playerImage, setPlayerImage] = useState(null);
  const [suggestionImages, setSuggestionImages] = useState({});
  const [playerTeamsData, setPlayerTeamsData] = useState(null);

  // Fetch real player image for selected player (with cache)
  useEffect(() => {
    if (!selectedPlayer) { setPlayerImage(null); return; }
    let cancelled = false;
    fetchPlayerImagesWithCache([selectedPlayer], (batch) => {
      if (!cancelled && batch[selectedPlayer]) {
        setPlayerImage(batch[selectedPlayer]);
      }
    });
    return () => { cancelled = true; };
  }, [selectedPlayer]);

  // Search suggestions + fetch their images progressively
  useEffect(() => {
    if (query.length < 1) { setSuggestions([]); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await searchPlayers(query);
        if (cancelled) return;
        setSuggestions(res.data);
        setShowSuggestions(true);

        // Progressively load real images for suggestions
        if (res.data?.length) {
          fetchPlayerImagesWithCache(res.data, (batch) => {
            if (!cancelled) {
              setSuggestionImages(prev => ({ ...prev, ...batch }));
            }
          });
        }
      } catch (err) { console.error(err); }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  const loadPlayerData = useCallback(async (name) => {
    setLoading(true);
    setError(null);
    try {
      const [batting, bowling, seasons, phases, teamsInfo] = await Promise.allSettled([
        fetchBattingStats(name), fetchBowlingStats(name), fetchPlayerSeasonWise(name), fetchPhaseStats(name), fetchPlayerTeams(name)
      ]);
      setBattingStats(batting.status === 'fulfilled' ? batting.value.data : null);
      setBowlingStats(bowling.status === 'fulfilled' ? bowling.value.data : null);
      setSeasonWise(seasons.status === 'fulfilled' ? seasons.value.data.seasons : []);
      setPhaseStats(phases.status === 'fulfilled' ? phases.value.data : null);
      setPlayerTeamsData(teamsInfo.status === 'fulfilled' ? teamsInfo.value.data : null);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (playerFromUrl) setSelectedPlayer(playerFromUrl);
  }, [playerFromUrl]);

  useEffect(() => {
    if (selectedPlayer) loadPlayerData(selectedPlayer);
  }, [selectedPlayer, loadPlayerData]);

  const selectPlayer = (name) => {
    setSelectedPlayer(name);
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleSearchKeyDown = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions.length > 0) {
        selectPlayer(suggestions[0]);
      } else if (query.trim().length >= 1) {
        // Fetch suggestions first, then select the top result
        try {
          const res = await searchPlayers(query.trim());
          if (res.data && res.data.length > 0) {
            selectPlayer(res.data[0]);
          }
        } catch (err) { console.error(err); }
      }
    }
  };

  const radarData = battingStats && bowlingStats ? [
    { stat: 'Strike Rate', value: Math.min(battingStats.strikeRate || 0, 200), fullMark: 200 },
    { stat: 'Average', value: Math.min(battingStats.average || 0, 60), fullMark: 60 },
    { stat: 'Boundary %', value: Math.min(battingStats.boundaryPercentage || 0, 100), fullMark: 100 },
    { stat: 'Wickets', value: Math.min(bowlingStats.wickets || 0, 200), fullMark: 200 },
    { stat: 'Dot Ball %', value: Math.min(bowlingStats.dotBallPercentage || 0, 50), fullMark: 50 },
    { stat: 'Economy', value: Math.min(10 - (bowlingStats.economy || 10), 10), fullMark: 10 }
  ] : [];

  return (
    <div className="space-y-4">
      {playerFromUrl && (
        <button onClick={() => navigate(-1)} className="back-btn mb-1">
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
      )}

      {/* Search */}
      <div className="card" style={{ overflow: 'visible' }}>
        <div className="card-header">
          <h3 className="card-title">Player Search</h3>
        </div>
        <div className="card-body" style={{ overflow: 'visible' }}>
          <div className="relative" style={{ maxWidth: 480 }}>
            <div className="search-box">
              <Search size={15} style={{ color: '#aaa', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search player (e.g. Kohli, Bumrah, Dhoni)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="search-input"
              />
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: 280, overflowY: 'auto', zIndex: 999 }}>
                {suggestions.map((name, i) => (
                  <button
                    key={i}
                    onMouseDown={() => selectPlayer(name)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', fontSize: 14, color: '#555', background: 'none', border: 'none', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', textAlign: 'left' }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#f5f5f5'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <span style={{ position: 'relative', width: 32, height: 32, flexShrink: 0 }}>
                      <img src={playerAvatar(name, 32)} alt="" style={{ width: 32, height: 32, borderRadius: '50%', position: 'absolute', top: 0, left: 0 }} />
                      {suggestionImages[name] && !suggestionImages[name].includes('ui-avatars.com') && (
                        <img
                          src={suggestionImages[name]}
                          alt=""
                          style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', position: 'absolute', top: 0, left: 0, animation: 'imgFadeIn 0.3s ease-in' }}
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      )}
                    </span>
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedPlayer && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img
                  src={playerImage || playerAvatar(selectedPlayer, 80)}
                  alt={selectedPlayer}
                  onError={(e) => { e.target.onerror = null; e.target.src = playerAvatar(selectedPlayer, 80); }}
                  style={{ width: 52, height: 52, borderRadius: '50%', border: '2px solid #1B2A72', objectFit: 'cover' }}
                />
                <div>
                  <p style={{ fontSize: 17, fontWeight: 700, color: '#333', margin: 0 }}>{selectedPlayer}</p>
                  <p style={{ fontSize: 12, color: '#888', margin: 0 }}>IPL Career Stats</p>
                </div>
              </div>
              {/* Team History */}
              {playerTeamsData && playerTeamsData.teams && playerTeamsData.teams.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                    Teams Played For
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {playerTeamsData.teams.map((t) => {
                      const info = getTeamInfo(t.team);
                      const isCurrent = t.team === playerTeamsData.currentTeam;
                      return (
                        <div
                          key={t.team}
                          onClick={() => navigate(`/teams?team=${encodeURIComponent(t.team)}`)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '5px 10px', borderRadius: 20,
                            background: isCurrent ? `${info.color}15` : '#f5f5f5',
                            border: `1px solid ${isCurrent ? info.color : '#e0e0e0'}`,
                            cursor: 'pointer', transition: 'all 0.15s'
                          }}
                          title={`${t.team} (${t.seasons.join(', ')})`}
                        >
                          <TeamLogo team={t.team} size={22} />
                          <span style={{ fontSize: 12, fontWeight: isCurrent ? 600 : 500, color: isCurrent ? info.color : '#666' }}>
                            {info.abbr}
                          </span>
                          <span style={{ fontSize: 10, color: '#aaa' }}>
                            {t.seasons.length > 2
                              ? `${t.seasons[0]}-${t.seasons[t.seasons.length - 1]}`
                              : t.seasons.join(', ')}
                          </span>
                          {isCurrent && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: info.color, background: `${info.color}18`, padding: '1px 5px', borderRadius: 8 }}>
                              CURRENT
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <LoadingSkeleton count={6} type="card" />
          <LoadingSkeleton type="chart" />
        </div>
      ) : error ? (
        <ErrorMessage message={error} onRetry={() => loadPlayerData(selectedPlayer)} />
      ) : (
        <>
          {/* Batting Stats */}
          {battingStats && (
            <>
              <div className="section-label">
                <Crosshair size={14} style={{ color: '#1B2A72' }} />
                <span style={{ color: '#1B2A72' }}>Batting</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Total Runs', value: battingStats.totalRuns?.toLocaleString(), color: '#f59e0b' },
                  { label: 'Strike Rate', value: battingStats.strikeRate, color: '#1B2A72' },
                  { label: 'Average', value: battingStats.average, color: '#6366f1' },
                  { label: 'Sixes', value: battingStats.sixes, color: '#ef4444' },
                  { label: 'Fours', value: battingStats.fours, color: '#06b6d4' },
                  { label: 'Boundary %', value: `${battingStats.boundaryPercentage}%`, color: '#a855f7' },
                ].map((s, i) => (
                  <div key={i} className="stat-card">
                    <p className="stat-label" style={{ marginBottom: 6 }}>{s.label}</p>
                    <p style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Phase-wise Batting */}
          {phaseStats?.batting && battingStats && (
            <>
              <div className="section-label" style={{ marginTop: 8 }}>
                <Crosshair size={14} style={{ color: '#1B2A72' }} />
                <span style={{ color: '#1B2A72' }}>Phase-wise Batting</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <thead>
                    <tr style={{ background: '#1B2A72', color: '#fff' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Phase</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>Runs</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>Balls</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>SR</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>4s</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>6s</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>Dot%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['powerplay', 'middle', 'death'].map((key, i) => {
                      const p = phaseStats.batting[key];
                      const colors = ['#f59e0b', '#6366f1', '#ef4444'];
                      return (
                        <tr key={key} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: colors[i] }}>{p.phase || key}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>{p.runs}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', color: '#666' }}>{p.balls}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: '#1B2A72' }}>{p.strikeRate}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', color: '#06b6d4' }}>{p.fours}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', color: '#ef4444' }}>{p.sixes}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', color: '#888' }}>{p.dotPct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Bowling Stats */}
          {bowlingStats && bowlingStats.wickets > 0 && (
            <>
              <div className="section-label" style={{ marginTop: 8 }}>
                <Target size={14} style={{ color: '#6366f1' }} />
                <span style={{ color: '#6366f1' }}>Bowling</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Wickets', value: bowlingStats.wickets, color: '#f59e0b' },
                  { label: 'Economy', value: bowlingStats.economy, color: '#1B2A72' },
                  { label: 'Bowling SR', value: bowlingStats.bowlingStrikeRate, color: '#6366f1' },
                  { label: 'Dot Ball %', value: `${bowlingStats.dotBallPercentage}%`, color: '#ef4444' },
                  { label: 'Matches', value: bowlingStats.matchesPlayed, color: '#06b6d4' },
                ].map((s, i) => (
                  <div key={i} className="stat-card">
                    <p className="stat-label" style={{ marginBottom: 6 }}>{s.label}</p>
                    <p style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Phase-wise Bowling */}
          {phaseStats?.bowling && bowlingStats && bowlingStats.wickets > 0 && (
            <>
              <div className="section-label" style={{ marginTop: 8 }}>
                <Target size={14} style={{ color: '#6366f1' }} />
                <span style={{ color: '#6366f1' }}>Phase-wise Bowling</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <thead>
                    <tr style={{ background: '#6366f1', color: '#fff' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Phase</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>Wickets</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>Balls</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>Runs</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>Econ</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>Dot%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['powerplay', 'middle', 'death'].map((key, i) => {
                      const p = phaseStats.bowling[key];
                      const colors = ['#f59e0b', '#6366f1', '#ef4444'];
                      return (
                        <tr key={key} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: colors[i] }}>{p.phase || key}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>{p.wickets}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', color: '#666' }}>{p.balls}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', color: '#ef4444' }}>{p.runsConceded}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: '#1B2A72' }}>{p.economy}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', color: '#888' }}>{p.dotPct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {seasonWise.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Season Runs</h3>
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={seasonWise}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                      <XAxis dataKey="season" stroke="#999" fontSize={10} angle={-45} textAnchor="end" height={55} tickLine={false} axisLine={false} tickFormatter={(v) => v.includes('/') ? v.split('/')[0] : v} />
                      <YAxis stroke="#999" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(27,42,114,0.06)' }} />
                      <Bar dataKey="runs" name="Runs" fill="#f59e0b" radius={[3, 3, 0, 0]} barSize={14} fillOpacity={0.85} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {seasonWise.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Strike Rate Trend</h3>
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={seasonWise}>
                      <defs>
                        <linearGradient id="srGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1B2A72" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#1B2A72" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                      <XAxis dataKey="season" stroke="#999" fontSize={10} angle={-45} textAnchor="end" height={55} tickLine={false} axisLine={false} tickFormatter={(v) => v.includes('/') ? v.split('/')[0] : v} />
                      <YAxis stroke="#999" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="strikeRate" name="Strike Rate" stroke="#1B2A72" strokeWidth={2} fill="url(#srGrad)" dot={{ fill: '#1B2A72', r: 3, strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Radar Chart */}
          {radarData.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">All-Round Profile</h3>
              </div>
              <div className="card-body flex justify-center">
                <ResponsiveContainer width="100%" height={280} maxWidth={450}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(0,0,0,0.08)" />
                    <PolarAngleAxis dataKey="stat" stroke="#777" fontSize={11} />
                    <PolarRadiusAxis stroke="rgba(0,0,0,0.04)" tick={false} />
                    <Radar name={selectedPlayer} dataKey="value" stroke="#1B2A72" fill="#1B2A72" fillOpacity={0.12} strokeWidth={2} />
                    <Tooltip content={<ChartTooltip />} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
