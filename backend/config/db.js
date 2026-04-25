const mongoose = require("mongoose");

let isConnected = false;

async function connectToDatabase() {
  if (isConnected) return mongoose.connection;

  const uri =
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/cipherX";

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log("✅ MongoDB Connected");

    isConnected = true;
    return mongoose.connection;

  } catch (err) {
    console.error("❌ MongoDB Connection Failed:", err.message);
    process.exit(1); // stop app if DB fails
  }
}

module.exports = { connectToDatabase };