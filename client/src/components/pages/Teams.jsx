import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, AreaChart, Area
} from 'recharts';
import { Search, ArrowLeft } from 'lucide-react';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import ErrorMessage from '../ui/ErrorMessage';
import TeamLogo from '../ui/TeamLogo';
import { fetchAllTeams, fetchTeamStats, fetchTeamSeasonWise } from '../../services/api';
import { getTeamInfo } from '../../utils/teamLogos';

const TEAM_COLORS = {
  'Mumbai Indians': '#004BA0',
  'Chennai Super Kings': '#f9a825',
  'Royal Challengers Bangalore': '#d32f2f',
  'Royal Challengers Bengaluru': '#d32f2f',
  'Kolkata Knight Riders': '#7b1fa2',
  'Rajasthan Royals': '#e91e97',
  'Delhi Capitals': '#1976d2',
  'Delhi Daredevils': '#1976d2',
  'Sunrisers Hyderabad': '#ff6f00',
  'Kings XI Punjab': '#e53935',
  'Punjab Kings': '#e53935',
  'Gujarat Titans': '#1a237e',
  'Lucknow Super Giants': '#00838f',
};

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

export default function Teams() {
  const [searchParams] = useSearchParams();
  const teamFromUrl = searchParams.get('team');
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [teamStats, setTeamStats] = useState(null);
  const [seasonWise, setSeasonWise] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchAllTeams()
      .then((res) => {
        setTeams(res.data);
        if (teamFromUrl && res.data.includes(teamFromUrl)) {
          setSelectedTeam(teamFromUrl);
        } else if (res.data.length > 0) {
          setSelectedTeam(res.data[0]);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [teamFromUrl]);

  useEffect(() => {
    if (!selectedTeam) return;
    setStatsLoading(true);
    Promise.all([fetchTeamStats(selectedTeam), fetchTeamSeasonWise(selectedTeam)])
      .then(([statsRes, seasonRes]) => {
        setTeamStats(statsRes.data);
        setSeasonWise(seasonRes.data.seasons);
      })
      .catch((err) => setError(err.message))
      .finally(() => setStatsLoading(false));
  }, [selectedTeam]);

  const filteredTeams = teams.filter(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
  const teamColor = TEAM_COLORS[selectedTeam] || '#1B2A72';

  if (loading) return <LoadingSkeleton count={6} type="card" />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="space-y-4">
      {teamFromUrl && (
        <button onClick={() => navigate(-1)} className="back-btn mb-1">
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
      )}

      {/* Team Selection */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Select Team</h3>
        </div>
        <div className="card-body">
          <div className="search-box mb-3" style={{ maxWidth: 320 }}>
            <Search size={15} style={{ color: '#aaa', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search teams..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
            {filteredTeams.map((team) => (
              <button
                key={team}
                onClick={() => setSelectedTeam(team)}
                className={`team-chip ${selectedTeam === team ? 'team-chip-active' : ''}`}
                style={{ justifyContent: 'center', textAlign: 'center', width: '100%' }}
              >
                {team}
              </button>
            ))}
          </div>
          {selectedTeam && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 18, padding: '14px 0' }}>
              <TeamLogo team={selectedTeam} size={52} />
              <p style={{ fontSize: 20, fontWeight: 700, color: getTeamInfo(selectedTeam).color, margin: 0 }}>
                {selectedTeam}
              </p>
            </div>
          )}
        </div>
      </div>

      {statsLoading ? (
        <div className="space-y-4">
          <LoadingSkeleton count={6} type="card" />
          <LoadingSkeleton type="chart" />
        </div>
      ) : teamStats ? (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Matches', value: teamStats.totalMatches, color: '#f59e0b' },
              { label: 'Wins', value: teamStats.wins, color: '#1B2A72' },
              { label: 'Losses', value: teamStats.losses, color: '#ef4444' },
              { label: 'Win Rate', value: `${teamStats.winPercentage}%`, color: '#6366f1' },
              { label: 'Home Win %', value: `${teamStats.homeWinPercentage}%`, color: '#a855f7' },
              { label: 'Away Win %', value: `${teamStats.awayWinPercentage}%`, color: '#06b6d4' },
            ].map((s, i) => (
              <div key={i} className="stat-card">
                <p className="stat-label" style={{ marginBottom: 6 }}>{s.label}</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Toss & Season Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="stat-card">
              <p className="stat-label">Toss Win Rate</p>
              <p style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b', marginTop: 4 }}>{teamStats.tossWinPercentage}%</p>
              <div className="progress" style={{ marginTop: 8 }}>
                <div className="progress-fill" style={{ width: `${teamStats.tossWinPercentage}%`, background: '#f59e0b' }} />
              </div>
            </div>
            <div className="stat-card">
              <p className="stat-label">Seasons Active</p>
              <p style={{ fontSize: 28, fontWeight: 700, color: '#1B2A72', marginTop: 4 }}>{teamStats.seasonsPlayed}</p>
              <p style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
                {(teamStats.seasons?.[0] || '').split('/')[0]} to {(teamStats.seasons?.[teamStats.seasons.length - 1] || '').split('/')[0]}
              </p>
            </div>
          </div>

          {/* Season Performance */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Season Performance</h3>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={seasonWise}>
                  <defs>
                    <linearGradient id="winsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1B2A72" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#1B2A72" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="season" stroke="#999" fontSize={10} angle={-45} textAnchor="end" height={55} tickLine={false} axisLine={false} tickFormatter={(v) => v.includes('/') ? v.split('/')[0] : v} />
                  <YAxis stroke="#999" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend formatter={(v) => <span style={{ fontSize: 12, color: '#888' }}>{v}</span>} iconType="circle" iconSize={9} />
                  <Area type="monotone" dataKey="wins" name="Wins" stroke="#1B2A72" strokeWidth={2} fill="url(#winsGrad)" dot={{ fill: '#1B2A72', r: 3, strokeWidth: 0 }} />
                  <Line type="monotone" dataKey="losses" name="Losses" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 3, strokeWidth: 0 }} strokeDasharray="5 5" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Win % by Season */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Win % by Season</h3>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={seasonWise}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="season" stroke="#999" fontSize={10} angle={-45} textAnchor="end" height={55} tickLine={false} axisLine={false} tickFormatter={(v) => v.includes('/') ? v.split('/')[0] : v} />
                  <YAxis stroke="#999" fontSize={11} domain={[0, 100]} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(27,42,114,0.06)' }} />
                  <Bar dataKey="winPercentage" name="Win %" fill={teamColor} radius={[3, 3, 0, 0]} barSize={18} fillOpacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
