const { planRoute, urgencyOf, latency } = require("../utils/route");
const { publicStats } = require("../utils/publicStats");
const { haversine } = require("../utils/hotspot");

// helper: a decorated open complaint at (12.97 + dLat, 77.59 + dLng)
const mk = (id, dLat, dLng, priority, overdue = false, extra = {}) => ({
  trackingId: `GMS-${id}`, title: `T${id}`, category: "Overflowing Bin", status: "Pending", level: "Medium", location: "x",
  priority, sla: { overdue }, coords: { type: "Point", coordinates: [77.59 + dLng, 12.97 + dLat] }, ...extra,
});

test("overdue and hotspot bonuses raise urgency", () => {
  const a = mk(1, 0, 0, 30), b = mk(2, 0, 0, 30, true);
  expect(urgencyOf(b)).toBe(urgencyOf(a) + 40);
  const hs = [{ center: { lat: 12.97, lng: 77.59 }, radius: 100, level: "Critical" }];
  expect(urgencyOf(a, hs)).toBe(55);
});

test("empty / resolved / unlocated input gives an empty plan", () => {
  expect(planRoute([]).stops).toHaveLength(0);
  expect(planRoute([mk(1, 0, 0, 10, false, { status: "Resolved" })]).stops).toHaveLength(0);
  expect(planRoute([{ ...mk(1, 0, 0, 10), coords: undefined }]).stops).toHaveLength(0);
});

test("respects maxStops and keeps the most urgent complaints", () => {
  const items = [mk(1, 0, 0, 10), mk(2, 0.01, 0, 90), mk(3, 0.02, 0, 80), mk(4, 0.03, 0, 5)];
  const plan = planRoute(items, { maxStops: 2 });
  expect(plan.stops).toHaveLength(2);
  expect(plan.stops.map((s) => s.trackingId).sort()).toEqual(["GMS-2", "GMS-3"]);
  expect(plan.considered).toBe(4);
});

test("on a zig-zag example the plan drives less than priority order and visits every stop once", () => {
  // urgent items zig-zag across the city, so priority order wastes driving
  const items = [mk(1, 0, 0, 90), mk(2, 0.05, 0.05, 85), mk(3, 0.001, 0.001, 80), mk(4, 0.051, 0.049, 75), mk(5, 0.002, 0, 70)];
  const plan = planRoute(items, { maxStops: 5 });
  expect(new Set(plan.stops.map((s) => s.trackingId)).size).toBe(5);
  expect(plan.totalKm).toBeLessThanOrEqual(plan.baseline.km);
  expect(plan.improvement.distancePct).toBeGreaterThan(0);
  expect(plan.stops[0].etaMinutes).toBe(0);
  // cumulative distance grows along the route
  plan.stops.forEach((s, i) => { if (i) expect(s.cumulativeMeters).toBeGreaterThanOrEqual(plan.stops[i - 1].cumulativeMeters); });
});

test("urgency-weighted delay is never worse than priority order", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const r = (k) => ((Math.sin(seed * 97 + k * 13) + 1) / 2) * 0.05;
    const items = [...Array(7)].map((_, i) => mk(i, r(i), r(i + 50), 10 + ((seed * 7 + i * 11) % 80)));
    expect(planRoute(items, { maxStops: 7 }).improvement.urgencyDelayPct).toBeGreaterThanOrEqual(0);
  }
});

test("a depot makes the first leg start from the depot", () => {
  const items = [mk(1, 0.02, 0, 60)];
  const plan = planRoute(items, { depot: { lat: 12.97, lng: 77.59 } });
  const expected = Math.round(haversine([12.97, 77.59], [12.99, 77.59]));
  expect(plan.stops[0].legMeters).toBe(expected);
});

test("weighted latency prefers visiting the urgent stop first", () => {
  const pts = [[12.97, 77.59], [12.971, 77.59]];
  const start = [12.9705, 77.59];
  expect(latency([1, 0], pts, [1, 100], start)).toBeLessThan(latency([0, 1], pts, [1, 100], start));
});

test("publicStats counts and SLA compliance", () => {
  const day = 864e5, now = Date.now();
  const rows = [
    { category: "A", status: "Resolved", createdAt: new Date(now - 3 * day), resolvedAt: new Date(now - 2 * day) },
    { category: "A", status: "Pending", createdAt: new Date(now - 10 * day) },
    { category: "B", status: "Pending", createdAt: new Date(now) },
  ].map((c) => ({ ...c, sla: { overdue: c.status !== "Resolved" && now - c.createdAt > 5 * day, metSla: c.status === "Resolved" ? true : null } }));
  const s = publicStats(rows);
  expect(s.total).toBe(3); expect(s.resolved).toBe(1); expect(s.open).toBe(2); expect(s.overdue).toBe(1);
  expect(s.resolutionRatePct).toBe(33); expect(s.slaComplianceOfResolvedPct).toBe(100); expect(s.avgResolutionHours).toBe(24);
  expect(publicStats([]).resolutionRatePct).toBeNull();
});
