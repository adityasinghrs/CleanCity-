const jwt = require("jsonwebtoken");

// No fallback secret: running with a guessable default would let anyone forge admin tokens.
const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 16) {
  throw new Error("JWT_SECRET is missing or too short (min 16 chars). Set it in backend/.env");
}

const protect = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Please login first" });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Session expired, login again" });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") return res.status(403).json({ message: "Admin access only" });
  next();
};

// Forward rejected promises from async route handlers to the central error handler
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Reject malformed :id params with 400 instead of a CastError
const validId = (req, res, next) =>
  require("mongoose").isValidObjectId(req.params.id) ? next() : res.status(400).json({ message: "Invalid id" });

module.exports = { protect, adminOnly, wrap, validId, SECRET };
