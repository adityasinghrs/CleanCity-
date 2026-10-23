const { slaInfo } = require("./sla");

// Smart priority score: category severity + community upvotes + age of the complaint
const WEIGHT = { "Hazardous Waste": 50, "Illegal Dumping": 30, "Overflowing Bin": 25, "Missed Pickup": 20, Other: 10 };

function computePriority({ status, category, upvoteCount, createdAt }, now = Date.now()) {
  if (status === "Resolved") return { priority: 0, level: "Done" };
  const days = Math.max(0, Math.floor((now - new Date(createdAt)) / 864e5));
  const priority = (WEIGHT[category] || 10) + upvoteCount * 5 + Math.min(days, 30) * 2;
  const level = priority >= 60 ? "High" : priority >= 35 ? "Medium" : "Low";
  return { priority, level };
}

// Adds priority/level/upvoteCount to a complaint and hides the raw upvoter list
function decorate(c) {
  const o = c.toObject ? c.toObject() : { ...c };
  o.upvoteCount = (o.upvotes || []).length;
  Object.assign(o, computePriority(o));
  o.sla = slaInfo(o);
  delete o.upvotes;
  delete o.photoHash; // internal fingerprint, never sent to clients
  return o;
}

module.exports = { WEIGHT, computePriority, decorate };
