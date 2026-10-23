// Smart Crew Route Planner (v6 unique feature).
// Problem: a cleanup crew can visit only a few places per shift. Which complaints should it pick,
// and in what ORDER, so urgent ones are reached first without driving all over the city?
//
// Model: Minimum-Latency (travelling-repairman) problem. We minimise  sum( urgency_i * distance travelled before reaching stop i ).
// Urgent stops get a big weight, so they move to the front; far-apart stops pay a distance cost.
// Heuristic: greedy "urgency per distance" construction, then 2-opt improvement. Pure functions, no DB.

const { haversine } = require("./hotspot");

// Urgency = smart priority score + SLA breach bonus + "sits inside a chronic hotspot" bonus
const OVERDUE_BONUS = 40;
const HOTSPOT_BONUS = { Critical: 25, High: 15, Watch: 8 };

function urgencyOf(c, hotspots = []) {
  let u = c.priority || 0;
  if (c.sla?.overdue) u += OVERDUE_BONUS;
  const ll = [c.coords.coordinates[1], c.coords.coordinates[0]];
  let bonus = 0;
  for (const h of hotspots) {
    if (haversine([h.center.lat, h.center.lng], ll) <= h.radius) bonus = Math.max(bonus, HOTSPOT_BONUS[h.level] || 0);
  }
  return Math.max(1, u + bonus); // never 0, otherwise a stop would carry no weight
}

const legDistances = (order, pts, start) => {
  const d = [];
  let prev = start;
  for (const i of order) { d.push(haversine(prev, pts[i])); prev = pts[i]; }
  return d;
};
const total = (d) => d.reduce((s, x) => s + x, 0);

// weighted latency of a visiting order = sum(urgency * distance already driven when arriving)
function latency(order, pts, urg, start) {
  let run = 0, cost = 0, prev = start;
  for (const i of order) { run += haversine(prev, pts[i]); cost += urg[i] * run; prev = pts[i]; }
  return cost;
}

// Greedy construction: from where we are, go to the stop with the best urgency / (distance + 200 m)
function greedyOrder(pts, urg, start) {
  const left = new Set(pts.map((_, i) => i));
  const order = [];
  let cur = start;
  while (left.size) {
    let best = -1, bestScore = -Infinity;
    for (const i of left) {
      const s = urg[i] / (haversine(cur, pts[i]) + 200);
      if (s > bestScore) { bestScore = s; best = i; }
    }
    order.push(best); left.delete(best); cur = pts[best];
  }
  return order;
}

// 2-opt: reverse a segment of the route whenever that lowers the weighted latency
function twoOpt(order, pts, urg, start) {
  let best = [...order], bestCost = latency(best, pts, urg, start), improved = true, guard = 0;
  while (improved && guard++ < 50) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const cand = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)];
        const cost = latency(cand, pts, urg, start);
        if (cost < bestCost - 1e-9) { best = cand; bestCost = cost; improved = true; }
      }
    }
  }
  return best;
}

// complaints: decorated OPEN complaints (priority, sla, coords). hotspots: output of detectHotspots.
// opts: maxStops (1-15), depot {lat,lng} optional, speedKmh, minutesPerStop
function planRoute(complaints, { maxStops = 8, depot, hotspots = [], speedKmh = 20, minutesPerStop = 15 } = {}) {
  const open = complaints.filter((c) => c.status !== "Resolved" && c.coords?.coordinates?.length === 2);
  const scored = open.map((c) => ({ c, u: urgencyOf(c, hotspots) })).sort((a, b) => b.u - a.u).slice(0, Math.max(1, maxStops));
  if (!scored.length) return { stops: [], totalKm: 0, etaMinutes: 0, considered: open.length, baseline: null, improvement: null };

  const pts = scored.map(({ c }) => [c.coords.coordinates[1], c.coords.coordinates[0]]);
  const urg = scored.map((s) => s.u);
  // no depot given: the crew starts at the most urgent stop (that stop is then visited first, distance 0)
  const start = depot && Number.isFinite(depot.lat) && Number.isFinite(depot.lng) ? [depot.lat, depot.lng] : pts[0];

  // Baseline = what an admin would do without the planner: visit in plain priority order
  const naive = pts.map((_, i) => i);
  // improve from two starting points (greedy and plain priority order) and keep the better one,
  // so the plan can never be worse than the priority-order baseline in urgency-weighted latency
  const candidates = [twoOpt(greedyOrder(pts, urg, start), pts, urg, start), twoOpt(naive, pts, urg, start)];
  const order = candidates.sort((a, b) => latency(a, pts, urg, start) - latency(b, pts, urg, start))[0];

  const legs = legDistances(order, pts, start);
  const naiveLegs = legDistances(naive, pts, start);
  const kmOf = (m) => Math.round((m / 1000) * 100) / 100;
  const metresPerMin = (speedKmh * 1000) / 60;

  let cum = 0;
  const stops = order.map((idx, k) => {
    cum += legs[k];
    const { c, u } = scored[idx];
    return {
      order: k + 1, trackingId: c.trackingId, title: c.title, category: c.category, level: c.level,
      overdue: !!c.sla?.overdue, urgency: Math.round(u), location: c.location,
      lat: pts[idx][0], lng: pts[idx][1],
      legMeters: Math.round(legs[k]), cumulativeMeters: Math.round(cum),
      etaMinutes: Math.round(cum / metresPerMin + k * minutesPerStop), // drive time so far + work time at earlier stops
    };
  });

  const baseKm = kmOf(total(naiveLegs)), planKm = kmOf(total(legs));
  const baseLat = latency(naive, pts, urg, start), planLat = latency(order, pts, urg, start);
  const pct = (a, b) => (a > 0 ? Math.max(0, Math.round(((a - b) / a) * 100)) : 0);
  return {
    stops,
    totalKm: planKm,
    etaMinutes: stops.length ? stops[stops.length - 1].etaMinutes + minutesPerStop : 0,
    considered: open.length,
    baseline: { km: baseKm },
    // distance saved vs priority order, and how much sooner (on average) urgent work is reached
    improvement: { distancePct: pct(baseKm, planKm), urgencyDelayPct: pct(baseLat, planLat) },
  };
}

module.exports = { urgencyOf, latency, greedyOrder, twoOpt, planRoute };
