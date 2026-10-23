const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const Complaint = require("../models/Complaint");
const User = require("../models/User");
const Image = require("../models/Image");
const { protect, adminOnly, wrap, validId } = require("../middleware/auth");
const { decorate } = require("../utils/priority");
const { detectImageType } = require("../utils/image");
const { validateComplaint, STATUSES, escapeRegex } = require("../utils/validate");
const { cleanHash, hamming, SIMILAR, NEARLY_IDENTICAL } = require("../utils/phash");
const { detectHotspots } = require("../utils/hotspot");
const { planRoute } = require("../utils/route");
const { publicStats } = require("../utils/publicStats");

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const withUpload = (field) => (req, res, next) =>
  upload.single(field)(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.code === "LIMIT_FILE_SIZE" ? "Image must be under 5 MB" : err.message });
    if (req.file && !detectImageType(req.file.buffer))
      return res.status(400).json({ message: "Only JPEG, PNG or WebP images are allowed" });
    next();
  });

// Store the photo; the content type comes from the detected bytes, not from the client
const saveImage = async (file) =>
  file ? (await Image.create({ data: file.buffer, contentType: detectImageType(file.buffer) }))._id : undefined;

const addPoints = (id, n) => User.findByIdAndUpdate(id, { $inc: { points: n } }).catch(() => {});

// Create complaint
router.post("/", protect, withUpload("image"), wrap(async (req, res) => {
  const { error, data } = validateComplaint(req.body);
  if (error) return res.status(400).json({ message: error });
  // Photo fingerprint: flag (not block) a report whose photo looks like one already filed within 300 m
  const photoHash = req.file ? cleanHash(req.body.photoHash) : undefined;
  let possibleDuplicateOf;
  if (photoHash && data.coords) {
    const near = await Complaint.find({
      photoHash: { $exists: true },
      coords: { $near: { $geometry: data.coords, $maxDistance: 300 } },
    }).limit(20).select("trackingId photoHash");
    possibleDuplicateOf = near.find((n) => hamming(n.photoHash, photoHash) <= SIMILAR)?.trackingId;
  }
  const c = await Complaint.create({
    ...data,
    photoHash,
    possibleDuplicateOf,
    trackingId: "GMS-" + crypto.randomBytes(3).toString("hex").toUpperCase(),
    user: req.user.id,
    image: await saveImage(req.file),
    history: [{ status: "Pending", note: "Complaint submitted", by: req.user.name }],
  });
  addPoints(req.user.id, 10);
  res.status(201).json(decorate(c));
}));

// Nearby open complaints (duplicate detection, 150 m, same category)
router.get("/nearby", protect, wrap(async (req, res) => {
  const lat = Number(req.query.lat), lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return res.json([]);
  const q = {
    status: { $ne: "Resolved" },
    coords: { $near: { $geometry: { type: "Point", coordinates: [lng, lat] }, $maxDistance: 150 } },
  };
  if (typeof req.query.category === "string" && req.query.category) q.category = req.query.category;
  const hash = cleanHash(req.query.hash);
  const data = await Complaint.find(q).limit(3).select("title trackingId category upvotes status createdAt photoHash");
  // visualMatch = the new photo also looks like this existing report's photo (stronger duplicate evidence)
  res.json(data.map((c) => ({ ...decorate(c), visualMatch: !!(hash && c.photoHash && hamming(c.photoHash, hash) <= SIMILAR) })));
}));

// Public community feed (open issues, highest priority first). Includes coords for the map view.
router.get("/feed", wrap(async (req, res) => {
  const data = await Complaint.find({ status: { $ne: "Resolved" } }).sort({ createdAt: -1 }).limit(60)
    .select("-user -adminNote -history -possibleDuplicateOf -proofWarning");
  res.json(data.map(decorate).sort((a, b) => b.priority - a.priority));
}));

// Public tracking by tracking ID (no login needed)
router.get("/track/:tid", wrap(async (req, res) => {
  const c = await Complaint.findOne({ trackingId: req.params.tid.toUpperCase().trim() }).select("-user -possibleDuplicateOf -proofWarning");
  if (!c) return res.status(404).json({ message: "No complaint found with that tracking ID" });
  res.json(decorate(c));
}));

