"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Message {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
  sender: { id: string; type: string };
}

interface ChatPartner {
  type: string;
  theirMissionTitle?: string | null;
}

interface ChatModalProps {
  matchId: string;
  myProfileId: string;
  partner: ChatPartner;
  aiScore: number | null;
  onClose: () => void;
}

const TYPE_EMOJI: Record<string, string> = {
  REMPLACANT: "🩺",
  ASSISTANT: "👩‍⚕️",
  TITULAIRE: "🏥",
};

const TYPE_LABEL: Record<string, string> = {
  REMPLACANT: "Remplaçant·e",
  ASSISTANT: "Assistant·e",
  TITULAIRE: "Cabinet / Titulaire",
};

export default function ChatModal({ matchId, myProfileId, partner, aiScore, onClose }: ChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastTimestampRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchMessages = useCallback(async (initial = false) => {
    const url = initial
      ? `/api/matches/${matchId}/messages`
      : `/api/matches/${matchId}/messages${lastTimestampRef.current ? `?after=${encodeURIComponent(lastTimestampRef.current)}` : ""}`;

    const res = await fetch(url);
    if (!res.ok) return;
    const fresh: Message[] = await res.json();

    if (fresh.length > 0) {
      lastTimestampRef.current = fresh[fresh.length - 1].createdAt;
      if (initial) {
        setMessages(fresh);
      } else {
        setMessages((prev) => [...prev, ...fresh]);
      }
    }
  }, [matchId]);

  // Chargement initial
  useEffect(() => {
    fetchMessages(true);
    inputRef.current?.focus();
  }, [fetchMessages]);

  // Polling toutes les 3s
  useEffect(() => {
    const timer = setInterval(() => fetchMessages(false), 3000);
    return () => clearInterval(timer);
  }, [fetchMessages]);

  // Scroll to bottom quand nouveaux messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setDraft("");

    // Optimiste
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      content,
      senderId: myProfileId,
      createdAt: new Date().toISOString(),
      sender: { id: myProfileId, type: "" },
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch(`/api/matches/${matchId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const real: Message = await res.json();
        setMessages((prev) => prev.map((m) => m.id === optimistic.id ? real : m));
        lastTimestampRef.current = real.createdAt;
      }
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  const score = aiScore !== null ? Math.round(aiScore) : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shadow-sm">
        <button
          onClick={onClose}
          className="p-2 rounded-xl hover:bg-gray-100 transition text-gray-500"
          aria-label="Fermer"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>

        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-kine-200 to-kine-500 flex items-center justify-center text-xl flex-shrink-0">
          {TYPE_EMOJI[partner.type] ?? "👤"}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm">{TYPE_LABEL[partner.type] ?? partner.type}</p>
          {partner.theirMissionTitle && (
            <p className="text-xs text-gray-400 truncate">{partner.theirMissionTitle}</p>
          )}
        </div>

        {score !== null && (
          <div className={`text-center px-3 py-1.5 rounded-xl ${score >= 80 ? "bg-emerald-50 text-emerald-600" : score >= 50 ? "bg-kine-50 text-kine-600" : "bg-amber-50 text-amber-600"}`}>
            <span className="text-base font-black">{score}%</span>
            <p className="text-[9px] text-gray-400 leading-none">match IA</p>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-gray-50">
        {messages.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-gray-500 text-sm font-medium">Démarrez la conversation !</p>
            <p className="text-gray-400 text-xs mt-1">
              {TYPE_EMOJI[partner.type]} {TYPE_LABEL[partner.type]} attend votre message
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isMine = msg.senderId === myProfileId;
          return (
            <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  isMine
                    ? "bg-kine-600 text-white rounded-br-sm"
                    : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm"
                }`}
              >
                {msg.content}
                <div className={`text-[10px] mt-0.5 ${isMine ? "text-kine-200" : "text-gray-400"}`}>
                  {new Date(msg.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={sendMessage}
        className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 bg-white"
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Votre message…"
          maxLength={1000}
          className="flex-1 px-4 py-3 bg-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400 focus:bg-white transition"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="w-11 h-11 bg-kine-600 text-white rounded-2xl flex items-center justify-center hover:bg-kine-700 transition disabled:opacity-40 flex-shrink-0"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </form>
    </div>
  );
}
