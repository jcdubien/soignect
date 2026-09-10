/* eslint-disable react/no-unescaped-entities */
"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fmtDateUTC } from "@/lib/contrats/date";
import { libelleOrdre, articleNonInstallation } from "@/lib/professions";
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
  /** Profession du contrat — nomme l'ordre et l'article de code exacts (section 240). */
  profession?: string;
  /** Durée, préavis et non-concurrence (section 237, lot 4). */
  defautsDuree?: {
    preavisJours: number; preavisCommunAccordJours: number; preavisUnilateralJours: number;
    preavisEssaiJours: number; periodeEssaiMoisInfirmier: number; periodeEssaiMoisCdi: number;
    dureeMois: number; renouvellementsMax: number; dureeMaxMois: number;
    nonConcurrenceDureeMois: number; nonConcurrenceIndemnitePct: number;
  };
  /** Valeurs pré-remplies du contrat de travail, calculées serveur (section 237, lot 2). */
  defautsSalarie?: {
    lieuTravail: string;
    heuresHebdomadaires: number;
    heuresComplementairesMax: number;
  };
  /** Honoraires et reversements des modèles infirmier (section 237, lot 3). */
  defautsInfirmier?: {
    reversementPct: number;
    reversementDelaiMois: number;
    redevanceCabinetPct: number;
    redevanceCabinetSeuilAlerte: number;
    jourVersementRedevance: number;
    forfaitDelaiReversementJours: number;
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
  /** Une signature manuscrite est conservée sur le profil du lecteur (section 242). */
  signatureEnregistree?: boolean;
}

const SIGNATURE_LEGAL =
  "Ce document a été signé électroniquement par apposition d'une image de signature manuscrite. " +
  "Il ne constitue pas une signature électronique qualifiée au sens du règlement eIDAS. Les parties " +
  "reconnaissent la validité de ce mode de signature pour les besoins de ce contrat.";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

/**
 * Groupe de clauses repliable (section 237, lot 4).
 *
 * POURQUOI LE RÉSUMÉ EST OBLIGATOIRE. La règle posée par Jean-Charles est qu'aucune valeur par
 * défaut n'atteigne le PDF sans avoir été montrée. Un groupe replié qui ne dirait que son titre
 * la violerait : le préavis serait de nouveau invisible. L'en-tête porte donc TOUJOURS les
 * valeurs qu'il contient — replié, on les lit quand même ; déplié, on les modifie.
 *
 * `<details>` natif plutôt qu'un état React : le repli reste accessible au clavier et aux
 * lecteurs d'écran sans qu'on ait à le réimplémenter.
 */
function Groupe({ titre, resume, children, ouvert = false }: {
  titre: string; resume: string; children: React.ReactNode; ouvert?: boolean;
}) {
  return (
    <details open={ouvert} className="border-t border-gray-100 pt-4 group">
      <summary className="cursor-pointer list-none flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-sm font-bold text-gray-900">{titre}</span>
          <span className="block text-xs text-gray-500 mt-0.5">{resume}</span>
        </span>
        <span className="text-xs text-kine-700 font-semibold shrink-0 mt-0.5">
          <span className="group-open:hidden">Modifier</span>
          <span className="hidden group-open:inline">Replier</span>
        </span>
      </summary>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </details>
  );
}

/** Champ numérique compact, avec son unité et sa note. Répété une quinzaine de fois au lot 4. */
function ChampNombre({ label, valeur, onChange, min, max, unite, note }: {
  label: string; valeur: number; onChange: (v: number) => void;
  min: number; max: number; unite?: string; note?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number" min={min} max={max} step={1} value={valeur}
          onChange={e => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))}
          className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-kine-200"
        />
        {unite && <span className="text-sm text-gray-500">{unite}</span>}
      </div>
      {note && <p className="text-[11px] text-gray-400 mt-1">{note}</p>}
    </div>
  );
}

