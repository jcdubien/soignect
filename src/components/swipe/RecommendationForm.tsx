"use client";

import { useState } from "react";

interface Props {
  matchId: string;
  ratedId: string;
  viewerType: "TITULAIRE" | "REMPLACANT" | "ASSISTANT";
}

type Step = "choice" | "details" | "done";

function CriteriaSlider({
  label, value, onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span className="font-semibold text-gray-700">{value > 0 ? `${value}/5` : "—"}</span>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            className={`flex-1 h-7 rounded text-xs font-semibold transition ${
              i <= value
                ? "bg-kine-500 text-white"
                : "bg-gray-100 text-gray-400 hover:bg-kine-100"
            }`}
          >
            {i}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function RecommendationForm({ matchId, ratedId, viewerType }: Props) {
  const [step, setStep]             = useState<Step>("choice");
  const [recommended, setRecommended] = useState<boolean | null>(null);
  const [loading, setLoading]       = useState(false);

  // Critères cabinet (pour REMPLACANT notant un TITULAIRE)
  const [scoreAccueil, setScoreAccueil]   = useState(0);
  const [scoreMateriel, setScoreMateriel] = useState(0);
  const [scoreContrat, setScoreContrat]   = useState(0);
  const [scoreAmbiance, setScoreAmbiance] = useState(0);
  const [comment, setComment]             = useState("");

  // Critères remplaçant (pour TITULAIRE notant un REMPLACANT)
  const [scorePonctualite, setScorePonctualite]       = useState(0);
  const [scoreQualiteSoins, setScoreQualiteSoins]     = useState(0);
  const [scoreDossierPatient, setScoreDossierPatient] = useState(0);
  const [scoreCommunication, setScoreCommunication]   = useState(0);

  const isCabinet = viewerType === "TITULAIRE";
  const endpoint  = isCabinet
    ? "/api/recommendations/remplacant"
    : "/api/recommendations/cabinet";

  async function handleSubmit() {
    if (recommended === null) return;
    setLoading(true);

    const body = isCabinet
      ? {
          matchId, ratedId, recommended,
          scorePonctualite:    scorePonctualite    > 0 ? scorePonctualite    : undefined,
          scoreQualiteSoins:   scoreQualiteSoins   > 0 ? scoreQualiteSoins   : undefined,
          scoreDossierPatient: scoreDossierPatient > 0 ? scoreDossierPatient : undefined,
          scoreCommunication:  scoreCommunication  > 0 ? scoreCommunication  : undefined,
        }
      : {
          matchId, ratedId, recommended,
          scoreAccueil:  scoreAccueil  > 0 ? scoreAccueil  : undefined,
          scoreMateriel: scoreMateriel > 0 ? scoreMateriel : undefined,
          scoreContrat:  scoreContrat  > 0 ? scoreContrat  : undefined,
          scoreAmbiance: scoreAmbiance > 0 ? scoreAmbiance : undefined,
          comment: comment.trim() || undefined,
        };

    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setStep("done");
    setLoading(false);
  }

  if (step === "done") {
    return (
      <p className="text-sm font-semibold text-emerald-600">
        {recommended ? "✓ Recommandation envoyée, merci !" : "✓ Évaluation envoyée, merci !"}
      </p>
    );
  }

  if (step === "choice") {
    return (
      <div className="space-y-2">
        <p className="text-xs text-gray-400 font-medium">
          {isCabinet
            ? "Recommandez-vous ce remplaçant ?"
            : "Recommandez-vous ce cabinet ?"}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => { setRecommended(true); setStep("details"); }}
            className="flex-1 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm font-semibold hover:bg-emerald-100 transition"
          >
            Oui 👍
          </button>
          <button
            onClick={() => { setRecommended(false); setStep("details"); }}
            className="flex-1 py-2 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-100 transition"
          >
            Non 👎
          </button>
        </div>
      </div>
    );
  }

  // step === "details" — critères optionnels
  return (
    <div className="space-y-3">
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
        recommended ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
      }`}>
        {recommended ? "Oui — je recommande 👍" : "Non — je ne recommande pas 👎"}
      </div>

      <p className="text-xs text-gray-400">Critères optionnels (aide la communauté) :</p>

      {isCabinet ? (
        <div className="space-y-2.5">
          <CriteriaSlider label="Ponctualité"         value={scorePonctualite}    onChange={setScorePonctualite} />
          <CriteriaSlider label="Qualité des soins"   value={scoreQualiteSoins}   onChange={setScoreQualiteSoins} />
          <CriteriaSlider label="Dossier patient"     value={scoreDossierPatient} onChange={setScoreDossierPatient} />
          <CriteriaSlider label="Communication"       value={scoreCommunication}  onChange={setScoreCommunication} />
        </div>
      ) : (
        <div className="space-y-2.5">
          <CriteriaSlider label="Accueil & intégration"       value={scoreAccueil}  onChange={setScoreAccueil} />
          <CriteriaSlider label="Matériel & locaux"           value={scoreMateriel} onChange={setScoreMateriel} />
          <CriteriaSlider label="Conditions contractuelles"   value={scoreContrat}  onChange={setScoreContrat} />
          <CriteriaSlider label="Ambiance équipe"             value={scoreAmbiance} onChange={setScoreAmbiance} />
          <div>
            <label className="block text-xs text-gray-400 mb-1">Commentaire (optionnel — sera modéré)</label>
            <textarea
              value={comment}
              onChange={e => { if (e.target.value.length <= 500) setComment(e.target.value); }}
              rows={2}
              placeholder="Partagez votre expérience…"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-kine-400 resize-none"
            />
            <p className="text-right text-[10px] text-gray-300">{comment.length}/500</p>
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => setStep("choice")}
          className="flex-1 py-2 border border-gray-200 rounded-xl text-xs text-gray-500 hover:bg-gray-50 transition"
        >
          Retour
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 py-2 bg-kine-600 text-white rounded-xl text-xs font-bold hover:bg-kine-700 transition disabled:opacity-40"
        >
          {loading ? "…" : "Envoyer"}
        </button>
      </div>
    </div>
  );
}
