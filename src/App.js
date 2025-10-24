// frontend/src/App.js
import React, {useState, useEffect, useRef} from "react";
import "./App.css";

const API = process.env.REACT_APP_API_URL || "";

function Login({onAuth}) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [isRegister, setIsRegister] = useState(false);

  async function submit() {
    const url = isRegister ? "/signup" : "/login";
    const res = await fetch(API + url, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      credentials: "include",
      body: JSON.stringify({username: u, password: p})
    });
    const json = await res.json();
    if (res.ok) {
      onAuth(true);
    } else {
      alert(json.error || "Auth failed");
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>{isRegister ? "Create account" : "Login"}</h2>
        <input placeholder="Username" value={u} onChange={e=>setU(e.target.value)} />
        <input placeholder="Password" type="password" value={p} onChange={e=>setP(e.target.value)} />
        <div style={{display:"flex", gap:8}}>
          <button onClick={submit}>{isRegister ? "Register" : "Login"}</button>
          <button onClick={()=>setIsRegister(!isRegister)} className="muted">
            {isRegister ? "Back to Login" : "Create account"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Sidebar({sessions, onSelect, onNew, onLogout, onDelete, onRename}) {
  return (
    <div className="sidebar">
      <div className="sidebar-top">
        <button onClick={onNew} className="new-chat">+ New Chat</button>
      </div>
      <div className="sessions-list">
        {sessions.map(s => (
          <div key={s.id} className="session-row">
            <button onClick={() => onSelect(s.id)} className="session-btn">{s.title}</button>
            <div className="session-actions">
              <button onClick={() => { const newTitle = prompt("Rename session", s.title); if(newTitle) onRename(s.id, newTitle); }}>✎</button>
              <button onClick={() => { if(window.confirm("Delete this session?")) onDelete(s.id); }}>🗑</button>
            </div>
          </div>
        ))}
      </div>
      <div className="sidebar-bottom">
        <button onClick={onLogout} className="logout">Logout</button>
      </div>
    </div>
  );
}

function ChatArea({messages, onSend, loading}) {
  const [input, setInput] = useState("");
  const messagesRef = useRef(null);

  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages, loading]);

  async function send() {
    if (!input.trim()) return;
    await onSend(input.trim());
    setInput("");
  }

  return (
    <div className="chat-area">
      <div className="messages" ref={messagesRef}>
        {messages.length === 0 && <div className="empty">No messages. Start a new chat.</div>}
        {messages.map((m,i) => (
          <div key={i} className={`message ${m.role === "user" ? "user" : "bot"}`}>
            <div className="role">{m.role === "user" ? "You" : "Bot"}</div>
            <div className="content">{m.content}</div>
          </div>
        ))}
        {loading && <div className="message bot">Bot is typing...</div>}
      </div>

      <div className="composer">
        <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Type a message..." onKeyDown={(e)=>{ if(e.key === "Enter") send(); }} />
        <button onClick={send}>Send</button>
      </div>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  async function fetchSessions() {
    const res = await fetch(API + "/sessions", { credentials: "include" });
    if (res.status === 401) { setAuthed(false); return; }
    const json = await res.json();
    setSessions(json);
  }

  async function selectSession(id) {
    if (!id) { setCurrentSessionId(null); setMessages([]); return; }
    const res = await fetch(API + `/sessions/${id}`, { credentials: "include" });
    if (!res.ok) { alert("Failed to load session"); return; }
    const data = await res.json();
    setCurrentSessionId(data.id);
    setMessages(data.messages || []);
  }

  async function newChat() {
    setCurrentSessionId(null);
    setMessages([]);
  }

  async function deleteSession(id) {
    const res = await fetch(API + `/sessions/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) fetchSessions();
    else alert("Delete failed");
  }

  async function renameSession(id, newTitle) {
    const res = await fetch(API + `/sessions/${id}/rename`, {
      method: "POST",
      credentials: "include",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({title:newTitle})
    });
    if (res.ok) fetchSessions();
    else alert("Rename failed");
  }

  async function logout() {
    await fetch(API + "/logout", { method: "POST", credentials: "include" });
    setAuthed(false);
  }

  async function sendMessage(text) {
    setLoading(true);
    const res = await fetch(API + "/chat", {
      method: "POST",
      credentials: "include",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ message: text, session_id: currentSessionId })
    });
    const json = await res.json();
    if (res.ok) {
      setCurrentSessionId(json.session_id);
      setMessages(prev => [...prev, { role: "user", content: text }, { role: "assistant", content: json.reply }]);
      fetchSessions(); // refresh list to show newest sessions
    } else {
      alert(json.error || "Chat error");
    }
    setLoading(false);
  }

  useEffect(() => {
    // Try to fetch sessions; if 401 then show login
    fetchSessions().then(() => setAuthed(true)).catch(() => {});
  }, []);

  if (!authed) return <Login onAuth={() => { setAuthed(true); fetchSessions(); }} />;

  return (
    <div className="app">
      <Sidebar
        sessions={sessions}
        onSelect={selectSession}
        onNew={newChat}
        onLogout={logout}
        onDelete={deleteSession}
        onRename={renameSession}
      />
      <ChatArea messages={messages} onSend={sendMessage} loading={loading} />
    </div>
  );
}
