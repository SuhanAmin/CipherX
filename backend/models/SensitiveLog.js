const mongoose = require("mongoose");

const sensitiveLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["phone", "email", "pan", "aadhaar", "bank"], // Types matching our scanner
    },
    maskedValue: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SensitiveLog", sensitiveLogSchema);
