import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import "../css/chat.css";

export default function Home() {
  const navigate = useNavigate();

  const [activeChat, setActiveChat] = useState(null);
  const [messageInput, setMessageInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [socket, setSocket] = useState(null);
  const [user, setUser] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const [scanResult, setScanResult] = useState(null);
  const [showScanPanel, setShowScanPanel] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  const [showNewChat, setShowNewChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
const [modifiedContent, setModifiedContent] = useState("");
const [maskedItems, setMaskedItems] = useState([]);
  const BACKEND_URL = "http://localhost:5000";

  // 🔹 API helper
  const api = async (path, opts = {}) => {
    const token = localStorage.getItem("token");

    const res = await fetch(`${BACKEND_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: "Bearer " + token }),
      },
      credentials: "include",
      ...opts,
    });

    if (res.status === 401) {
      localStorage.removeItem("token");
      navigate("/");
      throw new Error("Unauthorized");
    }

    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }

    return res.json();
  };

  // 🔹 Auth + token handling
  useEffect(() => {
    let token = localStorage.getItem("token");
    const urlToken = new URLSearchParams(window.location.search).get("token");

    if (urlToken) {
      localStorage.setItem("token", urlToken);
      token = urlToken;
      // Clean the URL to hide the token
      window.history.replaceState({}, document.title, "/home");
    }

    if (!token) {
      navigate("/");
      return;
    }

    // decode user (optional fallback)
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      setUser(payload);
    } catch { }
  }, [navigate]);

  const maskValue = (value, type) => {
  if (type === "phone") {
    return value.slice(0, -2).replace(/./g, "X") + value.slice(-2);
  }

  if (type === "email") {
    const [name, domain] = value.split("@");
    return name.replace(/./g, "X") + "@" + domain;
  }

  if (type === "pan" || type === "aadhaar" || type === "bank") {
    return value.slice(0, -2).replace(/./g, "X") + value.slice(-2);
  }

  return value;
};

const handleEncrypt = async (item) => {
  if (!scanResult) return;

  const masked = maskValue(item.value, item.type);

  let currentContent = modifiedContent;
  if (!currentContent) {
    if (previewFile?.type === "application/pdf" || previewFile?.type?.startsWith("image/")) {
      currentContent = scanResult.content || "";
    } else if (previewFile) {
      try {
        currentContent = await previewFile.text();
      } catch (e) {
        console.error("Failed to read file text", e);
        currentContent = previewFile.name || "";
      }
    }
  }

  let updated = currentContent.replaceAll(item.value, masked);

  setModifiedContent(updated);

  // Track the masked items for advanced PDF redaction
  setMaskedItems(prev => {
    if (!prev.some(i => i.original === item.value)) {
      return [...prev, { original: item.value, masked: masked }];
    }
    return prev;
  });

  // Update UI instantly
  setScanResult(prev => ({
    ...prev,
    detected: prev.detected.map(d =>
      d.value === item.value ? { ...d, value: masked } : d
    )
  }));
};
  // 🔹 Load rooms
  useEffect(() => {
    const loadRooms = async () => {
      try {
        const data = await api("/api/rooms");
        setRooms(data);
      } catch (err) {
        console.error(err);
      }
    };

    loadRooms();
  }, []);

  const handleSearch = async (q) => {
    setSearchQuery(q);

    if (!q.trim()) {
      setSearchResults([]);
      return;
    }

    const res = await api(`/api/users/search?q=${q}`);
    setSearchResults(res);
  };

  // 🔹 Socket connection
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const newSocket = io(BACKEND_URL, {
      auth: { token },
    });

    newSocket.on("connect", () => {
      console.log("✅ Socket connected");
    });

    newSocket.on("message:new", (msg) => {
      if (msg.roomId === activeChat) {
        setMessages((prev) => [
          ...prev,
          {
            id: msg._id,
            senderId: msg.sender._id === user?.id ? "me" : msg.sender._id,
            text: msg.content,

            type: msg.type || "text", // 👈 ADD THIS
            time: new Date(msg.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            isSent: msg.sender._id === user?.id,
          },
        ]);
      }
    });



    setSocket(newSocket);

    return () => newSocket.disconnect();
  }, [activeChat, user]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startChat = async (userId) => {
    const room = await api("/api/rooms/create", {
      method: "POST",
      body: JSON.stringify({ userId }),
    });

    setShowNewChat(false);

    // refresh rooms
    const updatedRooms = await api("/api/rooms");
    setRooms(updatedRooms);

    // open chat
    handleSelectRoom(room);
  };

  // 🔹 Select room
  const handleSelectRoom = async (room) => {
    setActiveChat(room._id);

    if (socket) {
      socket.emit("room:join", { roomId: room._id });
    }

    const msgs = await api(`/api/rooms/${room._id}/history`);

    setMessages(
      msgs.map((m) => ({
        id: m._id,
        senderId: m.sender?._id === user?.id ? "me" : m.sender?._id,
        text: m.content,
        time: new Date(m.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        isSent: m.sender?._id === user?.id,
      }))
    );
  };

  // 🔹 Send message
  const handleSendMessage = (e) => {
    if (e) e.preventDefault();
    if (!messageInput.trim() || !socket || !activeChat) return;

    socket.emit("message:send", {
      roomId: activeChat,
      content: messageInput,
    });

    setMessageInput("");
  };

  

  // 🔹 Handle textarea keys and sizing
  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const autoResize = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
    setMessageInput(e.target.value);
  };

  const activeRoom = rooms.find((r) => r._id === activeChat);

  return (
    <div className="shell">
      {/* ═══ SIDEBAR ═══ */}
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">💬</div>
          <div>
            <h1 className="logo-text">CipherChat</h1>
            <p className="logo-sub">Advanced Secure Comms</p>
          </div>
        </div>

        <button
          className="new-chat-btn"
          onClick={() => setShowNewChat(true)}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          New Chat
        </button>

        {showNewChat && (
          <div style={{ padding: "10px" }}>
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                marginBottom: "8px",
                borderRadius: "6px",
                border: "1px solid #ccc"
              }}
            />

            <div>
              {Array.isArray(searchResults) && searchResults.map((u) => (
                <div
                  key={u._id}
                  onClick={() => startChat(u._id)}
                  style={{
                    padding: "8px",
                    cursor: "pointer",
                    borderBottom: "1px solid #eee"
                  }}
                >
                  👤 {u.name}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="sidebar-label">Recent Chats</div>

        <div className="history-list">
          {rooms.map((room) => {
            const displayName = room.isPrivate && room.members
              ? room.members.find(m => m._id !== user?.id)?.name || "User"
              : room.name || "Chat Room";
            return (
              <div
                key={room._id}
                className={`history-item ${activeChat === room._id ? "active" : ""}`}
                onClick={() => handleSelectRoom(room)}
              >
                <span style={{ fontSize: "16px" }}>💬</span> {displayName}
              </div>
            );
          })}
        </div>

        <div className="sidebar-footer">
          <span>{user?.name || "User"}</span>
          <span style={{ color: "#34d399" }}>Online</span>
        </div>
      </aside>

      {/* ═══ MAIN ═══ */}
      <div className="main">
        {previewFile ? (
          <div className="file-preview-page">
            <div className="preview-main">
              <div className="preview-header">
                <button className="preview-close-btn" onClick={() => {
                  setPreviewFile(null);
                  if (previewUrl) URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                  setScanResult(null);
                  setModifiedContent("");
                  setMaskedItems([]);
                }} title="Close Preview">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
                <h2>File Preview</h2>
              </div>

              <div className="preview-content-center">
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="preview-image" />
                ) : (
                  <div className="preview-file-icon">
                    <div className="icon">📄</div>
                    <span>{previewFile.name}</span>
                  </div>
                )}
              </div>

              <div className="preview-footer">
                <button className="preview-send-btn" onClick={async () => {
                  if (!previewFile || !socket || !activeChat) return;

                  try {
                    const formData = new FormData();

                    // ✅ SECURE DOCUMENT CASE (PDFs & Images)
                    if ((previewFile?.type === "application/pdf" || previewFile?.type?.startsWith("image/")) && maskedItems.length > 0) {
                      const formDataMask = new FormData();
                      formDataMask.append("file", previewFile);
                      formDataMask.append("maskedItems", JSON.stringify(maskedItems));

                      const resMask = await fetch("http://localhost:5000/api/mask-file", {
                        method: "POST",
                        body: formDataMask,
                      });

                      if (!resMask.ok) {
                        throw new Error(`File Masking failed: ${resMask.status}`);
                      }

                      const dataMask = await resMask.json();
                      
                      if (!dataMask.fileUrl) {
                        throw new Error("No fileUrl returned from mask-file");
                      }

                      // Fetch the generated secured file from backend to re-upload into chat flow
                      const response = await fetch(dataMask.fileUrl);
                      const blob = await response.blob();

                      // Determine correct extension
                      const isPdf = previewFile.type === "application/pdf";
                      let ext = isPdf ? "pdf" : (previewFile.type === "image/png" ? "png" : "jpg");
                      
                      const filename = previewFile.name 
                        ? previewFile.name.replace(/\.[^/.]+$/, "") + `-secured.${ext}` 
                        : `secured.${ext}`;

                      formData.append("file", blob, filename);
                    }
                    // ✅ TEXT CASE (or any other modified content)
                    else if (modifiedContent) {
                      const blob = new Blob([modifiedContent], { type: "text/plain" });

                      const filename = previewFile.name
                        ? previewFile.name.replace(/\.[^/.]+$/, "") + "-secured.txt"
                        : "secured.txt";

                      formData.append("file", blob, filename);
                    }
                    // ✅ DEFAULT
                    else {
                      formData.append("file", previewFile);
                    }

                    // 1️⃣ Upload file to backend
                    const res = await fetch("http://localhost:5000/api/upload", {
                      method: "POST",
                      body: formData
                    });

                    if (!res.ok) {
                       throw new Error(`Upload failed with status ${res.status}`);
                    }

                    const data = await res.json();

                    if (!data.fileUrl) {
                       throw new Error("No fileUrl returned from backend");
                    }

                    console.log("Uploaded file URL:", data.fileUrl);

                    // 2️⃣ Send via socket
                    socket.emit("message:send", {
                      roomId: activeChat,
                      content: data.fileUrl,
                      type: "file"
                    });

                  } catch (err) {
                    console.error("File send error:", err);
                    alert("Failed to send encrypted file. See console for details.");
                  }

                  // 3️⃣ Reset UI
                  setPreviewFile(null);
                  if (previewUrl) URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                  setScanResult(null);
                  setModifiedContent("");
                  setMaskedItems([]);
                }} title="Send">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
              </div>
            </div>

            <div className="preview-scan-wrapper">
              <div className="scan-header">
                <h3>📄 File Intelligence</h3>
              </div>

              {isScanning ? (
                <div className="scan-loader">
                  <div className="scan-loader-spinner"></div>
                  <span>Analyzing file securely...</span>
                </div>
              ) : (
                <div className="scan-content">
                  

  {/* SHOW ONLY WHEN SCAN EXISTS */}
  {scanResult ? (
    <>

      {/* ✅ SUMMARY */}
      <div className="scan-section">
        <div className="scan-section-title">✨ AI Summary</div>
        <div className="scan-summary-box">
          {scanResult.summary}
        </div>
      </div>

      {/* 📞 PHONES */}
      {scanResult.detected?.some(d => d.type === "phone") && (
        <div className="scan-section">
          <div className="scan-section-title">📞 Extracted Phones</div>
          <div className="scan-list">
            {scanResult.detected
              .filter(d => d.type === "phone")
              .map((p, i) => (
                <div key={i} className="scan-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>📱 {p.value}</span>
                  <button onClick={() => handleEncrypt(p)} className="encrypt-btn" style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", border: "none", padding: "6px 12px", borderRadius: "6px", color: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px", boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0110 0v4"></path></svg>
                    Encrypt
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 📧 EMAILS */}
      {scanResult.detected?.some(d => d.type === "email") && (
        <div className="scan-section">
          <div className="scan-section-title">📧 Extracted Emails</div>
          <div className="scan-list">
            {scanResult.detected
              .filter(d => d.type === "email")
              .map((e, i) => (
                <div key={i} className="scan-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>✉️ {e.value}</span>
                  <button onClick={() => handleEncrypt(e)} className="encrypt-btn" style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", border: "none", padding: "6px 12px", borderRadius: "6px", color: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px", boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0110 0v4"></path></svg>
                    Encrypt
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 🪪 PAN */}
      {scanResult.detected?.some(d => d.type === "pan") && (
        <div className="scan-section">
          <div className="scan-section-title">🪪 PAN</div>
          <div className="scan-list">
            {scanResult.detected
              .filter(d => d.type === "pan")
              .map((p, i) => (
                <div key={i} className="scan-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>🆔 {p.value}</span>
                  <button onClick={() => handleEncrypt(p)} className="encrypt-btn" style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", border: "none", padding: "6px 12px", borderRadius: "6px", color: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px", boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0110 0v4"></path></svg>
                    Encrypt
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 🆔 AADHAAR */}
      {scanResult.detected?.some(d => d.type === "aadhaar") && (
        <div className="scan-section">
          <div className="scan-section-title">🆔 Aadhaar</div>
          <div className="scan-list">
            {scanResult.detected
              .filter(d => d.type === "aadhaar")
              .map((a, i) => (
                <div key={i} className="scan-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>📄 {a.value}</span>
                  <button onClick={() => handleEncrypt(a)} className="encrypt-btn" style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", border: "none", padding: "6px 12px", borderRadius: "6px", color: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px", boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0110 0v4"></path></svg>
                    Encrypt
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 🏦 BANK */}
      {scanResult.detected?.some(d => d.type === "bank") && (
        <div className="scan-section">
          <div className="scan-section-title">🏦 Bank</div>
          <div className="scan-list">
            {scanResult.detected
              .filter(d => d.type === "bank")
              .map((b, i) => (
                <div key={i} className="scan-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>💳 {b.value}</span>
                  <button onClick={() => handleEncrypt(b)} className="encrypt-btn" style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", border: "none", padding: "6px 12px", borderRadius: "6px", color: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px", boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0110 0v4"></path></svg>
                    Encrypt
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

    </>
  ) : (
    <div className="scan-summary-placeholder">
      Upload a file to analyze sensitive data
    </div>
  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Top bar */}
            <div className="topbar">
              <div className="topbar-title">
                {activeRoom 
                  ? (activeRoom.isPrivate && activeRoom.members
                      ? activeRoom.members.find(m => m._id !== user?.id)?.name || "User"
                      : activeRoom.name) 
                  : "Select a Chat"}
              </div>
              <div className="status-dot">
                <div className="dot"></div>Connected
              </div>
            </div>

            {/* Messages */}
            <div className="messages">
              {!activeRoom ? (
                <div className="welcome">
                  <div className="welcome-icon">💬</div>
                  <h1>Welcome to CipherChat</h1>
                  <p>Select a recent chat from the left or start a new conversation. Enjoy secure, seamless, and lightning-fast messaging.</p>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <div key={msg.id} className={`msg-row ${msg.isSent ? "sent" : "received"}`}>
                      <div className={`avatar ${msg.isSent ? "sent" : "received"}`}>
                        {msg.isSent ? "👤" : "💬"}
                      </div>
                      <div className={`bubble ${msg.isSent ? "sent" : "received"}`}>
                        {msg.type === "file" || msg.text.includes("/uploads/") ? (
                          <a href={msg.text} target="_blank">📎 Open File</a>
                        ) : (
                          msg.text
                        )}
                        <span className="msg-time">{msg.time}</span>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            <div className="input-area">
              <div className="input-box" style={{ position: "relative" }}>
                <button
                  className="attach-btn"
                  onClick={() => setShowAttachMenu(!showAttachMenu)}
                  title="Attach File"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                </button>

                {showAttachMenu && (
                  <div className="attach-menu">
                    <button className="attach-menu-item" onClick={() => {
                      setShowAttachMenu(false);
                      fileInputRef.current?.click();
                    }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Upload File
                    </button>
                  </div>
                )}

                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    console.log("Selected:", file.name);

                    setPreviewFile(file);
                    if (file.type.startsWith("image/")) {
                      setPreviewUrl(URL.createObjectURL(file));
                    } else {
                      setPreviewUrl(null);
                    }

                    setIsScanning(true);
                    setScanResult(null);
                    setModifiedContent("");
                    setMaskedItems([]);

                    const formData = new FormData();
                    formData.append("file", file);

                    try {
                      const res = await fetch("http://localhost:5000/api/scan", {
                        method: "POST",
                        body: formData
                      });
                      const data = await res.json();
                      console.log("Scan result:", data);
                      setScanResult(data);
                    } catch (err) {
                      console.error(err);
                    } finally {
                      setIsScanning(false);
                    }
                  }}
                />

                <textarea
                  rows={1}
                  placeholder={activeRoom ? "Type a message..." : "Select a room to chat..."}
                  value={messageInput}
                  onChange={autoResize}
                  onKeyDown={handleKey}
                  disabled={!activeRoom}
                />
                <button
                  className="send-btn"
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || !activeRoom}
                  title="Send"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                    <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              <div className="input-hint">
                Press <span className="kbd">Enter</span> to send &nbsp;·&nbsp; <span className="kbd">Shift+Enter</span> for new line
              </div>
            </div>

          </>
        )}
      </div>
    </div>

  );
}