import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Zap, Shield, Flame, ChevronDown } from 'lucide-react';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import ErrorMessage from '../ui/ErrorMessage';
import { fetchBattingImpact, fetchBowlingPressure, fetchDeathRating, fetchSeasons } from '../../services/api';

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

const MetricBadge = ({ icon: Icon, label, description, color }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: `${color}08`, borderRadius: 8, border: `1px solid ${color}20` }}>
    <Icon size={18} style={{ color, marginTop: 2, flexShrink: 0 }} />
    <div>
      <p style={{ fontSize: 13, fontWeight: 700, color }}>{label}</p>
      <p style={{ fontSize: 11, color: '#888', marginTop: 2, lineHeight: 1.4 }}>{description}</p>
    </div>
  </div>
);

export default function Analytics() {
  const [seasons, setSeasons] = useState([]);
  const [season, setSeason] = useState('');
  const [activeTab, setActiveTab] = useState('batting-impact');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deathType, setDeathType] = useState('batting');

  useEffect(() => {
    fetchSeasons().then(r => setSeasons(r.data)).catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let res;
      if (activeTab === 'batting-impact') {
        res = await fetchBattingImpact(season || undefined, 20);
      } else if (activeTab === 'bowling-pressure') {
        res = await fetchBowlingPressure(season || undefined, 20);
      } else {
        res = await fetchDeathRating(season || undefined, deathType, 20);
      }
      setData(res);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [activeTab, season, deathType]);

  useEffect(() => { loadData(); }, [loadData]);

  const tabs = [
    { id: 'batting-impact', label: 'Batting Impact', icon: Zap, color: '#f59e0b' },
    { id: 'bowling-pressure', label: 'Bowling Pressure', icon: Shield, color: '#6366f1' },
    { id: 'death-rating', label: 'Death Over Rating', icon: Flame, color: '#ef4444' }
  ];

  const activeTabInfo = tabs.find(t => t.id === activeTab);
  const barKey = activeTab === 'batting-impact' ? 'impactScore'
    : activeTab === 'bowling-pressure' ? 'pressureIndex' : 'deathRating';
  const barLabel = activeTab === 'batting-impact' ? 'Impact Score'
    : activeTab === 'bowling-pressure' ? 'Pressure Index' : 'Death Rating';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Custom Analytics Engine</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <MetricBadge icon={Zap} label="Batting Impact Score" description="Runs × SR factor + boundary weight + finish bonus + death-over pressure" color="#f59e0b" />
            <MetricBadge icon={Shield} label="Bowling Pressure Index" description="Dot% × 1.5 + wickets × 10 + economy factor + death clutch wickets" color="#6366f1" />
            <MetricBadge icon={Flame} label="Death Over Rating" description="Performance rating in overs 16-20 for both batting and bowling" color="#ef4444" />
          </div>
          <p style={{ fontSize: 11, color: '#999', textAlign: 'center' }}>These are custom-derived metrics — not raw stats. They combine multiple factors into a single analytical score.</p>
        </div>
      </div>

      {/* Tabs + Season Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 500, borderRadius: 8,
                border: activeTab === tab.id ? `2px solid ${tab.color}` : '2px solid #e5e7eb',
                background: activeTab === tab.id ? `${tab.color}10` : '#fff',
                color: activeTab === tab.id ? tab.color : '#666', cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          {activeTab === 'death-rating' && (
            <select
              value={deathType}
              onChange={e => setDeathType(e.target.value)}
              className="form-select"
              style={{ fontSize: 12, padding: '6px 10px', minWidth: 100 }}
            >
              <option value="batting">Batting</option>
              <option value="bowling">Bowling</option>
            </select>
          )}
          <select
            value={season}
            onChange={e => setSeason(e.target.value)}
            className="form-select"
            style={{ fontSize: 12, padding: '6px 10px', minWidth: 110 }}
          >
            <option value="">All Seasons</option>
            {seasons.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSkeleton count={5} type="card" />
      ) : error ? (
        <ErrorMessage message={error} onRetry={loadData} />
      ) : data?.data?.length > 0 ? (
        <>
          {/* Chart */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">{barLabel} — Top 15</h3>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={380}>
                <BarChart data={data.data.slice(0, 15)} layout="vertical" margin={{ left: 90, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis type="number" stroke="#999" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis dataKey="player" type="category" stroke="#666" fontSize={11} tickLine={false} axisLine={false} width={85} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(27,42,114,0.04)' }} />
                  <Bar dataKey={barKey} name={barLabel} fill={activeTabInfo?.color || '#1B2A72'} radius={[0, 4, 4, 0]} barSize={16} fillOpacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Leaderboard Table */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Full Leaderboard ({data.data.length} players)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th style={{ textAlign: 'left' }}>Player</th>
                    <th>{barLabel}</th>
                    {activeTab === 'batting-impact' && <><th>Innings</th><th>Avg Runs</th><th>SR</th></>}
                    {activeTab === 'bowling-pressure' && <><th>Matches</th><th>Wickets</th><th>Economy</th><th>Dot%</th></>}
                    {activeTab === 'death-rating' && deathType === 'batting' && <><th>Innings</th><th>Runs</th><th>SR</th><th>6s</th></>}
                    {activeTab === 'death-rating' && deathType === 'bowling' && <><th>Matches</th><th>Wickets</th><th>Economy</th><th>Dot%</th></>}
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((row, i) => (
                    <tr key={row.player}>
                      <td style={{ fontWeight: 600, color: i < 3 ? activeTabInfo?.color : '#999', width: 36, textAlign: 'center' }}>{i + 1}</td>
                      <td style={{ textAlign: 'left', fontWeight: 600 }}>{row.player}</td>
                      <td style={{ fontWeight: 700, color: activeTabInfo?.color }}>{row[barKey]}</td>
                      {activeTab === 'batting-impact' && <><td>{row.innings}</td><td>{row.avgRuns}</td><td>{row.sr}</td></>}
                      {activeTab === 'bowling-pressure' && <><td>{row.matches}</td><td>{row.wickets}</td><td>{row.economy}</td><td>{row.dotPct}%</td></>}
                      {activeTab === 'death-rating' && deathType === 'batting' && <><td>{row.innings}</td><td>{row.runs?.toLocaleString()}</td><td>{row.sr}</td><td>{row.sixes}</td></>}
                      {activeTab === 'death-rating' && deathType === 'bowling' && <><td>{row.matches}</td><td>{row.wickets}</td><td>{row.economy}</td><td>{row.dotPct}%</td></>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Metric Description */}
          <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 11, color: '#aaa' }}>
            {data.description}
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
          <p>No data available for this filter.</p>
        </div>
      )}
    </div>
  );
}
