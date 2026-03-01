import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import ErrorMessage from '../ui/ErrorMessage';
import { fetchFilteredMatches, fetchFilterOptions } from '../../services/api';

export default function MatchFilter() {
  const navigate = useNavigate();
  const [options, setOptions] = useState(null);
  const [filters, setFilters] = useState({
    seasonFrom: '', seasonTo: '', venue: '', tossWinner: '', tossDecision: '',
    winner: '', result: '', superOver: '', team: '', sort: 'date_desc'
  });
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    fetchFilterOptions().then(r => setOptions(r.data)).catch(() => {});
  }, []);

  const search = useCallback(async (p = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page: p, limit: 20 };
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await fetchFilteredMatches(params);
      setData(res);
      setPage(p);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { search(1); }, []);

  const reset = () => {
    setFilters({ seasonFrom: '', seasonTo: '', venue: '', tossWinner: '', tossDecision: '', winner: '', result: '', superOver: '', team: '', sort: 'date_desc' });
  };

  const updateFilter = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));

  const SelectFilter = ({ label, field, options: opts }) => (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>{label}</label>
      <select value={filters[field]} onChange={e => updateFilter(field, e.target.value)} className="form-select w-full" style={{ fontSize: 12, padding: '6px 8px' }}>
        <option value="">Any</option>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Filter Panel */}
      <div className="card">
        <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => setShowFilters(!showFilters)}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={14} /> Advanced Match Filter
          </h3>
          {showFilters ? <ChevronUp size={16} style={{ color: '#888' }} /> : <ChevronDown size={16} style={{ color: '#888' }} />}
        </div>
        {showFilters && options && (
          <div className="card-body">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
              {/* Season Range */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Season From</label>
                <select value={filters.seasonFrom} onChange={e => updateFilter('seasonFrom', e.target.value)} className="form-select w-full" style={{ fontSize: 12, padding: '6px 8px' }}>
                  <option value="">Start</option>
                  {options.seasons.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Season To</label>
                <select value={filters.seasonTo} onChange={e => updateFilter('seasonTo', e.target.value)} className="form-select w-full" style={{ fontSize: 12, padding: '6px 8px' }}>
                  <option value="">End</option>
                  {options.seasons.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <SelectFilter label="Team" field="team" options={options.teams} />
              <SelectFilter label="Winner" field="winner" options={options.teams} />
              <SelectFilter label="Venue" field="venue" options={options.venues} />
              <SelectFilter label="Toss Winner" field="tossWinner" options={options.teams} />
              <SelectFilter label="Toss Decision" field="tossDecision" options={options.tossDecisions} />
              <SelectFilter label="Result Type" field="result" options={options.results} />
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Super Over</label>
                <select value={filters.superOver} onChange={e => updateFilter('superOver', e.target.value)} className="form-select w-full" style={{ fontSize: 12, padding: '6px 8px' }}>
                  <option value="">Any</option>
                  <option value="Y">Yes</option>
                  <option value="N">No</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Sort By</label>
                <select value={filters.sort} onChange={e => updateFilter('sort', e.target.value)} className="form-select w-full" style={{ fontSize: 12, padding: '6px 8px' }}>
                  <option value="date_desc">Newest First</option>
                  <option value="date_asc">Oldest First</option>
                  <option value="margin_desc">Biggest Margin</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => search(1)} style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, background: '#1B2A72', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                Apply Filters
              </button>
              <button onClick={() => { reset(); setTimeout(() => search(1), 100); }} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 500, background: '#f3f4f6', color: '#666', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <RotateCcw size={12} /> Reset
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      {data?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="stat-card text-center">
            <p className="stat-label" style={{ marginBottom: 6 }}>Matches Found</p>
            <p style={{ fontSize: 26, fontWeight: 700, color: '#1B2A72' }}>{data.summary.total}</p>
          </div>
          <div className="stat-card text-center">
            <p className="stat-label" style={{ marginBottom: 6 }}>Avg Margin</p>
            <p style={{ fontSize: 26, fontWeight: 700, color: '#f59e0b' }}>{data.summary.avgMargin}</p>
          </div>
          <div className="stat-card text-center">
            <p className="stat-label" style={{ marginBottom: 6 }}>Won by Runs</p>
            <p style={{ fontSize: 26, fontWeight: 700, color: '#6366f1' }}>{data.summary.winsBy?.runs || 0}</p>
          </div>
          <div className="stat-card text-center">
            <p className="stat-label" style={{ marginBottom: 6 }}>Super Overs</p>
            <p style={{ fontSize: 26, fontWeight: 700, color: '#ef4444' }}>{data.summary.winsBy?.superOvers || 0}</p>
          </div>
        </div>
      )}

      {/* Results Table */}
      {loading ? (
        <LoadingSkeleton count={6} type="card" />
      ) : error ? (
        <ErrorMessage message={error} onRetry={() => search(page)} />
      ) : data?.data?.length > 0 ? (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Results ({data.pagination?.total} matches)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Season</th>
                  <th style={{ textAlign: 'left' }}>Teams</th>
                  <th style={{ textAlign: 'left' }}>Venue</th>
                  <th>Winner</th>
                  <th>Margin</th>
                  <th>Toss</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((m, i) => (
                  <tr key={m.id || i} style={{ cursor: 'pointer' }} onClick={() => navigate(`/scorecard?match=${m.id}`)}
                    onMouseOver={e => e.currentTarget.style.background = '#f8f9ff'} onMouseOut={e => e.currentTarget.style.background = ''}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{new Date(m.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                    <td style={{ fontSize: 12 }}>{m.season}</td>
                    <td style={{ textAlign: 'left', fontSize: 12 }}>{m.team1} vs {m.team2}</td>
                    <td style={{ textAlign: 'left', fontSize: 11, color: '#888', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.venue}</td>
                    <td style={{ fontWeight: 600, color: '#1B2A72', fontSize: 12 }}>{m.winner || 'NR'}</td>
                    <td style={{ fontSize: 12 }}>{m.result_margin ? `${m.result_margin} ${m.result}` : '—'}</td>
                    <td style={{ fontSize: 11, color: '#888' }}>{m.toss_winner?.split(' ').pop()} ({m.toss_decision})</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.pagination && data.pagination.pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '12px 16px', borderTop: '1px solid #f0f0f0' }}>
              {Array.from({ length: Math.min(data.pagination.pages, 10) }, (_, i) => {
                const p = i + 1;
                return (
                  <button key={p} onClick={() => search(p)} style={{
                    width: 32, height: 32, borderRadius: 6, fontSize: 12, fontWeight: page === p ? 700 : 500,
                    background: page === p ? '#1B2A72' : '#f3f4f6', color: page === p ? '#fff' : '#666',
                    border: 'none', cursor: 'pointer'
                  }}>{p}</button>
                );
              })}
              {data.pagination.pages > 10 && <span style={{ color: '#999', lineHeight: '32px' }}>...</span>}
            </div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
          <Filter size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <p style={{ fontSize: 14 }}>No matches found. Try adjusting your filters.</p>
        </div>
      )}
    </div>
  );
}
