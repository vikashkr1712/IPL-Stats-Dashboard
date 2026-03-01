import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronDown, Trophy, Award, TrendingUp } from 'lucide-react';
import { fetchLeaderboard, fetchSeasons, fetchAllTeams, fetchPlayerImagesWithCache } from '../../services/api';
import TeamLogo from '../ui/TeamLogo';
import { getTeamInfo } from '../../utils/teamLogos';

/* ================================================================
   CATEGORY DEFINITIONS (mirrors backend)
   ================================================================ */

const BATTER_CATEGORIES = [
  { key: 'orange_cap', label: 'Orange Cap' },
  { key: 'most_fours', label: 'Most 4s' },
  { key: 'most_fours_innings', label: 'Most 4s (Innings)' },
  { key: 'most_sixes', label: 'Most 6s' },
  { key: 'most_sixes_innings', label: 'Most 6s (Innings)' },
  { key: 'most_fifties', label: 'Most Fifties' },
  { key: 'most_centuries', label: 'Most Centuries' },
  { key: 'fastest_fifties', label: 'Fastest Fifties' },
  { key: 'fastest_centuries', label: 'Fastest Centuries' },
  { key: 'highest_scores', label: 'Highest Scores' },
  { key: 'best_batting_sr', label: 'Best Strike Rate' },
  { key: 'best_batting_sr_innings', label: 'Best SR (Innings)' },
  { key: 'best_batting_avg', label: 'Best Average' },
];

const BOWLER_CATEGORIES = [
  { key: 'purple_cap', label: 'Purple Cap' },
  { key: 'most_maidens', label: 'Most Maidens' },
  { key: 'most_dot_balls', label: 'Most Dot Balls' },
  { key: 'most_dot_balls_innings', label: 'Most Dot Balls (Innings)' },
  { key: 'best_bowling_avg', label: 'Best Bowling Average' },
  { key: 'best_bowling_economy', label: 'Best Economy' },
  { key: 'best_bowling_economy_innings', label: 'Best Economy (Innings)' },
  { key: 'best_bowling_sr', label: 'Best Strike Rate' },
  { key: 'best_bowling_sr_innings', label: 'Best SR (Innings)' },
  { key: 'best_bowling_figures', label: 'Best Figures' },
  { key: 'most_runs_conceded', label: 'Most Runs Conceded' },
  { key: 'hat_tricks', label: 'Hat-tricks' },
];

/* ================================================================
   TEAM ABBREVIATIONS & COLORS (for player badges)
   ================================================================ */

const TEAM_META = {
  'Mumbai Indians': { abbr: 'MI', color: '#004BA0' },
  'Chennai Super Kings': { abbr: 'CSK', color: '#FFCB05' },
  'Royal Challengers Bangalore': { abbr: 'RCB', color: '#D4213D' },
  'Royal Challengers Bengaluru': { abbr: 'RCB', color: '#D4213D' },
  'Kolkata Knight Riders': { abbr: 'KKR', color: '#3A225D' },
  'Delhi Capitals': { abbr: 'DC', color: '#004C93' },
  'Delhi Daredevils': { abbr: 'DD', color: '#004C93' },
  'Rajasthan Royals': { abbr: 'RR', color: '#EA1A85' },
  'Sunrisers Hyderabad': { abbr: 'SRH', color: '#FF822A' },
  'Punjab Kings': { abbr: 'PBKS', color: '#ED1B24' },
  'Kings XI Punjab': { abbr: 'KXIP', color: '#ED1B24' },
  'Gujarat Titans': { abbr: 'GT', color: '#1C1C2B' },
  'Lucknow Super Giants': { abbr: 'LSG', color: '#A72056' },
  'Deccan Chargers': { abbr: 'DC', color: '#4A4A4A' },
  'Rising Pune Supergiant': { abbr: 'RPS', color: '#6F42C1' },
  'Rising Pune Supergiants': { abbr: 'RPS', color: '#6F42C1' },
  'Gujarat Lions': { abbr: 'GL', color: '#E04F16' },
  'Pune Warriors': { abbr: 'PW', color: '#2F9BE3' },
  'Kochi Tuskers Kerala': { abbr: 'KTK', color: '#7B3F00' },
};

function getTeamAbbr(team) {
  return TEAM_META[team]?.abbr || team?.split(' ').map(w => w[0]).join('') || '?';
}
function getTeamColor(team) {
  return TEAM_META[team]?.color || '#666';
}

