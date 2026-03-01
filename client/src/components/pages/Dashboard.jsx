import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import { Trophy, Target, Zap, MapPin, Award, TrendingUp } from 'lucide-react';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import ErrorMessage from '../ui/ErrorMessage';
import {
  fetchOverview, fetchTeamWins, fetchMatchesWonBy, fetchTossImpact,
  fetchTopBatsmen, fetchTopBowlers, fetchVenueStats
} from '../../services/api';

const COLORS = ['#1B2A72', '#f59e0b', '#6366f1', '#ef4444', '#a855f7', '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#8b5cf6'];

const TEAM_COLORS = {
  'Mumbai Indians': '#004BA0',
  'Chennai Super Kings': '#F9CD05',
  'Kolkata Knight Riders': '#3A225D',
  'Royal Challengers Bengaluru': '#D4213D',
  'Rajasthan Royals': '#EA1A85',
  'Sunrisers Hyderabad': '#FF822A',
  'Punjab Kings': '#ED1B24',
  'Delhi Capitals': '#004C93',
  'Gujarat Titans': '#1C1C2B',
  'Lucknow Super Giants': '#A72056',
  'Deccan Chargers': '#4A4A4A',
  'Rising Pune Supergiants': '#6F42C1',
  'Gujarat Lions': '#E04F16',
  'Pune Warriors': '#2F9BE3',
  'Kochi Tuskers Kerala': '#7B3F00',
};

