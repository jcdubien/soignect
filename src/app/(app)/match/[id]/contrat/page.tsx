/* eslint-disable react/no-unescaped-entities */
"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface MatchInfo {
  missionType: "REMPLACEMENT" | "ASSISTANAT" | "COLLABORATION" | null;
  theirName: string | null;
  hasPremium: boolean;
  missingSelf?: string[];   // champs d'identité contractuelle manquants (moi)
  missingOther?: string[];  // champs manquants de l'autre partie
  enforce?: boolean;        // true = blocage dur ; false = avertissement
  isSalariat?: boolean;     // recruteur = structure → pas de contrat libéral (section 161)
}

interface SigStatus {
  mySide: "titulaire" | "remplacant";
  titulaireSigned: boolean;
  remplacantSigned: boolean;
  titulaireAt: string | null;
  remplacantAt: string | null;
  mineSigned: boolean;
  bothSigned: boolean;
}

const SIGNATURE_LEGAL =
  "Ce document a été signé électroniquement par apposition d'une image de signature manuscrite. " +
  "Il ne constitue pas une signature électronique qualifiée au sens du règlement eIDAS. Les parties " +
  "reconnaissent la validité de ce mode de signature pour les besoins de ce contrat.";

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

  // Clauses négociables in-app (section 164) — remplacent les placeholders figés du PDF.
  // Valeurs par défaut raisonnables : aucune saisie n'est obligatoire.
  const [modePaiement,        setModePaiement]        = useState("Virement bancaire");
  const [delaiPaiementJours,  setDelaiPaiementJours]  = useState(5);
  const [modalitesLocaux,     setModalitesLocaux]     = useState("");

  // Signature photo (section 61)
  const [sig, setSig] = useState<SigStatus | null>(null);
  const [signing, setSigning] = useState(false);
  const sigInputRef = useRef<HTMLInputElement>(null);

  function loadSig() {
    fetch(`/api/match/${id}/signature`).then(r => (r.ok ? r.json() : null)).then(setSig).catch(() => {});
  }

  useEffect(() => {
    fetch(`/api/match/${id}/contrat-info`)
      .then(r => r.json())
      .then(d => {
        setInfo(d);
        if (d.retrocessionPct) setRetrocessionPct(d.retrocessionPct);
      })
      .catch(() => setError("Impossible de charger les informations du match."))
      .finally(() => setLoading(false));
    loadSig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSignFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSigning(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/match/${id}/signature`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "Échec de l'envoi de la signature."); return; }
      loadSig();
    } catch {
      setError("Erreur réseau lors de l'envoi de la signature.");
    } finally {
      setSigning(false);
    }
  }

  function buildUrl(draft: boolean) {
    const params = new URLSearchParams({
      rayonKm:      String(rayonKm),
      dureeAns:     String(dureeAns),
      periodeEssai: String(periodeEssai),
      retrocessionPct: String(retrocessionPct),
      redevancePct:    String(redevancePct),
      modePaiement,
      delaiPaiementJours: String(delaiPaiementJours),
      modalitesLocaux,
    });
    if (draft) params.set("draft", "true");
    return `/api/match/${id}/contrat?${params.toString()}`;
  }

  async function handleGenerate(draft: boolean) {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(buildUrl(draft));
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erreur lors de la génération du PDF.");
        return;
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const base = `contrat-${info?.missionType?.toLowerCase() ?? "match"}`;
      a.download = draft ? `${base}-brouillon.pdf` : `${base}.pdf`;
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

  // Salariat (section 161) : le recruteur est un établissement (CDD/CDI/Stage/Vacation). Soignect
  // ne génère que des contrats LIBÉRAUX (remplacement/assistanat/collaboration) → on ne propose
  // pas de PDF pour le salariat, pour ne jamais produire un document juridiquement inadapté.
  if (info?.isSalariat) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 flex flex-col items-center gap-5 text-center">
        <span className="text-5xl">🏢</span>
        <h1 className="text-xl font-black text-gray-900">Poste salarié — contrat hors plateforme</h1>
        <p className="text-gray-500 text-sm">
          Cette mise en relation concerne un poste salarié (CDD, CDI, stage ou vacation).
          Le <strong>contrat de travail est établi par l&apos;établissement</strong> selon ses
          propres modalités : Soignect ne génère que des contrats d&apos;exercice libéral
          (remplacement, assistanat, collaboration).
        </p>
        <p className="text-gray-400 text-xs">
          Poursuivez la discussion dans la messagerie pour convenir des modalités.
        </p>
        <Link href={`/matches?matchId=${id}`} className="w-full max-w-xs py-3 bg-kine-600 text-white rounded-xl text-sm font-bold hover:bg-kine-700 transition">
          Ouvrir la conversation →
        </Link>
        <Link href={`/match/${id}`} className="text-kine-600 text-sm underline">← Retour à la mise en relation</Link>
      </div>
    );
  }

  if (!info || !info.hasPremium) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 flex flex-col items-center gap-6 text-center">
        <span className="text-5xl">🔒</span>
        <h1 className="text-xl font-black text-gray-900">Fonctionnalité Premium</h1>
        <p className="text-gray-500 text-sm">La génération de contrat PDF est réservée aux abonnés Premium et Boost.</p>
        <Link href={`/match/${id}`} className="text-kine-600 text-sm underline">← Retour à la mise en relation</Link>
      </div>
    );
  }

  // Identité contractuelle (section 150) — champs requis pour le PDF.
  const missingSelf  = info.missingSelf ?? [];
  const missingOther = info.missingOther ?? [];
  const identityIncomplete = missingSelf.length > 0 || missingOther.length > 0;

  // Blocage dur : flag actif ET identité incomplète → accès contrat refusé, CTA /compte.
  if (info.enforce && identityIncomplete) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 flex flex-col items-center gap-5 text-center">
        <span className="text-5xl">📝</span>
        <h1 className="text-xl font-black text-gray-900">Profil à compléter avant le contrat</h1>
        {missingSelf.length > 0 && (
          <div className="w-full bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-left">
            <p className="text-sm font-semibold text-amber-800 mb-1">Vos informations manquantes :</p>
            <ul className="list-disc list-inside text-sm text-amber-700">
              {missingSelf.map((f) => <li key={f}>{f}</li>)}
            </ul>
          </div>
        )}
        {missingOther.length > 0 && (
          <p className="text-sm text-gray-500">
            L&apos;autre partie ({info.theirName ?? "cabinet"}) doit aussi compléter : {missingOther.join(", ")}.
          </p>
        )}
        {missingSelf.length > 0 && (
          <Link href="/compte" className="w-full max-w-xs py-3 bg-kine-600 text-white rounded-xl text-sm font-bold hover:bg-kine-700 transition">
            Compléter mon profil →
          </Link>
        )}
        <Link href={`/match/${id}`} className="text-kine-600 text-sm underline">← Retour à la mise en relation</Link>
      </div>
    );
  }

  const missionType   = info.missionType ?? "REMPLACEMENT";
  const isRemplacement = missionType === "REMPLACEMENT";
  const typeLabel     = TYPE_LABELS[missionType] ?? missionType;

  // États de signature (section signature intermédiaire) :
  //  - bothSigned : contrat officiel → figé (formulaire non modifiable) + PDF téléchargeable
  //  - une seule signature : en attente → formulaire toujours modifiable, PDF encore bloqué
  const theirSigned = sig ? (sig.mySide === "titulaire" ? sig.remplacantSigned : sig.titulaireSigned) : false;
  const bothSigned  = !!sig?.bothSigned;
  const locked      = bothSigned; // formulaire verrouillé une fois le contrat officiel
  const oneSigned   = !!sig && !bothSigned && (sig.mineSigned || theirSigned);

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

      {/* Avertissement identité contractuelle incomplète (section 150) — non bloquant
          tant que le blocage dur n'est pas activé. Le PDF affichera « à compléter » sinon. */}
      {identityIncomplete && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-xs text-amber-800">
          ⚠️ <strong>Informations manquantes pour le contrat.</strong>
          {missingSelf.length > 0 && (
            <> Votre profil : {missingSelf.join(", ")} — <Link href="/compte" className="underline font-semibold">compléter mon profil</Link>.</>
          )}
          {missingOther.length > 0 && (
            <> {info.theirName ?? "L'autre partie"} doit compléter : {missingOther.join(", ")}.</>
          )}
        </div>
      )}

      {/* Bandeau contrat officiel (les 2 ont signé) → formulaire figé */}
      {locked && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 text-xs text-emerald-700 flex items-center gap-2">
          🔒 <span><strong>Contrat officiel</strong> — signé par les deux parties. Les termes ne sont plus modifiables.</span>
        </div>
      )}

      {/* Formulaire */}
      <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-5 ${locked ? "opacity-60 pointer-events-none" : ""}`}>

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

        {/* Modalités de paiement (section 164) — remplacent les placeholders [mode]/[délai] du PDF.
            « rétrocession » pour un remplacement, « redevance » sinon. */}
        <div className="border-t border-gray-100 pt-4 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              Mode de paiement de la {isRemplacement ? "rétrocession" : "redevance"}
            </label>
            <select
              value={modePaiement}
              onChange={e => setModePaiement(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-kine-200"
            >
              <option>Virement bancaire</option>
              <option>Chèque</option>
              <option>Espèces</option>
              <option>Autre</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              Délai de paiement (jours après la fin de {isRemplacement ? "chaque période" : "chaque mois"})
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number" min={1} max={60} step={1}
                value={delaiPaiementJours}
                onChange={e => setDelaiPaiementJours(Math.min(60, Math.max(1, Number(e.target.value) || 1)))}
                className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-kine-200"
              />
              <span className="text-sm text-gray-500">jours</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              Modalités des locaux et du matériel (Art. 6)
            </label>
            <textarea
              value={modalitesLocaux}
              onChange={e => setModalitesLocaux(e.target.value.slice(0, 600))}
              rows={3}
              placeholder="Ex. : charges (loyer, fluides, fournitures) incluses dans la redevance, ou réparties à 50/50…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 resize-y focus:outline-none focus:ring-2 focus:ring-kine-200"
            />
            <p className="text-xs text-gray-400 mt-1">
              Facultatif — si laissé vide, le contrat indiquera « à convenir entre les parties ».
            </p>
          </div>
        </div>

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

      {/* Signature par photo (section 61) */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-bold text-gray-800">Signature du contrat</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Chaque partie prend en photo sa signature manuscrite. Le contrat est confirmé quand les deux ont signé.
          </p>
        </div>

        {sig && (
          <div className="flex flex-col gap-2">
            {/* Ma signature */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-gray-600">Ma signature</span>
              {sig.mineSigned ? (
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">Signée ✓</span>
              ) : (
                <span className="text-xs font-semibold text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full">En attente</span>
              )}
            </div>
            {/* Signature de l'autre partie */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-gray-600">Signature de l&apos;autre partie</span>
              {(sig.mySide === "titulaire" ? sig.remplacantSigned : sig.titulaireSigned) ? (
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">Signée ✓</span>
              ) : (
                <span className="text-xs font-semibold text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full">En attente</span>
              )}
            </div>
          </div>
        )}

        {oneSigned && (
          <p className="text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
            {sig?.mineSigned
              ? "⏳ En attente de la signature de l'autre partie"
              : "✍️ L'autre partie a signé — à votre tour de signer"}
          </p>
        )}

        {sig?.bothSigned ? (
          <p className="text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center">
            ✅ Contrat confirmé — les deux parties ont signé
          </p>
        ) : (
          <>
            <input
              ref={sigInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleSignFile}
            />
            <button
              onClick={() => sigInputRef.current?.click()}
              disabled={signing}
              className="w-full py-3 bg-gray-900 text-white rounded-xl font-semibold text-sm hover:bg-black active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {signing ? "Envoi…" : (sig?.mineSigned ? "✍️ Refaire ma signature" : "✍️ Signer avec ma signature")}
            </button>
          </>
        )}

        <p className="text-[11px] text-gray-400 leading-snug border-t border-gray-100 pt-3">{SIGNATURE_LEGAL}</p>
      </div>

      {/* Erreur */}
      {error && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
      )}

      {/* Bouton génération — le libellé indique clairement lequel des 2 PDF sera généré :
          brouillon filigrané avant les 2 signatures, PDF officiel une fois les 2 apposées. */}
      {bothSigned ? (
        <button
          onClick={() => handleGenerate(false)}
          disabled={generating}
          className="w-full py-4 bg-kine-600 text-white rounded-2xl font-bold text-base shadow hover:bg-kine-700 active:scale-[0.98] transition disabled:opacity-60"
        >
          {generating ? "Génération en cours…" : "Télécharger le PDF officiel →"}
        </button>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => handleGenerate(true)}
            disabled={generating}
            className="w-full py-4 bg-white border-2 border-kine-300 text-kine-700 rounded-2xl font-bold text-base shadow-sm hover:bg-kine-50 active:scale-[0.98] transition disabled:opacity-60"
          >
            {generating ? "Génération en cours…" : "Télécharger l'aperçu (brouillon) →"}
          </button>
          <p className="text-xs text-gray-400 text-center">
            Document filigrané « non officiel », pour relecture avant signature. Le PDF officiel
            (sans filigrane, avec les signatures) sera disponible une fois les deux parties signées.
          </p>
        </div>
      )}
    </div>
  );
}