/** Champ texte libre, pour les mentions administratives. */
function ChampTexte({ label, valeur, onChange, max, placeholder, note }: {
  label: string; valeur: string; onChange: (v: string) => void;
  max: number; placeholder?: string; note?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
      <input
        type="text" value={valeur} placeholder={placeholder}
        onChange={e => onChange(e.target.value.slice(0, max))}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-kine-200"
      />
      {note && <p className="text-[11px] text-gray-400 mt-1">{note}</p>}
    </div>
  );
}

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

  // Honoraires et reversements des modèles INFIRMIER (section 237, lot 3).
  //
  // `redevanceCabinetPct` est SÉPARÉ de `redevancePct`, et ce n'est pas de la coquetterie : dans le
  // remplacement entre confrères, la redevance est versée PAR le remplaçant installé, alors que le
  // reversement du modèle avec autorisation va DANS L'AUTRE SENS. Les confondre retourne le flux
  // financier du document — ce qui se produisait, le curseur kiné masqué envoyant 40 %.
  const [reversementDirectPct,       setReversementDirectPct]       = useState(70);
  const [reversementDirectDelai,     setReversementDirectDelai]     = useState(1);
  const [reversementTiersPayantPct,  setReversementTiersPayantPct]  = useState(70);
  const [reversementTiersPayantDelai, setReversementTiersPayantDelai] = useState(1);
  const [redevanceCabinetPct,        setRedevanceCabinetPct]        = useState(5);
  const [jourVersementRedevance,     setJourVersementRedevance]     = useState(10);
  const [forfaitDelaiReversement,    setForfaitDelaiReversement]    = useState(30);

  // Durée, préavis, non-concurrence et mentions administratives (section 237, lot 4).
  // Vingt-quatre paramètres que la route lisait et que l'écran n'envoyait jamais : leurs valeurs
  // par défaut partaient donc dans le PDF sans avoir été montrées une seule fois.
  const [preavisJours,        setPreavisJours]        = useState(30);
  const [preavisCommunAccord, setPreavisCommunAccord] = useState(8);
  const [preavisUnilateral,   setPreavisUnilateral]   = useState(8);
  const [preavisEssaiJours,   setPreavisEssaiJours]   = useState(15);
  const [essaiCdiActif,       setEssaiCdiActif]       = useState(false);
  const [essaiCdiMois,        setEssaiCdiMois]        = useState(2);
  const [essaiInfMois,        setEssaiInfMois]        = useState(3);
  const [dureeMois,           setDureeMois]           = useState(12);
  const [renouvellementsMax,  setRenouvellementsMax]  = useState(1);
  const [dureeMaxMois,        setDureeMaxMois]        = useState(24);
  const [ncDureeMois,         setNcDureeMois]         = useState(12);
  const [ncIndemnitePct,      setNcIndemnitePct]      = useState(25);
  const [ncPeriodicite,       setNcPeriodicite]       = useState("MENSUELLE");
  const [dureeInfoSollicit,   setDureeInfoSollicit]   = useState("");
  // Mentions administratives — champs TEXTE, tous vides par défaut côté route : le gabarit
  // imprime alors « [à compléter] ». Les montrer, c'est donner la chance de les remplir.
  const [urssafVille,      setUrssafVille]      = useState("");
  const [numeroSecu,       setNumeroSecu]       = useState("");
  const [caisseRetraite,   setCaisseRetraite]   = useState("");
  const [regimeFraisSante, setRegimeFraisSante] = useState("");
  const [regimePrevoyance, setRegimePrevoyance] = useState("");
  const [autorisationNum,  setAutorisationNum]  = useState("");
  const [autorisationDate, setAutorisationDate] = useState("");
  const [cpamRattachement, setCpamRattachement] = useState("");
  const [cabinetRemplacant, setCabinetRemplacant] = useState("");
  const [moyensMisADispo,  setMoyensMisADispo]  = useState("");
  const [recensementDispo, setRecensementDispo] = useState("");
  const [forfaitRepartition, setForfaitRepartition] = useState("");

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
  // Conservation de la signature (section 242). DÉCOCHÉE PAR DÉFAUT : une signature manuscrite
  // est une donnée personnelle, et un consentement pré-coché n'en est pas un. La demande était
  // « propose explicitement », pas « réutilise en silence ».
  const [enregistrerSignature, setEnregistrerSignature] = useState(false);
  const [oubliEnCours, setOubliEnCours] = useState(false);

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
        if (d.defautsDuree) {
          const u = d.defautsDuree;
          setPreavisJours(u.preavisJours);
          setPreavisCommunAccord(u.preavisCommunAccordJours);
          setPreavisUnilateral(u.preavisUnilateralJours);
          setPreavisEssaiJours(u.preavisEssaiJours);
          setEssaiCdiMois(u.periodeEssaiMoisCdi);
          setEssaiInfMois(u.periodeEssaiMoisInfirmier);
          setDureeMois(u.dureeMois);
          setRenouvellementsMax(u.renouvellementsMax);
          setDureeMaxMois(u.dureeMaxMois);
          setNcDureeMois(u.nonConcurrenceDureeMois);
          setNcIndemnitePct(u.nonConcurrenceIndemnitePct);
        }
        if (d.defautsInfirmier) {
          const i = d.defautsInfirmier;
          setReversementDirectPct(i.reversementPct);
          setReversementTiersPayantPct(i.reversementPct);
          setReversementDirectDelai(i.reversementDelaiMois);
          setReversementTiersPayantDelai(i.reversementDelaiMois);
          setRedevanceCabinetPct(i.redevanceCabinetPct);
          setJourVersementRedevance(i.jourVersementRedevance);
          setForfaitDelaiReversement(i.forfaitDelaiReversementJours);
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
      // N'est proposé — donc n'est transmis — que si aucune signature n'est déjà conservée.
      if (enregistrerSignature && !sig?.signatureEnregistree) fd.append("enregistrer", "true");
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

  /** Apposer la signature conservée, sans reprendre de photo (section 242). */
  async function handleSignEnregistree() {
    setSigning(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("reutiliser", "true");
      const res = await fetch(`/api/match/${id}/signature`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "Échec de l'apposition de la signature."); return; }
      loadSig();
    } catch {
      setError("Erreur réseau lors de l'apposition de la signature.");
    } finally {
      setSigning(false);
    }
  }

  /** Retirer le consentement. Les contrats déjà signés gardent leur propre copie. */
  async function handleOublierSignature() {
    setOubliEnCours(true);
    setError(null);
    try {
      const res = await fetch("/api/profil/signature", { method: "DELETE" });
      if (!res.ok) { setError("Impossible de retirer la signature conservée."); return; }
      loadSig();
    } catch {
      setError("Erreur réseau.");
    } finally {
      setOubliEnCours(false);
    }
  }

  function buildUrl(draft: boolean) {
    const params = new URLSearchParams({
      // Toujours transmises, même vides : côté route, un paramètre ABSENT retombe sur l'annonce,
      // tandis qu'un paramètre VIDE dit « pas de date ». Sans cet envoi systématique, effacer une
      // date à l'écran serait sans effet sur le document.
      dateDebut,
      dateFin,

      modePaiement,
      delaiPaiementJours: String(delaiPaiementJours),
      modalitesLocaux,
    });

    // RIEN NE PART QUI N'AIT ÉTÉ MONTRÉ (section 237, lot 3).
    //
    // `retrocessionPct` et `redevancePct` étaient transmis systématiquement, y compris quand leur
    // curseur était masqué. Sur un remplacement, l'écran affiche la rétrocession et cache la
    // redevance — mais envoyait quand même sa valeur par défaut, 40 %. Le modèle infirmier entre
    // confrères la lisait et imprimait « Une redevance de 40 % », un taux jamais vu, jamais
    // choisi, et que l'Ordre situe entre 5 et 10 %.
    //
    // La règle est désormais symétrique de celle des défauts : un paramètre n'est transmis que si
    // le contrôle qui le règle est à l'écran.
    if (montrePeriodeEssaiLiberale) params.set("periodeEssai", String(periodeEssai));
    if (montreRayon)        params.set("rayonKm",  String(rayonKm));
    if (montreDureeAns)     params.set("dureeAns", String(dureeAns));
    if (montreRetrocession) params.set("retrocessionPct", String(retrocessionPct));
    if (montreRedevance)    params.set("redevancePct",    String(redevancePct));
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

    if (gabaritId === "INFIRMIER_REMPLACEMENT_AUTORISATION") {
      params.set("reversementDirectPct", String(reversementDirectPct));
      params.set("reversementDirectDelaiMois", String(reversementDirectDelai));
      params.set("reversementTiersPayantPct", String(reversementTiersPayantPct));
      params.set("reversementTiersPayantDelaiMois", String(reversementTiersPayantDelai));
    }
    if (gabaritId === "INFIRMIER_REMPLACEMENT_CONFRERE") {
      params.set("redevanceCabinetPct", String(redevanceCabinetPct));
    }
    if (gabaritId === "INFIRMIER_COLLABORATION") {
      params.set("jourVersementRedevance", String(jourVersementRedevance));
      params.set("forfaitDelaiReversementJours", String(forfaitDelaiReversement));
    }

    // ── Lot 4 : durée, préavis, non-concurrence, mentions administratives ─────────────────
    // Toujours par gabarit, jamais en bloc : la règle du lot 3 vaut ici aussi, un paramètre ne
    // part que si le champ qui le règle est à l'écran.
    if (info?.isSalariat) {
      params.set("preavisJours", String(preavisJours));
      params.set("nonConcurrenceDureeMois", String(ncDureeMois));
      params.set("nonConcurrenceIndemnitePct", String(ncIndemnitePct));
      params.set("nonConcurrencePeriodicite", ncPeriodicite);
      // Vide = pas de période d'essai. La route distingue déjà l'absent du vide sur ce champ.
      params.set("periodeEssaiMois", essaiCdiActif ? String(essaiCdiMois) : "");
      params.set("urssafVille", urssafVille);
      params.set("numeroSecuriteSociale", numeroSecu);
      params.set("caisseRetraite", caisseRetraite);
      params.set("regimeFraisSante", regimeFraisSante);
      params.set("regimePrevoyance", regimePrevoyance);
    }
    if (gabaritId === "INFIRMIER_REMPLACEMENT_AUTORISATION") {
      params.set("preavisCommunAccordJours", String(preavisCommunAccord));
      params.set("preavisUnilateralJours", String(preavisUnilateral));
      params.set("autorisationNumero", autorisationNum);
      params.set("autorisationDate", autorisationDate);
      params.set("cpamRattachement", cpamRattachement);
      params.set("moyensMisADisposition", moyensMisADispo);
    }
    if (gabaritId === "INFIRMIER_REMPLACEMENT_CONFRERE") {
      params.set("preavisCommunAccordJours", String(preavisCommunAccord));
      params.set("preavisUnilateralJours", String(preavisUnilateral));
      params.set("dureeInformationSollicitation", dureeInfoSollicit);
      params.set("cabinetRemplacant", cabinetRemplacant);
      params.set("moyensMisADisposition", moyensMisADispo);
    }
    if (gabaritId === "INFIRMIER_COLLABORATION") {
      params.set("dureeMois", String(dureeMois));
      params.set("renouvellementsMax", String(renouvellementsMax));
      params.set("dureeMaxMois", String(dureeMaxMois));
      params.set("periodeEssaiMois", String(essaiInfMois));
      params.set("preavisEssaiJours", String(preavisEssaiJours));
      params.set("dureeInformationSollicitation", dureeInfoSollicit);
      params.set("moyensMisADisposition", moyensMisADispo);
      params.set("recensementDispositions", recensementDispo);
      if (forfaitPartage === "CHARGE_TRAVAIL") params.set("forfaitRepartition", forfaitRepartition);
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
      // NOM DU FICHIER : CELUI DE LA ROUTE (section 246). L'écran en reconstruisait un second,
      // de forme différente et sans la période. Deux noms pour un même document, c'est la règle
      // recopiée dont ce dépôt a déjà payé le prix trois fois. La route le compose une fois, avec
      // les dates réellement portées au contrat ; on le lit dans l'en-tête.
      const dispo = res.headers.get("Content-Disposition") ?? "";
      const nomServeur = /filename="([^"]+)"/.exec(dispo)?.[1];
      const repli = `contrat-${info?.missionType?.toLowerCase() ?? "match"}${draft ? "-brouillon" : ""}.pdf`;
      a.download = nomServeur ?? repli;
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

  // Conditions d'affichage des deux taux libéraux, nommées UNE FOIS et réutilisées par le JSX
  // comme par `buildUrl`. Tant que la condition d'affichage vivait uniquement dans le JSX, rien
  // n'empêchait l'envoi d'un paramètre masqué — ce qui est précisément arrivé.
  const estInfirmier = (gabaritId ?? "").startsWith("INFIRMIER_");

  // Vocabulaire de l'ordre concerné (section 240). Ces deux textes étaient codés en dur pour les
  // kinésithérapeutes : un infirmier lisait le mauvais nom d'ordre et le mauvais article de code,
  // sur l'écran même qui produit son contrat.
  // Résumés d'en-tête des groupes repliés (section 237, lot 4). Ils ne sont pas décoratifs :
  // c'est par eux qu'un groupe fermé continue de MONTRER ses valeurs. Sans eux, replier un
  // groupe recréerait exactement le défaut que ce lot ferme.
  const resumeDuree = [
    info.isSalariat && (essaiCdiActif ? `essai ${essaiCdiMois} mois` : "sans période d'essai"),
    info.isSalariat && `préavis ${preavisJours} j`,
    (gabaritId === "INFIRMIER_REMPLACEMENT_AUTORISATION" || gabaritId === "INFIRMIER_REMPLACEMENT_CONFRERE")
      && `préavis ${preavisCommunAccord} j d'un commun accord, ${preavisUnilateral} j unilatéral`,
    gabaritId === "INFIRMIER_COLLABORATION"
      && `${dureeMois} mois, ${renouvellementsMax} renouvellement${renouvellementsMax > 1 ? "s" : ""}, ${dureeMaxMois} mois au total · essai ${essaiInfMois} mois, préavis ${preavisEssaiJours} j`,
  ].filter(Boolean).join(" · ");

  // QUELS GROUPES ONT QUELQUE CHOSE À DIRE (section 241, correctif du 08/09).
  //
  // Les trois groupes du lot 4 ne concernent que le CDI et les modèles infirmier. Sur un contrat
  // KINÉ LIBÉRAL — le cas le plus courant, quatre des six mises en relation réelles — aucune des
  // conditions internes n'est vraie : le groupe « Durée et préavis » s'affichait vide, sans
  // résumé, avec un lien « Modifier » qui n'ouvrait rien.
  //
  // Rien n'est perdu pour ces gabarits : leur préavis d'essai est porté par la case dédiée, et
  // leur durée de non-installation est fixée par la loi, indiquée sous le rayon. Il n'y avait donc
  // rien à mettre dans ce groupe — il ne devait simplement pas exister.
  //
  // Défaut introduit par le lot 4 lui-même, et trouvé en vérifiant le déploiement : les deux
  // écrans que j'avais contrôlés, CDI et collaboration infirmier, étaient justement les deux où
  // le groupe avait du contenu.
  const groupeDureeUtile = !!info.isSalariat || estInfirmier;
  const groupeNonConcurrenceUtile = !!info.isSalariat;
  const groupeMentionsUtile = !!info.isSalariat || estInfirmier;
  const montreGroupesLot4 = groupeDureeUtile || groupeNonConcurrenceUtile || groupeMentionsUtile;

  const resumeNonConcurrence =
    `${ncDureeMois} mois · contrepartie ${ncIndemnitePct} % du salaire, versée ${ncPeriodicite === "TRIMESTRIELLE" ? "trimestriellement" : "mensuellement"}`;

  // Ce résumé-ci compte les champs RESTÉS VIDES : ils s'imprimeront « [à compléter] » dans le
  // document. Annoncer « tout est rempli » quand ce n'est pas le cas serait le même mensonge
  // d'écran que ceux corrigés aujourd'hui.
  const champsMentions = [
    ...(info.isSalariat ? [urssafVille, numeroSecu, caisseRetraite, regimeFraisSante, regimePrevoyance] : []),
    ...(gabaritId === "INFIRMIER_REMPLACEMENT_AUTORISATION" ? [autorisationNum, autorisationDate, cpamRattachement] : []),
    ...(gabaritId === "INFIRMIER_REMPLACEMENT_CONFRERE" ? [cabinetRemplacant] : []),
    ...(estInfirmier ? [moyensMisADispo] : []),
    ...(gabaritId === "INFIRMIER_COLLABORATION" ? [recensementDispo] : []),
  ];
  const vides = champsMentions.filter((v) => !v.trim()).length;
  const resumeMentions =
    vides === 0
      ? "toutes renseignées"
      : `${vides} sur ${champsMentions.length} non renseignée${vides > 1 ? "s" : ""} — le contrat portera « à compléter »`;

  const ordre = libelleOrdre(info.profession);
  const articleNonInstall = articleNonInstallation(info.profession);

  // `retrocessionPct` n'est lu par AUCUN gabarit infirmier : il n'y figure que dans des
  // commentaires mettant en garde contre cette confusion. Le remplacement infirmier a ses propres
  // taux, réglés ci-dessous. Afficher en plus un curseur de rétrocession sans effet serait le même
  // levier dormant que les six retirés du CDI au lot 2.
  const montreRetrocession = isRemplacement  && !info.isSalariat && !estInfirmier;
  // La redevance, elle, EST lue par la collaboration infirmier — on la garde donc là.
  const montreRedevance    = !isRemplacement && !info.isSalariat;

  // Derniers leviers dormants, consignés au lot 3 et fermés ici (section 237, lot 4).
  // `rayonKm` n'est lu ni par le remplacement infirmier entre confrères ni par la collaboration
  // infirmier ; `dureeAns` ne l'est par aucun gabarit infirmier. Les afficher offrirait des
  // réglages sans effet sur le document.
  const montreRayon =
    gabaritId !== "INFIRMIER_REMPLACEMENT_CONFRERE" && gabaritId !== "INFIRMIER_COLLABORATION";
  const montreDureeAns = !isRemplacement && !info.isSalariat && !estInfirmier;
  // La case d'essai LIBÉRALE est booléenne (`periodeEssai`) : seuls les gabarits kiné la lisent.
  // Les modèles infirmier ont leur propre essai, en MOIS, réglé dans « Durée et préavis ». Les
  // afficher tous les deux ne donnait pas seulement un levier sans effet : les deux se
  // contredisaient à l'écran. Constaté de visu sur la collaboration infirmier.
  const montrePeriodeEssaiLiberale = !info.isSalariat && !estInfirmier;
  const seuilRedevance = info.defautsInfirmier?.redevanceCabinetSeuilAlerte ?? 10;
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

        {/* ── Honoraires et reversements — modèles INFIRMIER (section 237, lot 3) ─────────
            Le contenu dépend du modèle retenu, parce que l'argent n'y circule pas dans le
            même sens : avec autorisation, le remplacé REVERSE au remplaçant ; entre
            confrères, le remplaçant installé VERSE une redevance de frais de cabinet. */}
        {estInfirmier && (
          <div className="border-t border-gray-100 pt-4">
            <h2 className="text-sm font-bold text-gray-900 mb-1">Honoraires et reversements</h2>
            <p className="text-xs text-gray-500 mb-3">
              Clause économique centrale du contrat. Les valeurs ci-dessous figureront telles
              quelles dans le document.
            </p>

            {gabaritId === "INFIRMIER_REMPLACEMENT_AUTORISATION" && (
              <div className="flex flex-col gap-4">
                <p className="text-xs text-gray-500">
                  Le remplacé encaisse les honoraires et vous en reverse une part : le remplaçant
                  n&apos;étant pas installé, il ne facture pas lui-même.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Part reversée au remplaçant — honoraires perçus directement (%)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range" min={0} max={100} step={5}
                      value={reversementDirectPct}
                      onChange={e => setReversementDirectPct(Number(e.target.value))}
                      className="flex-1 accent-kine-600"
                    />
                    <span className="w-16 text-center text-sm font-bold text-kine-700 bg-kine-50 rounded-xl px-2 py-1">
                      {reversementDirectPct}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-600">reversés dans un délai de</span>
                    <input
                      type="number" min={0} max={12} step={1}
                      value={reversementDirectDelai}
                      onChange={e => setReversementDirectDelai(Math.min(12, Math.max(0, Number(e.target.value) || 0)))}
                      className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-800"
                    />
                    <span className="text-xs text-gray-600">mois après la fin du remplacement</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Part reversée au remplaçant — actes en tiers payant (%)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range" min={0} max={100} step={5}
                      value={reversementTiersPayantPct}
                      onChange={e => setReversementTiersPayantPct(Number(e.target.value))}
                      className="flex-1 accent-kine-600"
                    />
                    <span className="w-16 text-center text-sm font-bold text-kine-700 bg-kine-50 rounded-xl px-2 py-1">
                      {reversementTiersPayantPct}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-600">reversés dans un délai de</span>
                    <input
                      type="number" min={0} max={12} step={1}
                      value={reversementTiersPayantDelai}
                      onChange={e => setReversementTiersPayantDelai(Math.min(12, Math.max(0, Number(e.target.value) || 0)))}
                      className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-800"
                    />
                    <span className="text-xs text-gray-600">mois après la fin du remplacement</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Les caisses continuent de verser au remplacé : ce taux règle ce qu&apos;il
                    reverse ensuite.
                  </p>
                </div>
              </div>
            )}

            {gabaritId === "INFIRMIER_REMPLACEMENT_CONFRERE" && (
              <div>
                <p className="text-xs text-gray-500 mb-2">
                  Sens inverse du modèle précédent : le remplaçant, lui-même installé, encaisse ses
                  honoraires et verse au remplacé une redevance couvrant les frais du cabinet.
                </p>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Redevance de frais de cabinet versée au remplacé (%)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range" min={0} max={30} step={1}
                    value={redevanceCabinetPct}
                    onChange={e => setRedevanceCabinetPct(Number(e.target.value))}
                    className="flex-1 accent-kine-600"
                  />
                  <span className="w-16 text-center text-sm font-bold text-kine-700 bg-kine-50 rounded-xl px-2 py-1">
                    {redevanceCabinetPct}%
                  </span>
                </div>
                {redevanceCabinetPct > seuilRedevance ? (
                  <p className="text-xs text-amber-700 mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 leading-relaxed">
                    <strong>Au-delà de {seuilRedevance} %</strong>, l&apos;Ordre considère qu&apos;une
                    redevance peut s&apos;apparenter à un partage d&apos;honoraires, interdit par
                    l&apos;article R.4312-30. La redevance doit correspondre aux frais réellement
                    engagés.
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-400 mt-1">
                    Usage constaté par l&apos;Ordre : 5 à 10 %.
                  </p>
                )}
              </div>
            )}

            {gabaritId === "INFIRMIER_COLLABORATION" && (
              <div className="flex flex-col gap-4">
                <p className="text-xs text-gray-500">
                  Le collaborateur encaisse ses honoraires et verse au titulaire la redevance réglée
                  ci-dessous, au titre des frais professionnels mis à disposition.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Jour du mois où la redevance est versée
                  </label>
                  <input
                    type="number" min={1} max={31} step={1}
                    value={jourVersementRedevance}
                    onChange={e => setJourVersementRedevance(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                    className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Du mois suivant la période facturée.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Délai de reversement des forfaits de prise en charge (jours)
                  </label>
                  <input
                    type="number" min={0} max={365} step={1}
                    value={forfaitDelaiReversement}
                    onChange={e => setForfaitDelaiReversement(Math.min(365, Math.max(0, Number(e.target.value) || 0)))}
                    className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    À compter de la perception du forfait — complète le mode de partage choisi
                    plus haut.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Rayon non-concurrence */}
        <div className="border-t border-gray-100 pt-4">
          {montreRayon && (
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              Rayon de non-{isRemplacement ? "installation" : "concurrence"} (km)
            </label>
          )}
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

          {montreRayon && (
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
          )}
          {montreRayon && isRemplacement && (
            <p className="text-xs text-gray-400 mt-1">
              La durée est fixée à 2 ans
              {articleNonInstall ? ` par l'art. ${articleNonInstall}` : " par le code de la santé publique"}
              {" "}(non modifiable).
            </p>
          )}
        </div>

        {/* Durée non-concurrence (uniquement hors remplacement, et hors contrat de travail :
            le CDI porte sa propre durée de non-concurrence, en mois, réglée au lot 4). */}
        {montreDureeAns && (
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
        {montreRetrocession && (
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
        {montreRedevance && (
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
        {!info.isSalariat && !estInfirmier && (
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

        {/* Période d'essai — variante LIBÉRALE (booléenne), propre aux gabarits kiné. Le CDI et
            les modèles infirmier ont la leur, en MOIS, dans le groupe « Durée et préavis ». */}
        {montrePeriodeEssaiLiberale && (
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

      {/* ── Lot 4 : trois groupes repliables, chacun résumant ses valeurs dans son en-tête ──
          Repliés par défaut : ce sont des clauses standard, moins souvent négociées que la
          période ou l'argent. Mais leurs valeurs restent LISIBLES sans ouvrir — sinon le
          préavis redeviendrait invisible, ce que ce lot corrige précisément. */}
      {montreGroupesLot4 && (
      <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-1 ${locked ? "opacity-60 pointer-events-none" : ""}`}>

        {groupeDureeUtile && (
        <Groupe titre="Durée et préavis" resume={resumeDuree}>
          {info.isSalariat && (
            <>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox" checked={essaiCdiActif}
                  onChange={e => setEssaiCdiActif(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-kine-600"
                />
                <div>
                  <p className="text-sm font-semibold text-gray-800">Inclure une période d&apos;essai</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Sans elle, le contrat ne comporte aucune clause d&apos;essai.
                  </p>
                </div>
              </label>
              {essaiCdiActif && (
                <ChampNombre label="Durée de la période d'essai" valeur={essaiCdiMois}
                  onChange={setEssaiCdiMois} min={0} max={8} unite="mois"
                  note="2 mois pour un non-cadre, renouvellement non compris." />
              )}
              <ChampNombre label="Préavis de rupture" valeur={preavisJours}
                onChange={setPreavisJours} min={0} max={180} unite="jours" />
            </>
          )}

          {(gabaritId === "INFIRMIER_REMPLACEMENT_AUTORISATION" || gabaritId === "INFIRMIER_REMPLACEMENT_CONFRERE") && (
            <>
              <ChampNombre label="Préavis en cas de rupture d'un commun accord" valeur={preavisCommunAccord}
                onChange={setPreavisCommunAccord} min={0} max={180} unite="jours" />
              <ChampNombre label="Préavis en cas de rupture unilatérale" valeur={preavisUnilateral}
                onChange={setPreavisUnilateral} min={0} max={180} unite="jours" />
            </>
          )}

          {gabaritId === "INFIRMIER_COLLABORATION" && (
            <>
              <ChampNombre label="Durée initiale du contrat" valeur={dureeMois}
                onChange={setDureeMois} min={1} max={240} unite="mois"
                note="Reprise de l'annonce quand elle en déclare une." />
              <ChampNombre label="Nombre de renouvellements possibles" valeur={renouvellementsMax}
                onChange={setRenouvellementsMax} min={0} max={20} />
              <ChampNombre label="Durée totale maximale, renouvellements compris" valeur={dureeMaxMois}
                onChange={setDureeMaxMois} min={1} max={480} unite="mois" />
              <ChampNombre label="Période d'essai" valeur={essaiInfMois}
                onChange={setEssaiInfMois} min={0} max={24} unite="mois" />
              <ChampNombre label="Préavis pendant la période d'essai" valeur={preavisEssaiJours}
                onChange={setPreavisEssaiJours} min={0} max={180} unite="jours" />
            </>
          )}

          {(gabaritId === "INFIRMIER_COLLABORATION" || gabaritId === "INFIRMIER_REMPLACEMENT_CONFRERE") && (
            <ChampTexte label="Durée de l'obligation d'information en cas de sollicitation"
              valeur={dureeInfoSollicit} onChange={setDureeInfoSollicit} max={60}
              placeholder="Ex. : six mois"
              note="Laissé vide, le contrat portera « [à compléter] »." />
          )}
        </Groupe>
        )}

        {/* Non-concurrence — propre au CDI, seul modèle dont la clause se négocie. Les modèles
            libéraux ont une durée fixée par la loi, déjà indiquée sous le rayon. */}
        {info.isSalariat && (
          <Groupe titre="Non-concurrence" resume={resumeNonConcurrence}>
            <ChampNombre label="Durée de la clause après la rupture" valeur={ncDureeMois}
              onChange={setNcDureeMois} min={0} max={60} unite="mois" />
            <ChampNombre label="Contrepartie financière" valeur={ncIndemnitePct}
              onChange={setNcIndemnitePct} min={0} max={100} unite="% du salaire"
              note="Une clause de non-concurrence sans contrepartie financière est nulle." />
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Périodicité du versement de la contrepartie
              </label>
              <select
                value={ncPeriodicite}
                onChange={e => setNcPeriodicite(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 bg-white"
              >
                <option value="MENSUELLE">Mensuelle</option>
                <option value="TRIMESTRIELLE">Trimestrielle</option>
              </select>
            </div>
          </Groupe>
        )}

        {(info.isSalariat || estInfirmier) && (
          <Groupe titre="Mentions administratives" resume={resumeMentions}>
            {info.isSalariat && (
              <>
                <ChampTexte label="Ville de l'URSSAF" valeur={urssafVille}
                  onChange={setUrssafVille} max={80} placeholder="Ex. : Pointe-à-Pitre" />
                <ChampTexte label="N° de sécurité sociale du salarié" valeur={numeroSecu}
                  onChange={setNumeroSecu} max={25} />
                <ChampTexte label="Caisse de retraite complémentaire" valeur={caisseRetraite}
                  onChange={setCaisseRetraite} max={120} />
                <ChampTexte label="Régime de frais de santé" valeur={regimeFraisSante}
                  onChange={setRegimeFraisSante} max={120} />
                <ChampTexte label="Régime de prévoyance" valeur={regimePrevoyance}
                  onChange={setRegimePrevoyance} max={120} />
              </>
            )}

            {gabaritId === "INFIRMIER_REMPLACEMENT_AUTORISATION" && (
              <>
                <ChampTexte label="N° d'autorisation de remplacement" valeur={autorisationNum}
                  onChange={setAutorisationNum} max={60}
                  note="Délivrée par le conseil départemental de l'ordre." />
                <ChampTexte label="Date de l'autorisation" valeur={autorisationDate}
                  onChange={setAutorisationDate} max={40} placeholder="Ex. : 12 janvier 2026" />
                <ChampTexte label="CPAM de rattachement" valeur={cpamRattachement}
                  onChange={setCpamRattachement} max={120} />
              </>
            )}

            {gabaritId === "INFIRMIER_REMPLACEMENT_CONFRERE" && (
              <ChampTexte label="Cabinet du remplaçant" valeur={cabinetRemplacant}
                onChange={setCabinetRemplacant} max={200}
                note="Adresse de son propre cabinet, puisqu'il est installé." />
            )}

            {estInfirmier && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Moyens mis à disposition
                </label>
                <textarea
                  value={moyensMisADispo} rows={2}
                  onChange={e => setMoyensMisADispo(e.target.value.slice(0, 600))}
                  placeholder="Ex. : local, matériel de soins, logiciel de facturation…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 resize-y"
                />
              </div>
            )}

            {gabaritId === "INFIRMIER_COLLABORATION" && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Recensement des dispositions particulières
                  </label>
                  <textarea
                    value={recensementDispo} rows={2}
                    onChange={e => setRecensementDispo(e.target.value.slice(0, 600))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 resize-y"
                  />
                </div>
                {forfaitPartage === "CHARGE_TRAVAIL" && (
                  <ChampTexte label="Répartition des forfaits selon la charge de travail"
                    valeur={forfaitRepartition} onChange={setForfaitRepartition} max={300}
                    placeholder="Ex. : 60 % titulaire / 40 % collaborateur"
                    note="Exigée par le mode de partage choisi plus haut." />
                )}
              </>
            )}
          </Groupe>
        )}
      </div>
      )}

      {/* Mention légale */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-xs text-amber-700">
        ⚠️ <strong>Document indicatif</strong> — Document pré-rempli à titre indicatif. À faire valider par un avocat ou {ordre} avant signature.
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
            {/* ── Signature conservée (section 242) ────────────────────────────────────
                Deux chemins, jamais un seul : la signature déjà conservée est proposée en
                premier, mais reprendre une photo reste toujours accessible — une signature
                change, une photo peut être ratée. */}
            {sig?.signatureEnregistree ? (
              <>
                <button
                  onClick={handleSignEnregistree}
                  disabled={signing}
                  className="w-full py-3 bg-gray-900 text-white rounded-xl font-semibold text-sm hover:bg-black active:scale-[0.98] transition disabled:opacity-50"
                >
                  {signing ? "Envoi…" : "✍️ Signer avec ma signature enregistrée"}
                </button>
                <button
                  onClick={() => sigInputRef.current?.click()}
                  disabled={signing}
                  className="w-full py-2 text-sm font-semibold text-kine-700 hover:underline disabled:opacity-50"
                >
                  Reprendre ma signature en photo
                </button>
                <p className="text-[11px] text-gray-400 leading-snug">
                  Votre signature est conservée pour vos prochains contrats.{" "}
                  <button
                    onClick={handleOublierSignature}
                    disabled={oubliEnCours}
                    className="underline hover:text-gray-600 disabled:opacity-50"
                  >
                    {oubliEnCours ? "Retrait…" : "Ne plus la conserver"}
                  </button>
                  {" "}— les contrats déjà signés ne sont pas modifiés.
                </p>
              </>
            ) : (
              <>
                <button
                  onClick={() => sigInputRef.current?.click()}
                  disabled={signing}
                  className="w-full py-3 bg-gray-900 text-white rounded-xl font-semibold text-sm hover:bg-black active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {signing ? "Envoi…" : (sig?.mineSigned ? "✍️ Refaire ma signature" : "✍️ Signer avec ma signature")}
                </button>
                {/* La case est posée AVANT le geste, pas après : on ne demande pas après coup
                    l'autorisation de garder ce qu'on a déjà gardé. */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enregistrerSignature}
                    onChange={e => setEnregistrerSignature(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-kine-600"
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      Enregistrer cette signature pour mes prochains contrats
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Elle sera proposée automatiquement, sans nouvelle photo. Vous pourrez la
                      reprendre ou cesser de la conserver à tout moment.
                    </p>
                  </div>
                </label>
              </>
            )}
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
