import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Swords } from 'lucide-react';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import ErrorMessage from '../ui/ErrorMessage';
import TeamLogo from '../ui/TeamLogo';
import { fetchAllTeams, fetchHeadToHead } from '../../services/api';
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

export default function HeadToHead() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [team1, setTeam1] = useState('');
  const [team2, setTeam2] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAllTeams()
      .then((res) => {
        setTeams(res.data);
        if (res.data.length >= 2) {
          setTeam1(res.data.find(t => t.includes('Mumbai')) || res.data[0]);
          setTeam2(res.data.find(t => t.includes('Chennai')) || res.data[1]);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setTeamsLoading(false));
  }, []);

  const compare = async () => {
    if (!team1 || !team2 || team1 === team2) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchHeadToHead(team1, team2);
      setData(res.data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (team1 && team2 && team1 !== team2) compare();
  }, [team1, team2]);

  const comparisonData = data ? [
    { stat: 'Wins', [data.team1]: data.team1Wins, [data.team2]: data.team2Wins },
    { stat: 'High Score', [data.team1]: data.team1HighScore, [data.team2]: data.team2HighScore },
  ] : [];

  if (teamsLoading) return <LoadingSkeleton count={4} type="card" />;

  return (
    <div className="space-y-4">
      {/* Team Selectors */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Select Teams</h3>
        </div>
        <div className="card-body">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 w-full">
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Team 1</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {team1 && <TeamLogo team={team1} size={36} />}
                <select value={team1} onChange={(e) => setTeam1(e.target.value)} className="form-select w-full">
                  <option value="">Select Team</option>
                  {teams.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-center w-10 h-10 rounded-lg mt-2 sm:mt-5 flex-shrink-0" style={{ background: 'rgba(27,42,114,0.08)', border: '1px solid rgba(27,42,114,0.15)' }}>
              <Swords size={16} style={{ color: '#1B2A72' }} />
            </div>

            <div className="flex-1 w-full">
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Team 2</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {team2 && <TeamLogo team={team2} size={36} />}
                <select value={team2} onChange={(e) => setTeam2(e.target.value)} className="form-select w-full">
                  <option value="">Select Team</option>
                  {teams.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <LoadingSkeleton count={4} type="card" />
          <LoadingSkeleton type="chart" />
        </div>
      ) : error ? (
        <ErrorMessage message={error} onRetry={compare} />
      ) : data ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="stat-card text-center">
              <p className="stat-label" style={{ marginBottom: 6 }}>Total Matches</p>
              <p style={{ fontSize: 26, fontWeight: 700, color: '#f59e0b' }}>{data.totalMatches}</p>
            </div>
            <div className="stat-card text-center">
              <p className="stat-label" style={{ marginBottom: 6 }}>{data.team1} Wins</p>
              <p style={{ fontSize: 26, fontWeight: 700, color: '#1B2A72' }}>{data.team1Wins}</p>
            </div>
            <div className="stat-card text-center">
              <p className="stat-label" style={{ marginBottom: 6 }}>{data.team2} Wins</p>
              <p style={{ fontSize: 26, fontWeight: 700, color: '#6366f1' }}>{data.team2Wins}</p>
            </div>
            <div className="stat-card text-center">
              <p className="stat-label" style={{ marginBottom: 6 }}>No Result</p>
              <p style={{ fontSize: 26, fontWeight: 700, color: '#999' }}>{data.noResult}</p>
            </div>
          </div>

          {/* Win Distribution */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Win Distribution</h3>
            </div>
            <div className="card-body">
              <div className="space-y-3 mb-5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#1B2A72' }}>{data.team1}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1B2A72' }}>{data.team1Wins}</span>
                  </div>
                  <div className="progress" style={{ height: 8 }}>
                    <div className="progress-fill" style={{ width: `${data.totalMatches ? (data.team1Wins / data.totalMatches) * 100 : 0}%`, background: '#1B2A72' }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#6366f1' }}>{data.team2}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#6366f1' }}>{data.team2Wins}</span>
                  </div>
                  <div className="progress" style={{ height: 8 }}>
                    <div className="progress-fill" style={{ width: `${data.totalMatches ? (data.team2Wins / data.totalMatches) * 100 : 0}%`, background: '#6366f1' }} />
                  </div>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="stat" stroke="#999" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#999" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(27,42,114,0.06)' }} />
                  <Legend formatter={(v) => <span style={{ fontSize: 12, color: '#888' }}>{v}</span>} iconType="circle" iconSize={8} />
                  <Bar dataKey={data.team1} fill="#1B2A72" radius={[3, 3, 0, 0]} barSize={24} fillOpacity={0.85} />
                  <Bar dataKey={data.team2} fill="#6366f1" radius={[3, 3, 0, 0]} barSize={24} fillOpacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* High Scores */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="stat-card">
              <p className="stat-label" style={{ marginBottom: 6 }}>{data.team1} Highest</p>
              <p style={{ fontSize: 32, fontWeight: 700, color: '#1B2A72' }}>{data.team1HighScore}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label" style={{ marginBottom: 6 }}>{data.team2} Highest</p>
              <p style={{ fontSize: 32, fontWeight: 700, color: '#6366f1' }}>{data.team2HighScore}</p>
            </div>
          </div>

          {/* Recent Matches */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Recent Matches</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Venue</th>
                    <th>Winner</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentMatches.map((match, i) => (
                    <tr key={i}>
                      <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                        {new Date(match.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{match.venue}</td>
                      <td>
                        <span
                          className={match.winner ? 'team-link' : ''}
                          style={{ fontWeight: 500, color: match.winner === data.team1 ? '#1B2A72' : match.winner === data.team2 ? '#6366f1' : '#999' }}
                          onClick={() => match.winner && navigate(`/teams?team=${encodeURIComponent(match.winner)}`)}
                        >
                          {match.winner || 'No Result'}
                        </span>
                      </td>
                      <td>{match.result_margin ? `${match.result_margin} ${match.result}` : '\u2014'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#aaa' }}>
          <Swords size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <p style={{ fontSize: 14 }}>Select two teams to compare</p>
        </div>
      )}
    </div>
  );
}
