Privacy-First Secure Sharing Platform
A smart communication platform that detects, warns, and protects sensitive information before sharing files or images.

Overview
This application ensures users do not unintentionally expose personal or confidential data while sharing files. It performs pre-send analysis, detects sensitive information, and allows users to selectively mask or encrypt data.

Features
Smart Data Detection
Automatically detects sensitive information such as:
Phone numbers
Bank/account details
Emails
Personal identifiers
Multi-Format Support
Works with:
Documents (PDF,TXT)
Images (via OCR)
Real-Time Risk Alerts
Provides warnings and highlights risky content before sending.
Selective Masking
Users can choose what data to hide instead of masking everything.
AI-Based Summarization
Generates a summary and explains detected risks clearly.
Secure Output
Sends only the masked/safe version of the file.
AI Chat Assistant
Smart Chatbot Integration
Integrated AI chatbot that assists users within the application.
Context-Aware Responses
Users can ask questions about any sent or received data/files, and the chatbot responds intelligently.
Powered by Stored Data
The chatbot uses a secure internal dataset (chat history & processed content) to provide relevant answers.

Workflow
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

How It Works
File Upload
User uploads a document or image.
Text Extraction
Documents → Parsed
Images → OCR (Tesseract)
Content Analysis
Regex for structured data
AI/NLP for contextual understanding
Risk Detection
Classifies data into risk levels (LOW / MEDIUM / HIGH).
User Interaction
Displays detected sensitive data with options to select.
Masking Engine
Applies masking only to selected content.
Final Output
Generates a safe, shareable version of the file.

Tech Stack
Frontend
React.js
HTML/CSS
Backend
AI & Processing
Tesseract OCR
Regex
NLP / AI models (for detection & summarization)
PIL (image handling)
