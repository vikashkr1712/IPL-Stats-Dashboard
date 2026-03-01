import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronRight, ArrowLeft, MapPin, Trophy,
  User, Zap, MessageCircle, ChevronDown, ChevronUp,
  Filter, ChevronsLeft, ChevronsRight
} from 'lucide-react';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import ErrorMessage from '../ui/ErrorMessage';
import TeamLogo from '../ui/TeamLogo';
import { fetchRecentMatches, fetchScorecard, fetchCommentary, fetchAllTeams, fetchSeasons } from '../../services/api';

function MatchCard({ match, onClick, navigate }) {
  const date = new Date(match.date);
  const formatted = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const matchType = match.match_type && match.match_type !== 'League' && match.match_type !== 'T20'
    ? match.match_type : null;

  return (
    <button onClick={() => onClick(match.id)} className="mc-card group w-full text-left">
      {/* Navy header */}
      <div className="mc-header">
        <div className="mc-header-left">
          <span className="mc-season">IPL {match.season?.split('/')[0]}</span>
          {matchType && <span className="mc-badge">{matchType}</span>}
        </div>
        <span className="mc-date">{formatted}</span>
      </div>

      {/* Teams */}
      <div className="mc-body">
        {[match.team1, match.team2].map((team) => {
          const isWinner = match.winner === team;
          return (
            <div key={team} className={`mc-team-row ${isWinner ? 'mc-team-winner' : ''}`}>
              <div className="mc-team-info">
                <TeamLogo team={team} size={32} />
                <span
                  className="mc-team-name"
                  onClick={(e) => { e.stopPropagation(); navigate(`/teams?team=${encodeURIComponent(team)}`); }}
                >
                  {team}
                </span>
              </div>
              {isWinner && (
                <div className="mc-trophy">
                  <Trophy size={16} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Result footer */}
      <div className="mc-footer">
        <div className="mc-result">
          {match.winner ? (
            <p className="mc-result-text">
              {match.winner} won{match.result_margin > 0 ? ` by ${match.result_margin} ${match.result}` : ''}
            </p>
          ) : (
            <p className="mc-result-nr">No Result</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {match.hasScorecard === false && (
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>
              Summary Only
            </span>
          )}
          <ChevronRight size={16} className="mc-chevron" />
        </div>
      </div>
    </button>
  );
}

function BattingTable({ batsmen, extras, totalRuns, totalWickets, overs, navigate }) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ textAlign: 'left', width: '40%' }}>Batter</th>
            <th>R</th>
            <th>B</th>
            <th>4s</th>
            <th>6s</th>
            <th>SR</th>
          </tr>
        </thead>
        <tbody>
          {batsmen.map((b, i) => {
            const sr = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0';
            const isHalf = b.runs >= 50 && b.runs < 100;
            const isCentury = b.runs >= 100;
            return (
              <tr key={i}>
                <td style={{ textAlign: 'left' }}>
                  <span
                    className="player-link"
                    style={{ fontSize: 14, fontWeight: 600, color: isCentury ? '#f59e0b' : isHalf ? '#d97706' : '#555' }}
                    onClick={() => navigate(`/players?name=${encodeURIComponent(b.name)}`)}
                  >
                    {b.name}
                  </span>
                  {b.dismissal ? (
                    <p style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{b.dismissal}</p>
                  ) : (
                    <p style={{ fontSize: 11, color: '#1B2A72', fontWeight: 500, marginTop: 2 }}>not out</p>
                  )}
                </td>
                <td style={{ fontWeight: 700, color: isCentury || isHalf ? '#f59e0b' : '#333' }}>{b.runs}</td>
                <td>{b.balls}</td>
                <td>{b.fours}</td>
                <td>{b.sixes}</td>
                <td style={{ color: parseFloat(sr) > 150 ? '#1B2A72' : parseFloat(sr) < 80 ? '#d92f2b' : '' }}>{sr}</td>
              </tr>
            );
          })}
          <tr className="data-table-extras">
            <td colSpan={6} style={{ textAlign: 'left' }}>
              <span style={{ color: '#999', fontSize: 13 }}>Extras</span>
              <span style={{ color: '#555', fontWeight: 600, marginLeft: 12, fontSize: 14 }}>{extras}</span>
            </td>
          </tr>
          <tr className="data-table-total">
            <td style={{ textAlign: 'left' }}>
              <span style={{ color: '#333', fontWeight: 700, fontSize: 15 }}>Total</span>
            </td>
            <td colSpan={5} style={{ textAlign: 'left' }}>
              <span style={{ color: '#333', fontWeight: 700, fontSize: 15 }}>{totalRuns}/{totalWickets}</span>
              <span style={{ color: '#999', fontSize: 13, marginLeft: 8 }}>({overs} Ov)</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function BowlingTable({ bowlers, navigate }) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ textAlign: 'left', width: '40%' }}>Bowler</th>
            <th>O</th>
            <th>R</th>
            <th>W</th>
            <th>Econ</th>
          </tr>
        </thead>
        <tbody>
          {bowlers.map((b, i) => {
            const isGreat = b.wickets >= 3;
            return (
              <tr key={i}>
                <td style={{ textAlign: 'left' }}>
                  <span
                    className="player-link"
                    style={{ fontSize: 14, fontWeight: 600, color: isGreat ? '#6366f1' : '#555' }}
                    onClick={() => navigate(`/players?name=${encodeURIComponent(b.name)}`)}
                  >
                    {b.name}
                  </span>
                </td>
                <td>{b.overs}</td>
                <td>{b.runs}</td>
                <td style={{ fontWeight: 700, color: isGreat ? '#6366f1' : '#333' }}>{b.wickets}</td>
                <td style={{ color: b.economy < 6 ? '#1B2A72' : b.economy > 10 ? '#d92f2b' : '' }}>{b.economy}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OverBlock({ over }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="over-block">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2.5"
        style={{ cursor: 'pointer', background: 'none', border: 'none' }}
      >
        <div className="flex items-center gap-3">
          <div className="over-badge">{over.over + 1}</div>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#555' }}>Over {over.over + 1}</p>
            <p style={{ fontSize: 12, color: '#aaa' }}>
              {over.runs} run{over.runs !== 1 ? 's' : ''}
              {over.wickets > 0 && <span style={{ color: '#d92f2b', fontWeight: 500 }}> � {over.wickets} wkt{over.wickets > 1 ? 's' : ''}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1">
            {over.balls.slice(0, 6).map((b, i) => (
              <div
                key={i}
                className={`ball-dot ${b.isWicket ? 'ball-wicket' : b.isSix ? 'ball-six' : b.isFour ? 'ball-four' : b.runs === 0 ? 'ball-dot-run' : 'ball-normal'}`}
              >
                {b.isWicket ? 'W' : b.runs}
              </div>
            ))}
          </div>
          {expanded ? <ChevronUp size={16} style={{ color: '#aaa' }} /> : <ChevronDown size={16} style={{ color: '#aaa' }} />}
        </div>
      </button>
      <div className={`over-detail ${expanded ? 'over-detail-open' : ''}`}>
        {expanded && (
          <div style={{ borderTop: '1px solid #eee', padding: '0 14px' }}>
            {over.balls.map((b, i) => (
              <div
                key={i}
                style={{
                  padding: '10px 0',
                  borderBottom: '1px solid #f5f5f5',
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: b.isWicket ? '#d92f2b' : b.isSix ? '#1B2A72' : b.isFour ? '#3366cc' : '#777'
                }}
              >
                {b.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Scorecard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState('list');
  const [matches, setMatches] = useState([]);
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [teamFilter, setTeamFilter] = useState('');
  const [seasonFilter, setSeasonFilter] = useState('');
  const [teams, setTeams] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [scorecard, setScorecard] = useState(null);
  const [scorecardLoading, setScorecardLoading] = useState(false);
  const [showCommentary, setShowCommentary] = useState(false);
  const [commentary, setCommentary] = useState(null);
  const [commentaryInning, setCommentaryInning] = useState(1);
  const [commentaryLoading, setCommentaryLoading] = useState(false);
  const [activeInning, setActiveInning] = useState(1);
  const [activeTab, setActiveTab] = useState('scorecard');

  useEffect(() => {
    fetchAllTeams().then(res => setTeams(res.data)).catch(() => {});
    fetchSeasons().then(res => setSeasons(res.data)).catch(() => {});
  }, []);

  // Auto-open scorecard if ?match= query param is present (from MatchFilter navigation)
  useEffect(() => {
    const matchId = searchParams.get('match');
    if (matchId) {
      openScorecard(Number(matchId));
      // Clear the query param to avoid re-opening on back navigation
      setSearchParams({}, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchRecentMatches(page, 9, seasonFilter, teamFilter);
      setMatches(res.data);
      setPagination(res.pagination);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [page, teamFilter, seasonFilter]);

  useEffect(() => { loadMatches(); }, [loadMatches]);

  const openScorecard = async (matchId) => {
    setSelectedMatchId(matchId);
    setScorecardLoading(true);
    setView('scorecard');
    setShowCommentary(false);
    setActiveInning(1);
    setActiveTab('scorecard');
    try {
      const res = await fetchScorecard(matchId);
      setScorecard(res.data);
    } catch (err) { setError(err.message); }
    finally { setScorecardLoading(false); }
  };

  const loadCommentary = async (inning) => {
    setCommentaryInning(inning);
    setCommentaryLoading(true);
    setShowCommentary(true);
    try {
      const res = await fetchCommentary(selectedMatchId, inning);
      setCommentary(res.data);
    } catch (err) { setError(err.message); }
    finally { setCommentaryLoading(false); }
  };

  const goBack = () => {
    setView('list');
    setScorecard(null);
    setCommentary(null);
    setShowCommentary(false);
  };

  if (view === 'list') {
    return (
      <div>
        {/* Page header — matches Points Table style */}
        <div className="mc-page-header">
          <div>
            <h2 className="mc-page-title">Match Results</h2>
            <p className="mc-page-sub">Indian Premier League — {pagination.total || 0} matches</p>
          </div>
        </div>

        {/* Filter bar */}
        <div className="mc-filter-bar">
          <Filter size={16} style={{ color: '#999' }} />
          <select
            value={seasonFilter}
            onChange={(e) => { setSeasonFilter(e.target.value); setPage(1); }}
            className="form-select"
          >
            <option value="">All Seasons</option>
            {seasons.map(s => (
              <option key={s} value={s}>{s.includes('/') ? s.split('/')[0] : s}</option>
            ))}
          </select>
          <select
            value={teamFilter}
            onChange={(e) => { setTeamFilter(e.target.value); setPage(1); }}
            className="form-select"
          >
            <option value="">All Teams</option>
            {teams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {loading ? (
          <LoadingSkeleton count={9} type="card" />
        ) : error ? (
          <ErrorMessage message={error} onRetry={loadMatches} />
        ) : (
          <>
            <div className="mc-grid">
              {matches.map(m => (
                <MatchCard key={m.id} match={m} onClick={openScorecard} navigate={navigate} />
              ))}
            </div>

            {pagination.pages > 1 && (
              <div className="pagination">
                <button onClick={() => setPage(1)} disabled={page === 1} className="page-btn" title="First">
                  <ChevronsLeft size={16} />
                </button>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="page-btn">
                  Prev
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                    let pageNum;
                    if (pagination.pages <= 5) pageNum = i + 1;
                    else if (page <= 3) pageNum = i + 1;
                    else if (page >= pagination.pages - 2) pageNum = pagination.pages - 4 + i;
                    else pageNum = page - 2 + i;
                    return (
                      <button key={pageNum} onClick={() => setPage(pageNum)} className={`page-num ${page === pageNum ? 'page-num-active' : ''}`}>
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages} className="page-btn">
                  Next
                </button>
                <button onClick={() => setPage(pagination.pages)} disabled={page === pagination.pages} className="page-btn" title="Last">
                  <ChevronsRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  const match = scorecard?.match;
  const innings = scorecard?.innings || [];

  return (
    <div>
      <button onClick={goBack} className="back-btn mb-4">
        <ArrowLeft size={18} />
        <span>Back to matches</span>
      </button>

      {scorecardLoading ? (
        <div className="space-y-4">
          <LoadingSkeleton type="chart" />
          <LoadingSkeleton type="chart" />
        </div>
      ) : error ? (
        <ErrorMessage message={error} onRetry={() => openScorecard(selectedMatchId)} />
      ) : match ? (
        <div className="space-y-0">
          {/* Match Header */}
          <div className="match-header">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3" style={{ fontSize: 12, color: '#999' }}>
              <span style={{ color: '#f59e0b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                IPL {match.season?.split('/')[0]}
              </span>
              {match.match_type && match.match_type !== 'T20' && match.match_type !== 'League' && (
                <span style={{ background: '#1B2A72', color: '#fff', padding: '2px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                  {match.match_type}
                </span>
              )}
              <span>{new Date(match.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</span>
              <span className="flex items-center gap-1"><MapPin size={12} /> {match.venue}{match.city ? `, ${match.city}` : ''}</span>
            </div>

            <div className="space-y-2">
              {innings.length > 0 ? innings.map((inn) => (
                <div key={inn.inning} className="score-strip">
                  <div className="flex items-center gap-2">
                    <TeamLogo team={inn.battingTeam} size={28} />
                    <span
                      className="team-link"
                      style={{ fontSize: 15, fontWeight: 700, color: match.winner === inn.battingTeam ? '#333' : '#888' }}
                      onClick={() => navigate(`/teams?team=${encodeURIComponent(inn.battingTeam)}`)}
                    >
                      {inn.battingTeam}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span style={{ fontSize: 22, fontWeight: 700, color: '#333' }}>{inn.totalRuns}</span>
                    <span style={{ fontSize: 15, color: '#999' }}>/{inn.totalWickets}</span>
                    <span style={{ fontSize: 13, color: '#999', marginLeft: 6 }}>({inn.overs} Ov)</span>
                  </div>
                </div>
              )) : (
                /* Show both teams from match data when no innings exist */
                [match.team1, match.team2].map((team) => (
                  <div key={team} className="score-strip">
                    <div className="flex items-center gap-2">
                      <TeamLogo team={team} size={28} />
                      <span
                        className="team-link"
                        style={{ fontSize: 15, fontWeight: 700, color: match.winner === team ? '#333' : '#888' }}
                        onClick={() => navigate(`/teams?team=${encodeURIComponent(team)}`)}
                      >
                        {team}
                      </span>
                      {match.winner === team && <Trophy size={14} style={{ color: '#f59e0b' }} />}
                    </div>
                  </div>
                ))
              )}
            </div>

            {match.winner && (
              <div className="result-badge mt-3">
                <Trophy size={14} style={{ color: '#1B2A72' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1B2A72' }}>
                  <span className="team-link" onClick={() => navigate(`/teams?team=${encodeURIComponent(match.winner)}`)}>{match.winner}</span>{match.result_margin > 0 ? ` won by ${match.result_margin} ${match.result}` : ' won'}
                </span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3 pt-3" style={{ borderTop: '1px solid #eee' }}>
              {match.player_of_match && (
                <div className="flex items-center gap-1.5" style={{ fontSize: 13 }}>
                  <User size={14} style={{ color: '#f59e0b' }} />
                  <span style={{ color: '#999' }}>MoM:</span>
                  <span className="player-link" style={{ color: '#f59e0b', fontWeight: 600 }} onClick={() => navigate(`/players?name=${encodeURIComponent(match.player_of_match)}`)}>{match.player_of_match}</span>
                </div>
              )}
              {match.toss_winner && (
                <div className="flex items-center gap-1.5" style={{ fontSize: 13 }}>
                  <Zap size={14} style={{ color: '#6366f1' }} />
                  <span style={{ color: '#999' }}>Toss:</span>
                  <span style={{ color: '#6366f1', fontWeight: 600 }}>
                    <span className="team-link" onClick={() => navigate(`/teams?team=${encodeURIComponent(match.toss_winner)}`)}>{match.toss_winner}</span> ({match.toss_decision})
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Tabs — only show if innings data exists */}
          {innings.length > 0 ? (
            <div className="tab-bar" style={{ marginTop: 12 }}>
              <button onClick={() => setActiveTab('scorecard')} className={`tab-item ${activeTab === 'scorecard' ? 'tab-item-active' : ''}`}>
                Scorecard
              </button>
              <button onClick={() => { setActiveTab('commentary'); if (!showCommentary) loadCommentary(1); }} className={`tab-item ${activeTab === 'commentary' ? 'tab-item-active' : ''}`}>
                Commentary
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
              <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.15 }}>🏏</div>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#666', marginBottom: 6 }}>Scorecard Not Available</p>
              <p style={{ fontSize: 13, color: '#aaa' }}>Ball-by-ball data is not available for this {match.match_type || 'match'}. This is typically the case for playoff/final matches added as summary records.</p>
              <button onClick={goBack} className="back-btn" style={{ margin: '20px auto 0', display: 'inline-flex' }}>
                <ArrowLeft size={16} />
                <span>Browse other matches</span>
              </button>
            </div>
          )}

          {/* Scorecard Tab */}
          {activeTab === 'scorecard' && innings.length > 0 && (
            <div className="tab-content">
              <div className="inning-tabs">
                {innings.map(inn => (
                  <button
                    key={inn.inning}
                    onClick={() => setActiveInning(inn.inning)}
                    className={`inning-tab ${activeInning === inn.inning ? 'inning-tab-active' : ''}`}
                  >
                    {inn.battingTeam}
                    <span style={{ marginLeft: 8, opacity: 0.7 }}>{inn.totalRuns}/{inn.totalWickets}</span>
                  </button>
                ))}
              </div>

              {innings.filter(inn => inn.inning === activeInning).map(inn => (
                <div key={inn.inning} className="space-y-5 py-4">
                  <div>
                    <div className="section-label">
                      <div className="section-dot" style={{ background: '#f59e0b' }} />
                      Batting
                    </div>
                    <BattingTable batsmen={inn.batsmen} extras={inn.totalExtras} totalRuns={inn.totalRuns} totalWickets={inn.totalWickets} overs={inn.overs} navigate={navigate} />
                  </div>
                  <div>
                    <div className="section-label">
                      <div className="section-dot" style={{ background: '#6366f1' }} />
                      Bowling
                    </div>
                    <BowlingTable bowlers={inn.bowlers} navigate={navigate} />
                  </div>
                  {inn.fallOfWickets?.length > 0 && (
                    <div>
                      <div className="section-label">
                        <div className="section-dot" style={{ background: '#d92f2b' }} />
                        Fall of Wickets
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {inn.fallOfWickets.map((fow, i) => (
                          <div key={i} className="fow-chip">
                            <span style={{ color: '#d92f2b', fontWeight: 700 }}>{fow.runs}/{fow.wickets}</span>
                            <span style={{ color: '#999', marginLeft: 4 }}>(<span className="player-link" onClick={() => navigate(`/players?name=${encodeURIComponent(fow.player)}`)}>{fow.player}</span>, {fow.over} ov)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Commentary Tab */}
          {activeTab === 'commentary' && innings.length > 0 && (
            <div className="tab-content">
              <div className="inning-tabs">
                {innings.map(inn => (
                  <button
                    key={inn.inning}
                    onClick={() => loadCommentary(inn.inning)}
                    className={`inning-tab ${showCommentary && commentaryInning === inn.inning ? 'inning-tab-active' : ''}`}
                  >
                    {inn.battingTeam} Innings
                  </button>
                ))}
              </div>
              <div style={{ padding: '16px 0' }}>
                {commentaryLoading ? (
                  <LoadingSkeleton count={4} type="card" />
                ) : showCommentary && commentary ? (
                  <div className="space-y-2" style={{ maxHeight: 600, overflowY: 'auto', paddingRight: 4 }}>
                    {commentary.commentary.map((ov, i) => (
                      <OverBlock key={i} over={ov} />
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '48px 0', color: '#aaa' }}>
                    <MessageCircle size={32} style={{ margin: '0 auto 10px', opacity: 0.2 }} />
                    <p style={{ fontSize: 14 }}>Select an innings to view commentary</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
