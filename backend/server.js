const app = require("./app");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/garbageDB";
const PORT = process.env.PORT || 5000;

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || "admin@clean.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (await User.findOne({ email })) return;
  if (!password || password.length < 8) {
    console.warn("No admin created: set ADMIN_EMAIL and ADMIN_PASSWORD (min 8 chars) in .env");
    return;
  }
  if (process.env.NODE_ENV === "production" && password === "admin123") {
    console.warn("No admin created: refusing the default ADMIN_PASSWORD in production");
    return;
  }
  await User.create({ name: "Admin", email, password: await bcrypt.hash(password, 10), role: "admin" });
  console.log(`Admin created -> ${email}`);
}

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log(`DB Connected (${mongoose.connection.host})`);
    await mongoose.model("Complaint").syncIndexes(); // creates 2dsphere + unique indexes in Atlas
    await seedAdmin();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("DB connection failed. Check MONGO_URI / Atlas IP access list.\n", err.message);
    process.exit(1);
  });
