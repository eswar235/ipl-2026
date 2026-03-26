// Pure Node.js JSON database — no native modules needed
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'ipl2026.json');

function load() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ team_ratios: {}, cached_matches: [] }, null, 2));
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return { team_ratios: {}, cached_matches: [] };
  }
}

function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

module.exports = {
  getRatios: () => load().team_ratios || {},

  setRatio: (teamName, ratio) => {
    const data = load();
    data.team_ratios[teamName] = ratio;
    save(data);
  },

  getAllRatios: () => {
    const ratios = load().team_ratios || {};
    return Object.entries(ratios).map(([team_name, ratio]) => ({ team_name, ratio }));
  },

  // Cache IPL matches so they persist between restarts
  cacheMatches: (matches) => {
    const data = load();
    // Merge by id
    const map = {};
    for (const m of (data.cached_matches || [])) map[m.id] = m;
    for (const m of matches) map[m.id] = m;
    data.cached_matches = Object.values(map);
    save(data);
  },

  getCachedMatches: () => load().cached_matches || [],
};
