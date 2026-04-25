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

  // 🔹 Analytics state
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

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

const handleToggleMask = async (item) => {
  if (!scanResult) return;

  setScanResult(prev => ({
    ...prev,
    detected: prev.detected.map(d => {
      if (d.original === item.original) {
        const newMaskedState = !d.isMasked;

        return {
          ...d,
          isMasked: newMaskedState,
          value: newMaskedState ? d.masked : d.original
        };
      }
      return d;
    })
  }));

  // 🔥 Update content accordingly
  let currentContent = modifiedContent || scanResult.content || "";

  let updatedContent = currentContent;

  if (!item.isMasked) {
    // MASK
    updatedContent = currentContent.replaceAll(item.original, item.masked);
  } else {
    // UNMASK
    updatedContent = currentContent.replaceAll(item.masked, item.original);
  }

  setModifiedContent(updatedContent);
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

  const handleSelectCipherX = () => {
    setActiveChat("cipherx");
    setMessages([{
      id: "welcome-cipherx",
      senderId: "cipherx",
      text: "Hello! I am CipherX, your advanced AI assistant. How can I help you today?",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isSent: false,
      isAi: true
    }]);
  };

  // 🔹 Send message
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!messageInput.trim() || !activeChat) return;

    if (activeChat === "cipherx") {
      const userMsg = {
        id: Date.now(),
        senderId: "me",
        text: messageInput,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        isSent: true,
      };

      setMessages(prev => [...prev, userMsg]);

      const query = messageInput; // 🔥 IMPORTANT
      setMessageInput("");

      try {
        const token = localStorage.getItem("token");
        const res = await fetch("http://localhost:5000/api/rag", { 
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token  
          },
          body: JSON.stringify({ question: query })
        });

        const data = await res.json();

        setMessages(prev => [
          ...prev,
          {
            id: Date.now() + 1,
            senderId: "cipherx",
            text: data.answer || "No response from AI",
            time: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            isSent: false,
            isAi: true
          }
        ]);

      } catch (err) {
        console.error("RAG ERROR:", err);

        setMessages(prev => [
          ...prev,
          {
            id: Date.now() + 2,
            senderId: "cipherx",
            text: "⚠️ Failed to fetch AI response",
            time: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            isSent: false,
            isAi: true
          }
        ]);
      }

      return;
    }

    if (!socket) return;

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

  const handleLogout = async () => {
  try {
    await fetch("http://localhost:5000/api/logout", {
      method: "POST",
      credentials: "include"
    });
  } catch (err) {
    console.error("Logout error:", err);
  }

  localStorage.removeItem("token");
  navigate("/");
};

  const autoResize = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
    setMessageInput(e.target.value);
  };

  // 🔹 Analytics helpers
  const TYPE_META = {
    phone:  { icon: "📱", label: "Phone Numbers", color: "#3b82f6", gradient: "linear-gradient(135deg, #3b82f6, #2563eb)" },
    email:  { icon: "✉️", label: "Email Addresses", color: "#8b5cf6", gradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)" },
    pan:    { icon: "🪪", label: "PAN Cards",       color: "#f59e0b", gradient: "linear-gradient(135deg, #f59e0b, #d97706)" },
    aadhaar:{ icon: "🆔", label: "Aadhaar Numbers", color: "#ef4444", gradient: "linear-gradient(135deg, #ef4444, #dc2626)" },
    bank:   { icon: "🏦", label: "Bank Details",    color: "#10b981", gradient: "linear-gradient(135deg, #10b981, #059669)" },
  };

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const data = await api("/api/analytics");
      setAnalyticsData(data);
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const openAnalytics = () => {
    setShowAnalytics(true);
    fetchAnalytics();
  };

  const VALID_LOG_TYPES = ["phone", "email", "pan", "aadhaar", "bank"];

  const logUnmaskedItems = async (detected) => {
    if (!detected || detected.length === 0) return;
    // Only log items that are unmasked AND have a valid type AND have a masked value
    const unmasked = detected.filter(d =>
      !d.isMasked &&
      VALID_LOG_TYPES.includes(d.type) &&
      (d.masked || d.value)   // must have some value to store
    );
    if (unmasked.length === 0) return;
    try {
      await api("/api/analytics/log", {
        method: "POST",
        body: JSON.stringify({ items: unmasked }),
      });
    } catch (err) {
      console.error("Failed to log unmasked items:", err);
    }
  };

  // 🔹 File card helpers
  const getFileInfo = (url) => {
    const filename = decodeURIComponent(url.split("/").pop().split("?")[0]) || "file";
    const ext = filename.split(".").pop().toLowerCase();
    const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"];
    const isImage = imageExts.includes(ext);
    const isPdf = ext === "pdf";
    const isText = ["txt", "csv", "log", "md", "json"].includes(ext);
    const isSecured = filename.includes("secured");
    let type = "generic";
    if (isImage) type = "image";
    else if (isPdf) type = "pdf";
    else if (isText) type = "text";
    return { filename, ext, type, isSecured, url };
  };

  const renderFileCard = (fileUrl, isSent) => {
    const file = getFileInfo(fileUrl);
    const fullUrl = fileUrl.startsWith("http") ? fileUrl : `${BACKEND_URL}${fileUrl}`;

    if (file.type === "image") {
      return (
        <a href={fullUrl} target="_blank" rel="noreferrer" className="file-card file-card-image">
          <div className="file-card-img-wrap">
            <img src={fullUrl} alt={file.filename} className="file-card-img" loading="lazy" />
            <div className="file-card-img-overlay">
              {file.isSecured && <span className="file-secured-badge">🔒 Secured</span>}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            </div>
          </div>
          <div className="file-card-meta">
            <span className="file-card-name">{file.filename.length > 28 ? file.filename.slice(0, 25) + "..." : file.filename}</span>
            <span className="file-card-ext">{file.ext.toUpperCase()}</span>
          </div>
        </a>
      );
    }

    const iconMap = {
      pdf:     { emoji: "📕", color: "#ef4444", gradient: "linear-gradient(135deg, #ef4444, #dc2626)" },
      text:    { emoji: "📄", color: "#3b82f6", gradient: "linear-gradient(135deg, #3b82f6, #2563eb)" },
      generic: { emoji: "📁", color: "#8b5cf6", gradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)" },
    };
    const icon = iconMap[file.type] || iconMap.generic;

    return (
      <a href={fullUrl} target="_blank" rel="noreferrer" className={`file-card file-card-doc ${isSent ? "file-card-sent" : ""}`}>
        <div className="file-card-icon" style={{ background: icon.gradient }}>
          <span>{icon.emoji}</span>
        </div>
        <div className="file-card-info">
          <span className="file-card-name">{file.filename.length > 24 ? file.filename.slice(0, 21) + "..." : file.filename}</span>
          <div className="file-card-detail">
            <span className="file-card-ext">{file.ext.toUpperCase()} File</span>
            {file.isSecured && <span className="file-secured-badge">🔒 Secured</span>}
          </div>
        </div>
        <div className="file-card-dl">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
        </div>
      </a>
    );
  };

  const activeRoom = rooms.find((r) => r._id === activeChat);
  const isCipherX = activeChat === "cipherx";

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

        <div className="sidebar-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "15px" }}>
          <span>Pinned AI</span>
        </div>

        <div 
          className={`history-item ${activeChat === "cipherx" ? "active" : ""}`}
          onClick={handleSelectCipherX}
          style={activeChat === "cipherx" ? {
            background: "linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)",
            borderLeft: "4px solid #8b5cf6",
            marginBottom: "10px",
            padding: "12px"
          } : {
            borderLeft: "4px solid transparent",
            marginBottom: "10px",
            padding: "12px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%" }}>
            <div style={{
              width: "42px", height: "42px", borderRadius: "12px",
              background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: "20px",
              boxShadow: "0 4px 12px rgba(139, 92, 246, 0.3)"
            }}>
              ✨
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div style={{ fontWeight: "600", fontSize: "15px", color: activeChat === "cipherx" ? "#8b5cf6" : "inherit", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                CipherX
                <span style={{ fontSize: "10px", background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)", color: "#fff", padding: "2px 6px", borderRadius: "10px", fontWeight: "bold" }}>Beta</span>
              </div>
              <div style={{ fontSize: "13px", opacity: 0.7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: "2px" }}>
                Ask me anything...
              </div>
            </div>
          </div>
        </div>

        <div className="sidebar-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Recent Chats</span>
        </div>

        <button className="analytics-sidebar-btn" onClick={openAnalytics}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 20V10M12 20V4M6 20v-6" />
          </svg>
          Data Analytics
          <span className="analytics-badge">🔒</span>
        </button>

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
  <div style={{ display: "flex", flexDirection: "column" }}>
    <span>{user?.name || "User"}</span>
    <span style={{ color: "#34d399", fontSize: "11px" }}>Online</span>
  </div>

  <button className="logout-btn" onClick={handleLogout} title="Logout">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M13 5H5a2 2 0 00-2 2v10a2 2 0 002 2h8" strokeLinecap="round"/>
    </svg>
  </button>
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

                    // ✅ SECURE DOCUMENT CASE (PDFs & Images with masking)
                    // Use scanResult.detected items where isMasked === true
                    const activeMaskedItems = (scanResult?.detected || []).filter(d => d.isMasked);
                    if ((previewFile?.type === "application/pdf" || previewFile?.type?.startsWith("image/")) && activeMaskedItems.length > 0) {
                      const formDataMask = new FormData();
                      formDataMask.append("file", previewFile);
                      formDataMask.append("maskedItems", JSON.stringify(activeMaskedItems));

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
                    // ✅ TEXT CASE — only for actual text files (NOT pdfs or images)
                    else if (
                      modifiedContent &&
                      !previewFile?.type?.startsWith("image/") &&
                      previewFile?.type !== "application/pdf"
                    ) {
                      const originalExt = previewFile.name?.split(".").pop() || "txt";
                      const blob = new Blob([modifiedContent], { type: previewFile.type || "text/plain" });

                      const filename = previewFile.name
                        ? previewFile.name.replace(/\.[^/.]+$/, "") + `-secured.${originalExt}`
                        : `secured.${originalExt}`;

                      formData.append("file", blob, filename);
                    }
                    // ✅ DEFAULT — send original file unchanged
                    else {
                      formData.append("file", previewFile);
                    }

                    // 1️⃣ Upload file to backend
                    const token = localStorage.getItem("token");  // ✅ THIS IS MISSING
                    const res = await fetch("http://localhost:5000/api/upload", {
                      method: "POST",
                       headers: {
    Authorization: "Bearer " + token   // 🔥 VERY IMPORTANT
  },
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

                    // 2️⃣ Log unmasked sensitive data for analytics
                    if (scanResult?.detected) {
                      await logUnmaskedItems(scanResult.detected);
                    }

                    // 3️⃣ Send via socket
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
                  <button
  onClick={() => handleToggleMask(p)}
  style={{
    background: p.isMasked
      ? "linear-gradient(135deg, #ef4444, #dc2626)"  // red
      : "linear-gradient(135deg, #10b981, #059669)", // green
    color: "#fff"
  }}
>
  {p.isMasked ? "Unmask" : "Mask"}
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
                  <button
  onClick={() => handleToggleMask(e)}
  style={{
    background: e.isMasked
      ? "linear-gradient(135deg, #ef4444, #dc2626)"  // red
      : "linear-gradient(135deg, #10b981, #059669)", // green
    color: "#fff"
  }}
>
  {e.isMasked ? "Unmask" : "Mask"}
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
                  <button
  onClick={() => handleToggleMask(p)}
  style={{
    background: p.isMasked
      ? "linear-gradient(135deg, #ef4444, #dc2626)"  // red
      : "linear-gradient(135deg, #10b981, #059669)", // green
    color: "#fff"
  }}
>
  {p.isMasked ? "Unmask" : "Mask"}
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
                  <button
  onClick={() => handleToggleMask(a)}
  style={{
    background: a.isMasked
      ? "linear-gradient(135deg, #ef4444, #dc2626)"  // red
      : "linear-gradient(135deg, #10b981, #059669)", // green
    color: "#fff"
  }}
>
  {a.isMasked ? "Unmask" : "Mask"}
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
                 <button
  onClick={() => handleToggleMask(b)}
  style={{
    background: b.isMasked
      ? "linear-gradient(135deg, #ef4444, #dc2626)"  // red
      : "linear-gradient(135deg, #10b981, #059669)", // green
    color: "#fff"
  }}
>
  {b.isMasked ? "Unmask" : "Mask"}
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
                {isCipherX ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                        width: "28px", height: "28px", borderRadius: "8px",
                        background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", fontWeight: "bold", fontSize: "14px"
                    }}>✨</div>
                    <span style={{ background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontWeight: "bold" }}>CipherX AI</span>
                  </div>
                ) : activeRoom 
                  ? (activeRoom.isPrivate && activeRoom.members
                      ? activeRoom.members.find(m => m._id !== user?.id)?.name || "User"
                      : activeRoom.name) 
                  : "Select a Chat"}
              </div>
              <div className="status-dot">
                <div className="dot" style={isCipherX ? { background: "#8b5cf6", boxShadow: "0 0 8px #8b5cf6" } : {}}></div>{isCipherX ? "Online" : "Connected"}
              </div>
            </div>

            {/* Messages */}
            <div className="messages" style={isCipherX ? { backgroundImage: "radial-gradient(circle at center, rgba(139, 92, 246, 0.03) 0%, transparent 70%)" } : {}}>
              {!activeRoom && !isCipherX ? (
                <div className="welcome">
                  <div className="welcome-particles">
                    <div className="particle p1"></div>
                    <div className="particle p2"></div>
                    <div className="particle p3"></div>
                    <div className="particle p4"></div>
                  </div>
                  <div className="welcome-icon">🛡️</div>
                  <h1 className="welcome-heading">Welcome to <span className="welcome-brand">CipherChat</span></h1>
                  <p className="welcome-sub">End-to-end encrypted messaging with AI-powered security intelligence.</p>
                  <div className="welcome-features">
                    <div className="welcome-feature-card">
                      <span className="wf-icon">🔒</span>
                      <span className="wf-label">Encrypted Files</span>
                    </div>
                    <div className="welcome-feature-card">
                      <span className="wf-icon">🤖</span>
                      <span className="wf-label">AI Assistant</span>
                    </div>
                    <div className="welcome-feature-card">
                      <span className="wf-icon">📊</span>
                      <span className="wf-label">Data Analytics</span>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {isCipherX && messages.length === 1 && (
                    <div style={{ textAlign: "center", padding: "40px 20px" }}>
                      <div style={{ fontSize: "64px", marginBottom: "20px", textShadow: "0 0 20px rgba(139, 92, 246, 0.4)" }}>✨</div>
                      <h2 style={{ background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: "15px", fontSize: "28px" }}>How can I assist you today?</h2>
                      <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap", maxWidth: "600px", margin: "0 auto" }}>
                         {["Summarize a secure file", "Check for data leaks", "Draft an encrypted message"].map(text => (
                           <div key={text} onClick={() => setMessageInput(text)} style={{ padding: "10px 16px", background: "rgba(139, 92, 246, 0.1)", color: "#8b5cf6", borderRadius: "20px", cursor: "pointer", fontSize: "14px", border: "1px solid rgba(139, 92, 246, 0.2)", transition: "all 0.2s", fontWeight: "500" }} onMouseEnter={(e) => e.currentTarget.style.background = "rgba(139, 92, 246, 0.2)"} onMouseLeave={(e) => e.currentTarget.style.background = "rgba(139, 92, 246, 0.1)"}>
                             {text}
                           </div>
                         ))}
                      </div>
                    </div>
                  )}

                  {messages.map((msg) => (
                    <div key={msg.id} className={`msg-row ${msg.isSent ? "sent" : "received"}`}>
                      <div className={`avatar ${msg.isSent ? "sent" : "received"}`} style={msg.isAi ? { background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)", color: "#fff", border: "none" } : {}}>
                        {msg.isSent ? "👤" : msg.isAi ? "✨" : "💬"}
                      </div>
                      <div className={`bubble ${msg.isSent ? "sent" : "received"} ${(msg.type === "file" || msg.text.includes("/uploads/")) ? "bubble-file" : ""}`} style={msg.isAi ? { background: "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)", border: "1px solid rgba(139, 92, 246, 0.2)", color: "inherit", borderTopLeftRadius: "4px" } : {}}>
                        {msg.type === "file" || msg.text.includes("/uploads/") ? (
                          renderFileCard(msg.text, msg.isSent)
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
                      setScanResult({
                        ...data,
                        detected: data.detected.map(d => {
                          const masked = maskValue(d.value, d.type);

                          return {
                            ...d,
                            original: d.value,
                            masked: masked,
                            isMasked: false,
                            value: d.value
                          };
                        })
                      });
                    } catch (err) {
                      console.error(err);
                    } finally {
                      setIsScanning(false);
                    }
                  }}
                />

                <textarea
                  rows={1}
                  placeholder={isCipherX ? "Message CipherX..." : activeRoom ? "Type a message..." : "Select a room to chat..."}
                  value={messageInput}
                  onChange={autoResize}
                  onKeyDown={handleKey}
                  disabled={!activeRoom && !isCipherX}
                  style={isCipherX ? { border: "1px solid rgba(139, 92, 246, 0.3)", boxShadow: "0 2px 12px rgba(139, 92, 246, 0.05)" } : {}}
                />
                <button
                  className="send-btn"
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || (!activeRoom && !isCipherX)}
                  title="Send"
                  style={isCipherX ? { background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)", color: "#fff", borderColor: "transparent" } : {}}
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
      {/* ═══ ANALYTICS MODAL ═══ */}
      {showAnalytics && (
        <div className="analytics-overlay" onClick={() => setShowAnalytics(false)}>
          <div className="analytics-modal" onClick={(e) => e.stopPropagation()}>
            <div className="analytics-modal-header">
              <div className="analytics-modal-title">
                <div className="analytics-title-icon">📊</div>
                <div>
                  <h2>Sensitive Data Analytics</h2>
                  <p>Track unmasked data you've sent</p>
                </div>
              </div>
              <button className="analytics-close-btn" onClick={() => setShowAnalytics(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="analytics-modal-body">
              {analyticsLoading ? (
                <div className="analytics-loading">
                  <div className="scan-loader-spinner" />
                  <span>Loading analytics...</span>
                </div>
              ) : analyticsData ? (
                <>
                  {/* ── Summary Cards ── */}
                  <div className="analytics-summary-row">
                    <div className="analytics-card analytics-card-total">
                      <div className="analytics-card-icon">🛡️</div>
                      <div className="analytics-card-info">
                        <span className="analytics-card-value">{analyticsData.total || 0}</span>
                        <span className="analytics-card-label">Total Unmasked Sent</span>
                      </div>
                    </div>
                    <div className="analytics-card analytics-card-types">
                      <div className="analytics-card-icon">📂</div>
                      <div className="analytics-card-info">
                        <span className="analytics-card-value">{Object.keys(analyticsData.counts || {}).length}</span>
                        <span className="analytics-card-label">Data Types Exposed</span>
                      </div>
                    </div>
                    <div className="analytics-card analytics-card-risk">
                      <div className="analytics-card-icon">{(analyticsData.total || 0) > 10 ? "🔴" : (analyticsData.total || 0) > 3 ? "🟡" : "🟢"}</div>
                      <div className="analytics-card-info">
                        <span className="analytics-card-value">{(analyticsData.total || 0) > 10 ? "High" : (analyticsData.total || 0) > 3 ? "Medium" : "Low"}</span>
                        <span className="analytics-card-label">Risk Level</span>
                      </div>
                    </div>
                  </div>

                  {/* ── Bar Chart Breakdown ── */}
                  <div className="analytics-section">
                    <div className="analytics-section-title">Breakdown by Type</div>
                    <div className="analytics-bars">
                      {Object.entries(TYPE_META).map(([type, meta]) => {
                        const count = analyticsData.counts?.[type] || 0;
                        const maxCount = Math.max(...Object.values(analyticsData.counts || { _: 1 }), 1);
                        const pct = Math.round((count / maxCount) * 100);
                        return (
                          <div key={type} className="analytics-bar-row">
                            <div className="analytics-bar-label">
                              <span className="analytics-bar-icon">{meta.icon}</span>
                              <span>{meta.label}</span>
                            </div>
                            <div className="analytics-bar-track">
                              <div
                                className="analytics-bar-fill"
                                style={{ width: `${pct}%`, background: meta.gradient }}
                              />
                            </div>
                            <span className="analytics-bar-count">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Donut Visual ── */}
                  <div className="analytics-section">
                    <div className="analytics-section-title">Exposure Distribution</div>
                    <div className="analytics-donut-row">
                      <div className="analytics-donut-container">
                        <svg viewBox="0 0 120 120" className="analytics-donut-svg">
                          {(() => {
                            const total = analyticsData.total || 1;
                            let cumAngle = 0;
                            const entries = Object.entries(analyticsData.counts || {});
                            if (entries.length === 0) {
                              return <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" strokeWidth="14" />;
                            }
                            return entries.map(([type, count]) => {
                              const pct = count / total;
                              const dashArray = pct * 314.16;
                              const dashOffset = -cumAngle * 314.16;
                              cumAngle += pct;
                              return (
                                <circle
                                  key={type}
                                  cx="60" cy="60" r="50"
                                  fill="none"
                                  stroke={TYPE_META[type]?.color || "#666"}
                                  strokeWidth="14"
                                  strokeDasharray={`${dashArray} ${314.16 - dashArray}`}
                                  strokeDashoffset={dashOffset}
                                  style={{ transition: "all 0.8s ease" }}
                                />
                              );
                            });
                          })()}
                          <text x="60" y="56" textAnchor="middle" fill="var(--text)" fontSize="22" fontWeight="700">{analyticsData.total || 0}</text>
                          <text x="60" y="72" textAnchor="middle" fill="var(--muted)" fontSize="9">TOTAL</text>
                        </svg>
                      </div>
                      <div className="analytics-donut-legend">
                        {Object.entries(TYPE_META).map(([type, meta]) => {
                          const count = analyticsData.counts?.[type] || 0;
                          if (count === 0) return null;
                          return (
                            <div key={type} className="analytics-legend-item">
                              <div className="analytics-legend-dot" style={{ background: meta.color }} />
                              <span className="analytics-legend-label">{meta.label}</span>
                              <span className="analytics-legend-count">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* ── Recent Logs ── */}
                  <div className="analytics-section">
                    <div className="analytics-section-title">Recent Activity</div>
                    <div className="analytics-recent-list">
                      {analyticsData.recent && analyticsData.recent.length > 0 ? (
                        analyticsData.recent.map((log, i) => {
                          const meta = TYPE_META[log.type] || { icon: "❓", label: log.type, color: "#666", gradient: "#666" };
                          return (
                            <div key={log._id || i} className="analytics-recent-item">
                              <div className="analytics-recent-icon" style={{ background: meta.gradient }}>{meta.icon}</div>
                              <div className="analytics-recent-info">
                                <span className="analytics-recent-type">{meta.label}</span>
                                <span className="analytics-recent-value">{log.maskedValue}</span>
                              </div>
                              <span className="analytics-recent-time">
                                {new Date(log.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                                {" "}
                                {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="analytics-empty">
                          <span style={{ fontSize: "40px" }}>🎉</span>
                          <span>No unmasked data sent yet — you're secure!</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="analytics-empty">
                  <span style={{ fontSize: "40px" }}>📊</span>
                  <span>No analytics data available</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>

  );
}