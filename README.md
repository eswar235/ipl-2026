# IPL 2026 Live Schedule Website

Real-time IPL 2026 schedule, live scores, and admin ratio management.

## Setup

### 1. Get a free Cricket API key
Sign up at **https://cricketdata.org** (formerly CricAPI) — free tier available.

### 2. Configure backend
```
cd backend
cp .env.example .env
# Edit .env and set your CRICKET_API_KEY and ADMIN_SECRET
npm install
npm start
```

### 3. Run frontend
```
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

---

## Admin Panel
Click the ⚙ Admin button → enter your `ADMIN_SECRET` from `.env` → set ratios per team.

Ratios are stored in `backend/ipl2026.db` (SQLite) and shown beside team names on match cards.

## API Endpoints (backend :3001)
| Endpoint | Description |
|---|---|
| `GET /api/matches` | All IPL 2026 matches with ratios |
| `GET /api/live` | Currently live matches |
| `GET /api/match/:id/score` | Live score for a match |
| `GET /api/ratios` | All stored team ratios |
| `POST /api/admin/ratio` | Set ratio (requires x-admin-secret header) |

## Auto-refresh
- Match list refreshes every **5 minutes**
- Live match scores refresh every **30 seconds**
