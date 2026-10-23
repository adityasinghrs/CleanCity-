// Endpoint test with the Complaint model mocked (no database needed)
jest.mock("../models/Complaint", () => {
  const chain = { sort: () => chain, limit: () => chain, select: () => chain, lean: () => Promise.resolve(chain.rows) };
  return { find: jest.fn(() => chain), __chain: chain };
});
const request = require("supertest");
const jwt = require("jsonwebtoken");
const Complaint = require("../models/Complaint");
const app = require("../app");

const admin = jwt.sign({ id: "64b000000000000000000001", role: "admin", name: "A" }, process.env.JWT_SECRET);
const user = jwt.sign({ id: "64b000000000000000000002", role: "user", name: "U" }, process.env.JWT_SECRET);
const row = (n, dLat, status = "Pending") => ({
  trackingId: `GMS-${n}`, title: `T${n}`, category: "Hazardous Waste", status, location: "MG Road", upvotes: [],
  createdAt: new Date(Date.now() - 3 * 864e5), coords: { type: "Point", coordinates: [77.5946, 12.9716 + dLat] },
});

test("GET /route is admin only", async () => {
  expect((await request(app).get("/api/complaint/route")).status).toBe(401);
  expect((await request(app).get("/api/complaint/route").set("Authorization", `Bearer ${user}`)).status).toBe(403);
});

test("GET /route returns an ordered plan and clamps stops", async () => {
  Complaint.__chain.rows = [row(1, 0), row(2, 0.01), row(3, 0.02, "Resolved")];
  const res = await request(app).get("/api/complaint/route?stops=999").set("Authorization", `Bearer ${admin}`);
  expect(res.status).toBe(200);
  expect(res.body.stops).toHaveLength(2); // the resolved one is excluded
  expect(res.body.stops[0].overdue).toBe(true); // hazardous waste, 3 days old, SLA is 24 h
  expect(res.body.improvement).toBeDefined();
});

test("GET /public-stats needs no login and hides personal data", async () => {
  Complaint.__chain.rows = [row(1, 0), row(2, 0.01, "Resolved")];
  const res = await request(app).get("/api/complaint/public-stats");
  expect(res.status).toBe(200);
  expect(res.body.total).toBe(2);
  expect(JSON.stringify(res.body)).not.toMatch(/trackingId|MG Road/);
});
