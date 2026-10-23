// Demo data for presentations: citizens + complaints that form clear hotspots (one chronic, one fresh)
// plus some overdue items, so Hotspot Intelligence and SLA tracking have something to show.
//   npm run seed            (adds demo data, safe to run again)
//   npm run seed -- --clear (removes only the demo data)
// Optional: SEED_LAT / SEED_LNG in .env move the demo to your own city (default: Bengaluru).
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
const Complaint = require("./models/Complaint");

const LAT = Number(process.env.SEED_LAT) || 12.9716;
const LNG = Number(process.env.SEED_LNG) || 77.5946;
const DEMO_PASSWORD = "Demo@1234";
const hoursAgo = (h) => new Date(Date.now() - h * 36e5);
const spot = (dNorthM, dEastM) => ({
  type: "Point",
  coordinates: [LNG + dEastM / (111320 * Math.cos((LAT * Math.PI) / 180)), LAT + dNorthM / 110574],
});

async function main() {
  if (process.env.NODE_ENV === "production" && !process.argv.includes("--force")) {
    throw new Error("Refusing to seed with NODE_ENV=production (add --force if you really mean it)");
  }
  await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/garbageDB");
  const demoUsers = await User.find({ email: /^demo\d@cleancity\.test$/ }).select("_id");
  await Complaint.deleteMany({ trackingId: /^DEMO-/ });
  if (process.argv.includes("--clear")) {
    await User.deleteMany({ _id: { $in: demoUsers.map((u) => u._id) } });
    console.log("Demo data removed");
    return process.exit(0);
  }

  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users = [];
  for (let i = 1; i <= 4; i++) {
    const email = `demo${i}@cleancity.test`;
    users.push(await User.findOneAndUpdate({ email }, { name: `Demo Citizen ${i}`, email, password: hash, role: "user", points: 10 * i }, { upsert: true, new: true }));
  }
  const U = (i) => users[i % users.length]._id;

  // [category, status, hoursAgoCreated, hoursAgoResolved, north m, east m, title, location]
  const rows = [
    // Chronic hotspot: cleaned, then dumped again (twice)
    ["Illegal Dumping", "Resolved", 400, 380, 0, 0, "Garbage dumped behind market", "Market back lane"],
    ["Illegal Dumping", "Resolved", 250, 230, 20, 10, "Dumping again behind market", "Market back lane"],
    ["Illegal Dumping", "Pending", 60, null, 10, -15, "Third time this month: pile near wall", "Market back lane"],
    ["Overflowing Bin", "In Progress", 30, null, -15, 25, "Bin overflowing at lane end", "Market back lane"],
    // Fresh hotspot: all open, bin capacity problem
    ["Overflowing Bin", "Pending", 20, null, 600, 500, "Bin overflowing near bus stop", "Bus stop, Ring Road"],
    ["Overflowing Bin", "Pending", 12, null, 620, 520, "Bus stop bin full again", "Bus stop, Ring Road"],
    ["Overflowing Bin", "Pending", 5, null, 590, 480, "Garbage spilling on footpath", "Bus stop, Ring Road"],
    // Scattered single reports (not hotspots); some overdue
    ["Hazardous Waste", "Pending", 40, null, -900, 300, "Broken glass and chemical cans", "Industrial Estate gate"],
    ["Missed Pickup", "Pending", 100, null, 400, -700, "Pickup not done for 4 days", "Lakeview Colony"],
    ["Other", "Resolved", 90, 20, -500, -600, "Dead tree branches on road", "Temple Street"],
  ];
  const created = [];
  let n = 1;
  for (const [category, status, created_h, resolved_h, north, east, title, location] of rows) {
    const createdAt = hoursAgo(created_h);
    const resolvedAt = resolved_h != null ? hoursAgo(resolved_h) : undefined;
    created.push({
      trackingId: `DEMO-${String(n).padStart(3, "0")}`, user: U(n), title, category, location, status,
      coords: spot(north, east), createdAt, resolvedAt, upvotes: n % 3 === 0 ? [U(n + 1)] : [],
      history: [
        { status: "Pending", note: "Complaint submitted", by: "Demo", at: createdAt },
        ...(status !== "Pending" ? [{ status, note: status === "Resolved" ? "Cleared by sanitation team" : "Team assigned", by: "Admin", at: resolvedAt || hoursAgo(created_h - 5) }] : []),
      ],
    });
    n++;
  }
  // insertMany with explicit createdAt keeps the timestamps above (needed for SLA / recurrence demo)
  await Complaint.insertMany(created, { timestamps: false });
  console.log(`Seeded ${created.length} complaints and ${users.length} citizens`);
  console.log(`Citizen login: demo1@cleancity.test / ${DEMO_PASSWORD}   (Admin: use ADMIN_EMAIL from your .env)`);
  console.log("Open Admin → 🔥 Hotspots to see the clusters.");
  process.exit(0);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
