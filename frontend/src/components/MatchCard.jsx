import React, { useState, useEffect } from 'react';
import { fetchMatchScore } from '../api';

// IPL team abbreviations & colors
const TEAM_META = {
  'Mumbai Indians': { abbr: 'MI', color: '#004BA0' },
  'Chennai Super Kings': { abbr: 'CSK', color: '#F9CD05' },
  'Royal Challengers Bengaluru': { abbr: 'RCB', color: '#EC1C24' },
  'Royal Challengers Bangalore': { abbr: 'RCB', color: '#EC1C24' },
  'Kolkata Knight Riders': { abbr: 'KKR', color: '#3A225D' },
  'Delhi Capitals': { abbr: 'DC', color: '#0078BC' },
  'Sunrisers Hyderabad': { abbr: 'SRH', color: '#F7A721' },
  'Rajasthan Royals': { abbr: 'RR', color: '#EA1A85' },
  'Punjab Kings': { abbr: 'PBKS', color: '#ED1B24' },
  'Lucknow Super Giants': { abbr: 'LSG', color: '#A72056' },
  'Gujarat Titans': { abbr: 'GT', color: '#1C1C1C' },
};

function getTeamMeta(name) {
  if (!name) return { abbr: '??', color: '#334155' };
  const key = Object.keys(TEAM_META).find(k =>
    name.toLowerCase().includes(k.toLowerCase()) ||
    k.toLowerCase().includes(name.toLowerCase())
  );
  return key ? TEAM_META[key] : { abbr: name.slice(0, 3).toUpperCase(), color: '#334155' };
}

function StatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  const isLive = s.includes('live') || s.includes('progress') || s.includes('innings');
  const isCompleted = s.includes('won') || s.includes('result') || s.includes('tied') || s.includes('no result');
  const isUpcoming = s.includes('not started') || s.includes('upcoming');

  const style = {
    padding: '3px 10px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    background: isLive ? '#16a34a22' : isCompleted ? '#1e3a5f' : '#1e293b',
    color: isLive ? '#22c55e' : isCompleted ? '#60a5fa' : '#94a3b8',
    border: `1px solid ${isLive ? '#22c55e44' : isCompleted ? '#3b82f644' : '#33415544'}`,
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  };

  return (
    <span style={style}>
      {isLive && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />}
      {isLive ? 'LIVE' : isCompleted ? 'Completed' : 'Upcoming'}
    </span>
  );
}

function TeamBlock({ name, score, ratio }) {
  const meta = getTeamMeta(name);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: meta.color + '33',
        border: `2px solid ${meta.color}66`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 800, color: meta.color,
        letterSpacing: '-0.5px'
      }}>
        {meta.abbr}
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, textAlign: 'center', color: '#e2e8f0', maxWidth: 120 }}>{name}</span>
      {score && <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{score}</span>}
      {ratio && (
        <span style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 20,
          background: '#f9731622', color: '#f97316',
          border: '1px solid #f9731644', fontWeight: 700
        }}>
          {ratio}
        </span>
      )}
    </div>
  );
}

export default function MatchCard({ match }) {
  const [liveScore, setLiveScore] = useState(null);
  const teams = match.teams || [];
  const team1 = teams[0] || 'TBD';
  const team2 = teams[1] || 'TBD';
  const isLive = (match.status || '').toLowerCase().includes('live') ||
    (match.status || '').toLowerCase().includes('progress') ||
    (match.status || '').toLowerCase().includes('innings');

  useEffect(() => {
    if (!match.id) return;
    const load = async () => {
      try {
        const data = await fetchMatchScore(match.id);
        // Handle Cricbuzz response format
        const info = data?.response?.matchInfo || data?.data;
        if (info && Object.keys(info).length > 0) setLiveScore(info);
      } catch { /* silent */ }
    };
    if (isLive) {
      load();
      const interval = setInterval(load, 30000);
      return () => clearInterval(interval);
    }
  }, [match.id, isLive]);

  // Score from live API or from match.score (cricapi format)
  const matchScore = match.score || [];
  const score1 = liveScore?.score?.[0]?.r ?? matchScore.find(s => s.inning?.includes(team1))?.r;
  const score2 = liveScore?.score?.[1]?.r ?? matchScore.find(s => s.inning?.includes(team2))?.r;
  const scoreStr1 = score1 !== undefined ? `${score1}` : null;
  const scoreStr2 = score2 !== undefined ? `${score2}` : null;

  const ratio1 = match.teamRatios?.[team1];
  const ratio2 = match.teamRatios?.[team2];

  const matchDate = match.dateTimeGMT ? new Date(match.dateTimeGMT) : null;
  const dateStr = matchDate ? matchDate.toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  }) : match.date || 'TBD';
  const timeStr = matchDate ? matchDate.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
  }) : '';

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${isLive ? '#22c55e33' : 'var(--border)'}`,
      borderRadius: 'var(--radius)',
      padding: '20px',
      transition: 'transform 0.15s, box-shadow 0.15s',
      boxShadow: isLive ? '0 0 20px #22c55e11' : 'none',
    }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          <span>{dateStr}</span>
          {timeStr && <span style={{ marginLeft: 8, color: '#475569' }}>{timeStr}</span>}
        </div>
        <StatusBadge status={match.status} />
      </div>

      {/* Teams */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <TeamBlock name={team1} score={scoreStr1} ratio={ratio1} />
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--muted)', flexShrink: 0 }}>VS</div>
        <TeamBlock name={team2} score={scoreStr2} ratio={ratio2} />
      </div>

      {/* Live score detail */}
      {isLive && liveScore && (
        <div style={{
          background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px',
          fontSize: 12, color: '#94a3b8', marginBottom: 12
        }}>
          {liveScore.status || match.status}
        </div>
      )}

      {/* Result */}
      {!isLive && match.status && !match.status.toLowerCase().includes('not started') && (
        <div style={{
          fontSize: 12, color: '#60a5fa', background: '#1e3a5f22',
          borderRadius: 8, padding: '8px 12px', marginBottom: 12
        }}>
          {match.status}
        </div>
      )}

      {/* Venue */}
      {match.venue && (
        <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span>📍</span>
          <span>{match.venue}</span>
        </div>
      )}
    </div>
  );
}
