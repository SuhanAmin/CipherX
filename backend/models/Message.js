const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  content: String,
  type: {
  type: String,
  default: "text"
},
}, { timestamps: true });

module.exports = mongoose.model("Message", messageSchema);