##  Personal Data Privacy Analyzer

---

###  Problem

Users often unknowingly share sensitive personal information in documents, increasing the risk of **data breaches and misuse**.

---

###  Challenge

Create a tool that:

-  Scans uploaded files (PDFs, images, documents)  
-  Identifies sensitive data (e.g., Aadhaar, PAN, phone numbers, emails)  
-  Highlights or masks sensitive information  

---

### Goal

Help users **safeguard personal data** and promote **responsible data sharing practices**.

# Privacy-First Secure Sharing Platform
---
A smart communication platform that **detects, warns, and protects sensitive information** before sharing files or images.

---

##  Overview

This application ensures users do not unintentionally expose personal or confidential data while sharing files.  

It performs **pre-send analysis**, detects sensitive information, and allows users to **selectively mask or encrypt data**.

---

##  Features

###  Smart Data Detection
Automatically detects sensitive information such as:
- Phone numbers  
- Bank/account details  
- Emails  
- Personal identifiers  

---

###  Multi-Format Support
Works with:
- Documents (PDF, TXT)  
- Images (via OCR)  

---

###  Real-Time Risk Alerts
Provides warnings and highlights risky content before sending.

---

###  Selective Masking
Users can choose what data to hide instead of masking everything.

---

###  AI-Based Summarization
Generates a summary and explains detected risks clearly.

---

###  Secure Output
Sends only the masked/safe version of the file.

---

###  AI Chat Assistant

####  Smart Chatbot Integration
Integrated AI chatbot that assists users within the application.

####  Context-Aware Responses
Users can ask questions about any **sent or received data/files**, and the chatbot responds intelligently.

####  Powered by Stored Data
The chatbot uses a **secure internal dataset (chat history & processed content)** to provide relevant answers.

---

##  Workflow

Upload File
↓
Text Extraction (OCR / Parser)
↓
Content Analysis (Regex + AI)
↓
Sensitive Data Detection
↓
Risk Classification
↓
User Review (UI Panel)
↓
Selective Masking
↓
Safe File Sharing



---

##  How It Works

### 1. File Upload
User uploads a document or image.

### 2. Text Extraction
- Documents → Parsed  
- Images → OCR (Tesseract)  

### 3. Content Analysis
- Regex for structured data  
- AI/NLP for contextual understanding  

### 4. Risk Detection
Classifies data into risk levels (**LOW / MEDIUM / HIGH**).

### 5. User Interaction
Displays detected sensitive data with options to select.

### 6. Masking Engine
Applies masking only to selected content.

### 7. Final Output
Generates a safe, shareable version of the file.

---

##  Tech Stack

### Frontend
- React.js  
- HTML/CSS  

### Backend
- NodeJS

### AI & Processing
- Tesseract OCR  
- Regex  
- AI models (for detection & summarization)  
- PIL (image handling)  

---
