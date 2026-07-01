"use client";

import { useState } from "react";

interface Rating {
  id: string;
  recommended: boolean;
  comment: string | null;
  scoreGlobal: number | null;
  scoreAccueil: number | null;
  scoreMateriel: number | null;
  scoreContrat: number | null;
  scoreAmbiance: number | null;
  isPublished: boolean;
  createdAt: string;
  rater: { id: string; name: string | null; type: string };
  rated: { id: string; name: string | null; type: string };
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function RatingsClient({ initialRatings }: { initialRatings: Rating[] }) {
  const [ratings, setRatings] = useState<Rating[]>(initialRatings);
  const [loading, setLoading] = useState<string | null>(null);

  async function publish(id: string) {
    setLoading(id);
    const r = await fetch(`/api/admin/ratings/${id}`, { method: "PATCH" });
    if (r.ok) {
      setRatings((prev) => prev.filter((x) => x.id !== id));
    }
    setLoading(null);
  }

  async function reject(id: string) {
    if (!confirm("Rejeter et supprimer définitivement cet avis ?")) return;
    setLoading(id);
    const r = await fetch(`/api/admin/ratings/${id}`, { method: "DELETE" });
    if (r.ok) {
      setRatings((prev) => prev.filter((x) => x.id !== id));
    }
    setLoading(null);
  }

  return (
    <div className="max-w-5xl mx-auto w-full px-4 py-6 space-y-4">
      <h1 className="text-xl font-bold text-gray-800">
        Recommandations en attente{" "}
        <span className="text-sm font-normal text-gray-400">({ratings.length})</span>
      </h1>

      {ratings.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-12 text-center">
          <p className="text-gray-400">Aucun avis en attente de modération</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ratings.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-700">
                      {r.rater.name ?? `Profil ${r.rater.id.slice(0, 6)}`}
                    </span>
                    <span className="text-gray-400 text-xs">→</span>
                    <span className="text-sm font-semibold text-gray-700">
                      {r.rated.name ?? `Profil ${r.rated.id.slice(0, 6)}`}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        r.recommended
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {r.recommended ? "Recommande" : "Ne recommande pas"}
                    </span>
                    {r.scoreGlobal != null && (
                      <span className="text-xs text-gray-500">
                        Score global : {r.scoreGlobal.toFixed(1)}/5
                      </span>
                    )}
                  </div>

                  {(r.scoreAccueil || r.scoreMateriel || r.scoreContrat || r.scoreAmbiance) && (
                    <div className="mt-2 flex gap-3 text-xs text-gray-500 flex-wrap">
                      {r.scoreAccueil != null && <span>Accueil {r.scoreAccueil}/5</span>}
                      {r.scoreMateriel != null && <span>Matériel {r.scoreMateriel}/5</span>}
                      {r.scoreContrat != null && <span>Contrat {r.scoreContrat}/5</span>}
                      {r.scoreAmbiance != null && <span>Ambiance {r.scoreAmbiance}/5</span>}
                    </div>
                  )}

                  {r.comment && (
                    <p className="mt-2 text-sm text-gray-600 italic">
                      &ldquo;{r.comment}&rdquo;
                    </p>
                  )}

                  <p className="mt-2 text-xs text-gray-400">{fmt(r.createdAt)}</p>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => publish(r.id)}
                    disabled={loading === r.id}
                    className="text-xs px-3 py-1.5 rounded-lg bg-kine-600 text-white font-semibold hover:bg-kine-700 disabled:opacity-50 transition"
                  >
                    Publier
                  </button>
                  <button
                    onClick={() => reject(r.id)}
                    disabled={loading === r.id}
                    className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
                  >
                    Rejeter
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
