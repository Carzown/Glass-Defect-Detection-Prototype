import React, { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'react-glass-chat-messages';
const CHANNEL_NAME = 'react-glass-chat-channel';

function loadMessages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveMessages(msgs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
  } catch (e) {
    // ignore
  }
}

export default function Chat({ sender = 'User' }) {
  const [messages, setMessages] = useState(() => loadMessages());
  const [text, setText] = useState('');
  const bcRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    let bc = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel(CHANNEL_NAME);
      bc.onmessage = (ev) => {
        if (!ev.data) return;
        const next = (arr) => {
          const merged = arr.concat(ev.data).slice(-200);
          saveMessages(merged);
          return merged;
        };
        setMessages((prev) => next(prev));
      };
      bcRef.current = bc;
    }

    function storageHandler(e) {
      if (e.key !== STORAGE_KEY) return;
      setMessages(loadMessages());
    }

    window.addEventListener('storage', storageHandler);

    return () => {
      if (bcRef.current) bcRef.current.close();
      window.removeEventListener('storage', storageHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // scroll to bottom
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  function broadcastMessage(msg) {
    if (bcRef.current) {
      bcRef.current.postMessage(msg);
    }
    // also write to localStorage so new tabs pick it up
    const cur = loadMessages();
    const next = cur.concat(msg).slice(-200);
    saveMessages(next);
    // update local state
    setMessages(next);
  }

  function handleSend(e) {
    if (e && e.preventDefault) e.preventDefault();
    const t = (text || '').trim();
    if (!t) return;
    const msg = { id: Date.now() + '-' + Math.random().toString(36).slice(2, 8), sender, text: t, ts: Date.now() };
    broadcastMessage(msg);
    setText('');
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, display: 'flex', flexDirection: 'column', background: '#fff', flex: 1, minHeight: 0 }}>
        <div ref={listRef} style={{ padding: 12, overflowY: 'auto', flex: 1, background: '#f8fafc', minHeight: 0 }}>
          {messages.length === 0 ? (
            <div style={{ color: '#6b7280' }}>No messages yet — start the conversation.</div>
          ) : (
            messages.map((m) => (
              <div key={m.id} style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', alignItems: m.sender === sender ? 'flex-end' : 'flex-start' }}>
                <div style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>{m.sender}</div>
                <div style={{ background: m.sender === sender ? '#0f172a' : '#eab308', color: '#fff', padding: '8px 12px', borderRadius: 8, maxWidth: '80%' }}>{m.text}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{new Date(m.ts).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid #e6e6e6', background: '#fff' }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Message as ${sender}`}
            style={{ flex: 1, padding: '10px 12px', borderRadius: 6, border: '1px solid #e5e7eb' }}
          />
          <button type="submit" className="action-button upload-button">Send</button>
        </form>
      </div>
    </div>
  );
}
