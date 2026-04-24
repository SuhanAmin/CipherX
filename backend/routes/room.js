const express = require("express");
const { authenticate } = require("../middleware/auth");
const Room = require("../models/Room");
const Message = require("../models/Message");

const router = express.Router();

/**
 * 🔥 Create room (group or private)
 */
router.post("/", authenticate, async (req, res) => {
  try {
    let { name, memberIds } = req.body;

    if (!Array.isArray(memberIds)) memberIds = [];

    // include current user
    if (!memberIds.includes(req.user.id)) {
      memberIds.push(req.user.id);
    }

    if (memberIds.length < 2) {
      return res.status(400).json({ error: "at least 2 members required" });
    }

    const isPrivate = memberIds.length === 2;

    // 🔥 avoid duplicate private room
    if (isPrivate) {
      const existing = await Room.findOne({
        isPrivate: true,
        members: { $all: memberIds, $size: 2 },
      });

      if (existing) return res.json(existing);

      if (!name) name = "Direct Message";
    } else {
      if (!name) {
        return res.status(400).json({ error: "name required for group room" });
      }
    }

    const room = await Room.create({
      name,
      isPrivate,
      members: memberIds,
    });

    res.json(room);
  } catch (err) {
    console.error("CREATE ROOM ERROR:", err);
    res.status(500).json({ error: "failed to create room" });
  }
});

/**
 * 🔥 List rooms for current user
 */
router.get("/", authenticate, async (req, res) => {
  try {
    const rooms = await Room.find({ members: req.user.id })
      .sort({ updatedAt: -1 })
      .populate("members", "name");

    res.json(rooms);
  } catch (err) {
    console.error("GET ROOMS ERROR:", err);
    res.status(500).json({ error: "failed to fetch rooms" });
  }
});

/**
 * 🔥 Room history
 */
router.get("/:roomId/history", authenticate, async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findOne({
      _id: roomId,
      members: req.user.id,
    });

    if (!room) {
      return res.status(404).json([]);
    }

    const messages = await Message.find({ roomId })
      .sort({ createdAt: 1 })
      .limit(500)
      .populate("senderId", "name");

   res.json(
  messages.map((m) => ({
    _id: m._id,
    roomId: m.roomId,
    sender: {
      _id: m.senderId?._id,
      username: m.senderId?.name || "Unknown",
    },
    content: m.content,
    type: m.type || "text", // ✅ ADD THIS LINE
    createdAt: m.createdAt,
  }))
);
  } catch (err) {
    console.error("HISTORY ERROR:", err);
    res.status(500).json([]); // 🔥 CRITICAL FIX
  }
});
/**
 * 🔥 Create or get private chat (used by "New Chat")
 */
router.post("/create", authenticate, async (req, res) => {
  try {
    const { userId } = req.body;
    const currentUser = req.user.id;

    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }

    // 🔥 check existing room
    let room = await Room.findOne({
      isPrivate: true,
      members: { $all: [currentUser, userId], $size: 2 },
    });

    // 🔥 create if not exists
    if (!room) {
      room = await Room.create({
        members: [currentUser, userId],
        name: "Private Chat",
        isPrivate: true, // ✅ IMPORTANT FIX
      });
    }

    res.json(room);
  } catch (err) {
    console.error("CREATE PRIVATE ROOM ERROR:", err);
    res.status(500).json({ error: "failed to create private room" });
  }
});

module.exports = router;