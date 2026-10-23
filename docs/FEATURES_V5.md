# What is new in v5

## ⭐ Unique feature: Hotspot Intelligence (Admin → 🔥 Hotspots)
1. All located complaints (open **and resolved**) are clustered with **DBSCAN** (default 100 m radius, 3+ reports; radius slider on the dashboard).
2. For each cluster the system counts **recurrences**: reports filed *after* an earlier report at the same spot was resolved, meaning the cleanup did not last.
3. A score = `reports×4 + open×8 + recurrences×15 + hazardous×10` gives **Critical / High / Watch**.
4. A rule-based recommendation depends on the dominant category: Illegal Dumping → signage/CCTV/patrol; Overflowing Bin → more bins or pickups; Missed Pickup → fix the route; Hazardous → specialist team. Chronic spots are labelled as such.
5. Hotspots are drawn as dashed circles on the map.
Code: `backend/utils/hotspot.js`, route `GET /api/complaint/hotspots`, UI in `frontend/src/pages/Admin.js`.

## Other additions
| Feature | Where | What it does |
|---|---|---|
| **SLA tracking and escalation** | `utils/sla.js`, badges on Feed/Track/Admin | Hazardous 24 h, Illegal Dumping / Overflowing Bin 48 h, Missed Pickup 72 h, Other 120 h. Overdue complaints show a red badge; admin has an **⏰ Overdue** filter; citizens see the promised time on the Track page; CSV has SLA columns. |
| **Photo fingerprint (dHash)** | `utils/phash.js` (server), `frontend/src/utils/phash.js` (browser) | Browser computes a 64-bit hash of the photo. If a nearby report has a look-alike photo the user is warned ("photo looks the same") and admin sees a *possible duplicate* note. |
| **Proof-of-cleanup check** | `PUT /api/complaint/:id` | If the admin's "after" photo is almost identical to the original photo, the complaint is flagged for on-site verification. |
| **Demo data seeder** | `backend/seed.js` | `npm run seed` creates demo citizens and complaints that form a chronic hotspot, a fresh hotspot and overdue items. |
| **Deploy configs** | `render.yaml`, `frontend/vercel.json`, `frontend/public/_redirects` | One-click Render blueprint and SPA routing for Vercel/Netlify. |
| **14 new tests** | `backend/tests/features.test.js`, `hotspotRoute.test.js` | Cover clustering, recurrence, SLA maths, hash distance and the hotspot route. |

## Viva talking points
- *Why DBSCAN and not k-means?* No need to guess the number of hotspots, it ignores isolated reports as noise, and clusters can be any shape (a long street).
- *Why a hash instead of storing/comparing images?* Cheap (16 bytes), computed in the browser, tolerant to resizing/compression.
- *Limits (be honest):* the photo hash is a screening aid, not proof; a determined user can edit a photo. Recommendations are rule-based, not learned. Hotspot quality depends on how many people report.