// Upvote toggle ("I see this too"). Points are reversed on un-upvote so toggling can't farm Eco-Points.
router.post("/:id/upvote", protect, validId, wrap(async (req, res) => {
  const c = await Complaint.findById(req.params.id);
  if (!c) return res.status(404).json({ message: "Not found" });
  if (String(c.user) === req.user.id) return res.status(400).json({ message: "You can't upvote your own report" });
  const has = c.upvotes.some((u) => String(u) === req.user.id);
  if (has) { c.upvotes.pull(req.user.id); addPoints(c.user, -2); addPoints(req.user.id, -1); }
  else { c.upvotes.push(req.user.id); addPoints(c.user, 2); addPoints(req.user.id, 1); }
  await c.save();
  res.json({ upvoted: !has, upvoteCount: c.upvotes.length });
}));

// My complaints
router.get("/mine", protect, wrap(async (req, res) => {
  const data = await Complaint.find({ user: req.user.id }).sort({ createdAt: -1 }).select("-possibleDuplicateOf -proofWarning");
  res.json(data.map(decorate));
}));

// Admin: analytics using MongoDB aggregation pipelines
router.get("/stats", protect, adminOnly, wrap(async (req, res) => {
  const since = new Date(Date.now() - 6 * 864e5); since.setHours(0, 0, 0, 0);
  const [byStatus, byCategory, daily, avg] = await Promise.all([
    Complaint.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    Complaint.aggregate([{ $group: { _id: "$category", n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
    Complaint.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, n: { $sum: 1 } } },
    ]),
    Complaint.aggregate([
      { $match: { resolvedAt: { $exists: true } } },
      { $group: { _id: null, ms: { $avg: { $subtract: ["$resolvedAt", "$createdAt"] } } } },
    ]),
  ]);
  const s = Object.fromEntries(byStatus.map((x) => [x._id, x.n]));
  const days = [...Array(7)].map((_, i) => {
    const d = new Date(since.getTime() + i * 864e5);
    const key = d.toLocaleDateString("en-CA");
    return { day: d.toLocaleDateString("en-IN", { weekday: "short" }), n: daily.find((x) => x._id === key)?.n || 0 };
  });
  res.json({
    total: (s.Pending || 0) + (s["In Progress"] || 0) + (s.Resolved || 0),
    pending: s.Pending || 0, inProgress: s["In Progress"] || 0, resolved: s.Resolved || 0,
    byCategory: byCategory.map((x) => ({ category: x._id, n: x.n })),
    days,
    avgResolutionHours: avg[0] ? Math.round((avg[0].ms / 36e5) * 10) / 10 : null,
  });
}));

// Admin: complaints with server-side search, status filter and pagination, sorted by smart priority.
// ?page=1&limit=12&status=Pending&q=text   (limit max 50)
router.get("/", protect, adminOnly, wrap(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));
  const filter = {};
  if (STATUSES.includes(req.query.status)) filter.status = req.query.status;
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 60) : "";
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    const users = await User.find({ name: rx }).select("_id");
    filter.$or = [{ title: rx }, { location: rx }, { category: rx }, { trackingId: rx }, { user: { $in: users.map((u) => u._id) } }];
  }
  // Priority is computed (not stored), so sort in memory, then slice the requested page.
  const all = await Complaint.find(filter).populate("user", "name email");
  let sorted = all.map(decorate).sort((a, b) => b.priority - a.priority);
  if (req.query.sla === "overdue") sorted = sorted.filter((c) => c.sla.overdue); // SLA breaches only
  res.json({
    items: sorted.slice((page - 1) * limit, page * limit),
    total: sorted.length, page, pages: Math.max(1, Math.ceil(sorted.length / limit)),
  });
}));

