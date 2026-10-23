// Hotspot Intelligence: finds chronic garbage spots by clustering complaint locations (DBSCAN) and
// scoring how often a place relapses after being cleaned (the "recurrence" signal).
// Pure functions only (no DB access) so they are easy to unit-test.

const R = 6371000; // Earth radius in metres
const rad = (d) => (d * Math.PI) / 180;

// Great-circle distance between two [lat, lng] points, in metres
function haversine(a, b) {
  const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// DBSCAN (Ester et al., 1996). points: [[lat, lng], ...]. Returns an array of clusters (arrays of point indexes).
// Points that do not belong to any dense group are noise and are left out.
function dbscan(points, epsMeters = 100, minPts = 3) {
  const n = points.length;
  const label = new Array(n).fill(undefined); // undefined = unvisited, -1 = noise, >=0 = cluster id
  const neighbours = (i) => {
    const out = [];
    for (let j = 0; j < n; j++) if (haversine(points[i], points[j]) <= epsMeters) out.push(j);
    return out;
  };
  let id = 0;
  for (let i = 0; i < n; i++) {
    if (label[i] !== undefined) continue;
    const seeds = neighbours(i);
    if (seeds.length < minPts) { label[i] = -1; continue; }
    label[i] = id;
    for (let k = 0; k < seeds.length; k++) {
      const j = seeds[k];
      if (label[j] === -1) label[j] = id; // border point, was noise
      if (label[j] !== undefined) continue;
      label[j] = id;
      const nb = neighbours(j);
      if (nb.length >= minPts) for (const x of nb) if (!seeds.includes(x)) seeds.push(x);
    }
    id++;
  }
  const clusters = Array.from({ length: id }, () => []);
  label.forEach((l, i) => { if (l >= 0) clusters[l].push(i); });
  return clusters;
}

// A "recurrence" = a new complaint filed at a spot AFTER an earlier complaint there was resolved.
// That means the cleanup did not last, which is the strongest sign of a chronic hotspot.
function countRecurrences(items) {
  const sorted = [...items].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  let n = 0;
  sorted.forEach((c, i) => {
    const t = new Date(c.createdAt).getTime();
    if (sorted.slice(0, i).some((p) => p.resolvedAt && new Date(p.resolvedAt).getTime() <= t)) n++;
  });
  return n;
}

const ACTIONS = {
  "Illegal Dumping": "Enforcement problem: put up warning signage, add CCTV / night patrol and fine repeat offenders.",
  "Overflowing Bin": "Capacity problem: add more bins or increase the pickup frequency here.",
  "Missed Pickup": "Route gap: review the collection route and schedule for this street.",
  "Hazardous Waste": "Safety risk: send a specialised hazardous-waste team and inform the pollution board.",
  Other: "Inspect on site and decide on a permanent fix.",
};

function recommend(dominant, recurrences) {
  const base = ACTIONS[dominant] || ACTIONS.Other;
  return recurrences >= 2 ? `Chronic spot (cleaned ${recurrences}x, came back). ${base}` : base;
}

// complaints: plain objects with coords.coordinates [lng, lat], category, status, createdAt, resolvedAt
function detectHotspots(complaints, { epsMeters = 100, minPts = 3 } = {}) {
  const located = complaints.filter((c) => c.coords?.coordinates?.length === 2);
  const pts = located.map((c) => [c.coords.coordinates[1], c.coords.coordinates[0]]);
  const spots = dbscan(pts, epsMeters, minPts).map((idxs) => {
    const items = idxs.map((i) => located[i]);
    const lat = idxs.reduce((s, i) => s + pts[i][0], 0) / idxs.length;
    const lng = idxs.reduce((s, i) => s + pts[i][1], 0) / idxs.length;
    const radius = Math.max(40, ...idxs.map((i) => haversine([lat, lng], pts[i]))) + 15;
    const tally = {};
    items.forEach((c) => { tally[c.category] = (tally[c.category] || 0) + 1; });
    const dominant = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];
    const open = items.filter((c) => c.status !== "Resolved").length;
    const recurrences = countRecurrences(items);
    const hazardous = tally["Hazardous Waste"] || 0;
    const score = items.length * 4 + open * 8 + recurrences * 15 + hazardous * 10;
    const level = score >= 60 ? "Critical" : score >= 35 ? "High" : "Watch";
    return {
      center: { lat: +lat.toFixed(6), lng: +lng.toFixed(6) },
      radius: Math.round(radius),
      total: items.length, open, resolved: items.length - open, recurrences,
      dominantCategory: dominant, categories: tally, score, level,
      sampleLocation: items[0].location,
      trackingIds: items.map((c) => c.trackingId).slice(0, 8),
      recommendation: recommend(dominant, recurrences),
    };
  });
  return spots.sort((a, b) => b.score - a.score);
}

module.exports = { haversine, dbscan, countRecurrences, detectHotspots };