function getTeamColor(team, fallbackIdx) {
  return TEAM_COLORS[team] || COLORS[fallbackIdx % COLORS.length];
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{label}</p>
      {payload.map((entry, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color }} />
          <span style={{ color: '#aaa' }}>{entry.name}:</span>
          <span style={{ color: '#fff', fontWeight: 600 }}>{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function Dashboard({ season }) {
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [teamWins, setTeamWins] = useState([]);
  const [wonBy, setWonBy] = useState([]);
  const [tossImpact, setTossImpact] = useState([]);
  const [topBatsmen, setTopBatsmen] = useState([]);
  const [topBowlers, setTopBowlers] = useState([]);
  const [venueStats, setVenueStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchOverview(season), fetchTeamWins(season), fetchMatchesWonBy(season),
      fetchTossImpact(), fetchTopBatsmen(season, 10), fetchTopBowlers(season, 10), fetchVenueStats(season)
    ]).then(([o, w, wb, t, bat, bowl, v]) => {
      setOverview(o.data);
      setTeamWins(w.data || []);
      setWonBy(wb.data || []);
      setTossImpact(t.data || []);
      setTopBatsmen(bat.data || []);
      setTopBowlers(bowl.data || []);
      setVenueStats(v.data || []);
    }).catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [season]);

  if (loading) return (
    <div className="space-y-4">
      <LoadingSkeleton count={6} type="card" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LoadingSkeleton type="chart" />
        <LoadingSkeleton type="chart" />
      </div>
    </div>
  );

  if (error) return <ErrorMessage message={error} onRetry={() => window.location.reload()} />;

  return (
    <div className="space-y-5">
      {/* Key Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: 'Matches', value: overview?.totalMatches || 0, icon: Trophy, color: '#1B2A72' },
          { label: 'Teams', value: overview?.totalTeams || 0, icon: Target, color: '#6366f1' },
          { label: 'Top Scorer', value: overview?.topScorer?.player || '-', sub: `${overview?.topScorer?.runs || 0} runs`, icon: Award, color: '#f59e0b', isPlayer: true },
          { label: 'Top Wickets', value: overview?.topWicketTaker?.player || '-', sub: `${overview?.topWicketTaker?.wickets || 0} wkts`, icon: Zap, color: '#a855f7', isPlayer: true },
          { label: 'Total 6s', value: overview?.totalSixes || 0, icon: TrendingUp, color: '#ef4444' },
          { label: 'Total 4s', value: overview?.totalFours || 0, icon: MapPin, color: '#06b6d4' },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="flex items-center justify-between mb-1">
              <span className="stat-label">{s.label}</span>
              {s.icon && <s.icon size={18} style={{ color: s.color, opacity: 0.6 }} />}
            </div>
            <p
              className={`stat-value ${s.isPlayer ? 'player-link' : ''}`}
              style={{ color: s.color, fontSize: s.isPlayer ? 18 : 26 }}
              onClick={() => s.isPlayer && typeof s.value === 'string' && s.value !== '-' && navigate(`/players?name=${encodeURIComponent(s.value)}`)}
            >
              {typeof s.value === 'number' ? s.value.toLocaleString() : s.value}
            </p>
            {s.sub && <p style={{ fontSize: 13, color: '#999', marginTop: 3 }}>{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Team Wins + Win Type */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card">
          <div className="card-header">
            <h3 className="card-title">Team Wins</h3>
            <p className="card-subtitle">Total victories by franchise</p>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={Math.max(360, teamWins.length * 30)}>
              <BarChart data={teamWins} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                <XAxis type="number" stroke="#999" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="team" stroke="#777" fontSize={12} width={150} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(27,42,114,0.06)' }} />
                <Bar dataKey="wins" radius={[0, 3, 3, 0]} barSize={16}>
                  {teamWins.map((entry, i) => (
                    <Cell key={i} fill={getTeamColor(entry.team, i)} fillOpacity={0.9} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Win Type</h3>
            <p className="card-subtitle">Result distribution</p>
          </div>
          <div className="card-body flex items-center justify-center">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={wonBy.filter(w => w.wonBy)} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} dataKey="count" nameKey="wonBy" strokeWidth={0}>
                  {wonBy.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend formatter={(v) => <span style={{ fontSize: 12, color: '#888' }}>{v}</span>} iconType="circle" iconSize={9} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Batsmen + Top Bowlers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Top Run Scorers</h3>
          </div>
          <div className="card-body space-y-2">
            {topBatsmen.slice(0, 8).map((player, i) => {
              const maxRuns = topBatsmen[0]?.totalRuns || 1;
              return (
                <div key={i} className="leaderboard-row">
                  <span className="rank-badge">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[14px] font-medium text-gray-700 truncate player-link" onClick={() => navigate(`/players?name=${encodeURIComponent(player.player)}`)}>{player.player}</span>
                      <span className="text-[14px] font-bold text-amber-600 ml-2">{player.totalRuns?.toLocaleString()}</span>
                    </div>
                    <div className="progress">
                      <div className="progress-fill" style={{ width: `${(player.totalRuns / maxRuns) * 100}%`, background: '#f59e0b' }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Top Wicket Takers</h3>
          </div>
          <div className="card-body space-y-2">
            {topBowlers.slice(0, 8).map((player, i) => {
              const maxW = topBowlers[0]?.wickets || 1;
              return (
                <div key={i} className="leaderboard-row">
                  <span className="rank-badge">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[14px] font-medium text-gray-700 truncate player-link" onClick={() => navigate(`/players?name=${encodeURIComponent(player.player)}`)}>{player.player}</span>
                      <span className="text-[14px] font-bold text-indigo-500 ml-2">{player.wickets}</span>
                    </div>
                    <div className="progress">
                      <div className="progress-fill" style={{ width: `${(player.wickets / maxW) * 100}%`, background: '#6366f1' }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Toss Impact */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Toss Decision Impact</h3>
          <p className="card-subtitle">Win rate after winning the toss</p>
        </div>
        <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-3">
          {tossImpact.map((item, i) => (
            <div key={i} className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>Chose to {item.decision}</p>
                  <p style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>{item.tossWinnerWon} of {item.totalMatches} won</p>
                </div>
                <p style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b' }}>{item.winPercentage}%</p>
              </div>
              <div className="progress">
                <div className="progress-fill" style={{ width: `${item.winPercentage}%`, background: '#f59e0b' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Venue Stats */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Top Venues</h3>
          <p className="card-subtitle">Wins by batting first vs bowling first at each venue</p>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={380}>
            <BarChart data={venueStats.slice(0, 12).map(v => ({ ...v, venue: v._id?.length > 30 ? v._id.substring(0, 30) + '...' : v._id }))} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
              <XAxis type="number" stroke="#999" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="venue" stroke="#777" fontSize={11} width={190} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(27,42,114,0.06)' }} />
              <Legend formatter={(v) => <span style={{ fontSize: 12, color: '#888' }}>{v}</span>} iconType="circle" iconSize={9} />
              <Bar dataKey="winsByRuns" name="Batting First" stackId="a" fill="#6366f1" barSize={14} />
              <Bar dataKey="winsByWickets" name="Bowling First" stackId="a" fill="#1B2A72" barSize={14} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
