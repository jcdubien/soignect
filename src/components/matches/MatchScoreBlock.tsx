"use client";

import { useState } from "react";
import { lectureQualitative, PROFILE_LABEL } from "@/lib/compatibilite";

// Compatibilité du COUPLE d'annonces, prise en photo au moment de la mise en relation, puis
// recalculable à la demande. Même formule que le feed et les swipes — il n'existe plus qu'un
// scoreur dans l'application. Null = jamais calculé, et c'est dit tel quel : un score absent
// ne doit pas ressembler à un mauvais score.
//
// Restitution QUALITATIVE : le barème chiffré n'aide pas à décider, il invite à l'arbitrage.
// Il reste affiché aux administrateurs, pour diagnostiquer un score aberrant.
type Details = Record<string, number | string>;

export default function MatchScoreBlock({
  matchId,
  initialScore,
  initialFactors,
  isAdmin,
}: {
  matchId: string;
  initialScore: number | null;
  initialFactors: Details | null;
  isAdmin?: boolean;
}) {
  const [score,   setScore]   = useState<number | null>(initialScore);
  const [factors, setFactors] = useState<Details | null>(initialFactors);
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
      setScore(typeof d?.aiScore === "number" ? d.aiScore : null);
      setFactors((d?.aiFactors as Details) ?? null);
    } catch {
      setMessage("Le calcul n'a pas abouti. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  const mentions = lectureQualitative(factors);
  const couleur: Record<string, string> = {
    fort:   "bg-emerald-50 text-emerald-700",
    moyen:  "bg-amber-50 text-amber-700",
    faible: "bg-gray-100 text-gray-500",
  };
  const profKey = typeof factors?.profile === "string" ? factors.profile : "REMPLACEMENT";

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
          {mentions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {mentions.map((m) => (
                <span key={m.cle} className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${couleur[m.ton]}`}>
                  {m.texte}
                </span>
              ))}
            </div>
          )}
          {isAdmin && factors && (
            <p className="text-[10px] text-gray-400 mt-2 font-mono">
              {PROFILE_LABEL[profKey] ?? profKey} · dates {String(factors.dates ?? "—")}
              {" · "}géo {String(factors.geo ?? "—")}
              {" · "}bio {String(factors.bio ?? "—")}
              {" · "}log {String(factors.logement ?? "—")}
              {" · "}véh {String(factors.vehicule ?? "—")}
              {" · "}sec {String(factors.secretariat ?? "—")}
              {" · "}coord {String(factors.coordination ?? "—")}
              {/* socleMax = plafond du socle après renormalisation (100 − bonus en jeu). Sans lui
                  on ne peut pas juger si « dates 27 » est bon : le maximum dépend de la paire. */}
              {" · "}socle/{String(factors.socleMax ?? "100")}
            </p>
          )}
        </>
      )}

      {message && (
        <p className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{message}</p>
      )}
    </div>
  );
}
