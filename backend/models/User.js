const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  googleId: String,
  online: { type: Boolean, default: false },
	lastSeen: { type: Date, default: Date.now }
}, { timestamps: true });


module.exports = mongoose.model("User", userSchema);