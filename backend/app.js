require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const Image = require("./models/Image");
require("./models/Complaint");

const app = express();
app.set("trust proxy", 1); // correct client IPs behind Render/Railway proxies (needed for rate limiting)

// Photos are served from the API but shown on the frontend origin, so allow cross-origin image loads
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: (process.env.CLIENT_URL || "").replace(/\/+$/, "") || true })); // trailing slash in CLIENT_URL would break CORS
app.use(express.json({ limit: "20kb" }));

const json429 = (message) => ({ message });
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false, message: json429("Too many requests, slow down") });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: json429("Too many attempts, try again in 15 minutes") });
app.use("/api", apiLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/complaint", require("./routes/complaintRoutes"));
app.get("/", (req, res) => res.send("Backend Running"));
app.get("/api/health", (req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1 }));

// Serve photos straight from MongoDB
app.get("/api/image/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).end();
    const img = await Image.findById(req.params.id);
    if (!img) return res.status(404).end();
    res.set("Content-Type", img.contentType).set("Cache-Control", "public, max-age=86400").send(img.data);
  } catch {
    res.status(404).end();
  }
});

app.use("/api", (req, res) => res.status(404).json({ message: "Route not found" }));

// Central error handler: a failing route returns JSON instead of crashing or hanging
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ message: "Invalid JSON body" });
  console.error(err);
  res.status(500).json({ message: "Server error, please try again" });
});

module.exports = app;
