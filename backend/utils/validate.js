const CATEGORIES = ["Overflowing Bin", "Illegal Dumping", "Missed Pickup", "Hazardous Waste", "Other"];
const STATUSES = ["Pending", "In Progress", "Resolved"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (v) => (typeof v === "string" ? v.trim() : "");

// Password rule: 8+ characters with at least one letter and one number
function checkPassword(p) {
  if (typeof p !== "string" || p.length < 8 || p.length > 72) return "Password must be 8-72 characters";
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return "Password must contain a letter and a number";
  return null;
}

function validateRegister(body = {}) {
  const name = str(body.name), email = str(body.email).toLowerCase();
  if (name.length < 2 || name.length > 60) return { error: "Name must be 2-60 characters" };
  if (!EMAIL_RE.test(email) || email.length > 120) return { error: "Enter a valid email address" };
  const pe = checkPassword(body.password);
  if (pe) return { error: pe };
  return { data: { name, email, password: body.password } };
}

function validateComplaint(body = {}) {
  const title = str(body.title), location = str(body.location), description = str(body.description);
  const category = str(body.category) || "Other";
  if (!title || title.length > 120) return { error: "Title is required (max 120 characters)" };
  if (!location || location.length > 200) return { error: "Location is required (max 200 characters)" };
  if (description.length > 1000) return { error: "Description is too long (max 1000 characters)" };
  if (!CATEGORIES.includes(category)) return { error: "Invalid category" };
  const data = { title, location, description, category };
  if (body.lat !== undefined && body.lng !== undefined && body.lat !== "" && body.lng !== "") {
    const lat = Number(body.lat), lng = Number(body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
      return { error: "Invalid GPS coordinates" };
    data.coords = { type: "Point", coordinates: [lng, lat] };
  }
  return { data };
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

module.exports = { CATEGORIES, STATUSES, checkPassword, validateRegister, validateComplaint, escapeRegex };
