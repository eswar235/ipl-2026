// In production this points to your Railway backend URL
// Set VITE_API_URL in Vercel environment variables
const BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL + '/api'
  : '/api'; // fallback to proxy for local dev

export async function fetchMatches() {
  const res = await fetch(`${BASE}/matches`);
  if (!res.ok) throw new Error(`Failed to fetch matches: ${res.status}`);
  return res.json();
}

export async function fetchLive() {
  const res = await fetch(`${BASE}/live`);
  if (!res.ok) throw new Error(`Failed to fetch live: ${res.status}`);
  return res.json();
}

export async function fetchMatchScore(id) {
  const res = await fetch(`${BASE}/match/${id}/score`);
  if (!res.ok) throw new Error(`Failed to fetch score: ${res.status}`);
  return res.json();
}

export async function fetchRatios() {
  const res = await fetch(`${BASE}/ratios`);
  if (!res.ok) throw new Error('Failed to fetch ratios');
  return res.json();
}

export async function verifyAdmin(secret) {
  const res = await fetch(`${BASE}/admin/verify`, {
    headers: { 'x-admin-secret': secret }
  });
  return res.ok;
}

export async function saveRatio(teamName, ratio, secret) {
  const res = await fetch(`${BASE}/admin/ratio`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': secret
    },
    body: JSON.stringify({ teamName, ratio })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to save ratio');
  }
  return res.json();
}
