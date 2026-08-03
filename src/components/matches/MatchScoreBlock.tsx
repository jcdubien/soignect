"use client";

import { useState } from "react";

// Compatibilité du COUPLE d'annonces (Match.aiScore, 0-100), à ne pas confondre avec le score
// d'affinité du lecteur (Swipe.affinityScore) affiché au-dessus : celui-ci date du moment où il
// s'est prononcé, celui-là évalue l'appariement des deux annonces telles qu'elles sont
// aujourd'hui. Null = jamais calculé, et c'est dit tel quel — pas de zéro qui ferait verdict.
interface Factors { availability: number; location: number; specialties: number; bio: number }

const LIBELLES: Record<keyof Factors, string> = {
  availability: "Disponibilités",
  location:     "Localisation",
  specialties:  "Spécialités",
  bio:          "Profils",
};

export default function MatchScoreBlock({
  matchId,
  initialScore,
  initialFactors,
}: {
  matchId: string;
  initialScore: number | null;
  initialFactors: Factors | null;
}) {
  const [score,   setScore]   = useState<number | null>(initialScore);
  const [factors, setFactors] = useState<Factors | null>(initialFactors);
  const [busy,    setBusy]    = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function calculer() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rescore: true }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(typeof d?.error === "string" ? d.error : "Le calcul n'a pas abouti. Réessayez.");
        return;
      }
      // scored: false = plafond d'analyses atteint. Aucun score n'a été calculé, et on se garde
      // bien d'en inventer un : on l'annonce.
      if (d?.scored === false) {
        setMessage("Analyse indisponible pour le moment (plafond quotidien atteint) — réessayez plus tard.");
        return;
      }
      setScore(typeof d?.aiScore === "number" ? d.aiScore : null);
      setFactors((d?.aiFactors as Factors) ?? null);
    } catch {
      setMessage("Le calcul n'a pas abouti. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-400 uppercase tracking-wide">Compatibilité des annonces</p>
        <button
          type="button"
          onClick={calculer}
          disabled={busy}
          className="shrink-0 text-xs font-semibold text-kine-600 hover:underline disabled:opacity-40"
        >
          {busy ? "Analyse…" : score === null ? "Calculer" : "Recalculer"}
        </button>
      </div>

      {score === null ? (
        <p className="text-sm text-gray-400 mt-1">Non calculée.</p>
      ) : (
        <>
          <div className="flex justify-between text-xs text-gray-400 mt-2 mb-1.5">
            <span>Score global</span>
            <span className="font-bold text-kine-600">{Math.round(score)}%</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-kine-500 rounded-full transition-all"
              style={{ width: `${Math.min(Math.round(score), 100)}%` }}
            />
          </div>
          {factors && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {(Object.keys(LIBELLES) as (keyof Factors)[]).map((k) => (
                <span key={k} className="px-2 py-0.5 bg-gray-100 rounded-full text-[10px] text-gray-600">
                  {LIBELLES[k]} {Math.round(factors[k] ?? 0)}%
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {message && (
        <p className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{message}</p>
      )}
    </div>
  );
}
