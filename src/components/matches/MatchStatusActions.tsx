"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Actions de statut d'une mise en relation (item 12)
export default function MatchStatusActions({
  matchId,
  status,
}: {
  matchId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setStatus(next: string) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  // Rien à faire si déjà confirmé / décliné / expiré
  if (status === "CONFIRME" || status === "DECLINE" || status === "EXPIRE") return null;

  return (
    <div className="flex gap-2">
      <button
        onClick={() => setStatus("CONFIRME")}
        disabled={busy}
        className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition disabled:opacity-40"
      >
        Confirmer
      </button>
      <button
        onClick={() => setStatus("DECLINE")}
        disabled={busy}
        className="flex-1 py-2 border border-red-200 text-red-600 rounded-xl text-xs font-bold hover:bg-red-50 transition disabled:opacity-40"
      >
        Décliner
      </button>
    </div>
  );
}
