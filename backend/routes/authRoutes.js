const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { protect, wrap, SECRET } = require("../middleware/auth");
const { validateRegister, checkPassword } = require("../utils/validate");

const router = express.Router();

const sign = (u) => jwt.sign({ id: u._id, role: u.role, name: u.name }, SECRET, { expiresIn: "7d" });
const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, points: u.points || 0 });

router.post("/register", wrap(async (req, res) => {
  const { error, data } = validateRegister(req.body);
  if (error) return res.status(400).json({ message: error });
  if (await User.findOne({ email: data.email })) return res.status(400).json({ message: "Email already registered" });

  // role is never taken from the request - everyone registers as "user"
  const user = await User.create({ name: data.name, email: data.email, password: await bcrypt.hash(data.password, 10) });
  res.status(201).json({ token: sign(user), user: publicUser(user) });
}));

router.post("/login", wrap(async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== "string" || typeof password !== "string")
    return res.status(400).json({ message: "Email and password are required" });
  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(400).json({ message: "Invalid email or password" });
  res.json({ token: sign(user), user: publicUser(user) });
}));

router.get("/me", protect, wrap(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(publicUser(user));
}));

router.put("/change-password", protect, wrap(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== "string") return res.status(400).json({ message: "Current password is required" });
  const pe = checkPassword(newPassword);
  if (pe) return res.status(400).json({ message: pe });
  const user = await User.findById(req.user.id);
  if (!user || !(await bcrypt.compare(currentPassword, user.password)))
    return res.status(400).json({ message: "Current password is incorrect" });
  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();
  res.json({ message: "Password updated" });
}));

// Eco-Points leaderboard (public)
router.get("/leaderboard", wrap(async (req, res) => {
  const top = await User.find({ role: "user", points: { $gt: 0 } }).sort({ points: -1 }).limit(5).select("name points");
  res.json(top);
}));

module.exports = router;
