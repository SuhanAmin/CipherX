const express = require("express");
const axios = require("axios");

const router = express.Router();
const { authenticate } = require("../middleware/auth"); // ✅ import

router.post("/rag",authenticate, async (req, res) => {
  try {
    const { question } = req.body;
    const user = req.user; // ✅ get user from auth middleware
    const response = await axios.post("http://localhost:8000/query", {
      question,
      userId: user.id 
    });

    res.json({
      answer: response.data.answer
    });

  } catch (err) {
    console.error("RAG ERROR:", err.message);
    res.status(500).json({ error: "RAG failed" });
  }
});

module.exports = router;