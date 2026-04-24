const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
  name: String,
  isPrivate: Boolean,
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
}, { timestamps: true });

module.exports = mongoose.model("Room", roomSchema);