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
const getSummary = async (text) => {
  try {
    const res = await axios.post(
      "http://localhost:11434/api/generate",
      {
        model: "phi",
        prompt: `
Analyze the document and explain its content.

Rules:
- Explain what the document contains
- Give a good summary related to the content what is present in Document.
- Do NOT assume anything
- Do NOT mention sensitive data unless clearly visible


Document:
${text}
`,
        stream: false,
      },
      { timeout: 4000 }
    );

    return res.data.response;
  } catch {
    return null;
  }
};

/* -------------------- 🔥 REGEX -------------------- */
const phoneRegex =
  /(\+?\d{1,3}[-.\s]?)?\(?\d{3,5}\)?[-.\s]?\d{3,5}[-.\s]?\d{3,5}/g;

// ✅ FIXED EMAIL REGEX
const emailRegex =
  /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}\b/g;

const aadhaarRegex = /\b\d{4}\s?\d{4}\s?\d{4}\b/g;

const panRegex = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g;

const bankRegex = /\b\d{9,18}\b/g;

/* -------------------- 🔥 KEYWORDS -------------------- */
const KEYWORDS = {
  bank: ["account", "bank", "ifsc"],
};

/* -------------------- 🔥 DETECTION -------------------- */
function detectSensitive(content) {
  const results = [];
  const seen = new Set();

  const lines = content.split("\n");

  for (let line of lines) {
    const lower = line.toLowerCase();

    // 📞 PHONE
    const phones = line.match(phoneRegex) || [];
    for (let p of phones) {
      const clean = p.replace(/\D/g, "");
      if (clean.length >= 10 && clean.length <= 12) {
        const key = "phone" + clean;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({ value: clean, type: "phone" });
        }
      }
    }

    // 📧 EMAIL
    const emails = line.match(emailRegex) || [];
    for (let e of emails) {
      const key = "email" + e;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({ value: e, type: "email" });
      }
    }

    // 🪪 AADHAAR
    const aadhaar = line.match(aadhaarRegex) || [];
    for (let a of aadhaar) {
      const clean = a.replace(/\s/g, "");
      const key = "aadhaar" + clean;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({ value: clean, type: "aadhaar" });
      }
    }

    // 🆔 PAN
    const pan = line.match(panRegex) || [];
    for (let p of pan) {
      const key = "pan" + p;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({ value: p, type: "pan" });
      }
    }

    // 🏦 BANK (context-based)
    const bank = line.match(bankRegex) || [];
    for (let b of bank) {
      if (KEYWORDS.bank.some(k => lower.includes(k))) {
        const key = "bank" + b;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({ value: b, type: "bank" });
        }
      }
    }
  }

  return results;
}

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
    const detected = detectSensitive(content);

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
    const detected = detectSensitive(content);

    /* -------- SUMMARY -------- */
    let summary;

    // ⚡ Fast path
    if (content.length < 200) {
      summary = generateSummary(detected);
    } else {
      // optional AI explanation
      const shortText = content.slice(0, 300);
      const aiSummary = await getSummary(shortText);

      summary = aiSummary || generateSummary(detected);
    }

    // 🔥 FORCE CONSISTENCY (MOST IMPORTANT)
    if (detected.length > 0) {
      summary = generateSummary(detected);
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