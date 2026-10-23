const { haversine, dbscan, countRecurrences, detectHotspots } = require("../utils/hotspot");
const { slaInfo, SLA_HOURS } = require("../utils/sla");
const { cleanHash, hamming } = require("../utils/phash");
const { decorate } = require("../utils/priority");

const BASE = [12.9716, 77.5946]; // any city centre; ~0.0001 deg lat is about 11 m
const at = (dLat, dLng = 0) => ({ type: "Point", coordinates: [BASE[1] + dLng, BASE[0] + dLat] });
const mk = (n, dLat, extra = {}) => ({
  trackingId: `GMS-${n}`, category: "Illegal Dumping", status: "Pending", location: "x",
  createdAt: new Date(Date.UTC(2026, 0, n)), coords: at(dLat), ...extra,
});

describe("hotspot detection (DBSCAN)", () => {
  test("haversine: 0.001 deg of latitude is about 111 m", () => {
    const d = haversine([0, 0], [0.001, 0]);
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });

  test("three reports within 100 m form one cluster; a far-away report is noise", () => {
    const pts = [[12.97160, 77.5946], [12.97165, 77.5946], [12.97170, 77.5946], [13.2, 77.9]];
    const clusters = dbscan(pts, 100, 3);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].sort()).toEqual([0, 1, 2]);
  });

  test("two reports are not enough when minPts is 3", () => {
    expect(dbscan([[12.9716, 77.5946], [12.97165, 77.5946]], 100, 3)).toHaveLength(0);
  });

  test("a chain of nearby reports is one cluster (density-reachable)", () => {
    const pts = [0, 1, 2, 3, 4, 5].map((i) => [12.9716 + i * 0.0005, 77.5946]); // ~55 m steps
    expect(dbscan(pts, 100, 3)).toHaveLength(1);
  });

  test("recurrence = new complaint after an earlier one was resolved", () => {
    const a = mk(1, 0, { status: "Resolved", resolvedAt: new Date(Date.UTC(2026, 0, 3)) });
    const b = mk(5, 0.00005);   // filed after a was resolved -> relapse
    const c = mk(2, 0.0001);    // filed before a was resolved -> not a relapse
    expect(countRecurrences([a, b, c])).toBe(1);
    expect(countRecurrences([mk(1, 0), mk(2, 0)])).toBe(0);
  });

  test("detectHotspots ranks, scores and recommends", () => {
    const resolved = mk(1, 0, { status: "Resolved", resolvedAt: new Date(Date.UTC(2026, 0, 2)) });
    const hot = [resolved, mk(5, 0.00005), mk(8, 0.0001), mk(9, 0.00008)];
    const cool = [mk(1, 0.05), mk(2, 0.05005), mk(3, 0.0501, { category: "Overflowing Bin" })];
    const lonely = [mk(1, 0.5)];
    const spots = detectHotspots([...cool, ...hot, ...lonely]);
    expect(spots).toHaveLength(2);
    expect(spots[0].total).toBe(4);
    expect(spots[0].recurrences).toBeGreaterThanOrEqual(2);
    expect(spots[0].score).toBeGreaterThan(spots[1].score);
    expect(spots[0].recommendation).toMatch(/Chronic spot/);
    expect(spots[0].recommendation).toMatch(/Enforcement/);
    expect(spots[1].dominantCategory).toBe("Illegal Dumping");
  });

  test("complaints without GPS are ignored", () => {
    expect(detectHotspots([{ category: "Other", status: "Pending", createdAt: new Date() }])).toEqual([]);
  });
});

describe("SLA tracking", () => {
  const now = Date.UTC(2026, 5, 10, 12);
  test("fresh complaint has time left; old one is overdue", () => {
    const fresh = slaInfo({ status: "Pending", category: "Missed Pickup", createdAt: now - 10 * 36e5 }, now);
    expect(fresh.overdue).toBe(false);
    expect(fresh.hoursLeft).toBe(SLA_HOURS["Missed Pickup"] - 10);
    const old = slaInfo({ status: "In Progress", category: "Hazardous Waste", createdAt: now - 30 * 36e5 }, now);
    expect(old.overdue).toBe(true);
    expect(old.hoursLeft).toBe(-6);
  });
  test("resolved complaints are never overdue and record whether the SLA was met", () => {
    const created = now - 100 * 36e5;
    const late = slaInfo({ status: "Resolved", category: "Illegal Dumping", createdAt: created, resolvedAt: now }, now);
    const ontime = slaInfo({ status: "Resolved", category: "Illegal Dumping", createdAt: created, resolvedAt: created + 10 * 36e5 }, now);
    expect(late.overdue).toBe(false);
    expect(late.metSla).toBe(false);
    expect(ontime.metSla).toBe(true);
  });
  test("decorate adds sla and hides the photo fingerprint", () => {
    const d = decorate({ status: "Pending", category: "Other", createdAt: new Date(), upvotes: [], photoHash: "ffffffffffffffff" });
    expect(d.sla.slaHours).toBe(SLA_HOURS.Other);
    expect(d.photoHash).toBeUndefined();
  });
});

describe("photo fingerprint (dHash)", () => {
  test("hamming distance counts differing bits", () => {
    expect(hamming("0000000000000000", "0000000000000000")).toBe(0);
    expect(hamming("0000000000000000", "ffffffffffffffff")).toBe(64);
    expect(hamming("0000000000000001", "0000000000000003")).toBe(1);
  });
  test("invalid hashes are rejected / treated as maximally different", () => {
    expect(cleanHash("xyz")).toBeUndefined();
    expect(cleanHash({ $ne: 1 })).toBeUndefined();
    expect(cleanHash(" ABCDEF0123456789 ")).toBe("abcdef0123456789");
    expect(hamming("nope", "0000000000000000")).toBe(64);
  });
});
