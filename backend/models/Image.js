const mongoose = require("mongoose");
// Photos are stored inside MongoDB Atlas itself (max 5 MB each, well under the 16 MB document limit)
module.exports = mongoose.model("Image", new mongoose.Schema(
  { data: { type: Buffer, required: true }, contentType: String },
  { timestamps: true }
));
