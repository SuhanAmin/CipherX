require("dotenv").config();

const path = require("path");
const http = require("http");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const { connectToDatabase } = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const roomRoutes = require("./routes/room");
const userRoutes = require("./routes/user");
const  User  = require("./models/User");
const  Room  = require("./models/Room");
const  Message  = require("./models/Message");

const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

// ✅ INIT
const app = express();
const server = http.createServer(app);

// ✅ SOCKET.IO
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    credentials: true,
  },
});

// ✅ MIDDLEWARE
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  })
);
require("./config/passport");
// Static
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.use("/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/users", userRoutes);

// Health
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});
const ragRoutes = require("./routes/rag");
app.use("/api", ragRoutes);
// ✅ SOCKET AUTH
io.use(async (socket, next) => {
  try {
    const tokenFromQuery = socket.handshake.auth?.token;
    const cookieHeader = socket.handshake.headers.cookie || "";

    let token = tokenFromQuery;

    if (!token && cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader.split(";").map((c) => c.trim().split("="))
      );
      token = cookies["token"];
    }

    if (!token) return next(new Error("Unauthorized"));

    const payload = jwt.verify(token, JWT_SECRET);

    socket.user = {
      id: payload.id,
      name: payload.name,
    };

    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

// ✅ ONLINE USERS
const onlineUsers = new Map();

// ✅ SOCKET CONNECTION
io.on("connection", async (socket) => {
  const userId = socket.user.id;

  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId).add(socket.id);

  socket.join(`user:${userId}`);

  await User.findByIdAndUpdate(userId, {
    online: true,
    lastSeen: new Date(),
  }).catch(() => {});

  io.emit("presence:online", { userId });

  // Join user rooms
  try {
    const rooms = await Room.find({ members: userId }).select("_id");
    rooms.forEach((r) => socket.join(`room:${r._id}`));
  } catch {}

  // Join room
  socket.on("room:join", async ({ roomId }) => {
  if (!roomId) return;

  if (!mongoose.Types.ObjectId.isValid(roomId)) return;

  const room = await Room.findOne({
    _id: roomId,
    members: userId,
  });

  if (!room) return;

  socket.join(`room:${roomId}`);
  socket.emit("room:joined", { roomId });
});

  // Typing
  socket.on("typing", ({ roomId, isTyping }) => {
    io.to(`room:${roomId}`).emit("typing", {
      roomId,
      userId,
      isTyping: !!isTyping,
    });
  });

  // Send message
  const mongoose = require("mongoose");

socket.on("message:send", async ({ roomId, content, type }) => {
  try {
    // 🚫 BLOCK AI CHAT (cipherx)
    if (roomId === "cipherx") {
      console.log("🤖 AI chat detected → skipping DB");
      return;
    }

    // 🚫 INVALID OBJECTID PROTECTION
    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      console.log("⚠️ Invalid roomId:", roomId);
      return;
    }

    if (!roomId || !content) return;

    const room = await Room.findOne({
      _id: roomId,
      members: userId,
    });

    if (!room) return;

    const message = await Message.create({
      roomId,
      senderId: userId,
      content,
      type: type || "text",
    });

    const populated = await message.populate("senderId", "name");

    io.to(`room:${roomId}`).emit("message:new", {
      _id: message._id,
      roomId,
      type: message.type || "text",
      sender: {
        _id: populated.senderId._id,
        name: populated.senderId.name,
      },
      content: message.content,
      createdAt: message.createdAt,
    });

  } catch (err) {
    console.error("❌ SOCKET ERROR:", err.message);
  }
});

  // Disconnect
  socket.on("disconnect", async () => {
    const sockets = onlineUsers.get(userId);

    if (sockets) {
      sockets.delete(socket.id);

      if (sockets.size === 0) {
        onlineUsers.delete(userId);

        await User.findByIdAndUpdate(userId, {
          online: false,
          lastSeen: new Date(),
        }).catch(() => {});

        io.emit("presence:offline", { userId });
      }
    }
  });
});
const scanRoutes = require("./routes/scan"); // adjust path

app.use("/api", scanRoutes);
app.use("/uploads", express.static("uploads"));
const uploadRoutes = require("./routes/upload");

app.use("/api/upload", uploadRoutes);
// ✅ START SERVER
server.listen(PORT, async () => {
  await connectToDatabase();
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});