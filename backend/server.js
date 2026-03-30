require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const db = require('./db');
const STATIC_SCHEDULE = require('./ipl2026-schedule');

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'DELETE'] }));
app.use(express.json());

const RAPID_KEY = process.env.RAPID_API_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin123';
const PORT = process.env.PORT || 3001;
const HOST_FREE = 'free-cricbuzz-cricket-api.p.rapidapi.com';
const HOST_LIVE = 'cricbuzz-cricket.p.rapidapi.com';
const IPL_SERIES_ID = 9241;

const hFree = () => ({ 'x-rapidapi-key': RAPID_KEY, 'x-rapidapi-host': HOST_FREE });
const hLive = () => ({ 'x-rapidapi-key': RAPID_KEY, 'x-rapidapi-host': HOST_LIVE });

const cache = { matches: null, ts: 0 };
const CACHE_TTL = 15 * 1000;

function requireAdmin(req, res, next) {
  if (req.headers['x-admin-secret'] !== ADMIN_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

async function fetchFromCricbuzz(type) {
  const res = await fetch(`https://${HOST_LIVE}/matches/v1/${type}`, { headers: hLive() });
  const data = await res.json();
  const matches = [];
  for (const typeMatch of (data.typeMatches || [])) {
    for (const sm of (typeMatch.seriesMatches || [])) {
      const wrapper = sm.seriesAdWrapper;
      if (!wrapper || wrapper.seriesId !== IPL_SERIES_ID) continue;
      for (const m of (wrapper.matches || [])) {
        const info = m.matchInfo;
        const score = m.matchScore;
        if (!info) continue;
        matches.push({
          id: String(info.matchId),
          seriesName: info.seriesName,
          matchDesc: info.matchDesc,
          matchFormat: info.matchFormat,
          dateTimeGMT: info.startDate ? new Date(parseInt(info.startDate)).toISOString() : null,
          date: info.startDate ? new Date(parseInt(info.startDate)).toISOString().slice(0, 10) : null,
          teams: [info.team1?.teamName, info.team2?.teamName],
          team1: info.team1,
          team2: info.team2,
          venue: info.venueInfo ? `${info.venueInfo.ground}, ${info.venueInfo.city}` : '',
          status: info.status || '',
          state: info.state || '',
          matchStarted: info.state !== 'Preview',
          matchEnded: info.state === 'Complete',
          liveScore: score ? formatScore(score, info) : null,
        });
      }
    }
  }
  return matches;
}

function formatScore(score, info) {
  const t1 = score.team1Score;
  const t2 = score.team2Score;
  const fmt = (s) => s ? `${s.runs}/${s.wickets} (${s.overs} ov)` : null;
  return {
    [info.team1?.teamName]: fmt(t1?.inngs1) || fmt(t1?.inngs2),
    [info.team2?.teamName]: fmt(t2?.inngs1) || fmt(t2?.inngs2),
  };
}

async function fetchUpcomingIPL() {
  const res = await fetch(`https://${HOST_FREE}/cricket-schedule`, { headers: hFree() });
  const data = await res.json();
  const matches = [];
  for (const day of (data?.response?.schedules || [])) {
    for (const series of (day.scheduleAdWrapper?.matchScheduleList || [])) {
      if (series.seriesId !== IPL_SERIES_ID) continue;
      for (const m of (series.matchInfo || [])) {
        const dt = m.startDate ? new Date(parseInt(m.startDate)) : null;
        matches.push({
          id: String(m.matchId),
          seriesName: series.seriesName,
          matchDesc: m.matchDesc,
          matchFormat: m.matchFormat,
          dateTimeGMT: dt ? dt.toISOString() : null,
          date: dt ? dt.toISOString().slice(0, 10) : null,
          teams: [m.team1?.teamName, m.team2?.teamName],
          team1: m.team1,
          team2: m.team2,
          venue: m.venueInfo ? `${m.venueInfo.ground}, ${m.venueInfo.city}` : '',
          status: 'Match not started',
          state: 'Preview',
          matchStarted: false,
          matchEnded: false,
        });
      }
    }
  }
  return matches;
}

async function fetchIPLMatches() {
  if (cache.matches && Date.now() - cache.ts < CACHE_TTL) return cache.matches;

  const staticMatches = STATIC_SCHEDULE.map(m => ({
    ...m, seriesName: 'Indian Premier League 2026', matchFormat: 'T20',
    team1: { teamName: m.teams[0] }, team2: { teamName: m.teams[1] },
    status: 'Match not started', state: 'Preview', matchStarted: false, matchEnded: false,
  }));

  let liveMatches = [];
  try {
    const [live, recent] = await Promise.all([fetchFromCricbuzz('live'), fetchFromCricbuzz('recent')]);
    liveMatches = [...live, ...recent];
  } catch (e) { console.error('Live fetch error:', e.message); }

  let upcoming = [];
  try { upcoming = await fetchUpcomingIPL(); } catch (e) { console.error('Schedule fetch error:', e.message); }

  // Build live map — these always win
  const liveMap = {};
  for (const m of liveMatches) liveMap[m.id] = m;

  // Start from static, override with live/upcoming
  const merged = staticMatches.map(s => {
    if (liveMap[s.id]) return { ...s, ...liveMap[s.id] };
    const up = upcoming.find(u => u.id === s.id);
    if (up) return { ...s, ...up };
    return s;
  });

  // Add live matches not in static
  for (const m of liveMatches) {
    if (!merged.find(s => s.id === m.id)) merged.push(m);
  }

  merged.sort((a, b) => new Date(a.dateTimeGMT || a.date) - new Date(b.dateTimeGMT || b.date));
  if (liveMatches.length > 0) db.cacheMatches(liveMatches);

  cache.matches = merged;
  cache.ts = Date.now();
  return merged;
}

app.get('/api/matches', async (req, res) => {
  try {
    if (!RAPID_KEY) return res.status(500).json({ error: 'RAPID_API_KEY not set' });
    const matches = await fetchIPLMatches();
    const ratios = db.getRatios();
    const enriched = matches.map(m => ({
      ...m,
      teamRatios: { [m.teams[0]]: ratios[m.teams[0]] || null, [m.teams[1]]: ratios[m.teams[1]] || null }
    }));
    res.json({ matches: enriched, total: enriched.length });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/live', async (req, res) => {
  try {
    const matches = await fetchIPLMatches();
    res.json({ matches: matches.filter(m => m.state === 'In Progress') });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/match/:id/score', async (req, res) => {
  try {
    const r = await fetch(`https://${HOST_LIVE}/mcenter/v1/${req.params.id}/hscard`, { headers: hLive() });
    const data = await r.json();
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/ratios', (req, res) => res.json(db.getAllRatios()));

app.post('/api/admin/ratio', requireAdmin, (req, res) => {
  const { teamName, ratio } = req.body;
  if (!teamName || ratio === undefined) return res.status(400).json({ error: 'teamName and ratio required' });
  db.setRatio(teamName, String(ratio).trim());
  res.json({ success: true, teamName, ratio });
});

app.get('/api/admin/verify', requireAdmin, (req, res) => res.json({ authenticated: true }));

app.get('/ping', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`Reddy IPL backend running on http://localhost:${PORT}`);
  console.log(`RapidAPI key: ${RAPID_KEY ? 'loaded ✓' : 'MISSING'}`);
  const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  setInterval(async () => {
    try { await fetch(`${SELF_URL}/ping`); }
    catch (e) { console.log('[keep-alive] failed:', e.message); }
  }, 4 * 60 * 1000);
});
