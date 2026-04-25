const express = require("express");
const axios = require("axios");

const router = express.Router();

router.post("/rag", async (req, res) => {
  try {
    const { question } = req.body;

    const response = await axios.post("http://localhost:8000/query", {
      question
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