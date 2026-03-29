import React, { useState, useEffect } from 'react';
import { verifyAdmin, saveRatio, fetchRatios } from '../api';

const IPL_TEAMS = [
  'Mumbai Indians', 'Chennai Super Kings', 'Royal Challengers Bengaluru',
  'Kolkata Knight Riders', 'Delhi Capitals', 'Sunrisers Hyderabad',
  'Rajasthan Royals', 'Punjab Kings', 'Lucknow Super Giants', 'Gujarat Titans',
];

export default function AdminPanel({ onClose }) {
  const [secret, setSecret] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [editing, setEditing] = useState({});
  const [saving, setSaving] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('admin_secret');
    if (saved) {
      setSecret(saved);
      verifyAdmin(saved).then(ok => {
        if (ok) { setAuthenticated(true); loadRatios(); }
        else localStorage.removeItem('admin_secret');
      });
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    const ok = await verifyAdmin(secret);
    if (ok) {
      localStorage.setItem('admin_secret', secret);
      setAuthenticated(true);
      loadRatios();
    } else {
      setError('Invalid admin secret');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_secret');
    setAuthenticated(false);
    setSecret('');
  };

  const loadRatios = async () => {
    try {
      const data = await fetchRatios();
      const map = {};
      data.forEach(r => { map[r.team_name] = r.ratio; });
      const editMap = {};
      IPL_TEAMS.forEach(t => { editMap[t] = map[t] || ''; });
      setEditing(editMap);
    } catch {}
  };

  const handleSave = async (team) => {
    setSaving(s => ({ ...s, [team]: true }));
    setError(''); setSuccess('');
    try {
      const s = localStorage.getItem('admin_secret') || secret;
      await saveRatio(team, editing[team], s);
      setSuccess('Saved ratio for ' + team);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(s => ({ ...s, [team]: false }));
    }
  };

  return (
    React.createElement('div', { style: { position: 'fixed', inset: 0, background: '#00000099', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }, onClick: e => e.target === e.currentTarget && onClose() },
      React.createElement('div', { style: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' } },
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 } },
          React.createElement('h2', { style: { fontSize: 20, fontWeight: 700 } }, 'Admin Panel'),
          React.createElement('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
            authenticated && React.createElement('button', { onClick: handleLogout, style: { background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--muted)', fontSize: 12, padding: '5px 12px', cursor: 'pointer' } }, 'Logout'),
            React.createElement('button', { onClick: onClose, style: { background: 'none', border: 'none', color: 'var(--muted)', fontSize: 24, cursor: 'pointer' } }, 'x')
          )
        ),
        !authenticated
          ? React.createElement('form', { onSubmit: handleLogin, style: { display: 'flex', flexDirection: 'column', gap: 14 } },
              React.createElement('p', { style: { fontSize: 13, color: 'var(--muted)' } }, 'Enter admin secret to manage team ratios.'),
              React.createElement('input', { type: 'password', placeholder: 'Admin secret', value: secret, onChange: e => setSecret(e.target.value), autoFocus: true, style: { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text)', fontSize: 14, outline: 'none', width: '100%' } }),
              error && React.createElement('p', { style: { color: '#f87171', fontSize: 13 } }, error),
              React.createElement('button', { type: 'submit', style: { background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, padding: '10px 20px', fontSize: 14, cursor: 'pointer' } }, 'Login')
            )
          : React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
              error && React.createElement('p', { style: { color: '#f87171', fontSize: 13 } }, error),
              success && React.createElement('p', { style: { color: '#22c55e', fontSize: 13 } }, success),
              ...IPL_TEAMS.map(team =>
                React.createElement('div', { key: team, style: { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface2)', borderRadius: 10, padding: '10px 14px' } },
                  React.createElement('span', { style: { flex: 1, fontSize: 13, fontWeight: 500 } }, team),
                  React.createElement('input', { type: 'text', placeholder: '1.85', value: editing[team] || '', onChange: e => setEditing(ed => ({ ...ed, [team]: e.target.value })), style: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', color: 'var(--text)', fontSize: 13, outline: 'none', width: 90 } }),
                  React.createElement('button', { onClick: () => handleSave(team), disabled: saving[team], style: { background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, padding: '6px 14px', fontSize: 12, minWidth: 60, cursor: 'pointer' } }, saving[team] ? '...' : 'Save')
                )
              )
            )
      )
    )
  );
}
