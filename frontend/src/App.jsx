import React, { useState, useEffect, useCallback } from 'react';
import MatchCard from './components/MatchCard';
import AdminPanel from './components/AdminPanel';
import { fetchMatches } from './api';

const FILTERS = ['All', 'Live', 'Upcoming', 'Completed'];

export default function App() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [showAdmin, setShowAdmin] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadMatches = useCallback(async () => {
    try {
      const data = await fetchMatches();
      setMatches(data.matches || []);
      setLastUpdated(new Date());
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMatches();
    // Auto-refresh every 5 minutes
    const interval = setInterval(loadMatches, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadMatches]);

  const filtered = matches.filter(m => {
    if (filter === 'All') return true;
    const s = (m.status || '').toLowerCase();
    if (filter === 'Live') return s.includes('live') || s.includes('progress') || s.includes('innings');
    if (filter === 'Upcoming') return s.includes('not started') || s.includes('upcoming');
    if (filter === 'Completed') return s.includes('won') || s.includes('result') || s.includes('tied') || s.includes('no result');
    return true;
  });

  const liveCount = matches.filter(m => {
    const s = (m.status || '').toLowerCase();
    return s.includes('live') || s.includes('progress') || s.includes('innings');
  }).length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .match-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 16px;
        }
        @media (max-width: 480px) {
          .match-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* Header */}
      <header style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '0 24px', position: 'sticky', top: 0, zIndex: 100
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>🏏</span>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>Reddy</h1>
              <p style={{ fontSize: 11, color: 'var(--muted)' }}>IPL 2026 Live Schedule & Scores</p>
            </div>
            {liveCount > 0 && (
              <span style={{
                background: '#16a34a22', color: '#22c55e', border: '1px solid #22c55e44',
                borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 5
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                {liveCount} LIVE
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {lastUpdated && (
              <span style={{ fontSize: 11, color: 'var(--muted)', display: 'none' }} className="updated">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={() => setShowAdmin(true)}
              style={{
                background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: 8, color: 'var(--muted)', padding: '7px 14px',
                fontSize: 13, fontWeight: 500
              }}
            >
              ⚙ Admin
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '7px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                border: `1px solid ${filter === f ? 'var(--accent)' : 'var(--border)'}`,
                background: filter === f ? 'var(--accent)' : 'var(--surface)',
                color: filter === f ? '#fff' : 'var(--muted)',
                transition: 'all 0.15s'
              }}
            >
              {f}
              {f === 'Live' && liveCount > 0 && (
                <span style={{ marginLeft: 6, background: '#22c55e', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>
                  {liveCount}
                </span>
              )}
            </button>
          ))}

          <button
            onClick={loadMatches}
            style={{
              marginLeft: 'auto', padding: '7px 14px', borderRadius: 20, fontSize: 13,
              border: '1px solid var(--border)', background: 'var(--surface)',
              color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            ↻ Refresh
          </button>
        </div>

        {/* States */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted)' }}>
            <div style={{
              width: 36, height: 36, border: '3px solid var(--border)',
              borderTopColor: 'var(--accent)', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite', margin: '0 auto 16px'
            }} />
            <p>Loading IPL 2026 schedule...</p>
          </div>
        )}

        {!loading && error && (
          <div style={{
            background: '#7f1d1d22', border: '1px solid #7f1d1d',
            borderRadius: 12, padding: 24, textAlign: 'center'
          }}>
            <p style={{ color: '#fca5a5', fontWeight: 600, marginBottom: 8 }}>Failed to load matches</p>
            <p style={{ color: '#f87171', fontSize: 13, marginBottom: 16 }}>{error}</p>
            <p style={{ color: 'var(--muted)', fontSize: 12 }}>
              Make sure your backend is running and <code style={{ color: '#f97316' }}>CRICKET_API_KEY</code> is set in <code style={{ color: '#f97316' }}>backend/.env</code>
            </p>
            <button onClick={loadMatches} style={{
              marginTop: 16, background: 'var(--accent)', border: 'none',
              borderRadius: 8, color: '#fff', padding: '8px 20px', fontWeight: 600
            }}>
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted)' }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>🏏</p>
            <p style={{ fontWeight: 600, marginBottom: 6 }}>No {filter !== 'All' ? filter.toLowerCase() : ''} matches found</p>
            <p style={{ fontSize: 13 }}>IPL 2026 runs March 28 – May 31, 2026</p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              {filtered.length} match{filtered.length !== 1 ? 'es' : ''}
              {lastUpdated && ` · Updated ${lastUpdated.toLocaleTimeString()}`}
            </p>
            <div className="match-grid">
              {filtered.map(match => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </>
        )}
      </main>

      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
    </div>
  );
}
