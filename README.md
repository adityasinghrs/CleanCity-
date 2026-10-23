# ♻️ CleanCity v6 — Smart Garbage Management System

A full-stack web app where citizens report garbage problems with a **photo + GPS location**, the community **upvotes** them, and admins **prioritise, track and resolve** them with proof photos.

**Stack:** React 19 · Node.js / Express · MongoDB Atlas (Mongoose) · JWT auth · Leaflet maps

> Live demo: _add your deployed link here_ &nbsp;|&nbsp; Screenshots: _add to `docs/` and link here_

---

## Features

| # | Feature | How it works |
|---|---|---|
| 1 | **Smart priority score** | category severity + community upvotes + days open → High / Medium / Low; admin list is auto-sorted |
| 2 | **Duplicate detection** | MongoDB `$near` geo-query finds same-category open issues within 150 m and offers a "Me too" upvote |
| 3 | **Public tracking ID** | `GMS-XXXXXX`; anyone can track progress without logging in |
| 4 | **Status timeline** | every change (who, when, note) is stored in the complaint's history |
| 5 | **Before / After proof** | admin uploads a cleanup photo when resolving |
| 6 | **Community feed + Eco-Points** | +10 report · +2 per upvote received · +20 when resolved (first time only) |
| 7 | **Map view** *(new)* | Leaflet + OpenStreetMap; pins coloured by priority on the community page and admin dashboard |
| 8 | **Admin analytics** | MongoDB aggregation: by category, last 7 days, average resolution time; CSV export |
| 9 | **Server-side search, filter & pagination** *(new)* | admin list handles large data (12 per page, search by title / ID / location / category / user) |
| 10 | **Change password** | `/profile` page |
| 11 | ⭐ **Hotspot Intelligence** *(unique, v5)* | DBSCAN clustering of all reports + recurrence detection (cleaned, then dumped again) → Critical/High/Watch hotspots with a recommended fix, shown on the admin map |
| 12 | **SLA tracking & escalation** *(v5)* | per-category deadline (24-120 h), overdue badge and filter, promise shown on the public Track page |
| 13 | **Photo fingerprint** *(v5)* | browser-side dHash flags look-alike photos nearby (duplicate) and "after" photos identical to "before" (fake proof) |
| 14 | **Demo seeder** *(v5)* | `npm run seed` loads demo data that shows hotspots and overdue items |
| 15 | ⭐ **Smart Crew Route Planner** *(unique, v6)* | picks the most urgent open complaints (priority + overdue SLA + hotspot) and orders them into a short route by minimising urgency-weighted latency (greedy + 2-opt); shows % less driving and % sooner urgent work vs priority order |
| 16 | **Public Transparency page** *(v6)* | `/transparency`: resolution rate, SLA compliance, overdue count, average time. No login |

More detail: [docs/FEATURES_V6.md](docs/FEATURES_V6.md) · [docs/FEATURES_V5.md](docs/FEATURES_V5.md) · [docs/LITERATURE_SURVEY.md](docs/LITERATURE_SURVEY.md)

## Architecture

```
React (CRA)  ──axios + JWT──▶  Express API  ──Mongoose──▶  MongoDB Atlas
 pages, MapView                routes, validation,          users · complaints · images
                               helmet, rate limit           (photos stored as binary)
```

```
backend/
  app.js            Express app (helmet, CORS, rate limits, error handler) – exported for tests
  server.js         DB connection, index sync, admin seeding, app.listen
  routes/           authRoutes.js, complaintRoutes.js
  middleware/       auth.js (JWT, admin guard, async wrapper, id validation)
  models/           User, Complaint (2dsphere index), Image
  utils/            priority.js, sla.js, hotspot.js, route.js, publicStats.js, validate.js, image.js
  tests/            Jest + Supertest
frontend/src/       pages/, components/ (MapView, Timeline, BeforeAfter …), AuthContext, api.js
```

## Setup

### 1. MongoDB Atlas (free)
1. Create a free **M0** cluster at https://www.mongodb.com/cloud/atlas (region: Mumbai / AWS ap-south-1).
2. **Database Access** → add a user (username + password).
3. **Network Access** → allow your IP (or `0.0.0.0/0` for a demo only).
4. **Connect → Drivers** → copy the connection string.

