const express = require("express");
const multer = require("multer");
const fs = require("fs");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/scan", upload.single("file"), async (req, res) => {
  try {
    const filePath = req.file.path;
    const mimeType = req.file.mimetype;

    // 🧠 CASE 1: TEXT FILE
    if (mimeType === "text/plain") {
      const content = fs.readFileSync(filePath, "utf-8");

      const phones = content.match(/\b\d{10}\b/g) || [];
      const emails = content.match(/\S+@\S+/g) || [];

      return res.json({
        summary: content.slice(0, 100),
        phones,
        emails,
      });
    }

    // 🧠 CASE 2: IMAGE FILE
    if (mimeType.startsWith("image/")) {
      return res.json({
        summary: "Image file detected. AI image scanning coming soon.",
        phones: [],
        emails: [],
      });
    }

    // 🧠 CASE 3: OTHER FILES
    return res.json({
      summary: "Unsupported file type",
      phones: [],
      emails: [],
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Scan failed" });
  }
});

module.exports = router;