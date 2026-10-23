// Route-level test with the Complaint model mocked, so it still needs no database.
jest.mock("../models/Complaint", () => {
  const chain = { sort: () => chain, limit: () => chain, select: () => chain, lean: () => Promise.resolve(chain.rows) };
  return { find: jest.fn(() => chain), __chain: chain };
});
const request = require("supertest");
const jwt = require("jsonwebtoken");
const Complaint = require("../models/Complaint");
const app = require("../app");

const admin = jwt.sign({ id: "64b000000000000000000001", role: "admin", name: "A" }, process.env.JWT_SECRET);
const row = (n, dLat) => ({
  trackingId: `GMS-${n}`, category: "Overflowing Bin", status: "Pending", location: "MG Road",
  createdAt: new Date(), coords: { type: "Point", coordinates: [77.5946, 12.9716 + dLat] },
});

test("GET /hotspots clusters stored complaints and clamps query params", async () => {
  Complaint.__chain.rows = [row(1, 0), row(2, 0.00005), row(3, 0.0001), row(4, 0.4)];
  const res = await request(app).get("/api/complaint/hotspots?radius=99999&min=1").set("Authorization", `Bearer ${admin}`);
  expect(res.status).toBe(200);
  expect(res.body.radius).toBe(500);      // clamped
  expect(res.body.minReports).toBe(2);    // clamped
  expect(res.body.analysed).toBe(4);
  expect(res.body.hotspots[0].total).toBe(3);
  expect(res.body.hotspots[0].recommendation).toMatch(/Capacity/);
});
