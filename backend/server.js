require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const db = require('./db');
const STATIC_SCHEDULE = require('./ipl2026-schedule');

const app = express();
app.use(cors({
  origin: '*', // allow Vercel frontend + mobile browsers
  methods: ['GET', 'POST', 'DELETE']
}));
app.use(express.json());

const RAPID_KEY = process.env.RAPID_API_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin123';
const PORT = process.env.PORT || 3001;
const HOST = 'free-cricbuzz-cricket-api.p.rapidapi.com';
const BASE = 'https://' + HOST;
const IPL_SERIES_ID = 9241; // Indian Premier League 2026

const headers = () => ({
  'x-rapidapi-key': RAPID_KEY,
  'x-rapidapi-host': HOST,
  'Content-Type': 'application/json'
});

// ─── Simple in-memory cache ──────────────────────────────────────────────────
const cache = { matches: null, ts: 0 };
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ─── Admin auth ──────────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  if (req.headers['x-admin-secret'] !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ─── Fetch IPL matches — schedule + live status ──────────────────────────────
async function fetchIPLMatches() {
  if (cache.matches && Date.now() - cache.ts < CACHE_TTL) {
    return cache.matches;
  }

  // Start with static schedule so matches are never lost
  const staticMatches = STATIC_SCHEDULE.map(m => ({
    ...m,
    seriesName: 'Indian Premier League 2026',
    matchFormat: 'T20',
    team1: { teamName: m.teams[0] },
    team2: { teamName: m.teams[1] },
    status: 'Match not started',
    matchStarted: false,
    matchEnded: false,
  }));

  const freshMatches = [];

  // 1. Get upcoming from Cricbuzz rolling schedule
  try {
    const res = await fetch(`${BASE}/cricket-schedule`, { headers: headers() });
    const data = await res.json();
    const schedules = data?.response?.schedules || [];
    for (const day of schedules) {
      const list = day.scheduleAdWrapper?.matchScheduleList || [];
      for (const series of list) {
        const isIPL = series.seriesId === IPL_SERIES_ID ||
          (series.seriesName && series.seriesName.toLowerCase().includes('indian premier league 2026'));
        if (!isIPL) continue;
        for (const m of (series.matchInfo || [])) {
          freshMatches.push(normalizeMatch(m, series.seriesName, day.scheduleAdWrapper?.date || ''));
        }
      }
    }
  } catch (e) { console.error('Schedule fetch error:', e.message); }

  // 2. Get live matches from cricapi.com
  try {
    const cricKey = process.env.CRICKET_API_KEY;
    if (cricKey) {
      const liveRes = await fetch(`https://api.cricapi.com/v1/currentMatches?apikey=${cricKey}&offset=0`);
      const liveData = await liveRes.json();
      const liveIPL = (liveData.data || []).filter(m =>
        m.name && m.name.toLowerCase().includes('ipl')
      );
      for (const lm of liveIPL) {
        freshMatches.push({
          id: lm.id,
          seriesName: 'Indian Premier League 2026',
          matchDesc: lm.name,
          matchFormat: 'T20',
          dateTimeGMT: lm.dateTimeGMT,
          date: lm.date,
          teams: lm.teams || [],
          team1: { teamName: lm.teams?.[0] || 'TBD' },
          team2: { teamName: lm.teams?.[1] || 'TBD' },
          venue: lm.venue || '',
          status: lm.status || '',
          matchStarted: lm.matchStarted || false,
          matchEnded: lm.matchEnded || false,
          score: lm.score || [],
        });
      }
    }
  } catch (e) { console.error('Live fetch error:', e.message); }

  // 3. Merge: static base → cached → fresh live (priority order)
  const stored = db.getCachedMatches();
  let merged = mergeMatches(staticMatches, stored);
  merged = mergeMatches(merged, freshMatches);

  if (freshMatches.length > 0) db.cacheMatches(freshMatches);

  cache.matches = merged;
  cache.ts = Date.now();
  return merged;
}

function normalizeMatch(m, seriesName, dateStr) {
  const startMs = parseInt(m.startDate);
  const dt = startMs ? new Date(startMs) : null;
  return {
    id: String(m.matchId),
    seriesId: m.seriesId,
    seriesName: seriesName || 'IPL 2026',
    matchDesc: m.matchDesc || '',
    matchFormat: m.matchFormat || 'T20',
    dateTimeGMT: dt ? dt.toISOString() : null,
    date: dt ? dt.toISOString().slice(0, 10) : dateStr,
    teams: [m.team1?.teamName || 'TBD', m.team2?.teamName || 'TBD'],
    team1: m.team1 || {},
    team2: m.team2 || {},
    venue: m.venueInfo ? `${m.venueInfo.ground}, ${m.venueInfo.city}` : '',
    timezone: m.venueInfo?.timezone || '+05:30',
    status: m.status || 'Match not started',
    matchStarted: m.matchStarted || false,
    matchEnded: m.matchEnded || false,
  };
}

function mergeMatches(stored, fresh) {
  const map = {};
  for (const m of stored) map[m.id] = m;
  for (const m of fresh) map[m.id] = { ...map[m.id], ...m }; // fresh overrides
  return Object.values(map).sort((a, b) =>
    new Date(a.dateTimeGMT || a.date) - new Date(b.dateTimeGMT || b.date)
  );
}

// ─── GET /api/matches ────────────────────────────────────────────────────────
app.get('/api/matches', async (req, res) => {
  try {
    if (!RAPID_KEY) return res.status(500).json({ error: 'RAPID_API_KEY not set in backend/.env' });
    const matches = await fetchIPLMatches();
    const ratios = db.getRatios();
    const enriched = matches.map(m => ({
      ...m,
      teamRatios: {
        [m.teams[0]]: ratios[m.teams[0]] || null,
        [m.teams[1]]: ratios[m.teams[1]] || null,
      }
    }));
    res.json({ matches: enriched, total: enriched.length });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/live ───────────────────────────────────────────────────────────
app.get('/api/live', async (req, res) => {
  try {
    if (!RAPID_KEY) return res.status(500).json({ error: 'RAPID_API_KEY not set' });
    const matches = await fetchIPLMatches();
    const live = matches.filter(m => m.matchStarted && !m.matchEnded);
    res.json({ matches: live });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/match/:id/score ────────────────────────────────────────────────
app.get('/api/match/:id/score', async (req, res) => {
  try {
    // Try cricapi.com first (works for live IPL scores)
    const cricKey = process.env.CRICKET_API_KEY;
    if (cricKey) {
      const r = await fetch(`https://api.cricapi.com/v1/match_info?apikey=${cricKey}&id=${req.params.id}`);
      const data = await r.json();
      if (data.status === 'success') return res.json(data);
    }
    // Fallback to Cricbuzz
    const r2 = await fetch(`${BASE}/cricket-match-info?matchid=${req.params.id}`, { headers: headers() });
    const data2 = await r2.json();
    res.json(data2);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/ratios ─────────────────────────────────────────────────────────
app.get('/api/ratios', (req, res) => res.json(db.getAllRatios()));

// ─── POST /api/admin/ratio ───────────────────────────────────────────────────
app.post('/api/admin/ratio', requireAdmin, (req, res) => {
  const { teamName, ratio } = req.body;
  if (!teamName || ratio === undefined) return res.status(400).json({ error: 'teamName and ratio required' });
  db.setRatio(teamName, String(ratio).trim());
  res.json({ success: true, teamName, ratio });
});

// ─── GET /api/admin/verify ───────────────────────────────────────────────────
app.get('/api/admin/verify', requireAdmin, (req, res) => res.json({ authenticated: true }));

app.get('/ping', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`IPL 2026 backend running on http://localhost:${PORT}`);
  console.log(`RapidAPI key: ${RAPID_KEY ? 'loaded ✓' : 'MISSING — set RAPID_API_KEY in .env'}`);

  // Keep Render free tier alive — ping self every 10 minutes
  const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  setInterval(async () => {
    try {
      await fetch(`${SELF_URL}/ping`);
      console.log(`[keep-alive] pinged at ${new Date().toISOString()}`);
    } catch (e) {
      console.log('[keep-alive] ping failed:', e.message);
    }
  }, 10 * 60 * 1000); // every 10 minutes
});