// Admin: Hotspot Intelligence. Clusters ALL located complaints (also resolved ones, to see relapses).
// ?radius=100 (metres, 30-500)  &min=3 (reports needed to form a hotspot, 2-10)
router.get("/hotspots", protect, adminOnly, wrap(async (req, res) => {
  const eps = Math.min(500, Math.max(30, parseInt(req.query.radius) || 100));
  const minPts = Math.min(10, Math.max(2, parseInt(req.query.min) || 3));
  const all = await Complaint.find({ "coords.coordinates.0": { $exists: true } })
    .sort({ createdAt: -1 }).limit(2000)
    .select("trackingId category status createdAt resolvedAt coords location").lean();
  res.json({ radius: eps, minReports: minPts, analysed: all.length, hotspots: detectHotspots(all, { epsMeters: eps, minPts }) });
}));

// Public: transparency numbers for citizens (counts only, no personal data)
router.get("/public-stats", wrap(async (req, res) => {
  const all = await Complaint.find({}).select("category status createdAt resolvedAt").lean();
  res.json(publicStats(all.map(decorate)));
}));

// Admin: Smart Crew Route Planner. Picks the most urgent open complaints (priority + SLA breach + hotspot)
// and orders them into a short driving route. ?stops=8 (1-15)  &lat=..&lng=.. (optional depot)
router.get("/route", protect, adminOnly, wrap(async (req, res) => {
  const maxStops = Math.min(15, Math.max(1, parseInt(req.query.stops) || 8));
  const lat = Number(req.query.lat), lng = Number(req.query.lng);
  const depot = req.query.lat !== undefined && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : undefined;
  const all = await Complaint.find({ "coords.coordinates.0": { $exists: true } })
    .sort({ createdAt: -1 }).limit(2000)
    .select("trackingId title category status upvotes createdAt resolvedAt coords location").lean();
  const hotspots = detectHotspots(all);
  const open = all.filter((c) => c.status !== "Resolved").map(decorate);
  res.json({ ...planRoute(open, { maxStops, depot, hotspots }), depot: depot || null });
}));

// Admin: all open complaints with coordinates (for the dashboard map)
router.get("/map", protect, adminOnly, wrap(async (req, res) => {
  const data = await Complaint.find({ "coords.coordinates.0": { $exists: true } }).select("title trackingId category status upvotes createdAt coords location");
  res.json(data.map(decorate));
}));

// Admin: update status / note / "after" photo (writes to history timeline)
router.put("/:id", protect, adminOnly, validId, withUpload("resolvedImage"), wrap(async (req, res) => {
  const c = await Complaint.findById(req.params.id);
  if (!c) return res.status(404).json({ message: "Not found" });
  const { status } = req.body;
  const adminNote = typeof req.body.adminNote === "string" ? req.body.adminNote.trim().slice(0, 500) : undefined;
  if (status !== undefined && !STATUSES.includes(status)) return res.status(400).json({ message: "Invalid status" });
  const prev = c.status;
  if (adminNote !== undefined) c.adminNote = adminNote;
  if (req.file) {
    c.resolvedImage = await saveImage(req.file);
    // Proof integrity: an "after" photo that is almost identical to the "before" photo is suspicious
    const proofHash = cleanHash(req.body.proofHash);
    c.proofWarning = proofHash && c.photoHash && hamming(c.photoHash, proofHash) <= NEARLY_IDENTICAL
      ? "Proof photo looks almost identical to the original report photo. Verify on site." : undefined;
  }
  if (status) c.status = status;
  if (c.status !== prev || adminNote !== undefined || req.file) {
    c.history.push({ status: c.status, note: adminNote || (req.file ? "Proof photo uploaded" : ""), by: req.user.name });
  }
  if (c.status === "Resolved" && prev !== "Resolved") {
    if (!c.resolvedAt) addPoints(c.user, 20); // reward only the first time (no farming by re-opening)
    c.resolvedAt = new Date();
  }
  await c.save();
  res.json(decorate(c));
}));

// Admin: delete (also removes stored photos)
router.delete("/:id", protect, adminOnly, validId, wrap(async (req, res) => {
  const c = await Complaint.findByIdAndDelete(req.params.id);
  if (c) await Image.deleteMany({ _id: { $in: [c.image, c.resolvedImage].filter(Boolean) } });
  res.json({ message: "Complaint deleted" });
}));

module.exports = router;
