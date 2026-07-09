const express = require("express");
const multer = require("multer");
const fs = require("fs");
const axios = require("axios");
const Tesseract = require("tesseract.js");
const pdfParseLib = require("pdf-parse");
const pdfParse = pdfParseLib.default || pdfParseLib;
const { PDFDocument, StandardFonts } = require("pdf-lib");


const upload = multer({ dest: "uploads/" });
const router = express.Router();


/* -------------------- 🔥 LLM (ONLY FOR EXPLANATION) -------------------- */

const LLM_API_KEY = process.env.LLM_API_KEY;
const LLM_BASE_URL = process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1";
const LLM_MODEL = process.env.LLM_MODEL || "google/gemma-4-31b-it:free";

const getSummary = async (text) => {
  try {
    const res = await axios.post(
      `${LLM_BASE_URL}/chat/completions`,
      {
        model: LLM_MODEL,
        messages: [
          {
            role: "user",
            content: `Analyze the document and explain its content.

Rules:
- Explain what the document contains
- Give a good summary related to the content what is present in Document.
- Do NOT assume anything
- Do NOT mention sensitive data unless clearly visible

Document:
${text}`,
          },
        ],
        max_tokens: 512,
      },
      {
        headers: {
          Authorization: `Bearer ${LLM_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:5000",
          "X-Title": "CipherX",
        },
        timeout: 30000,
      }
    );

    const choice = res.data?.choices?.[0];
    return choice?.message?.content || null;
  } catch (err) {
    console.error("❌ LLM Summary Error:", err.message);
    return null;
  }
};

/* -------------------- 🔥 REGEX -------------------- */
// Indian Phone: handles all common formats:
//   +919876543210, +91 9876543210, +91-9876543210
//   09876543210, 9876543210
//   +91 98765 43210 (spaces within the 10 digits)
const phoneRegex = /(?:\+91[\s-]?)?(?:0)?[6-9]\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d(?!\d)/g;

// Aadhaar: exactly 12 digits, separated by spaces or dashes every 4 digits, OR all together
const aadhaarRegex = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;

// PAN Card: 5 uppercase letters, 4 digits, 1 uppercase letter
const panRegex = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g;

// DOB: DD/MM/YYYY or DD-MM-YYYY (also handles D/M/YYYY loosely)
const dobRegex = /\b(?:0?[1-9]|[12][0-9]|3[01])[-/](?:0?[1-9]|1[0-2])[-/](?:19|20)\d{2}\b/g;

// OTP: 4 or 6 digits (context-gated)
const otpRegex = /\b(?:\d{4}|\d{6})\b/g;

// Email
const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}\b/g;

// Bank Account: 9-18 digits (context-gated)
const bankRegex = /\b\d{9,18}\b/g;

/* -------------------- 🔥 KEYWORDS -------------------- */
const KEYWORDS = {
  otp: ["otp", "code", "passcode", "verification", "one-time password"],
  bank: ["bank", "account", "acc", "ifsc", "transfer", "deposit", "savings", "current"]
};

/* -------------------- 🔥 DETECTION -------------------- */
function detectSensitive(content) {
  const results = [];
  const seen = new Set();
  // Track raw digit strings already claimed by higher-priority types
  const claimedDigits = new Set();

  const lines = content.split("\n");

  for (let line of lines) {
    const lower = line.toLowerCase();

    // 📧 EMAIL (most specific — detect first)
    const emails = line.match(emailRegex) || [];
    for (let e of emails) {
      const key = "email:" + e;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({ value: e, type: "email" });
      }
    }

    // 🪪 AADHAAR (12 digits — detect before phone to avoid overlap)
    const aadhaar = line.match(aadhaarRegex) || [];
    for (let a of aadhaar) {
      const digits = a.replace(/\D/g, "");
      // Must be exactly 12 digits
      if (digits.length !== 12) continue;
      const key = "aadhaar:" + digits;
      if (!seen.has(key)) {
        seen.add(key);
        claimedDigits.add(digits);
        results.push({ value: a, type: "aadhaar" });
      }
    }

    // 🆔 PAN
    const pan = line.match(panRegex) || [];
    for (let p of pan) {
      const key = "pan:" + p;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({ value: p, type: "pan" });
      }
    }

    // 📅 DOB (detect before phone/OTP so dates aren't misclassified)
    const dobs = line.match(dobRegex) || [];
    for (let d of dobs) {
      const key = "dob:" + d;
      if (!seen.has(key)) {
        seen.add(key);
        // Claim the digits so phone doesn't re-match them
        claimedDigits.add(d.replace(/\D/g, ""));
        results.push({ value: d, type: "dob" });
      }
    }

    // 📞 PHONE (detect after Aadhaar/DOB)
    const phones = line.match(phoneRegex) || [];
    for (let p of phones) {
      const rawDigits = p.replace(/\D/g, "");
      // Extract just the 10-digit core (strip leading 91 country code if present)
      const core = rawDigits.length > 10 ? rawDigits.slice(-10) : rawDigits;
      // Skip if these digits were already claimed as Aadhaar or DOB
      if (claimedDigits.has(rawDigits) || claimedDigits.has(core)) continue;
      // Must have exactly 10 core digits starting with 6-9
      if (core.length !== 10 || !/^[6-9]/.test(core)) continue;
      const key = "phone:" + core;
      if (!seen.has(key)) {
        seen.add(key);
        claimedDigits.add(core);
        results.push({ value: p.trim(), type: "phone" });
      }
    }

    // 🔐 OTP (context-gated)
    const otps = line.match(otpRegex) || [];
    for (let o of otps) {
      if (claimedDigits.has(o)) continue;
      
      // Prevent pincodes from being flagged as OTP
      const isPincode = lower.includes("pincode") || lower.includes("pin code") || lower.includes("zip") || lower.includes("postal");
      if (isPincode) continue;

      const hasOtpKeyword = KEYWORDS.otp.some(k => lower.includes(k)) || /\bpin\b/i.test(line);
      if (hasOtpKeyword) {
        const key = "otp:" + o;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({ value: o, type: "otp" });
        }
      }
    }

    // 🏦 BANK (context-gated)
    const banks = line.match(bankRegex) || [];
    for (let b of banks) {
      if (claimedDigits.has(b)) continue;
      if (KEYWORDS.bank.some(k => lower.includes(k))) {
        const key = "bank:" + b;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({ value: b, type: "bank" });
        }
      }
    }
  }

  return results;
}

const detectSensitiveML = async (content) => {
  // Always run Regex detection first (100% recall on standard formats)
  const regexResults = detectSensitive(content);
  
  let mlResults = [];
  try {
    const response = await axios.post("http://localhost:8000/detect-pii", { text: content });
    if (response.data && response.data.detected) {
      mlResults = response.data.detected;
      console.log("🤖 ML PII Detected count:", mlResults.length);
    }
  } catch (err) {
    console.error("❌ ML PII Service failed, using Regex only:", err.message);
    return regexResults;
  }

  // Merge ML and Regex results
  const merged = [];
  const seenValues = new Set();

  // Helper to normalize values for comparison (ignore whitespace, punctuation, case)
  const normalize = (v) => v.toLowerCase().replace(/[^a-z0-9]/g, "");

  // Prioritize Regex results first
  for (const item of regexResults) {
    const norm = normalize(item.value);
    if (norm) {
      seenValues.add(norm);
      merged.push(item);
    }
  }

  // Add ML results if not already captured by regex
  for (const item of mlResults) {
    const norm = normalize(item.value);
    if (norm && !seenValues.has(norm)) {
      seenValues.add(norm);
      const validTypes = ["phone", "email", "pan", "aadhaar", "bank", "dob", "otp"];
      if (validTypes.includes(item.type)) {
        merged.push(item);
      }
    }
  }

  return merged;
};

/* -------------------- 🔥 SUMMARY FROM DETECTION -------------------- */
function generateSummary(detected) {
  if (detected.length === 0) {
    return "The document contains general text with no sensitive information.";
  }

  const types = [...new Set(detected.map(d => d.type))];

  return `The document contains ${types.join(
    ", "
  )} information which may be sensitive and should be handled carefully.`;
}

/* -------------------- 🔥 ROUTE -------------------- */
router.post("/scan", upload.single("file"), async (req, res) => {
  try {
    const filePath = req.file.path;
    const mimeType = req.file.mimetype;

    let content = "";

    /* -------- TEXT -------- */
    if (mimeType === "text/plain") {
      content = fs.readFileSync(filePath, "utf-8");
    }

    /* -------- PDF -------- */
    else if (mimeType === "application/pdf") {
      const buffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(buffer);
      content = pdfData.text;

      if (!content || content.trim().length === 0) {
        return res.json({
          summary: "Scanned/image PDF (text not extractable)",
          detected: [],
          content: "",
        });
      }
    }

    /* -------- IMAGE -------- */
    else if (mimeType.startsWith("image/")) {
      try {
        const result = await Tesseract.recognize(filePath, "eng");

        const content = result.data.text;

        if (!content || content.trim().length === 0) {
          return res.json({
            summary: "No readable text found in image.",
            detected: [],
            content: "",
          });
        }

        // 🔥 REUSE SAME LOGIC
        const detected = await detectSensitiveML(content);

        let summary;

        if (detected.length > 0) {
          summary = generateSummary(detected);
        } else {
          summary = "The image contains text but no sensitive information.";
        }

        return res.json({
          summary,
          detected,
          content,
        });

      } catch (err) {
        console.error("OCR ERROR:", err);
        return res.status(500).json({ error: "Image scan failed" });
      }
    }

    /* -------- DETECT (SOURCE OF TRUTH) -------- */
    const detected = await detectSensitiveML(content);

    /* -------- SUMMARY -------- */
    let summary;
    let defaultSummary = generateSummary(detected);

    // Get AI explanation
    const shortText = content.slice(0, 800);
    const aiSummary = await getSummary(shortText);

    if (aiSummary) {
      if (detected.length > 0) {
        summary = `⚠️ Sensitive Information Detected: ${defaultSummary}\n\n📝 AI File Summary: ${aiSummary.trim()}`;
      } else {
        summary = `📝 AI File Summary: ${aiSummary.trim()}`;
      }
    } else {
      summary = defaultSummary;
    }

    return res.json({
      summary,
      detected,
      content,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Scan failed" });
  }
});

router.post("/mask-file", upload.single("file"), async (req, res) => {
  try {
    const maskedItems = req.body.maskedItems ? JSON.parse(req.body.maskedItems) : [];
    const filePath = req.file.path;
    const mimeType = req.file.mimetype;
    const originalBuffer = fs.readFileSync(filePath);

    if (maskedItems.length === 0) {
      return res.json({ fileUrl: `http://localhost:5000/${filePath}` });
    }

    /* -------- PDF REDACTION -------- */
    if (mimeType === "application/pdf") {
      const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
      const pdfDoc = await PDFDocument.load(originalBuffer);
      const pages = pdfDoc.getPages();
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const data = new Uint8Array(originalBuffer);
      const loadingTask = pdfjsLib.getDocument({
        data,
        disableFontFace: true,
        standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
      });
      
      const pdfJsDoc = await loadingTask.promise;

      for (let pageNum = 1; pageNum <= pdfJsDoc.numPages; pageNum++) {
        const page = await pdfJsDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pdfLibPage = pages[pageNum - 1];

        for (const item of textContent.items) {
          if (!item.str) continue;

          for (const mItem of maskedItems) {
            if (item.str.includes(mItem.original)) {
               const tx = item.transform[4];
               const ty = item.transform[5];
               const fontSize = item.transform[3]; 
               const width = item.width;

               // White rectangle to erase
               pdfLibPage.drawRectangle({
                 x: tx,
                 y: ty - (fontSize * 0.2), 
                 width: width + 2, 
                 height: fontSize * 1.2, 
                 color: rgb(1, 1, 1), 
               });

               // Draw masked text
               pdfLibPage.drawText(mItem.masked, {
                 x: tx,
                 y: ty,
                 size: fontSize,
                 font: helveticaFont,
                 color: rgb(0.1, 0.1, 0.1),
               });
            }
          }
        }
      }

      const pdfBytes = await pdfDoc.save();
      const fileName = `masked-${Date.now()}.pdf`;
      fs.writeFileSync(`uploads/${fileName}`, pdfBytes);
      return res.json({ fileUrl: `http://localhost:5000/uploads/${fileName}` });
    }
    
    /* -------- IMAGE REDACTION -------- */
    else if (mimeType.startsWith("image/")) {
       const Tesseract = require("tesseract.js");
       const { createCanvas, loadImage } = require("canvas");
       
       const image = await loadImage(filePath);
       const canvas = createCanvas(image.width, image.height);
       const ctx = canvas.getContext("2d");
       
       // Draw original image
       ctx.drawImage(image, 0, 0, image.width, image.height);
       
       // Re-run OCR to get precise bounding boxes
       const worker = await Tesseract.createWorker("eng");
       const result = await worker.recognize(filePath, {}, { blocks: true });
       await worker.terminate();

       const words = [];
       if (result.data.blocks) {
         for (const block of result.data.blocks) {
           for (const paragraph of block.paragraphs) {
             for (const line of paragraph.lines) {
               for (const word of line.words) {
                 words.push(word);
               }
             }
           }
         }
       }
       
       for (const mItem of maskedItems) {
         let textDrawn = false;
         const searchStr = mItem.original.replace(/\s/g, "");

         for (const word of words) {
           const wordClean = word.text.replace(/\s/g, "");
           if (!wordClean || wordClean.length < 4) continue; // Safety minimum length
           
           if (searchStr.includes(wordClean) || wordClean.includes(searchStr)) {
             const { x0, y0, x1, y1 } = word.bbox;
             const width = x1 - x0;
             const height = y1 - y0;
             
             // Sample a pixel slightly further from the text to get a true background color
             const sampleX = Math.max(0, x0 - 6);
             const sampleY = Math.max(0, y0 - 6);
             const bgPixel = ctx.getImageData(sampleX, sampleY, 1, 1).data;
             const bgColor = `rgb(${bgPixel[0]}, ${bgPixel[1]}, ${bgPixel[2]})`;
             
             ctx.save();
             // Add a blur effect to the edges of the masking box so it blends seamlessly
             ctx.shadowColor = bgColor;
             ctx.shadowBlur = 12;
             ctx.fillStyle = bgColor;
             
             // Draw the masking rectangle slightly larger to ensure full coverage
             ctx.fillRect(x0 - 4, y0 - 4, width + 8, height + 8);
             ctx.restore();
             
             // Draw masked string once
             if (!textDrawn) {
               ctx.fillStyle = "#111111";
               ctx.font = `bold ${Math.floor(height * 0.85)}px sans-serif`;
               ctx.fillText(mItem.masked, x0, y1 - (height * 0.15));
               textDrawn = true;
             }
           }
         }
       }
       
       const buffer = canvas.toBuffer(mimeType === "image/png" ? "image/png" : "image/jpeg");
       const ext = mimeType === "image/png" ? "png" : "jpg";
       const fileName = `masked-${Date.now()}.${ext}`;
       
       fs.writeFileSync(`uploads/${fileName}`, buffer);
       return res.json({ fileUrl: `http://localhost:5000/uploads/${fileName}` });
    }

    // Default fallback
    return res.json({ fileUrl: `http://localhost:5000/${filePath}` });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "File redaction failed" });
  }
});

module.exports = router;