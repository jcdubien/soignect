"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Notif {
  id: string;
  type: string;
  message: string;
  linkUrl: string;
  readAt: string | null;
  createdAt: string;
}

const TYPE_ICON: Record<string, string> = {
  message: "💬",
  match: "💚",
  signature: "✍️",
  consultation: "👀",
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}

// Cloche de notifications in-app (section 155) — badge de non-lus + panneau déroulant.
export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications");
      if (!r.ok) return;
      const d = await r.json();
      setItems(d.items ?? []);
      setUnread(d.unreadCount ?? 0);
    } catch { /* silencieux */ }
  }, []);

  // Chargement initial + rafraîchissement périodique léger (pas de websocket).
  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  // Fermeture au clic extérieur.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function markAllRead() {
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {});
  }

  async function openNotif(n: Notif) {
    setOpen(false);
    if (!n.readAt) {
      setUnread((u) => Math.max(0, u - 1));
      fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: n.id }) }).catch(() => {});
    }
    router.push(n.linkUrl);
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); if (!open) load(); }}
        aria-label="Notifications"
        className="relative w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-kine-600 hover:bg-gray-50 transition"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed sm:absolute right-2 sm:right-0 mt-2 w-[calc(100vw-16px)] sm:w-80 max-h-[70vh] overflow-y-auto bg-white rounded-2xl shadow-xl border border-gray-100 z-[60]">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 sticky top-0 bg-white">
            <p className="text-sm font-bold text-gray-900">Notifications</p>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-kine-600 font-semibold hover:underline">Tout marquer comme lu</button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">Aucune notification.</p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => openNotif(n)}
                className={`w-full text-left flex gap-2.5 px-4 py-3 hover:bg-gray-50 transition border-b border-gray-50 ${n.readAt ? "" : "bg-kine-50/50"}`}
              >
                <span className="text-base shrink-0">{TYPE_ICON[n.type] ?? "🔔"}</span>
                <span className="min-w-0">
                  <span className="block text-sm text-gray-800 leading-snug">{n.message}</span>
                  <span className="block text-[11px] text-gray-400 mt-0.5">{timeAgo(n.createdAt)}</span>
                </span>
                {!n.readAt && <span className="ml-auto mt-1 w-2 h-2 bg-red-500 rounded-full shrink-0" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
