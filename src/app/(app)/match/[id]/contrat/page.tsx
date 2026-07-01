/* eslint-disable react/no-unescaped-entities */
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface MatchInfo {
  missionType: "REMPLACEMENT" | "ASSISTANAT" | "COLLABORATION" | null;
  theirName: string | null;
  hasPremium: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  REMPLACEMENT:  "Remplacement",
  ASSISTANAT:    "Assistanat libéral",
  COLLABORATION: "Collaboration libérale",
};

export default function ContratPage() {
  const { id } = useParams<{ id: string }>();

  const [info,     setInfo]     = useState<MatchInfo | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Champs du formulaire
  const [rayonKm,      setRayonKm]      = useState(20);
  const [dureeAns,     setDureeAns]     = useState(2);
  const [periodeEssai, setPeriodeEssai] = useState(false);
  const [retrocessionPct, setRetrocessionPct] = useState(70);
  const [redevancePct,    setRedevancePct]    = useState(40);

  useEffect(() => {
    fetch(`/api/match/${id}/contrat-info`)
      .then(r => r.json())
      .then(d => {
        setInfo(d);
        if (d.retrocessionPct) setRetrocessionPct(d.retrocessionPct);
      })
      .catch(() => setError("Impossible de charger les informations du match."))
      .finally(() => setLoading(false));
  }, [id]);

  function buildUrl() {
    const params = new URLSearchParams({
      rayonKm:      String(rayonKm),
      dureeAns:     String(dureeAns),
      periodeEssai: String(periodeEssai),
      retrocessionPct: String(retrocessionPct),
      redevancePct:    String(redevancePct),
    });
    return `/api/match/${id}/contrat?${params.toString()}`;
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const url = buildUrl();
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erreur lors de la génération du PDF.");
        return;
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `contrat-${info?.missionType?.toLowerCase() ?? "match"}.pdf`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      setError("Erreur réseau. Veuillez réessayer.");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-kine-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!info || !info.hasPremium) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 flex flex-col items-center gap-6 text-center">
        <span className="text-5xl">🔒</span>
        <h1 className="text-xl font-black text-gray-900">Fonctionnalité Premium</h1>
        <p className="text-gray-500 text-sm">La génération de contrat PDF est réservée aux abonnés Premium et Boost.</p>
        <Link href={`/match/${id}`} className="text-kine-600 text-sm underline">← Retour au match</Link>
      </div>
    );
  }

  const missionType   = info.missionType ?? "REMPLACEMENT";
  const isRemplacement = missionType === "REMPLACEMENT";
  const typeLabel     = TYPE_LABELS[missionType] ?? missionType;

  return (
    <div className="max-w-lg mx-auto px-4 py-8 flex flex-col gap-6">

      {/* En-tête */}
      <div>
        <Link href={`/match/${id}`} className="text-sm text-gray-400 hover:text-kine-600 transition">
          ← Retour au match
        </Link>
        <h1 className="text-xl font-black text-gray-900 mt-3">Générer le contrat PDF</h1>
        <p className="text-sm text-gray-500 mt-1">
          {typeLabel} · {info.theirName ?? "Autre partie"}
        </p>
      </div>

      {/* Formulaire */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-5">

        {/* Rayon non-concurrence */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1">
            Rayon de non-{isRemplacement ? "installation" : "concurrence"} (km)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range" min={5} max={100} step={5}
              value={rayonKm}
              onChange={e => setRayonKm(Number(e.target.value))}
              className="flex-1 accent-kine-600"
            />
            <span className="w-16 text-center text-sm font-bold text-kine-700 bg-kine-50 rounded-xl px-2 py-1">
              {rayonKm} km
            </span>
          </div>
          {isRemplacement && (
            <p className="text-xs text-gray-400 mt-1">La durée est fixée à 2 ans par l'art. R.4321-130 (non modifiable).</p>
          )}
        </div>

        {/* Durée non-concurrence (uniquement hors remplacement) */}
        {!isRemplacement && (
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              Durée de non-concurrence (années)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range" min={1} max={5} step={1}
                value={dureeAns}
                onChange={e => setDureeAns(Number(e.target.value))}
                className="flex-1 accent-kine-600"
              />
              <span className="w-16 text-center text-sm font-bold text-kine-700 bg-kine-50 rounded-xl px-2 py-1">
                {dureeAns} an{dureeAns > 1 ? "s" : ""}
              </span>
            </div>
          </div>
        )}

        {/* Taux de rétrocession (REMPLACEMENT) */}
        {isRemplacement && (
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              Taux de rétrocession pour le remplaçant (%)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range" min={50} max={90} step={5}
                value={retrocessionPct}
                onChange={e => setRetrocessionPct(Number(e.target.value))}
                className="flex-1 accent-kine-600"
              />
              <span className="w-16 text-center text-sm font-bold text-kine-700 bg-kine-50 rounded-xl px-2 py-1">
                {retrocessionPct}%
              </span>
            </div>
          </div>
        )}

        {/* Taux de redevance (ASSISTANAT / COLLABORATION) */}
        {!isRemplacement && (
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              Redevance versée au titulaire (%)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range" min={20} max={60} step={5}
                value={redevancePct}
                onChange={e => setRedevancePct(Number(e.target.value))}
                className="flex-1 accent-kine-600"
              />
              <span className="w-16 text-center text-sm font-bold text-kine-700 bg-kine-50 rounded-xl px-2 py-1">
                {redevancePct}%
              </span>
            </div>
          </div>
        )}

        {/* Période d'essai */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={periodeEssai}
            onChange={e => setPeriodeEssai(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-kine-600"
          />
          <div>
            <p className="text-sm font-semibold text-gray-800">Inclure une période d'essai de 3 mois</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {isRemplacement
                ? "Préavis 15 jours pendant la période d'essai."
                : "Préavis 2 semaines pendant la période d'essai, puis 3 mois."}
            </p>
          </div>
        </label>
      </div>

      {/* Mention légale */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-xs text-amber-700">
        ⚠️ <strong>Document indicatif</strong> — Document pré-rempli à titre indicatif. À faire valider par un avocat ou l'Ordre des masseurs-kinésithérapeutes avant signature.
      </div>

      {/* Erreur */}
      {error && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
      )}

      {/* Bouton génération */}
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="w-full py-4 bg-kine-600 text-white rounded-2xl font-bold text-base shadow hover:bg-kine-700 active:scale-[0.98] transition disabled:opacity-60"
      >
        {generating ? "Génération en cours…" : "Générer le PDF →"}
      </button>
    </div>
  );
}
