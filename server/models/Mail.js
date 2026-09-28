const mongoose = require("mongoose");

const resultSchema = new mongoose.Schema(
  { email: String, status: { type: String, enum: ["sent", "failed"] }, error: String },
  { _id: false }
);

const mailSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    recipients: { type: [String], required: true },
    results: [resultSchema],
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    // sent = all delivered, partial = some failed, failed = none delivered
    status: { type: String, enum: ["sent", "partial", "failed"], required: true },
    sentBy: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Mail", mailSchema);
