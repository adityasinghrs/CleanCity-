# What is new in v6

## ⭐ Unique feature: Smart Crew Route Planner (Admin → 🚚 Crew Route)
**Problem:** a cleanup crew can do only a few jobs per shift. Which complaints first, and in what order?

1. **Urgency score** per open complaint = smart priority score (category + upvotes + age) **+ 40 if the SLA deadline is already missed** **+ 8 / 15 / 25 if the spot lies inside a Watch / High / Critical hotspot** (from v5 Hotspot Intelligence).
2. The **top N** (2-15, default 8) complaints with GPS become the stops.
3. The visiting order minimises the **urgency-weighted latency**: `sum(urgency x distance driven before reaching the stop)` (Minimum Latency / travelling-repairman problem, Blum et al. 1994). Urgent stops move to the front, far-apart stops cost distance.
4. Heuristic: greedy "urgency per distance" construction, then **2-opt** segment reversal (Croes, 1958); also started from plain priority order, and the better result is kept, so the plan is never worse than priority order in urgency-weighted delay.
5. Output: numbered route on the map, per-stop leg distance and ETA, total km, crew hours, and two measurable numbers for your report: **% less driving than priority order** and **% sooner urgent work is reached**.
6. Optional **start from my location** (browser GPS) uses the admin's position as depot.

Code: `backend/utils/route.js`, route `GET /api/complaint/route?stops=8&lat=&lng=`, UI in `frontend/src/pages/Admin.js`, map drawing in `MapView.js`. Tests: `backend/tests/route.test.js`, `routeEndpoint.test.js`.

## Other additions
| Feature | Where | What it does |
|---|---|---|
| **Public Transparency page** | `/transparency`, `GET /api/complaint/public-stats`, `utils/publicStats.js` | Anyone can see total reports, % resolved, % resolved within the promised SLA, overdue count, average resolution time, reports by category. No personal data or locations are exposed. |
| **CORS hardening** | `backend/app.js` | A trailing slash in `CLIENT_URL` (a common deployment mistake) no longer breaks the browser-to-API connection. |

## Viva talking points
- *Why not just sort by priority?* Priority order ignores geography; the crew would zig-zag. The planner trades a little urgency for a lot less driving, and the Blum-style cost keeps urgent jobs early.
- *Why not Google Maps / OSRM?* Needs an API key and network calls. Straight-line (haversine) distance is a documented approximation; road distances are listed as future work.
- *Is 2-opt optimal?* No, it is a heuristic, but for 15 stops it is instant and the plan is guaranteed not to be worse than the naive order on the cost it optimises.
- *Limits (be honest):* straight-line distances, one crew, no vehicle capacity, assumed 20 km/h and 15 min per stop.