/* ================================================================
   AVATAR HELPER
   ================================================================ */

function playerAvatar(name) {
  const initials = name ? name.split(' ').map(w => w[0]).join('').substring(0, 2) : '?';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1B2A72&color=fff&size=80&bold=true&format=svg`;
}

/* ================================================================
   MAIN COMPONENT
   ================================================================ */

export default function SeasonStats() {
  const navigate = useNavigate();

  // Filter state
  const [type, setType] = useState('batter');
  const [category, setCategory] = useState('orange_cap');
  const [season, setSeason] = useState('');
  const [team, setTeam] = useState('');
  const [search, setSearch] = useState('');

  // Data state
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [teams, setTeams] = useState([]);
  const [playerImages, setPlayerImages] = useState({});

  // Custom dropdown state
  const [catOpen, setCatOpen] = useState(false);

  // Fetch seasons & teams on mount
  useEffect(() => {
    fetchSeasons()
      .then(res => setSeasons(res.data || []))
      .catch(() => {});
    fetchAllTeams()
      .then(res => {
        const t = (res.data || []).map(item => typeof item === 'string' ? item : item.name || item.team);
        setTeams(t.sort());
      })
      .catch(() => {});
  }, []);

  // Fetch leaderboard data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchLeaderboard(category, season || undefined, team || undefined)
      .then(res => {
        if (!cancelled) {
          setData(res.data);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message || 'Failed to load stats');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [category, season, team]);

  // Fetch player images progressively (cached first, then server)
  useEffect(() => {
    if (!data?.rows?.length) return;
    const names = data.rows.map(r => r.player).filter(Boolean);
    if (!names.length) return;

    // Only fetch images we don't already have in component state
    const newNames = names.filter(n => !playerImages[n]);
    if (!newNames.length) return;

    let cancelled = false;
    fetchPlayerImagesWithCache(newNames, (batch) => {
      if (!cancelled) {
        setPlayerImages(prev => ({ ...prev, ...batch }));
      }
    });

    return () => { cancelled = true; };
  }, [data]);

  // Handle type toggle
  const handleTypeChange = useCallback((newType) => {
    setType(newType);
    setCategory(newType === 'batter' ? 'orange_cap' : 'purple_cap');
    setCatOpen(false);
  }, []);

  // Category options based on type
  const categoryOptions = useMemo(() => {
    return type === 'batter' ? BATTER_CATEGORIES : BOWLER_CATEGORIES;
  }, [type]);

  // Current category label
  const currentCatLabel = useMemo(() => {
    const all = [...BATTER_CATEGORIES, ...BOWLER_CATEGORIES];
    return all.find(c => c.key === category)?.label || category;
  }, [category]);

  // Filtered rows based on search
  const filteredRows = useMemo(() => {
    if (!data?.rows) return [];
    if (!search.trim()) return data.rows;
    const q = search.toLowerCase();
    return data.rows.filter(r =>
      r.player?.toLowerCase().includes(q) ||
      r.team?.toLowerCase().includes(q) ||
      r.opponent?.toLowerCase().includes(q)
    );
  }, [data, search]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!catOpen) return;
    const handler = (e) => {
      if (!e.target.closest('.cat-dropdown-wrapper')) setCatOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [catOpen]);

  /* ================================================================
     RENDER HELPERS
     ================================================================ */

  function renderPlayerCell(row) {
    const imgSrc = playerImages[row.player];
    const teamAbbr = getTeamAbbr(row.team);
    const teamColor = getTeamColor(row.team);
    const avatar = playerAvatar(row.player);

    return (
      <div className="lb-player-cell">
        <div
          className="lb-player-img-wrapper"
          data-img="1"
          style={{ '--hover-img': `url(${imgSrc || avatar})` }}
        >
          {/* Always show avatar as base layer */}
          <img
            src={avatar}
            alt=""
            className="lb-player-img lb-player-avatar"
          />
          {/* Overlay real image on top when available */}
          {imgSrc && imgSrc !== avatar && (
            <img
              src={imgSrc}
              alt={row.player}
              className="lb-player-img lb-player-real-img"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          )}
          {!imgSrc && (
            <div className="lb-player-img-shimmer" />
          )}
        </div>
        <div className="lb-player-info">
          <span
            className="lb-player-name lb-player-link"
            onClick={() => navigate(`/players?name=${encodeURIComponent(row.player)}`)}
            title={`View ${row.player}'s stats`}
          >
            {row.player}
          </span>
          <span className="lb-player-team" style={{ color: teamColor, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <TeamLogo team={row.team} size={16} />
          </span>
        </div>
      </div>
    );
  }

  function renderCellValue(col, row) {
    if (col.key === 'pos') return null; // handled separately
    if (col.key === 'player') return renderPlayerCell(row);
    const val = row[col.key];
    if (val === null || val === undefined) return '-';
    if (typeof val === 'number' && !Number.isInteger(val)) return val.toFixed(2);
    return val;
  }

  /* ================================================================
     RENDER
     ================================================================ */

  return (
    <div className="lb-page">
      {/* Page header */}
      <div className="lb-header">
        <div className="lb-header-icon">
          <Trophy size={28} />
        </div>
        <div>
          <h1 className="lb-title">IPL Stats & Records</h1>
          <p className="lb-subtitle">Complete statistical records from all IPL seasons</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="lb-filters">
        {/* Type Toggle */}
        <div className="lb-type-toggle">
          <button
            className={`lb-type-btn ${type === 'batter' ? 'active batter' : ''}`}
            onClick={() => handleTypeChange('batter')}
          >
            <TrendingUp size={14} />
            BATTERS
          </button>
          <button
            className={`lb-type-btn ${type === 'bowler' ? 'active bowler' : ''}`}
            onClick={() => handleTypeChange('bowler')}
          >
            <Award size={14} />
            BOWLERS
          </button>
        </div>

        {/* Category Dropdown */}
        <div className="cat-dropdown-wrapper">
          <button
            className="lb-filter-btn"
            onClick={() => setCatOpen(!catOpen)}
          >
            <span>{currentCatLabel}</span>
            <ChevronDown size={15} className={catOpen ? 'rotate' : ''} />
          </button>
          {catOpen && (
            <div className="cat-dropdown">
              {categoryOptions.map(c => (
                <button
                  key={c.key}
                  className={`cat-option ${c.key === category ? 'active' : ''}`}
                  onClick={() => { setCategory(c.key); setCatOpen(false); }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Season Dropdown */}
        <select
          className="lb-select"
          value={season}
          onChange={(e) => setSeason(e.target.value)}
        >
          <option value="">All Seasons</option>
          {seasons.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Team Dropdown */}
        <select
          className="lb-select"
          value={team}
          onChange={(e) => setTeam(e.target.value)}
        >
          <option value="">All Teams</option>
          {teams.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* Search */}
        <div className="lb-search">
          <Search size={15} />
          <input
            type="text"
            placeholder="Search player..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Category label banner */}
      <div className="lb-cat-banner">
        <span className={`lb-cat-badge ${type}`}>
          {type === 'batter' ? 'BATTING' : 'BOWLING'}
        </span>
        <h2 className="lb-cat-label">{data?.label || currentCatLabel}</h2>
        {!loading && data?.rows && (
          <span className="lb-cat-count">{filteredRows.length} records</span>
        )}
      </div>

      {/* Table */}
      <div className="lb-table-wrapper">
        {loading ? (
          <div className="lb-loading">
            <div className="lb-spinner" />
            <p>Loading stats...</p>
          </div>
        ) : error ? (
          <div className="lb-error">
            <p>{error}</p>
          </div>
        ) : !filteredRows.length ? (
          <div className="lb-empty">
            <p>No records found for the selected filters.</p>
          </div>
        ) : (
          <table className="lb-table">
            <thead>
              <tr>
                {data.columns.map(col => (
                  <th
                    key={col.key}
                    className={
                      col.key === 'pos' ? 'col-pos' :
                      col.key === 'player' ? 'col-player' :
                      col.key === 'opponent' || col.key === 'venue' ? 'col-text' :
                      'col-num'
                    }
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => (
                <tr key={idx} className={idx < 3 ? `top-${idx + 1}` : ''}>
                  {data.columns.map(col => (
                    <td
                      key={col.key}
                      className={
                        col.key === 'pos' ? 'col-pos' :
                        col.key === 'player' ? 'col-player' :
                        col.key === 'opponent' || col.key === 'venue' ? 'col-text' :
                        'col-num'
                      }
                    >
                      {col.key === 'pos' ? (
                        <span className={`lb-pos ${idx < 3 ? 'highlight' : ''}`}>
                          {idx + 1}
                        </span>
                      ) : (
                        renderCellValue(col, row)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
