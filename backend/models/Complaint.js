const mongoose = require("mongoose");

const pointSchema = new mongoose.Schema(
  { type: { type: String, enum: ["Point"], default: "Point" }, coordinates: { type: [Number], default: undefined } },
  { _id: false }
);

const complaintSchema = new mongoose.Schema(
  {
    trackingId: { type: String, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: {
      type: String,
      enum: ["Overflowing Bin", "Illegal Dumping", "Missed Pickup", "Hazardous Waste", "Other"],
      default: "Other",
    },
    location: { type: String, required: true },
    coords: pointSchema, // GeoJSON [lng, lat] -> used for nearby / duplicate detection
    image: { type: mongoose.Schema.Types.ObjectId, ref: "Image" },
    resolvedImage: { type: mongoose.Schema.Types.ObjectId, ref: "Image" }, // "after" proof photo
    photoHash: { type: String }, // 64-bit dHash of the report photo (16 hex chars), for visual duplicate checks
    possibleDuplicateOf: { type: String }, // trackingId of a nearby report with a very similar photo
    proofWarning: { type: String }, // set when the "after" photo looks identical to the "before" photo
    status: { type: String, enum: ["Pending", "In Progress", "Resolved"], default: "Pending" },
    adminNote: { type: String, default: "" },
    upvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    resolvedAt: Date,
    history: [{ status: String, note: String, by: String, at: { type: Date, default: Date.now }, _id: false }],
  },
  { timestamps: true }
);

complaintSchema.index({ coords: "2dsphere" });
complaintSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Complaint", complaintSchema);
