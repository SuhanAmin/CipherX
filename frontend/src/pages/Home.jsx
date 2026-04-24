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

    return res.json();
  };

  // 🔹 Auth + token handling
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/");
      return;
    }

    const urlToken = new URLSearchParams(window.location.search).get("token");
    if (urlToken) {
      localStorage.setItem("token", urlToken);
    }

    // decode user (optional fallback)
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      setUser(payload);
    } catch { }
  }, [navigate]);

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
                    formData.append("file", previewFile);

                    // 1️⃣ Upload file to backend
                    const res = await fetch("http://localhost:5000/api/upload", {
                      method: "POST",
                      body: formData
                    });

                    const data = await res.json();

                    console.log("Uploaded file URL:", data.fileUrl);

                    // 2️⃣ Send via socket
                    socket.emit("message:send", {
                      roomId: activeChat,
                      content: data.fileUrl,
                      type: "file"
                    });

                  } catch (err) {
                    console.error("File send error:", err);
                  }

                  // 3️⃣ Reset UI
                  setPreviewFile(null);
                  if (previewUrl) URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                  setScanResult(null);
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
                  {/* Summary Section */}
                  <div className="scan-section">
                    <div className="scan-section-title">✨ AI Summary</div>
                    <div className="scan-summary-box">
                      {scanResult?.summary ? (
                        scanResult.summary
                      ) : (
                        <span className="scan-summary-placeholder">AI Summary will be generated here...</span>
                      )}
                    </div>
                  </div>

                  {/* Phones Section */}
                  <div className="scan-section">
                    <div className="scan-section-title">📞 Extracted Phones</div>
                    <div className="scan-list">
                      {scanResult?.phones?.length > 0 ? (
                        scanResult.phones.map((p, i) => (
                          <div key={`phone-${i}`} className="scan-item">
                            <div className="scan-item-content">
                              <div className="scan-icon">📱</div>
                              <span>{p}</span>
                            </div>
                            <button className="encrypt-btn">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0110 0v4"></path></svg>
                              Encrypt
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="scan-item-content" style={{ color: 'var(--muted)', fontSize: '13px' }}>No phone numbers found.</div>
                      )}
                    </div>
                  </div>

                  {/* Emails Section */}
                  <div className="scan-section">
                    <div className="scan-section-title">📧 Extracted Emails</div>
                    <div className="scan-list">
                      {scanResult?.emails?.length > 0 ? (
                        scanResult.emails.map((e, i) => (
                          <div key={`email-${i}`} className="scan-item">
                            <div className="scan-item-content">
                              <div className="scan-icon">✉️</div>
                              <span style={{ wordBreak: 'break-all' }}>{e}</span>
                            </div>
                            <button className="encrypt-btn">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0110 0v4"></path></svg>
                              Encrypt
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="scan-item-content" style={{ color: 'var(--muted)', fontSize: '13px' }}>No emails found.</div>
                      )}
                    </div>
                  </div>
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