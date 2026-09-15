# Backend

Express + MongoDB API for Pulse Productivity Tracker.

## Setup

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

CORS allows `http://localhost:4200`.
