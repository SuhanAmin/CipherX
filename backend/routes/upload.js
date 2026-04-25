const express = require("express");
const multer = require("multer");
const axios = require("axios"); // ✅ add this
const path = require("path");
const router = express.Router();

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

router.post("/", upload.single("file"), async (req, res) => {
  try {
    const filePath = path.resolve(req.file.path);
    console.log("📂 Uploaded file:", filePath);

    // 🔥 SEND ORIGINAL FILE TO VECTOR DB
    try {
      await axios.post("http://localhost:8000/ingest", {
        filePath: filePath,
      });

      console.log("✅ Original file stored in vector DB");
    } catch (err) {
      console.error("❌ RAG INGEST ERROR:", err.message);
    }

    // ✅ Send SAME original file to frontend
    const fileUrl = `http://localhost:5000/uploads/${req.file.filename}`;

    res.json({ fileUrl });

  } catch (err) {
    console.error("❌ UPLOAD ERROR:", err.message);
    res.status(500).json({ error: "Upload failed" });
  }
});

module.exports = router;