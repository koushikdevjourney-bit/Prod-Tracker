# Productivity Tracker (Pulse)

MEAN-stack personal productivity tracker.

## Structure

- `frontend/` — Angular app (Vercel)
- `backend/` — Express + MongoDB API (Render): https://prod-tracker.onrender.com/

## Local development

```bash
# Backend
cd backend
cp .env.example .env   # fill MONGODB_URI, JWT_SECRET
npm install
npm run dev

# Frontend (API → http://localhost:5000)
cd frontend
npm install
npm start
```

## Production API

Frontend production builds call:

`https://prod-tracker.onrender.com/api`

## Deploy frontend on Vercel

1. Push this repo to GitHub (already: `koushikdevjourney-bit/Prod-Tracker`).
2. [vercel.com](https://vercel.com) → **Add New Project** → import that repo.
3. Configure:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Other
   - **Build Command:** `npm run build` (from `vercel.json`)
   - **Output Directory:** `dist/prod-tracker/browser`
4. Deploy.
5. Copy the Vercel URL (e.g. `https://prod-tracker.vercel.app`).
6. On **Render** → backend → Environment, set:

   `CLIENT_ORIGIN=https://your-vercel-url.vercel.app`

   (no trailing slash; add more origins comma-separated if needed)

7. Redeploy the Render service (or wait for restart) so CORS picks up the new origin.
8. Open the Vercel URL → Register / Login.

### Atlas

In MongoDB Atlas → Network Access, allow access from anywhere (`0.0.0.0/0`) or Render’s IPs so the API can connect.
