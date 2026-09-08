/* eslint-disable react/no-unescaped-entities */
"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fmtDateUTC } from "@/lib/contrats/date";
import type { PeriodeContrat, SourcePeriode } from "@/lib/contrats/periode";

export const dynamic = "force-dynamic";

interface MatchInfo {
  missionType: "REMPLACEMENT" | "ASSISTANAT" | "COLLABORATION" | null;
  theirName: string | null;
  hasPremium: boolean;
  missingSelf?: string[];   // champs d'identité contractuelle manquants (moi)
  missingOther?: string[];  // champs manquants de l'autre partie
  enforce?: boolean;        // true = blocage dur ; false = avertissement
  isSalariat?: boolean;     // recruteur = structure → pas de contrat libéral (section 161)
  /** Modèles applicables à (profession × type de mission). Vide = aucun n'existe. */
  gabarits?: { id: string; libelle: string; quandLUtiliser: string | null; source: string; composeSansModele?: boolean }[];
  /** Période par défaut du contrat et sa provenance (section 237). */
  periode?: PeriodeContrat;
  jeSuisTitulaire?: boolean;
  /** Valeurs pré-remplies du contrat de travail, calculées serveur (section 237, lot 2). */
  defautsSalarie?: {
    lieuTravail: string;
    heuresHebdomadaires: number;
    heuresComplementairesMax: number;
  };
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

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

const TYPE_LABELS: Record<string, string> = {
  REMPLACEMENT:  "Remplacement",
  ASSISTANAT:    "Assistanat libéral",
  COLLABORATION: "Collaboration libérale",
};

// La MÊME valeur d'enum désigne deux engagements opposés selon le camp du recruteur : chez un
// cabinet, `COLLABORATION` est une collaboration libérale ; chez une structure employeuse, c'est
// un CDI (voir NATURE_PAR_MISSION). Titrer « Collaboration libérale » au-dessus d'un formulaire
// qui produit un contrat de travail contredirait le document lui-même — le défaut de la
// section 238, dans sa version visible.
const TYPE_LABELS_SALARIE: Record<string, string> = {
  REMPLACEMENT:  "Vacation salariée",
  ASSISTANAT:    "Contrat à durée déterminée",
  COLLABORATION: "Contrat à durée indéterminée",
};

export default function ContratPage() {
  const { id } = useParams<{ id: string }>();

  const [info,     setInfo]     = useState<MatchInfo | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Période du contrat (section 237). Pré-remplie depuis les annonces, puis libre.
  //
  // POURQUOI UN ÉTAT SÉPARÉ DE L'ANNONCE. Ce qui est saisi ici vaut pour CE contrat et n'est
  // jamais réécrit dans la mission : une annonce dit ce que son auteur cherche, un contrat ce qui
  // a été convenu. Les deux annonces d'une mise en relation divergent presque toujours — six fois
  // sur six au 08/09 — et le document retenait jusqu'ici celle du titulaire sans le dire.
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin,   setDateFin]   = useState("");

  // Rémunération et temps de travail du contrat SALARIÉ (section 237, lot 2).
  //
  // `remuneration` démarre VIDE, et c'est délibéré. Son défaut valait `0` côté route, que le
  // gabarit imprimait tel quel : « une rémunération mensuelle brute de 0 euros ». Un salaire nul
  // n'est pas une valeur plausible, c'est une valeur absente — et une valeur absente ne se devine
  // pas. Le champ est donc obligatoire, ici comme dans la route.
  const [remuneration,   setRemuneration]   = useState("");
  const [lieuTravail,    setLieuTravail]    = useState("");
  const [heures,         setHeures]         = useState(35);
  const [tempsPartiel,   setTempsPartiel]   = useState(false);
  const [heuresComplMax, setHeuresComplMax] = useState(4);
  const [repartition,    setRepartition]    =
    useState<{ jour: string; debut: string; fin: string }[]>([]);

  // Champs du formulaire
  const [rayonKm,      setRayonKm]      = useState(20);
  const [dureeAns,     setDureeAns]     = useState(2);
  const [periodeEssai, setPeriodeEssai] = useState(false);
  const [retrocessionPct, setRetrocessionPct] = useState(70);
  const [redevancePct,    setRedevancePct]    = useState(40);

