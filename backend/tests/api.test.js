// These tests hit validation / auth guards that respond BEFORE any database call, so no MongoDB is needed.
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");

const token = (role) => jwt.sign({ id: "64b000000000000000000001", role, name: "T" }, process.env.JWT_SECRET);

test("health endpoint responds", async () => {
  const res = await request(app).get("/api/health");
  expect(res.status).toBe(200);
});

test("security headers are set (helmet)", async () => {
  const res = await request(app).get("/");
  expect(res.headers["x-content-type-options"]).toBe("nosniff");
});

test("protected routes need a token", async () => {
  expect((await request(app).get("/api/complaint/mine")).status).toBe(401);
  expect((await request(app).post("/api/complaint")).status).toBe(401);
});

test("normal users cannot use admin routes", async () => {
  const res = await request(app).get("/api/complaint/stats").set("Authorization", `Bearer ${token("user")}`);
  expect(res.status).toBe(403);
  const del = await request(app).delete("/api/complaint/64b000000000000000000002").set("Authorization", `Bearer ${token("user")}`);
  expect(del.status).toBe(403);
});

test("forged token with wrong secret is rejected", async () => {
  const bad = jwt.sign({ id: "x", role: "admin" }, "some_other_secret");
  expect((await request(app).get("/api/complaint/stats").set("Authorization", `Bearer ${bad}`)).status).toBe(401);
});

test("register rejects weak password and role injection is ignored by validation", async () => {
  const res = await request(app).post("/api/auth/register").send({ name: "Asha", email: "a@b.co", password: "weak", role: "admin" });
  expect(res.status).toBe(400);
});

test("login rejects non-string payloads (NoSQL injection attempt)", async () => {
  const res = await request(app).post("/api/auth/login").send({ email: { $gt: "" }, password: { $gt: "" } });
  expect(res.status).toBe(400);
});

test("malformed id returns 400, not a crash", async () => {
  const res = await request(app).put("/api/complaint/not-an-id").set("Authorization", `Bearer ${token("admin")}`);
  expect(res.status).toBe(400);
});

test("complaint with invalid category is rejected before touching the DB", async () => {
  const res = await request(app).post("/api/complaint").set("Authorization", `Bearer ${token("user")}`)
    .field("title", "Pile").field("location", "Main road").field("category", "Bogus");
  expect(res.status).toBe(400);
});

test("fake image (text file renamed .jpg) is rejected", async () => {
  const res = await request(app).post("/api/complaint").set("Authorization", `Bearer ${token("user")}`)
    .field("title", "Pile").field("location", "Main road")
    .attach("image", Buffer.from("not really an image at all"), { filename: "x.jpg", contentType: "image/jpeg" });
  expect(res.status).toBe(400);
  expect(res.body.message).toMatch(/JPEG, PNG or WebP/);
});

test("unknown API route gives JSON 404", async () => {
  const res = await request(app).get("/api/nope");
  expect(res.status).toBe(404);
  expect(res.body.message).toBeDefined();
});

test("hotspot and overdue endpoints are admin-only", async () => {
  expect((await request(app).get("/api/complaint/hotspots")).status).toBe(401);
  const res = await request(app).get("/api/complaint/hotspots").set("Authorization", `Bearer ${token("user")}`);
  expect(res.status).toBe(403);
});
