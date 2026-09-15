# Backend

Express + MongoDB API for Pulse Productivity Tracker.

## Setup (local)

1. Copy `.env.example` to `.env` and fill in `MONGODB_URI` and `JWT_SECRET`.
2. Install deps: `npm install`
3. Run: `npm run dev` (or `npm start`)

API defaults to `http://localhost:5000`.

## Auth endpoints

| Method | Path | Auth | Body |
|--------|------|------|------|
| POST | `/api/auth/register` | — | `{ name, email, password }` |
| POST | `/api/auth/login` | — | `{ email, password }` |
| GET | `/api/auth/me` | Bearer JWT | — |
| GET | `/api/health` | — | — |

## Deploy on Render

1. Create a **Web Service** from this repo.
2. Set **Root Directory** to `backend`.
3. Build: `npm install` · Start: `npm start`.
4. Add **Environment** variables (Dashboard → Environment):

| Key | Example |
|-----|---------|
| `MONGODB_URI` | your Atlas connection string |
| `JWT_SECRET` | long random string (required) |
| `JWT_EXPIRES_IN` | `7d` |
| `NODE_ENV` | `production` |
| `CLIENT_ORIGIN` | your Vercel frontend URL(s), comma-separated |

Do **not** rely on a committed `.env` — Render does not ship one. Set vars in the dashboard.

After the Angular app is on Vercel, set e.g.:
`CLIENT_ORIGIN=https://your-app.vercel.app`

CORS allows `http://localhost:4200` plus any origins in `CLIENT_ORIGIN`.