  // Modèle de contrat retenu (section 216). Quand la paire (profession, type de mission) en
  // compte plusieurs — le remplacement infirmier en a deux, économiquement opposés —, le choix
  // appartient aux parties. Le produit ne prend pas la première : il demande.
  const [gabaritId, setGabaritId] = useState("");
  // Partage des forfaits de prise en charge, propre à la collaboration infirmier (art. 6.2).
  // Sélectionné ici plutôt que figé au gabarit : les trois modes décrivent des organisations de
  // cabinet réellement différentes.
  const [forfaitPartage, setForfaitPartage] = useState("TOUR_DE_ROLE");

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
        // Pré-remplissage de la période : la valeur retenue par la route de génération, calculée
        // par la même fonction des deux côtés. L'écran ne peut donc pas afficher une date que le
        // PDF ne reprendrait pas.
        if (d.periode?.debut) setDateDebut(d.periode.debut);
        if (d.periode?.fin)   setDateFin(d.periode.fin);
        // Défauts du contrat de travail, calculés côté serveur par la MÊME fonction que la
        // génération. Les pré-remplir ici est ce qui satisfait la règle « aucune valeur par
        // défaut n'atteint le PDF sans avoir été montrée » : elles sont à l'écran, modifiables.
        if (d.defautsSalarie) {
          setLieuTravail(d.defautsSalarie.lieuTravail ?? "");
          setHeures(d.defautsSalarie.heuresHebdomadaires ?? 35);
          setHeuresComplMax(d.defautsSalarie.heuresComplementairesMax ?? 4);
        }
        // Un seul modèle : rien à demander, on le retient d'office.
        if (Array.isArray(d.gabarits) && d.gabarits.length === 1) setGabaritId(d.gabarits[0].id);
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
      // Toujours transmises, même vides : côté route, un paramètre ABSENT retombe sur l'annonce,
      // tandis qu'un paramètre VIDE dit « pas de date ». Sans cet envoi systématique, effacer une
      // date à l'écran serait sans effet sur le document.
      dateDebut,
      dateFin,
      rayonKm:      String(rayonKm),
      dureeAns:     String(dureeAns),
      periodeEssai: String(periodeEssai),
      retrocessionPct: String(retrocessionPct),
      redevancePct:    String(redevancePct),
      modePaiement,
      delaiPaiementJours: String(delaiPaiementJours),
      modalitesLocaux,
    });
    if (gabaritId) params.set("gabaritId", gabaritId);
    if (gabaritId === "INFIRMIER_COLLABORATION") params.set("forfaitPartage", forfaitPartage);

    // Contrat de travail (section 237, lot 2) — envoyés seulement si le contrat EST un salariat.
    // Les transmettre partout ferait voyager des paramètres qu'aucun gabarit libéral ne lit.
    if (info?.isSalariat) {
      params.set("remunerationBrutMensuelle", remuneration);
      params.set("lieuTravail", lieuTravail);
      params.set("heuresHebdomadaires", String(heures));
      params.set("tempsPartiel", String(tempsPartiel));
      if (tempsPartiel) {
        params.set("heuresComplementairesMax", String(heuresComplMax));
        params.set(
          "repartitionHoraire",
          repartition
            .filter((r) => r.jour && r.debut && r.fin)
            .map((r) => `${r.jour}|${r.debut}|${r.fin}`)
            .join(";"),
        );
      }
    }

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

  // Salariat (section 161, révisé le 29/08) : le recruteur est un établissement. Le blocage était
  // total tant qu'aucun gabarit de contrat de travail n'existait. Depuis la phase B, un registre
  // salarié séparé en fournit — mais il est encore incomplet (1 gabarit sur 4). L'écran ne bloque
  // donc plus le salariat EN TANT QUE TEL : il bloque l'absence de modèle applicable, ce qui est
  // la vraie raison et reste vrai pour les trois cas non encore écrits.
  if (info?.isSalariat && (info?.gabarits?.length ?? 0) === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 flex flex-col items-center gap-5 text-center">
        <span className="text-5xl">🏢</span>
        <h1 className="text-xl font-black text-gray-900">Poste salarié — contrat hors plateforme</h1>
        <p className="text-gray-500 text-sm">
          Cette mise en relation concerne un poste salarié, et{" "}
          <strong>aucun modèle de contrat de travail n&apos;est encore disponible</strong> pour
          cette profession et ce type de contrat. Le contrat est donc à établir par
          l&apos;établissement selon ses propres modalités.
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
  const typeLabel     = (info.isSalariat ? TYPE_LABELS_SALARIE : TYPE_LABELS)[missionType] ?? missionType;

  // États de signature (section signature intermédiaire) :
  //  - bothSigned : contrat officiel → figé (formulaire non modifiable) + PDF téléchargeable
  //  - une seule signature : en attente → formulaire toujours modifiable, PDF encore bloqué
  // ── Période du contrat (section 237) ──────────────────────────────────────────────────────
  // La date de fin n'est affichée que pour les gabarits qui la CONSOMMENT — remplacement kiné et
  // les deux remplacements infirmier. L'assistanat, les collaborations et le CDI décrivent leur
  // terme autrement (durée en mois, contrat à durée indéterminée) : y proposer une date de fin
  // offrirait un levier sans effet sur le document, le défaut qu'on s'interdit ici.
  const periodeAvecFin = isRemplacement && !info.isSalariat;
  const periode = info.periode;

  // Provenance d'une date, en phrase entière. Chaque cas est écrit en toutes lettres plutôt
  // qu'assemblé à partir de fragments : quatre fautes d'accord de suite, ce mois-ci, venaient
  // toutes d'un morceau composé pour un emplacement et réutilisé dans un autre.
  const origine = (source: SourcePeriode): string | null => {
    if (!source) return null;
    const cestMoi = source === "TITULAIRE" ? info.jeSuisTitulaire : !info.jeSuisTitulaire;
    if (cestMoi) return "d'après votre annonce";
    return `d'après l'annonce de ${info.theirName ?? "l'autre partie"}`;
  };

  // La mention de provenance ne vaut que TANT QUE le champ porte encore la valeur reprise.
  //
  // Constaté à l'écran le 08/09, sur la production : après avoir remplacé le début par une date
  // saisie à la main — puis après l'avoir effacé —, l'écran continuait d'afficher « d'après votre
  // annonce » sous un champ qu'aucune annonce ne portait. La lecture du code ne le montrait pas :
  // la condition ne regardait que `divergent`, un état figé au chargement, jamais la valeur
  // courante. Une mention d'origine qui survit à la modification de ce qu'elle explique est une
  // affirmation fausse — le défaut même que cette section ferme.
  const mentionProvenance = (
    valeurCourante: string,
    valeurReprise: string | null | undefined,
    source: SourcePeriode | undefined,
  ): boolean =>
    !!periode?.divergent && !!source && !!valeurReprise && valeurCourante === valeurReprise;

  const periodeAnnonce = (p: { debut: string | null; fin: string | null }): string => {
    if (p.debut && p.fin) return `du ${fmtDateUTC(p.debut)} au ${fmtDateUTC(p.fin)}`;
    if (p.debut) return `à partir du ${fmtDateUTC(p.debut)}`;
    if (p.fin) return `jusqu'au ${fmtDateUTC(p.fin)}`;
    return "aucune date indiquée";
  };

  // Ce qui manque pour un contrat de travail (section 237, lot 2). L'écran le dit AVANT de laisser
  // cliquer : la route refuse ces deux cas en 422, et découvrir le refus après coup serait
  // exactement le défaut qu'on ferme depuis deux semaines.
  const repartitionIncomplete =
    tempsPartiel && repartition.filter(r => r.jour && r.debut && r.fin).length === 0;
  const salariatIncomplet =
    !!info.isSalariat && (!remuneration || Number(remuneration) <= 0 || repartitionIncomplete);

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

        {/* ── Période du contrat (section 237) ────────────────────────────────────────────
            Toujours dépliée, en tête du formulaire : c'est la clause que les deux parties
            regardent en premier, et la seule que le document reprenait jusqu'ici sans
            l'avoir montrée. */}
        <div className="pb-1">
          <h2 className="text-sm font-bold text-gray-900 mb-1">Période du contrat</h2>
          <p className="text-xs text-gray-500 mb-3">
            Reprise des annonces, modifiable pour ce contrat. Les annonces publiées ne sont pas
            changées.
          </p>

          <div className={`grid gap-3 ${periodeAvecFin ? "grid-cols-2" : "grid-cols-1"}`}>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Début</label>
              <input
                type="date"
                value={dateDebut}
                onChange={e => setDateDebut(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-kine-200"
              />
              {mentionProvenance(dateDebut, periode?.debut, periode?.sourceDebut) && (
                <p className="text-[11px] text-gray-400 mt-1">{origine(periode!.sourceDebut)}</p>
              )}
            </div>

            {periodeAvecFin && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Fin</label>
                <input
                  type="date"
                  value={dateFin}
                  min={dateDebut || undefined}
                  onChange={e => setDateFin(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-kine-200"
                />
                {mentionProvenance(dateFin, periode?.fin, periode?.sourceFin) && (
                  <p className="text-[11px] text-gray-400 mt-1">{origine(periode!.sourceFin)}</p>
                )}
              </div>
            )}
          </div>

          {!dateDebut && (
            <p className="text-xs text-amber-700 mt-2">
              Aucune date de début n&apos;est indiquée : le contrat portera la mention
              «&nbsp;date à compléter&nbsp;». Renseignez-la avant signature.
            </p>
          )}

          {/* Divergence entre les deux annonces. On n'en choisit pas une en silence : les deux
              sont montrées, et le champ ci-dessus dit laquelle il a reprise. */}
          {periode?.divergent && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 leading-relaxed">
              <strong>Les deux annonces n&apos;indiquent pas la même période.</strong>
              <span className="block mt-1">
                {info.jeSuisTitulaire ? "Votre annonce" : `Annonce de ${info.theirName ?? "l'autre partie"}`} :{" "}
                {periodeAnnonce(periode.titulaire)}
              </span>
              <span className="block">
                {info.jeSuisTitulaire ? `Annonce de ${info.theirName ?? "l'autre partie"}` : "Votre annonce"} :{" "}
                {periodeAnnonce(periode.candidat)}
              </span>
              <span className="block mt-1">
                Convenez de la période applicable avant de générer le document.
              </span>
            </div>
          )}
        </div>

        {/* ── Rémunération et temps de travail (section 237, lot 2) ───────────────────────
            Contrat de TRAVAIL uniquement. Ces clauses n'existent pas dans les gabarits
            libéraux, et le CDI ne lit ni rétrocession ni redevance : chaque monde ne voit
            que ce que son modèle consomme. */}
        {info.isSalariat && (
          <div className="border-t border-gray-100 pt-4">
            <h2 className="text-sm font-bold text-gray-900 mb-1">Rémunération et temps de travail</h2>
            <p className="text-xs text-gray-500 mb-3">
              Mentions obligatoires du contrat de travail. Elles figureront telles quelles dans le
              document.
            </p>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Rémunération mensuelle brute (€) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number" min={1} max={1000000} step={10}
                  value={remuneration}
                  onChange={e => setRemuneration(e.target.value)}
                  placeholder="Ex. : 2600"
                  className="w-40 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-kine-200"
                />
                {!remuneration && (
                  <p className="text-xs text-amber-700 mt-1">
                    Obligatoire — un salaire ne peut pas être proposé par défaut. Sans cette valeur,
                    le contrat n&apos;est pas généré.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Lieu de travail
                </label>
                <input
                  type="text"
                  value={lieuTravail}
                  onChange={e => setLieuTravail(e.target.value.slice(0, 200))}
                  placeholder="Adresse d'exécution du contrat"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-kine-200"
                />
                <p className="text-[11px] text-gray-400 mt-1">Repris de l&apos;annonce, modifiable.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Durée hebdomadaire (heures)
                </label>
                <input
                  type="number" min={1} max={48} step={1}
                  value={heures}
                  onChange={e => setHeures(Math.min(48, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-28 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-kine-200"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  35 h par défaut — durée légale (art. L.3121-27).
                </p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tempsPartiel}
                  onChange={e => {
                    setTempsPartiel(e.target.checked);
                    // Une première ligne à remplir, plutôt qu'un tableau vide : le Code du travail
                    // impose la répartition, et la route refuse un temps partiel sans elle.
                    if (e.target.checked && repartition.length === 0) {
                      setRepartition([{ jour: "Lundi", debut: "", fin: "" }]);
                    }
                  }}
                  className="mt-0.5 w-4 h-4 accent-kine-600"
                />
                <div>
                  <p className="text-sm font-semibold text-gray-800">Temps partiel</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    La répartition des horaires devient obligatoire (art. L.3123-6).
                  </p>
                </div>
              </label>

              {tempsPartiel && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 flex flex-col gap-2">
                  <p className="text-xs font-semibold text-gray-700">Répartition des horaires</p>
                  {repartition.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <select
                        value={r.jour}
                        onChange={e => setRepartition(repartition.map((x, k) => k === i ? { ...x, jour: e.target.value } : x))}
                        className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-800 bg-white"
                      >
                        {JOURS.map(j => <option key={j} value={j}>{j}</option>)}
                      </select>
                      <input
                        type="time" value={r.debut}
                        onChange={e => setRepartition(repartition.map((x, k) => k === i ? { ...x, debut: e.target.value } : x))}
                        className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-800 bg-white"
                      />
                      <input
                        type="time" value={r.fin}
                        onChange={e => setRepartition(repartition.map((x, k) => k === i ? { ...x, fin: e.target.value } : x))}
                        className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-800 bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setRepartition(repartition.filter((_, k) => k !== i))}
                        className="text-gray-400 hover:text-red-500 text-sm px-1"
                        aria-label="Retirer cette ligne"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setRepartition([...repartition, { jour: "Lundi", debut: "", fin: "" }])}
                    className="self-start text-xs font-semibold text-kine-700 hover:underline"
                  >
                    + Ajouter un jour
                  </button>
                  {repartitionIncomplete && (
                    <p className="text-xs text-amber-700">
                      Indiquez au moins un jour avec ses heures de début et de fin.
                    </p>
                  )}

                  <div className="border-t border-gray-200 pt-2 mt-1">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Heures complémentaires maximum
                    </label>
                    <input
                      type="number" min={0} max={20} step={1}
                      value={heuresComplMax}
                      onChange={e => setHeuresComplMax(Math.min(20, Math.max(0, Number(e.target.value) || 0)))}
                      className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-800 bg-white"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rayon non-concurrence */}
        <div className="border-t border-gray-100 pt-4">
          <label className="block text-sm font-semibold text-gray-800 mb-1">
            Rayon de non-{isRemplacement ? "installation" : "concurrence"} (km)
          </label>
          {/* ── Modèle de contrat ─────────────────────────────────────────────────────────
              Affiché SEULEMENT quand plusieurs modèles existent. Un seul : rien à demander.
              Aucun : on le dit — le bouton de génération échouerait en 422, et laisser
              l'utilisateur le découvrir après coup serait le défaut qu'on passe la semaine
              à fermer. */}
          {info?.gabarits && info.gabarits.length === 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 leading-relaxed mb-4">
              Aucun modèle de contrat n&apos;existe pour ce type de mission dans votre profession.
              Ce statut n&apos;a pas nécessairement d&apos;équivalent d&apos;un ordre professionnel à
              l&apos;autre.
            </div>
          )}

          {info?.gabarits?.some((g) => g.composeSansModele) && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900 leading-relaxed mb-4">
              <strong>Aucun modèle-type de l&apos;Ordre ne couvre ce contrat.</strong> Le document
              proposé a été composé à partir des clauses déontologiques confirmées et des
              dispositions standard du droit du travail. Il porte cet avertissement en première
              page, et sa validation par un avocat est indispensable avant signature.
            </div>
          )}

          {info?.gabarits && info.gabarits.length > 1 && (
            <div className="mb-5">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Modèle de contrat applicable
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Plusieurs modèles officiels existent pour ce type de mission. Le choix dépend de la
                situation du remplaçant et engage les deux parties.
              </p>
              <div className="space-y-2">
                {info.gabarits.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGabaritId(g.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl border transition ${
                      gabaritId === g.id
                        ? "border-kine-500 bg-kine-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <span className="block text-sm font-semibold text-gray-800">{g.libelle}</span>
                    {g.quandLUtiliser && (
                      <span className="block text-xs text-gray-500 mt-0.5 leading-snug">{g.quandLUtiliser}</span>
                    )}
                    <span className="block text-[11px] text-gray-400 mt-1">{g.source}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {gabaritId === "INFIRMIER_COLLABORATION" && (
            <div className="mb-5">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Partage des forfaits de prise en charge
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Article 6.2 du modèle — comment le forfait journalier est réparti quand un patient
                est pris en charge en commun.
              </p>
              <select
                value={forfaitPartage}
                onChange={(e) => setForfaitPartage(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-800"
              >
                <option value="TOUR_DE_ROLE">Facturé et perçu à tour de rôle, au regard du planning</option>
                <option value="PARTS_EGALES">Partagé par parts égales</option>
                <option value="CHARGE_TRAVAIL">Partagé selon la charge de travail (pourcentages à préciser)</option>
              </select>
            </div>
          )}

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

        {/* Durée non-concurrence (uniquement hors remplacement, et hors contrat de travail :
            le CDI porte sa propre durée de non-concurrence, en mois, réglée au lot 4). */}
        {!isRemplacement && !info.isSalariat && (
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

        {/* Taux de rétrocession (REMPLACEMENT libéral) */}
        {isRemplacement && !info.isSalariat && (
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

        {/* Taux de redevance (ASSISTANAT / COLLABORATION libéraux) */}
        {!isRemplacement && !info.isSalariat && (
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              Redevance versée au titulaire (%)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range" min={10} max={60} step={5}
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
            « rétrocession » pour un remplacement, « redevance » sinon.
            Absentes d'un contrat de travail : un salarié est payé par bulletin de paie, et le
            gabarit CDI ne lit aucun de ces trois paramètres. */}
        {!info.isSalariat && (
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
        )}

        {/* Période d'essai — variante LIBÉRALE (booléenne). Le contrat de travail a la sienne, en
            mois (`periodeEssaiMois`), que ce formulaire n'envoie pas encore : la case ci-dessous
            n'aurait donc aucun effet sur un CDI. */}
        {!info.isSalariat && (
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
        )}
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
          disabled={generating || salariatIncomplet}
          className="w-full py-4 bg-kine-600 text-white rounded-2xl font-bold text-base shadow hover:bg-kine-700 active:scale-[0.98] transition disabled:opacity-60"
        >
          {generating ? "Génération en cours…" : "Télécharger le PDF officiel →"}
        </button>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => handleGenerate(true)}
            disabled={generating || salariatIncomplet}
            className="w-full py-4 bg-white border-2 border-kine-300 text-kine-700 rounded-2xl font-bold text-base shadow-sm hover:bg-kine-50 active:scale-[0.98] transition disabled:opacity-60"
          >
            {generating ? "Génération en cours…" : "Télécharger l'aperçu (brouillon) →"}
          </button>
          {/* Le brouillon est bloqué lui aussi, et non le seul PDF officiel : son objet est la
              relecture avant signature, et laisser relire un salaire inventé serait pire que de
              ne rien produire. */}
          {salariatIncomplet && (
            <p className="text-xs text-amber-700 text-center">
              Complétez la rémunération{repartitionIncomplete ? " et la répartition des horaires" : ""} pour
              générer le contrat.
            </p>
          )}
          <p className="text-xs text-gray-400 text-center">
            Document filigrané « non officiel », pour relecture avant signature. Le PDF officiel
            (sans filigrane, avec les signatures) sera disponible une fois les deux parties signées.
          </p>
        </div>
      )}
    </div>
  );
}
