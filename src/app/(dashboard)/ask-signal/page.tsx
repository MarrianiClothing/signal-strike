"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Message { role: "user" | "assistant"; content: string; }

const SUGGESTIONS = [
  "What's my total pipeline value?",
  "Which deals are closest to closing?",
  "Show me all deals in negotiation",
  "What's my win rate this year?",
  "Which deal has the highest commission?",
  "How much have I spent on Travel expenses?",
  "What are my pending next tasks?",
  "Summarize my pipeline by stage",
];

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 16 }}>
      {!isUser && (
        <div style={{
          width: 32, height: 32, borderRadius: "50%", background: "rgba(201,168,76,0.15)",
          border: "1px solid #C9A84C", color: "#C9A84C", fontSize: "0.7rem", fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          marginRight: 10, marginTop: 2,
        }}>⚡</div>
      )}
      <div style={{
        maxWidth: "72%", padding: "12px 16px", borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
        background: isUser ? "#C9A84C" : "#111113",
        border: isUser ? "none" : "1px solid #27272a",
        color: isUser ? "#000" : "#fafafa",
        fontSize: "0.9rem", lineHeight: 1.6,
        whiteSpace: "pre-wrap",
      }}>
        {msg.content}
      </div>
    </div>
  );
}

export default function AskSignalPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    }
    load();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text?: string) {
    const content = (text || input).trim();
    if (!content || !userId || loading) return;
    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const res = await fetch("/api/ask-signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, userId }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.reply || data.error || "Something went wrong." }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Connection error. Please try again." }]);
    }
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const isEmpty = messages.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#0a0a0b", maxWidth: 800, margin: "0 auto", width: "100%" }}>

      {/* Header */}
      <div style={{ padding: "24px 24px 0", borderBottom: "1px solid #18181b", paddingBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: "50%",
            background: "rgba(201,168,76,0.12)", border: "1px solid #C9A84C",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.1rem", flexShrink: 0,
          }}>⚡</div>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#fafafa", fontFamily: "var(--font-cinzel, serif)" }}>Ask Signal</h1>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "#52525b" }}>Your AI revenue assistant — ask anything about your deals, pipeline, or expenses</p>
          </div>
          {messages.length > 0 && (
            <button onClick={() => setMessages([])} style={{
              marginLeft: "auto", background: "transparent", border: "1px solid #27272a",
              color: "#52525b", borderRadius: 8, padding: "6px 12px", cursor: "pointer",
              fontSize: "0.75rem",
            }}>Clear</button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
        {isEmpty ? (
          <div>
            {/* Welcome */}
            <div style={{ textAlign: "center", padding: "32px 0 40px" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>⚡</div>
              <h2 style={{ color: "#fafafa", fontWeight: 700, margin: "0 0 8px", fontSize: "1.3rem" }}>How can I help you today?</h2>
              <p style={{ color: "#52525b", fontSize: "0.85rem", margin: 0 }}>Ask me anything about your deals, pipeline, commissions, or expenses.</p>
            </div>
            {/* Suggestion pills */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)} style={{
                  background: "#111113", border: "1px solid #27272a", borderRadius: 20,
                  color: "#a1a1aa", padding: "8px 16px", cursor: "pointer", fontSize: "0.82rem",
                  transition: "all 0.15s",
                }}
                  onMouseEnter={e => { (e.currentTarget.style.borderColor = "#C9A84C"); (e.currentTarget.style.color = "#C9A84C"); }}
                  onMouseLeave={e => { (e.currentTarget.style.borderColor = "#27272a"); (e.currentTarget.style.color = "#a1a1aa"); }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(201,168,76,0.15)", border: "1px solid #C9A84C", color: "#C9A84C", fontSize: "0.7rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>⚡</div>
                <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: "18px 18px 18px 4px", padding: "12px 18px", display: "flex", gap: 5, alignItems: "center" }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#C9A84C", animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`, opacity: 0.6 }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: "16px 24px 24px", borderTop: "1px solid #18181b" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about your deals, pipeline, expenses..."
            rows={1}
            style={{
              flex: 1, background: "#111113", border: "1px solid #27272a", borderRadius: 12,
              color: "#fafafa", padding: "12px 16px", fontSize: "0.9rem", outline: "none",
              resize: "none", lineHeight: 1.5, maxHeight: 120, overflowY: "auto",
              fontFamily: "var(--font-montserrat, sans-serif)",
              transition: "border-color 0.2s",
            }}
            onFocus={e => (e.target.style.borderColor = "#C9A84C")}
            onBlur={e => (e.target.style.borderColor = "#27272a")}
          />
          <button onClick={() => send()} disabled={!input.trim() || loading} style={{
            width: 44, height: 44, borderRadius: 12, border: "none",
            background: input.trim() && !loading ? "#C9A84C" : "#1c1c1f",
            color: input.trim() && !loading ? "#000" : "#52525b",
            cursor: input.trim() && !loading ? "pointer" : "not-allowed",
            fontSize: "1.1rem", display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, transition: "all 0.2s",
          }}>↑</button>
        </div>
        <p style={{ margin: "8px 0 0", fontSize: "0.68rem", color: "#3f3f46", textAlign: "center" }}>
          Enter to send · Shift+Enter for new line · Signal Search is available on the Dashboard
        </p>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
