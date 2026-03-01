import React, { useState, useEffect } from 'react';
import { Trophy, ChevronDown } from 'lucide-react';
import { fetchPointsTable, fetchPlayoffs, fetchSeasons } from '../../services/api';
import TeamLogo from '../ui/TeamLogo';
import { getTeamInfo } from '../../utils/teamLogos';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import ErrorMessage from '../ui/ErrorMessage';

/* ══════════════════════════════════════════════════════
   IPL POINTS TABLE + PLAYOFFS — iplt20.com-style
   ══════════════════════════════════════════════════════ */

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate().toString().padStart(2, '0')}`;
}

export default function PointsTable() {
  const [seasons, setSeasons] = useState([]);
  const [season, setSeason] = useState('');
  const [data, setData] = useState([]);
  const [playoffs, setPlayoffs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('table');

  useEffect(() => {
    fetchSeasons()
      .then(res => {
        const list = res.data || res;
        setSeasons(Array.isArray(list) ? list : []);
        if (Array.isArray(list) && list.length > 0) {
          setSeason(String(list[list.length - 1]));
        }
      })
      .catch(() => setSeasons([]));
  }, []);

  useEffect(() => {
    if (!season) return;
    setLoading(true);
    setError('');
    Promise.all([fetchPointsTable(season), fetchPlayoffs(season)])
      .then(([ptRes, plRes]) => {
        const table = ptRes.data || ptRes || [];
        setData(Array.isArray(table) ? table : []);
        const bracket = plRes.data || plRes || {};
        setPlayoffs(typeof bracket === 'object' && !Array.isArray(bracket) ? bracket : null);
      })
      .catch(err => setError(err.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [season]);

  const qualifyCount = 4;
  const hasPlayoffs = playoffs && Object.keys(playoffs).length > 0;

  return (
    <div className="pt-page">
      {/* ── Header ─────────────────────────────────── */}
      <div className="pt-header">
        <div className="pt-header-left">
          <Trophy size={26} strokeWidth={2.2} />
          <div>
            <h1 className="pt-title">Points Table</h1>
            <p className="pt-subtitle">Indian Premier League — Men</p>
          </div>
        </div>
        <div className="pt-season-picker">
          <select value={season} onChange={e => setSeason(e.target.value)} className="pt-season-select">
            <option value="" disabled>Select Season</option>
            {[...seasons].reverse().map(s => (
              <option key={s} value={s}>IPL {String(s).includes('/') ? String(s).split('/')[0] : s}</option>
            ))}
          </select>
          <ChevronDown size={16} className="pt-select-chevron" />
        </div>
      </div>

      {/* ── Tab toggle ─────────────────────────────── */}
      {!loading && !error && data.length > 0 && (
        <div className="pt-tabs">
          <button className={`pt-tab ${activeTab === 'table' ? 'pt-tab-active' : ''}`} onClick={() => setActiveTab('table')}>
            Points Table
          </button>
          <button className={`pt-tab ${activeTab === 'playoffs' ? 'pt-tab-active' : ''}`} onClick={() => setActiveTab('playoffs')}>
            Playoffs
          </button>
        </div>
      )}

      {loading && <LoadingSkeleton />}
      {error && <ErrorMessage message={error} />}

      {/* ── Points Table View ──────────────────────── */}
      {!loading && !error && data.length > 0 && activeTab === 'table' && (
        <div className="pt-table-wrapper">
          <table className="pt-table">
            <thead>
              <tr>
                <th className="pt-th pt-th-pos">#</th>
                <th className="pt-th pt-th-team">TEAM</th>
                <th className="pt-th pt-th-num">P</th>
                <th className="pt-th pt-th-num">W</th>
                <th className="pt-th pt-th-num">L</th>
                <th className="pt-th pt-th-num">NR</th>
                <th className="pt-th pt-th-num">NRR</th>
                <th className="pt-th pt-th-for">FOR</th>
                <th className="pt-th pt-th-for">AGAINST</th>
                <th className="pt-th pt-th-pts">PTS</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => {
                const isQ = i < qualifyCount;
                return (
                  <tr key={row.team} className={`pt-row ${isQ ? 'pt-row-qualify' : ''}`}>
                    <td className="pt-td pt-td-pos">
                      <span className={`pt-pos-num ${isQ ? 'pt-pos-qualified' : ''}`}>{row.position}</span>
                    </td>
                    <td className="pt-td pt-td-team">
                      <div className="pt-team-cell">
                        {isQ && <div className="pt-qualify-dot" />}
                        <TeamLogo team={row.team} size={32} />
                        <span className="pt-team-name">{row.team}</span>
                      </div>
                    </td>
                    <td className="pt-td pt-td-num">{row.played}</td>
                    <td className="pt-td pt-td-num pt-td-win">{row.won}</td>
                    <td className="pt-td pt-td-num pt-td-loss">{row.lost}</td>
                    <td className="pt-td pt-td-num">{row.noResult}</td>
                    <td className={`pt-td pt-td-num ${row.nrr >= 0 ? 'pt-nrr-pos' : 'pt-nrr-neg'}`}>
                      {row.nrr >= 0 ? '+' : ''}{row.nrr.toFixed(3)}
                    </td>
                    <td className="pt-td pt-td-for-val">
                      <span className="pt-for-runs">{row.runsFor}</span><span className="pt-for-overs">/{row.oversFor}</span>
                    </td>
                    <td className="pt-td pt-td-for-val">
                      <span className="pt-for-runs">{row.runsAgainst}</span><span className="pt-for-overs">/{row.oversAgainst}</span>
                    </td>
                    <td className="pt-td pt-td-pts"><span className="pt-pts-badge">{row.points}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="pt-legend">
            <div className="pt-legend-item">
              <div className="pt-qualify-dot" style={{ position: 'static' }} />
              <span>Qualified for playoffs</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Playoffs View ──────────────────────────── */}
      {!loading && !error && activeTab === 'playoffs' && hasPlayoffs && (
        <PlayoffsBracket playoffs={playoffs} season={season} />
      )}

      {!loading && !error && activeTab === 'playoffs' && !hasPlayoffs && (
        <div className="pt-empty">
          <Trophy size={48} strokeWidth={1.5} style={{ opacity: 0.3 }} />
          <p>Playoff data not available for IPL {season}</p>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Playoffs haven't started yet or data is unavailable for this season.</span>
        </div>
      )}

      {!loading && !error && data.length === 0 && season && activeTab === 'table' && (
        <div className="pt-empty">
          <Trophy size={48} strokeWidth={1.5} style={{ opacity: 0.3 }} />
          <p>No data available for {season} season</p>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   TEAM PILL — colored background with logo + name
   ══════════════════════════════════════════════════════ */

function TeamPill({ team, isWinner }) {
  const info = getTeamInfo(team);
  return (
    <div className={`po-pill ${isWinner ? 'po-pill-winner' : ''}`} style={{ background: info.color }}>
      <TeamLogo team={team} size={28} />
      <span className="po-pill-name">{team}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   PLAYOFFS BRACKET — IPL official style
   ══════════════════════════════════════════════════════ */

function PlayoffsBracket({ playoffs, season }) {
  const q1 = playoffs['Qualifier 1'];
  const el = playoffs['Eliminator'];
  const q2 = playoffs['Qualifier 2'];
  const final_ = playoffs['Final'];
  const champion = final_?.winner;

  return (
    <div className="po-section">
      {/* ── Desktop bracket ────────────────────────── */}
      <div className="po-bracket">
        {/* ── Column 1: Q1 + Eliminator teams ────── */}
        <div className="po-stage-col">
          {/* Q1 */}
          <div className="po-match-group">
            {q1 && <TeamPill team={q1.team1} isWinner={q1.winner === q1.team1} />}
            <div className="po-match-info">
              <strong>Qualifier 1{q1 ? `, ${formatDate(q1.date)}` : ''}</strong>
              {q1?.venue && <span>{q1.venue}</span>}
            </div>
            {q1 && <TeamPill team={q1.team2} isWinner={q1.winner === q1.team2} />}
          </div>

          {/* Eliminator */}
          <div className="po-match-group">
            {el && <TeamPill team={el.team1} isWinner={el.winner === el.team1} />}
            <div className="po-match-info">
              <strong>Eliminator{el ? `, ${formatDate(el.date)}` : ''}</strong>
              {el?.venue && <span>{el.venue}</span>}
            </div>
            {el && <TeamPill team={el.team2} isWinner={el.winner === el.team2} />}
          </div>
        </div>

        {/* ── SVG Connectors: Stage 1 → Q2 ─────── */}
        <div className="po-svg-col">
          <svg viewBox="0 0 100 500" className="po-svg" preserveAspectRatio="none" fill="none">
            {/* Q1 winner → goes right to Final (top path) */}
            <path d="M 0 100 Q 50 100, 50 150 L 50 150 Q 50 150, 100 150" stroke="#c47c3f" strokeWidth="2.5" />
            {/* Q1 loser → goes to Q2 top */}
            <path d="M 0 100 Q 30 100, 30 200 L 30 250 Q 30 250, 100 250" stroke="#c47c3f" strokeWidth="2.5" strokeDasharray="6 4" />
            {/* Eliminator winner → goes to Q2 bottom */}
            <path d="M 0 400 Q 30 400, 30 320 L 30 250 Q 30 250, 100 250" stroke="#c47c3f" strokeWidth="2.5" />
            {/* Dots at junctions */}
            <circle cx="0" cy="100" r="4" fill="#c47c3f" />
            <circle cx="0" cy="400" r="4" fill="#c47c3f" />
            <circle cx="100" cy="150" r="4" fill="#c47c3f" />
            <circle cx="100" cy="250" r="4" fill="#c47c3f" />
          </svg>
        </div>

        {/* ── Column 2: Q2 ─────────────────────── */}
        <div className="po-stage-col po-stage-mid">
          <div className="po-match-group po-match-q2">
            {q2 && <TeamPill team={q2.team1} isWinner={q2.winner === q2.team1} />}
            <div className="po-match-info">
              <strong>Qualifier 2{q2 ? `, ${formatDate(q2.date)}` : ''}</strong>
              {q2?.venue && <span>{q2.venue}</span>}
            </div>
            {q2 && <TeamPill team={q2.team2} isWinner={q2.winner === q2.team2} />}
          </div>
        </div>

        {/* ── SVG Connectors: Q1 winner + Q2 winner → Final */}
        <div className="po-svg-col">
          <svg viewBox="0 0 100 500" className="po-svg" preserveAspectRatio="none" fill="none">
            {/* Q1 winner (from top) → Final */}
            <path d="M 0 150 Q 50 150, 50 200 L 50 200 Q 50 200, 100 200" stroke="#c47c3f" strokeWidth="2.5" />
            {/* Q2 winner → Final */}
            <path d="M 0 250 Q 50 250, 50 200 L 50 200 Q 50 200, 100 200" stroke="#c47c3f" strokeWidth="2.5" />
            <circle cx="0" cy="150" r="4" fill="#c47c3f" />
            <circle cx="0" cy="250" r="4" fill="#c47c3f" />
            <circle cx="100" cy="200" r="4" fill="#c47c3f" />
          </svg>
        </div>

        {/* ── Column 3: Final ──────────────────── */}
        <div className="po-stage-col po-stage-final">
          <div className="po-match-group po-match-final">
            {final_ && <TeamPill team={final_.team1} isWinner={final_.winner === final_.team1} />}
            <div className="po-match-info po-match-info-final">
              <strong>Final{final_ ? `, ${formatDate(final_.date)}` : ''}</strong>
              {final_?.venue && <span>{final_.venue}</span>}
            </div>
            {final_ && <TeamPill team={final_.team2} isWinner={final_.winner === final_.team2} />}
          </div>
        </div>
      </div>

      {/* ── Champion banner ────────────────────────── */}
      {champion && (
        <div className="po-champion-banner">
          <div className="po-champion-trophy">🏆</div>
          <TeamLogo team={champion} size={52} />
          <div className="po-champion-text">
            <span className="po-champion-label">IPL {season} Champion</span>
            <span className="po-champion-name">{champion}</span>
          </div>
          <div className="po-champion-trophy">🏆</div>
        </div>
      )}

      {/* ── Mobile list view ───────────────────────── */}
      <div className="po-mobile-list">
        {q1 && <MobileMatchCard label="Qualifier 1" match={q1} />}
        {el && <MobileMatchCard label="Eliminator" match={el} />}
        {q2 && <MobileMatchCard label="Qualifier 2" match={q2} />}
        {final_ && <MobileMatchCard label="Final" match={final_} isFinal />}
        {champion && (
          <div className="po-champion-banner po-champion-banner-mobile">
            <div className="po-champion-trophy">🏆</div>
            <TeamLogo team={champion} size={44} />
            <div className="po-champion-text">
              <span className="po-champion-label">IPL {season} Champion</span>
              <span className="po-champion-name">{champion}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Mobile match card ─────────────────────────────── */

function MobileMatchCard({ label, match, isFinal = false }) {
  if (!match) return null;
  const { team1, team2, winner, result, result_margin } = match;

  let resultText = '';
  if (winner && result && result_margin) {
    resultText = `${winner} won by ${result_margin} ${result}`;
  } else if (winner) {
    resultText = `${winner} won`;
  }

  return (
    <div className={`po-mob-card ${isFinal ? 'po-mob-final' : ''}`}>
      <div className="po-mob-label">{isFinal ? '🏆 ' : ''}{label}</div>
      <div className="po-mob-date">{formatDate(match.date)}{match.venue ? ` • ${match.venue}` : ''}</div>
      <div className="po-mob-teams">
        <div className={`po-mob-team ${winner === team1 ? 'po-mob-winner' : ''}`}>
          <TeamLogo team={team1} size={24} />
          <span>{team1}</span>
          {winner === team1 && <Trophy size={12} style={{ color: '#fbbf24', marginLeft: 'auto' }} />}
        </div>
        <div className="po-mob-vs">VS</div>
        <div className={`po-mob-team ${winner === team2 ? 'po-mob-winner' : ''}`}>
          <TeamLogo team={team2} size={24} />
          <span>{team2}</span>
          {winner === team2 && <Trophy size={12} style={{ color: '#fbbf24', marginLeft: 'auto' }} />}
        </div>
      </div>
      {resultText && <div className="po-mob-result">{resultText}</div>}
    </div>
  );
}
