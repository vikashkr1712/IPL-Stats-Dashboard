import React, { useState, useEffect } from 'react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { Search, Crosshair, Target, RotateCcw, Swords, TrendingUp, Award, Zap, Shield, Flame, Calendar } from 'lucide-react';

const playerAvatar = (name, size = 32) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1B2A72&color=fff&size=${size}&bold=true&format=svg`;
import LoadingSkeleton from '../ui/LoadingSkeleton';
import TeamLogo from '../ui/TeamLogo';
import { searchPlayers, fetchPlayerCompare, fetchSeasons, fetchPlayerImagesWithCache, fetchPlayerTeams } from '../../services/api';

/* ─── Custom Tooltip ─────────────────────────────────────────────── */
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

/* ─── Player Search Box ──────────────────────────────────────────── */
function PlayerSearchBox({ label, color, selectedPlayer, onSelect, playerImage, currentTeam }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionImages, setSuggestionImages] = useState({});

  useEffect(() => {
    if (query.length < 1) { setSuggestions([]); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await searchPlayers(query);
        if (cancelled) return;
        setSuggestions(res.data);
        setShowSuggestions(true);
        if (res.data?.length) {
          fetchPlayerImagesWithCache(res.data, (batch) => {
            if (!cancelled) setSuggestionImages(prev => ({ ...prev, ...batch }));
          });
        }
      } catch (err) { console.error(err); }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  const selectPlayer = (name) => {
    onSelect(name);
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleKeyDown = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions.length > 0) {
        selectPlayer(suggestions[0]);
      } else if (query.trim().length >= 2) {
        try {
          const res = await searchPlayers(query.trim());
          if (res.data?.length > 0) selectPlayer(res.data[0]);
        } catch {}
      }
    }
  };

  return (
    <div className="card" style={{ borderTop: `3px solid ${color}`, overflow: 'visible' }}>
      <div className="card-header">
        <h3 className="card-title" style={{ color }}>{label}</h3>
      </div>
      <div className="card-body" style={{ overflow: 'visible' }}>
        <div className="relative">
          <div className="search-box">
            <Search size={15} style={{ color: '#aaa', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search player..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
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
                  <span style={{ position: 'relative', width: 28, height: 28, flexShrink: 0 }}>
                    <img src={playerAvatar(name, 28)} alt="" style={{ width: 28, height: 28, borderRadius: '50%', position: 'absolute', top: 0, left: 0 }} />
                    {suggestionImages[name] && !suggestionImages[name].includes('ui-avatars.com') && (
                      <img src={suggestionImages[name]} alt=""
                        style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', position: 'absolute', top: 0, left: 0, animation: 'imgFadeIn 0.3s ease-in' }}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <img
              src={playerImage || playerAvatar(selectedPlayer, 72)}
              alt={selectedPlayer}
              onError={(e) => { e.target.onerror = null; e.target.src = playerAvatar(selectedPlayer, 72); }}
              style={{ width: 40, height: 40, borderRadius: '50%', border: `2px solid ${color}`, objectFit: 'cover' }}
            />
            {currentTeam && <TeamLogo team={currentTeam} size={22} />}
            <span style={{ fontSize: 15, fontWeight: 700, color }}>{selectedPlayer}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Stat Comparison Row ────────────────────────────────────────── */
function StatRow({ label, val1, val2, color1, color2, higherIsBetter = true, icon }) {
  const n1 = parseFloat(val1) || 0;
  const n2 = parseFloat(val2) || 0;
  const better1 = higherIsBetter ? n1 > n2 : n1 < n2;
  const better2 = higherIsBetter ? n2 > n1 : n2 < n1;
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
      <div style={{ flex: 1, textAlign: 'right', paddingRight: 16 }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: better1 ? color1 : '#888' }}>{val1}</span>
      </div>
      <div style={{ flex: '0 0 auto', minWidth: 130, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        {icon && <span style={{ color: '#bbb', display: 'flex' }}>{icon}</span>}
        <span style={{ fontSize: 12, color: '#999', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      </div>
      <div style={{ flex: 1, textAlign: 'left', paddingLeft: 16 }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: better2 ? color2 : '#888' }}>{val2}</span>
      </div>
    </div>
  );
}

/* ─── Section Card ───────────────────────────────────────────────── */
function SectionCard({ icon, title, subtitle, color1, color2, p1, p2, img1, img2, team1, team2, children }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="card-title">{title}</h3>
        </div>
        {p1 && p2 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <img src={img1 || playerAvatar(p1, 48)} alt="" onError={(e) => { e.target.onerror = null; e.target.src = playerAvatar(p1, 48); }} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
              {team1 && <TeamLogo team={team1} size={16} />}
              <span style={{ color: color1, fontWeight: 600, fontSize: 13 }}>{p1}</span>
            </div>
            <span style={{ color: '#ccc', fontSize: 11 }}>vs</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <img src={img2 || playerAvatar(p2, 48)} alt="" onError={(e) => { e.target.onerror = null; e.target.src = playerAvatar(p2, 48); }} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
              {team2 && <TeamLogo team={team2} size={16} />}
              <span style={{ color: color2, fontWeight: 600, fontSize: 13 }}>{p2}</span>
            </div>
          </div>
        )}
      </div>
      <div className="card-body" style={{ padding: '0 16px 16px' }}>
        {subtitle && <p style={{ fontSize: 12, color: '#aaa', marginBottom: 10, paddingTop: 4 }}>{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

/* ─── Phase Row ──────────────────────────────────────────────────── */
function PhaseRow({ label, p1, p2, color1, color2 }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: '#777', letterSpacing: 0.5, marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'start' }}>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <MiniStat label="Runs" value={p1.runs} color={color1} />
          <MiniStat label="SR" value={p1.strikeRate} color={color1} />
          <MiniStat label="4s" value={p1.fours} color={color1} />
          <MiniStat label="6s" value={p1.sixes} color={color1} />
          <MiniStat label="Dot%" value={`${p1.dotPct}%`} color={color1} />
        </div>
        <div style={{ width: 1, background: '#eee', minHeight: 40, alignSelf: 'stretch' }} />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <MiniStat label="Runs" value={p2.runs} color={color2} />
          <MiniStat label="SR" value={p2.strikeRate} color={color2} />
          <MiniStat label="4s" value={p2.fours} color={color2} />
          <MiniStat label="6s" value={p2.sixes} color={color2} />
          <MiniStat label="Dot%" value={`${p2.dotPct}%`} color={color2} />
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 40 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: '#bbb', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
export default function PlayerCompare() {
  const COLOR1 = '#6366f1';
  const COLOR2 = '#f59e0b';

  const [player1, setPlayer1] = useState('V Kohli');
  const [player2, setPlayer2] = useState('RG Sharma');
  const [season, setSeason] = useState('');
  const [seasons, setSeasons] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [image1, setImage1] = useState(null);
  const [image2, setImage2] = useState(null);
  const [team1, setTeam1] = useState(null);
  const [team2, setTeam2] = useState(null);

  // Load seasons list
  useEffect(() => {
    fetchSeasons().then(res => setSeasons(res.data || [])).catch(() => {});
  }, []);

  // Load player images and teams
  useEffect(() => {
    if (!player1) { setImage1(null); setTeam1(null); return; }
    let c = false;
    fetchPlayerImagesWithCache([player1], (batch) => { if (!c && batch[player1]) setImage1(batch[player1]); });
    fetchPlayerTeams(player1).then(res => { if (!c) setTeam1(res.data?.currentTeam || null); }).catch(() => {});
    return () => { c = true; };
  }, [player1]);
  useEffect(() => {
    if (!player2) { setImage2(null); setTeam2(null); return; }
    let c = false;
    fetchPlayerImagesWithCache([player2], (batch) => { if (!c && batch[player2]) setImage2(batch[player2]); });
    fetchPlayerTeams(player2).then(res => { if (!c) setTeam2(res.data?.currentTeam || null); }).catch(() => {});
    return () => { c = true; };
  }, [player2]);

  // Fetch comparison data (single API call)
  useEffect(() => {
    if (!player1 || !player2) return;
    setLoading(true);
    fetchPlayerCompare(player1, player2, season || undefined)
      .then(res => { setData(res.data); setError(null); })
      .catch(err => { console.error(err); setError(err.message || 'Failed to load comparison'); })
      .finally(() => setLoading(false));
  }, [player1, player2, season]);

  const handleSwap = () => {
    setPlayer1(player2);
    setPlayer2(player1);
  };

  const d1 = data?.player1;
  const d2 = data?.player2;
  const bat1 = d1?.batting;
  const bat2 = d2?.batting;
  const bowl1 = d1?.bowling;
  const bowl2 = d2?.bowling;
  const ph1 = d1?.phases;
  const ph2 = d2?.phases;
  const mu = data?.matchup;

  // Radar data
  const radarData = [];
  if (bat1 && bat2) {
    radarData.push(
      { stat: 'Strike Rate', p1: Math.min(bat1.strikeRate || 0, 200), p2: Math.min(bat2.strikeRate || 0, 200), fullMark: 200 },
      { stat: 'Average', p1: Math.min(bat1.average || 0, 60), p2: Math.min(bat2.average || 0, 60), fullMark: 60 },
      { stat: 'Boundary %', p1: Math.min(bat1.boundaryPercentage || 0, 100), p2: Math.min(bat2.boundaryPercentage || 0, 100), fullMark: 100 }
    );
  }
  if (bowl1 && bowl2) {
    radarData.push(
      { stat: 'Wickets', p1: Math.min(bowl1.wickets || 0, 200), p2: Math.min(bowl2.wickets || 0, 200), fullMark: 200 },
      { stat: 'Dot Ball %', p1: Math.min(bowl1.dotBallPercentage || 0, 50), p2: Math.min(bowl2.dotBallPercentage || 0, 50), fullMark: 50 },
      { stat: 'Economy', p1: Math.min(10 - (bowl1.economy || 10), 10), p2: Math.min(10 - (bowl2.economy || 10), 10), fullMark: 10 }
    );
  }

  // Season comparison
  const seasonMap = {};
  (d1?.seasons || []).forEach(s => { seasonMap[s.season] = { season: s.season, p1Runs: s.runs || 0, p1Wkts: s.wickets || 0, p2Runs: 0, p2Wkts: 0 }; });
  (d2?.seasons || []).forEach(s => {
    if (seasonMap[s.season]) { seasonMap[s.season].p2Runs = s.runs || 0; seasonMap[s.season].p2Wkts = s.wickets || 0; }
    else seasonMap[s.season] = { season: s.season, p1Runs: 0, p1Wkts: 0, p2Runs: s.runs || 0, p2Wkts: s.wickets || 0 };
  });
  const seasonCompare = Object.values(seasonMap).sort((a, b) => a.season.localeCompare(b.season));
  const hasWickets = seasonCompare.some(s => s.p1Wkts > 0 || s.p2Wkts > 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="section-header mb-2">
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#333' }}>Player Comparison</h2>
        <p style={{ fontSize: 13, color: '#999', marginTop: 2 }}>
          Full batting, bowling, phase-wise &amp; head-to-head analysis
        </p>
      </div>

      {/* Season Filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Calendar size={15} style={{ color: '#aaa' }} />
        <select
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          style={{
            padding: '7px 14px', borderRadius: 6, border: '1px solid #e0e0e0',
            fontSize: 13, color: '#555', background: '#fff', cursor: 'pointer', minWidth: 140
          }}
        >
          <option value="">All Seasons</option>
          {seasons.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {season && <span style={{ fontSize: 12, color: '#1B2A72', fontWeight: 600, background: '#eef1ff', padding: '4px 10px', borderRadius: 12 }}>{season}</span>}
      </div>

      {/* Player Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ position: 'relative' }}>
        <PlayerSearchBox label="Player 1" color={COLOR1} selectedPlayer={player1} onSelect={setPlayer1} playerImage={image1} currentTeam={team1} />
        <PlayerSearchBox label="Player 2" color={COLOR2} selectedPlayer={player2} onSelect={setPlayer2} playerImage={image2} currentTeam={team2} />
        <button
          onClick={handleSwap}
          title="Swap players"
          style={{
            position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
            width: 40, height: 40, borderRadius: '50%', background: '#fff', border: '2px solid #e0e0e0',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 10
          }}
          onMouseOver={(e) => e.currentTarget.style.background = '#f5f5f5'}
          onMouseOut={(e) => e.currentTarget.style.background = '#fff'}
        >
          <RotateCcw size={16} style={{ color: '#666' }} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          <LoadingSkeleton count={6} type="card" />
          <LoadingSkeleton type="chart" />
        </div>
      ) : error ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <p style={{ color: '#ef4444', fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Failed to load comparison</p>
          <p style={{ color: '#999', fontSize: 14 }}>{error}</p>
        </div>
      ) : data ? (
        <>
          {/* ──── Awards & Milestones ──── */}
          {(bat1 || bat2) && (
            <SectionCard
              icon={<Award size={16} style={{ color: '#f59e0b' }} />}
              title="Awards & Milestones" subtitle="Career achievements and recognition"
              color1={COLOR1} color2={COLOR2} p1={player1} p2={player2} img1={image1} img2={image2} team1={team1} team2={team2}
            >
              <StatRow label="Player of Match" val1={d1?.awards?.playerOfMatch || 0} val2={d2?.awards?.playerOfMatch || 0} color1={COLOR1} color2={COLOR2} icon={<Award size={12} />} />
              {bat1 && bat2 && (
                <>
                  <StatRow label="Centuries" val1={bat1.centuries || 0} val2={bat2.centuries || 0} color1={COLOR1} color2={COLOR2} />
                  <StatRow label="Fifties" val1={bat1.fifties || 0} val2={bat2.fifties || 0} color1={COLOR1} color2={COLOR2} />
                  <StatRow label="Highest Score" val1={bat1.highestScore || 0} val2={bat2.highestScore || 0} color1={COLOR1} color2={COLOR2} />
                </>
              )}
            </SectionCard>
          )}

          {/* ──── Batting Comparison ──── */}
          {bat1 && bat2 && (
            <SectionCard
              icon={<Crosshair size={16} style={{ color: '#1B2A72' }} />}
              title="Batting Comparison" subtitle="Complete batting statistics"
              color1={COLOR1} color2={COLOR2} p1={player1} p2={player2} img1={image1} img2={image2} team1={team1} team2={team2}
            >
              <StatRow label="Matches" val1={bat1.matches} val2={bat2.matches} color1={COLOR1} color2={COLOR2} />
              <StatRow label="Innings" val1={bat1.innings} val2={bat2.innings} color1={COLOR1} color2={COLOR2} />
              <StatRow label="Total Runs" val1={bat1.totalRuns?.toLocaleString()} val2={bat2.totalRuns?.toLocaleString()} color1={COLOR1} color2={COLOR2} />
              <StatRow label="Strike Rate" val1={bat1.strikeRate} val2={bat2.strikeRate} color1={COLOR1} color2={COLOR2} />
              <StatRow label="Average" val1={bat1.average} val2={bat2.average} color1={COLOR1} color2={COLOR2} />
              <StatRow label="Balls Faced" val1={bat1.totalBalls?.toLocaleString()} val2={bat2.totalBalls?.toLocaleString()} color1={COLOR1} color2={COLOR2} />
              <StatRow label="Fours" val1={bat1.fours} val2={bat2.fours} color1={COLOR1} color2={COLOR2} />
              <StatRow label="Sixes" val1={bat1.sixes} val2={bat2.sixes} color1={COLOR1} color2={COLOR2} />
              <StatRow label="Boundary %" val1={`${bat1.boundaryPercentage}%`} val2={`${bat2.boundaryPercentage}%`} color1={COLOR1} color2={COLOR2} />
              <StatRow label="Dot Ball %" val1={`${bat1.dotBallPercentage}%`} val2={`${bat2.dotBallPercentage}%`} color1={COLOR1} color2={COLOR2} higherIsBetter={false} />
              <StatRow label="Dismissals" val1={bat1.dismissals} val2={bat2.dismissals} color1={COLOR1} color2={COLOR2} higherIsBetter={false} />
            </SectionCard>
          )}

          {/* ──── Bowling Comparison ──── */}
          {(bowl1 || bowl2) && (
            <SectionCard
              icon={<Target size={16} style={{ color: '#6366f1' }} />}
              title="Bowling Comparison" subtitle="Complete bowling statistics"
              color1={COLOR1} color2={COLOR2} p1={player1} p2={player2} img1={image1} img2={image2} team1={team1} team2={team2}
            >
              <StatRow label="Matches" val1={bowl1?.matches || '—'} val2={bowl2?.matches || '—'} color1={COLOR1} color2={COLOR2} />
              <StatRow label="Innings" val1={bowl1?.innings || '—'} val2={bowl2?.innings || '—'} color1={COLOR1} color2={COLOR2} />
              <StatRow label="Wickets" val1={bowl1?.wickets || 0} val2={bowl2?.wickets || 0} color1={COLOR1} color2={COLOR2} />
              <StatRow label="Overs" val1={bowl1?.overs || '—'} val2={bowl2?.overs || '—'} color1={COLOR1} color2={COLOR2} />
              <StatRow label="Economy" val1={bowl1?.economy || '—'} val2={bowl2?.economy || '—'} color1={COLOR1} color2={COLOR2} higherIsBetter={false} />
              <StatRow label="Bowling SR" val1={bowl1?.bowlingStrikeRate || '—'} val2={bowl2?.bowlingStrikeRate || '—'} color1={COLOR1} color2={COLOR2} higherIsBetter={false} />
              <StatRow label="Bowling Avg" val1={bowl1?.bowlingAverage || '—'} val2={bowl2?.bowlingAverage || '—'} color1={COLOR1} color2={COLOR2} higherIsBetter={false} />
              <StatRow label="Dot Ball %" val1={bowl1 ? `${bowl1.dotBallPercentage}%` : '—'} val2={bowl2 ? `${bowl2.dotBallPercentage}%` : '—'} color1={COLOR1} color2={COLOR2} />
              <StatRow label="Runs Conceded" val1={bowl1?.runsConceded?.toLocaleString() || '—'} val2={bowl2?.runsConceded?.toLocaleString() || '—'} color1={COLOR1} color2={COLOR2} higherIsBetter={false} />
            </SectionCard>
          )}

          {/* ──── Phase-wise Batting ──── */}
          {ph1 && ph2 && (bat1 || bat2) && (
            <SectionCard
              icon={<Zap size={16} style={{ color: '#ef4444' }} />}
              title="Phase-wise Batting" subtitle="Powerplay (Ov 1-6) · Middle (Ov 7-15) · Death (Ov 16-20)"
              color1={COLOR1} color2={COLOR2} p1={player1} p2={player2} img1={image1} img2={image2} team1={team1} team2={team2}
            >
              <PhaseRow label="Powerplay (Overs 1-6)" p1={ph1.powerplay} p2={ph2.powerplay} color1={COLOR1} color2={COLOR2} />
              <PhaseRow label="Middle Overs (7-15)" p1={ph1.middle} p2={ph2.middle} color1={COLOR1} color2={COLOR2} />
              <PhaseRow label="Death Overs (16-20)" p1={ph1.death} p2={ph2.death} color1={COLOR1} color2={COLOR2} />
            </SectionCard>
          )}

          {/* ──── Head-to-Head Matchup ──── */}
          {mu && (mu.p1BattingVsP2?.balls > 0 || mu.p2BattingVsP1?.balls > 0) && (
            <SectionCard
              icon={<Swords size={16} style={{ color: '#d92f2b' }} />}
              title="Head-to-Head Matchup" subtitle="When they face each other directly (batter vs bowler)"
            >
              {mu.p1BattingVsP2?.balls > 0 && (
                <div style={{ marginBottom: mu.p2BattingVsP1?.balls > 0 ? 24 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '10px 14px', background: '#f8f8f8', borderRadius: 6, flexWrap: 'wrap' }}>
                    <img src={image1 || playerAvatar(player1, 48)} alt="" onError={(e) => { e.target.onerror = null; e.target.src = playerAvatar(player1, 48); }} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                    {team1 && <TeamLogo team={team1} size={16} />}
                    <Crosshair size={14} style={{ color: COLOR1 }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: COLOR1 }}>{player1}</span>
                    <span style={{ fontSize: 12, color: '#999' }}>batting vs</span>
                    <img src={image2 || playerAvatar(player2, 48)} alt="" onError={(e) => { e.target.onerror = null; e.target.src = playerAvatar(player2, 48); }} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                    {team2 && <TeamLogo team={team2} size={16} />}
                    <Target size={14} style={{ color: COLOR2 }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: COLOR2 }}>{player2}</span>
                    <span style={{ fontSize: 12, color: '#999' }}>bowling</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Balls', value: mu.p1BattingVsP2.balls, color: '#555' },
                      { label: 'Runs', value: mu.p1BattingVsP2.runs, color: '#f59e0b' },
                      { label: 'SR', value: mu.p1BattingVsP2.strikeRate, color: '#1B2A72' },
                      { label: 'Dismissals', value: mu.p1BattingVsP2.wickets, color: '#d92f2b' },
                      { label: '4s', value: mu.p1BattingVsP2.fours, color: '#3366cc' },
                      { label: '6s', value: mu.p1BattingVsP2.sixes, color: '#6366f1' },
                      { label: 'Dots', value: mu.p1BattingVsP2.dots, color: '#999' },
                      { label: 'Dot %', value: `${mu.p1BattingVsP2.dotBallPercentage}%`, color: '#ef4444' },
                    ].map((s, i) => (
                      <div key={i} className="stat-card">
                        <p className="stat-label" style={{ marginBottom: 4 }}>{s.label}</p>
                        <p style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {mu.p2BattingVsP1?.balls > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '10px 14px', background: '#f8f8f8', borderRadius: 6, flexWrap: 'wrap' }}>
                    <img src={image2 || playerAvatar(player2, 48)} alt="" onError={(e) => { e.target.onerror = null; e.target.src = playerAvatar(player2, 48); }} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                    {team2 && <TeamLogo team={team2} size={16} />}
                    <Crosshair size={14} style={{ color: COLOR2 }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: COLOR2 }}>{player2}</span>
                    <span style={{ fontSize: 12, color: '#999' }}>batting vs</span>
                    <img src={image1 || playerAvatar(player1, 48)} alt="" onError={(e) => { e.target.onerror = null; e.target.src = playerAvatar(player1, 48); }} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                    {team1 && <TeamLogo team={team1} size={16} />}
                    <Target size={14} style={{ color: COLOR1 }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: COLOR1 }}>{player1}</span>
                    <span style={{ fontSize: 12, color: '#999' }}>bowling</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Balls', value: mu.p2BattingVsP1.balls, color: '#555' },
                      { label: 'Runs', value: mu.p2BattingVsP1.runs, color: '#f59e0b' },
                      { label: 'SR', value: mu.p2BattingVsP1.strikeRate, color: '#1B2A72' },
                      { label: 'Dismissals', value: mu.p2BattingVsP1.wickets, color: '#d92f2b' },
                      { label: '4s', value: mu.p2BattingVsP1.fours, color: '#3366cc' },
                      { label: '6s', value: mu.p2BattingVsP1.sixes, color: '#6366f1' },
                      { label: 'Dots', value: mu.p2BattingVsP1.dots, color: '#999' },
                      { label: 'Dot %', value: `${mu.p2BattingVsP1.dotBallPercentage}%`, color: '#ef4444' },
                    ].map((s, i) => (
                      <div key={i} className="stat-card">
                        <p className="stat-label" style={{ marginBottom: 4 }}>{s.label}</p>
                        <p style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </SectionCard>
          )}

          {/* ──── Radar Chart ──── */}
          {radarData.length >= 3 && (
            <div className="card">
              <div className="card-header">
                <div className="flex items-center gap-2">
                  <Shield size={16} style={{ color: '#1B2A72' }} />
                  <h3 className="card-title">All-Round Profile</h3>
                </div>
              </div>
              <div className="card-body flex justify-center">
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(0,0,0,0.08)" />
                    <PolarAngleAxis dataKey="stat" stroke="#777" fontSize={12} />
                    <PolarRadiusAxis stroke="rgba(0,0,0,0.04)" tick={false} />
                    <Radar name={player1} dataKey="p1" stroke={COLOR1} fill={COLOR1} fillOpacity={0.15} strokeWidth={2} />
                    <Radar name={player2} dataKey="p2" stroke={COLOR2} fill={COLOR2} fillOpacity={0.15} strokeWidth={2} />
                    <Legend formatter={(v) => <span style={{ fontSize: 13, color: '#666' }}>{v}</span>} iconType="circle" iconSize={9} />
                    <Tooltip content={<ChartTooltip />} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ──── Season-wise Runs ──── */}
          {seasonCompare.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} style={{ color: '#1B2A72' }} />
                  <h3 className="card-title">Season-wise Runs</h3>
                </div>
              </div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={seasonCompare}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis dataKey="season" stroke="#999" fontSize={11} angle={-45} textAnchor="end" height={55} tickLine={false} axisLine={false} tickFormatter={(v) => v.includes('/') ? v.split('/')[0] : v} />
                    <YAxis stroke="#999" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(27,42,114,0.06)' }} />
                    <Legend formatter={(v) => <span style={{ fontSize: 13, color: '#666' }}>{v}</span>} iconType="circle" iconSize={9} />
                    <Bar dataKey="p1Runs" name={player1} fill={COLOR1} radius={[3, 3, 0, 0]} barSize={14} fillOpacity={0.85} />
                    <Bar dataKey="p2Runs" name={player2} fill={COLOR2} radius={[3, 3, 0, 0]} barSize={14} fillOpacity={0.85} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ──── Season-wise Wickets ──── */}
          {hasWickets && seasonCompare.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div className="flex items-center gap-2">
                  <Flame size={16} style={{ color: '#ef4444' }} />
                  <h3 className="card-title">Season-wise Wickets</h3>
                </div>
              </div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={seasonCompare}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis dataKey="season" stroke="#999" fontSize={11} angle={-45} textAnchor="end" height={55} tickLine={false} axisLine={false} tickFormatter={(v) => v.includes('/') ? v.split('/')[0] : v} />
                    <YAxis stroke="#999" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(239,68,68,0.06)' }} />
                    <Legend formatter={(v) => <span style={{ fontSize: 13, color: '#666' }}>{v}</span>} iconType="circle" iconSize={9} />
                    <Bar dataKey="p1Wkts" name={player1} fill={COLOR1} radius={[3, 3, 0, 0]} barSize={14} fillOpacity={0.85} />
                    <Bar dataKey="p2Wkts" name={player2} fill={COLOR2} radius={[3, 3, 0, 0]} barSize={14} fillOpacity={0.85} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
