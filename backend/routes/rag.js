const express = require("express");
const axios = require("axios");

const router = express.Router();
const { authenticate } = require("../middleware/auth"); // ✅ import

router.post("/rag", authenticate, async (req, res) => {
  try {
    const { question } = req.body;
    const user = req.user;

    const response = await fetch("http://127.0.0.1:8000/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question,
        userId: user.id
      })
    });

    res.setHeader("Content-Type", "text/plain");

    for await (const chunk of response.body) {
      res.write(chunk);   // 🔥 stream to frontend
    }
    res.end();

  } catch (err) {
    console.error("RAG ERROR:", err.message);
    res.status(500).json({ error: "RAG failed" });
  }
});

module.exports = router;