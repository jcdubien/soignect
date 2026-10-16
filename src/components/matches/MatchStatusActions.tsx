"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Actions de statut d'une mise en relation (item 12, revu le 16/10).
//
// « Confirmer » est devenu « Contrat signé hors Soignect » : le geste ferme l'annonce et réserve
// les dates du candidat, exactement comme la double signature dans Soignect (lib/relationConclue).
// Il n'appartient qu'au RECRUTEUR — c'est son annonce qui se ferme — et demande une seconde
// pression : ce n'est plus un statut qu'on coche en passant. « Décliner » reste aux deux parties.
export default function MatchStatusActions({
  matchId,
  status,
  recruteur,
}: {
  matchId: string;
  status: string;
  recruteur: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [aConfirmer, setAConfirmer] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function setStatus(next: string) {
    if (busy) return;
    setBusy(true);
    setErreur(null);
    try {
      const res = await fetch(`/api/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) router.refresh();
      else setErreur((await res.json().catch(() => null))?.error ?? "Action impossible.");
    } finally {
      setBusy(false);
      setAConfirmer(false);
    }
  }

  // Rien à faire si déjà conclu / décliné / expiré
  if (status === "CONFIRME" || status === "DECLINE" || status === "EXPIRE") return null;

  if (aConfirmer) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-gray-600">
          Le contrat est signé ? Votre annonce sera retirée des annonces ouvertes et les dates du
          candidat réservées.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setStatus("CONFIRME")}
            disabled={busy}
            className="md3-ripple flex-1 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition disabled:opacity-40"
          >
            Oui, contrat signé
          </button>
          <button
            onClick={() => setAConfirmer(false)}
            disabled={busy}
            className="md3-ripple flex-1 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-50 transition disabled:opacity-40"
          >
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        {recruteur && (
          <button
            onClick={() => setAConfirmer(true)}
            disabled={busy}
            className="md3-ripple flex-1 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition disabled:opacity-40"
          >
            Contrat signé hors Soignect
          </button>
        )}
        <button
          onClick={() => setStatus("DECLINE")}
          disabled={busy}
          className="md3-ripple flex-1 py-2 border border-red-200 text-red-600 rounded-xl text-xs font-bold hover:bg-red-50 transition disabled:opacity-40"
        >
          Décliner
        </button>
      </div>
      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
    </div>
  );
}
