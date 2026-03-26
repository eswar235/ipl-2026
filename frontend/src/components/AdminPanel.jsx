import React, { useState, useEffect } from 'react';
import { verifyAdmin, saveRatio, fetchRatios } from '../api';

const IPL_TEAMS = [
  'Mumbai Indians',
  'Chennai Super Kings',
  'Royal Challengers Bengaluru',
  'Kolkata Knight Riders',
  'Delhi Capitals',
  'Sunrisers Hyderabad',
  'Rajasthan Royals',
  'Punjab Kings',
  'Lucknow Super Giants',
  'Gujarat Titans',
];

export default function AdminPanel({ onClose }) {
  const [secret, setSecret] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [ratios, setRatios] = useState({});
  const [editing, setEditing] = useState({});
  const [saving, setSaving] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    const ok = await verifyAdmin(secret);
    if (ok) {
      setAuthenticated(true);
      loadRatios();
    } else {
      setError('Invalid admin secret');
    }
  };

  const loadRatios = async () => {
    try {
      const data = await fetchRatios();
      const map = {};
      data.forEach(r => { map[r.team_name] = r.ratio; });
      setRatios(map);
      const editMap = {};
      IPL_TEAMS.forEach(t => { editMap[t] = map[t] || ''; });
      setEditing(editMap);
    } catch { /* silent */ }
  };

  const handleSave = async (team) => {
    setSaving(s => ({ ...s, [team]: true }));
    setError('');
    setSuccess('');
    try {
      await saveRatio(team, editing[team], secret);
      setRatios(r => ({ ...r, [team]: editing[team] }));
      setSuccess(`Saved ratio for ${team}`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(s => ({ ...s, [team]: false }));
    }
  };

  const overlay = {
    position: 'fixed', inset: 0, background: '#00000088',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16
  };

  const panel = {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 16, padding: 28, width: '100%', maxWidth: 520,
    maxHeight: '90vh', overflowY: 'auto'
  };

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={panel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Admin Panel</h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--muted)',
            fontSize: 22, lineHeight: 1, padding: '0 4px'
          }}>×</button>
        </div>

        {!authenticated ? (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Enter admin secret to manage team ratios.</p>
            <input
              type="password"
              placeholder="Admin secret"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              style={inputStyle}
              autoFocus
            />
            {error && <p style={{ color: '#f87171', fontSize: 13 }}>{error}</p>}
            <button type="submit" style={btnStyle}>Login</button>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>
              Set betting/odds ratios for each team. Format: e.g. <code style={{ color: '#f97316' }}>1.85</code> or <code style={{ color: '#f97316' }}>2/1</code>
            </p>
            {error && <p style={{ color: '#f87171', fontSize: 13 }}>{error}</p>}
            {success && <p style={{ color: '#22c55e', fontSize: 13 }}>{success}</p>}

            {IPL_TEAMS.map(team => (
              <div key={team} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'var(--surface2)', borderRadius: 10, padding: '10px 14px'
              }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{team}</span>
                <input
                  type="text"
                  placeholder="e.g. 1.85"
                  value={editing[team] || ''}
                  onChange={e => setEditing(ed => ({ ...ed, [team]: e.target.value }))}
                  style={{ ...inputStyle, width: 90, padding: '6px 10px', fontSize: 13 }}
                />
                <button
                  onClick={() => handleSave(team)}
                  disabled={saving[team]}
                  style={{ ...btnStyle, padding: '6px 14px', fontSize: 12, minWidth: 60 }}
                >
                  {saving[team] ? '...' : 'Save'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  background: 'var(--surface2)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '10px 14px', color: 'var(--text)',
  fontSize: 14, outline: 'none', width: '100%'
};

const btnStyle = {
  background: 'var(--accent)', border: 'none', borderRadius: 8,
  color: '#fff', fontWeight: 600, padding: '10px 20px',
  fontSize: 14, transition: 'opacity 0.15s'
};
