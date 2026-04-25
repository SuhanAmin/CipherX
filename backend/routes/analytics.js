const express = require("express");
const router = express.Router();
const SensitiveLog = require("../models/SensitiveLog");
const { authenticate } = require("../middleware/auth");

const VALID_TYPES = ["phone", "email", "pan", "aadhaar", "bank"];

// Log unmasked sensitive data sent by user
router.post("/log", authenticate, async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Invalid items array" });
    }

    // Filter to only valid, loggable items
    const validItems = items.filter(item =>
      VALID_TYPES.includes(item.type) && (item.masked || item.value)
    );

    if (validItems.length === 0) {
      return res.status(200).json({ message: "No valid items to log" });
    }

    const logs = validItems.map(item => ({
      user: req.user.id,
      type: item.type,
      // Store masked value; fall back to value if masked is not set
      maskedValue: item.masked || item.value
    }));

    await SensitiveLog.insertMany(logs);
    
    res.status(201).json({ message: "Logs saved successfully" });
  } catch (err) {
    console.error("Analytics log error:", err);
    res.status(500).json({ error: "Server error logging sensitive data" });
  }
});

const mongoose = require("mongoose");

// Get user's sensitive data analytics
router.get("/", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Aggregate counts by type
    const stats = await SensitiveLog.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: "$type", count: { $sum: 1 } } }
    ]);

    // Format stats into a simpler object: { phone: 2, pan: 1, ... }
    const counts = {};
    let total = 0;
    stats.forEach(s => {
      counts[s._id] = s.count;
      total += s.count;
    });

    // Get recent logs
    const recent = await SensitiveLog.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("-__v -user");

    res.json({ total, counts, recent });
  } catch (err) {
    console.error("Analytics fetch error:", err);
    res.status(500).json({ error: "Server error fetching analytics" });
  }
});

module.exports = router;
