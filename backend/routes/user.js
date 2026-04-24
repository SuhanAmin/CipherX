const express = require('express');
const { authenticate } = require('../middleware/auth');
const  User  = require('../models/User');

const router = express.Router();

router.get('/me', authenticate, async (req, res) => {
	const user = await User.findById(req.user.id).select('_id username online lastSeen');
	res.json(user);
});

router.get('/', authenticate, async (_req, res) => {
	const users = await User.find().select('_id username online lastSeen').limit(200).sort({ username: 1 });
	res.json(users);
});

router.get("/search", authenticate, async (req, res) => {
  try {
    let q = req.query.q || "";
    q = q.trim();

    if (!q) return res.json([]);

    const users = await User.find({
      name: { $regex: q, $options: "i" }
    })
      .select("_id name email")
      .limit(10);

    res.json(users || []);
  } catch (err) {
    console.error("SEARCH ERROR:", err);
    res.status(500).json([]); // 🔥 ALWAYS return array
  }
});

module.exports = router;