### 2. Backend
```bash
cd backend
cp .env.example .env        # Windows: copy .env.example .env
```
Edit `.env`:
- `MONGO_URI` – your Atlas string (replace `<db_password>`; URL-encode special characters; keep `/garbageDB` before the `?`)
- `JWT_SECRET` – **required**, min 16 chars. Generate one:
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` – **required** to create the first admin (min 8 chars; choose a strong one)

```bash
npm install
npm start                   # http://localhost:5000  → "DB Connected (...mongodb.net)"
```
The server refuses to start without a valid `JWT_SECRET`.

### 3. Frontend
```bash
cd frontend
cp .env.example .env        # REACT_APP_API_URL=http://localhost:5000
npm install
npm start                   # http://localhost:3000
```
Log in as the admin with the credentials from your `.env`. Everyone else uses **Sign up**.

## API overview

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` · `/login` | public (rate-limited) | create account / get JWT |
| GET | `/api/auth/me` | user | current profile + points |
| PUT | `/api/auth/change-password` | user | change password |
| GET | `/api/auth/leaderboard` | public | top 5 Eco-Points |
| POST | `/api/complaint` | user | report issue (multipart: title, category, location, lat, lng, image) |
| GET | `/api/complaint/nearby` | user | duplicates within 150 m |
| GET | `/api/complaint/feed` | public | open issues by priority (with coordinates) |
| GET | `/api/complaint/track/:tid` | public | track by ID |
| POST | `/api/complaint/:id/upvote` | user | toggle upvote |
| GET | `/api/complaint/mine` | user | my complaints |
| GET | `/api/complaint?page&limit&status&q` | admin | paginated, searchable list |
| GET | `/api/complaint/stats` · `/map` | admin | analytics / map pins |
| GET | `/api/complaint/hotspots?radius=100&min=3` | admin | clustered hotspots with score and recommendation |
| GET | `/api/complaint?sla=overdue` | admin | only SLA-breached complaints |
| GET | `/api/complaint/route?stops=8&lat=&lng=` | admin | urgency-weighted crew route (lat/lng optional start point) |
| GET | `/api/complaint/public-stats` | public | transparency numbers, no personal data |
| PUT | `/api/complaint/:id` | admin | status, note, proof photo |
| DELETE | `/api/complaint/:id` | admin | delete complaint + photos |
| GET | `/api/image/:id` | public | serve stored photo |
| GET | `/api/health` | public | health check |

## Security measures
- Passwords hashed with **bcrypt**; JWT (7 days); role is never accepted from the client, so nobody can self-register as admin
- **No fallback secrets**: server won't start without `JWT_SECRET`; no default admin password
- **helmet** security headers · **rate limiting** (20 login/register attempts per 15 min per IP, 600 API requests per 15 min)
- Input validation on every write endpoint (lengths, enum category, GPS range, password strength 8+ with letter and number), non-string login payloads rejected (NoSQL-injection guard), `:id` params validated
- Uploads: 5 MB limit, **real file type checked from the file's bytes** (JPEG / PNG / WebP only), stored as binary, never executed
- CSV export neutralises spreadsheet formula injection; popups on the map escape HTML (XSS)
- Eco-Points can't be farmed (points reversed on un-upvote; resolve bonus only once)
- Central error handler: failures return JSON, never crash the server

Known trade-off: the JWT is kept in `localStorage` (simple for an SPA, but exposed to XSS); an httpOnly cookie would be the next step.

## Tests
```bash
cd backend
npm test
```
Jest + Supertest cover the priority score, password/complaint validation, image-type detection, auth guards (401/403), forged tokens, NoSQL-injection attempt, fake image upload, and bad-id handling. They need **no database**. GitHub Actions (`.github/workflows/ci.yml`) runs the backend tests and a frontend build on every push.

## Deploy (free tier)
1. **Database** – MongoDB Atlas M0 (see Setup). Network Access → `0.0.0.0/0` (Render's IPs change).
2. **Backend on Render** – New → *Blueprint* → choose this repo (uses `render.yaml`), or New → Web Service with root `backend`, build `npm install`, start `npm start`. Set `MONGO_URI`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `NODE_ENV=production`, and `JWT_SECRET` (auto-generated by the blueprint). Leave `CLIENT_URL` empty for now. Test `https://<api>.onrender.com/api/health`.
3. **Frontend on Vercel** – Add New Project → import the repo → *Root Directory* `frontend` → env `REACT_APP_API_URL=https://<api>.onrender.com` (no trailing slash) → Deploy. `vercel.json` already handles page refreshes.
4. **CORS** – back on Render set `CLIENT_URL=https://<your-app>.vercel.app` and redeploy the backend.
5. Put the Vercel link at the top of this README. The first request after idle takes ~30-60 s on Render's free plan (cold start).

## Roadmap
Photo-based category suggestion (TACO / TrashNet-style model) · Email / SMS notifications on status change · forgot-password by email · staff/worker accounts · image compression before upload · move photos to object storage (S3/Cloudinary) at scale · httpOnly-cookie auth.

## Push to GitHub
```bash
git init
git add .
git status                  # make sure .env and node_modules are NOT listed
git commit -m "CleanCity v6"
git branch -M main
git remote add origin https://github.com/<your-username>/cleancity.git
git push -u origin main
```
Use a Personal Access Token as the password (or `gh auth login`).

## License
MIT — see [LICENSE](LICENSE).
