"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { COMMUNES_GUADELOUPE } from "@/lib/communes";
import { bioLimitFor } from "@/lib/bio";
import Link from "next/link";

export const dynamic = "force-dynamic";

// ── Contenu adapté par rôle ──────────────────────────────────────────────────

const CONFIG = {
  TITULAIRE: {
    pageTitle:        "Publier un poste",
    pageSubtitle:     "Visible par les remplaçants et assistants disponibles en Guadeloupe",
    titleLabel:       "Intitulé du poste",
    titlePlaceholder: "Ex : Remplacement congé maternité · Cabinet sport Pointe-à-Pitre",
    descLabel:        "Présentation du cabinet et du poste",
    descPlaceholder:  "Patientèle, équipements, conditions de travail, logement possible…",
    communeLabel:     "Commune du cabinet",
    specialtiesLabel: "Spécialités pratiquées au cabinet",
    pitchTitle:       "En une phrase, ce que vous proposez",
    submitLabel:      "Publier le poste →",
  },
  TITULAIRE_EMPLOYEUR: {
    pageTitle:        "Ouvrir un poste",
    pageSubtitle:     "Visible par les professionnels de santé disponibles en Guadeloupe",
    titleLabel:       "Intitulé du poste",
    titlePlaceholder: "Ex : Vacation kiné sport · Pointe-à-Pitre – été 2025",
    descLabel:        "Description du poste et de l'établissement",
    descPlaceholder:  "Conditions de travail, rémunération, équipe, logement possible…",
    communeLabel:     "Commune de l'établissement",
    specialtiesLabel: "Spécialités requises",
    pitchTitle:       "En une phrase, ce que vous proposez",
    submitLabel:      "Ouvrir le poste →",
  },
  REMPLACANT: {
    pageTitle:        "Décrire ma disponibilité",
    pageSubtitle:     "Visible par les cabinets et titulaires recherchant un remplaçant",
    titleLabel:       "Titre de mon annonce",
    titlePlaceholder: "Ex : Disponible juillet-août · Pointe-à-Pitre et alentours",
    descLabel:        "Mon profil et mes attentes",
    descPlaceholder:  "Expérience, techniques pratiquées, type de patientèle apprécié, mobilité…",
    communeLabel:     "Commune ou zone souhaitée",
    specialtiesLabel: "Mes spécialités",
    pitchTitle:       "En une phrase, qui vous êtes",
    submitLabel:      "Publier ma disponibilité →",
  },
  ASSISTANT: {
    pageTitle:        "Rechercher un poste",
    pageSubtitle:     "Visible par les cabinets proposant des postes longue durée",
    titleLabel:       "Mon projet en quelques mots",
    titlePlaceholder: "Ex : Recherche CDI kiné sport · Guadeloupe à partir de septembre",
    descLabel:        "Mon profil et mon projet professionnel",
    descPlaceholder:  "Formation, expérience, projet de vie en Guadeloupe, type de cabinet recherché…",
    communeLabel:     "Commune ou zone souhaitée",
    specialtiesLabel: "Mes spécialités",
    pitchTitle:       "En une phrase, votre projet",
    submitLabel:      "Publier ma recherche →",
  },
} as const;

type ProfileTypeKey = keyof typeof CONFIG;
type NeedType = "remplacement" | "assistant" | "collaboration" | "";

export default function CreateMissionPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const rawProfileType = (session?.user as { profileType?: string })?.profileType ?? "TITULAIRE";
  // isEmployeur de la session est posé au login (flag legacy). On le complète par le
  // vrai titulaireKind du profil (fetch ci-dessous) pour qu'un établissement déjà
  // connecté obtienne la config salariée sans avoir à se reconnecter.
  const sessionEmployeur = (session?.user as { isEmployeur?: boolean })?.isEmployeur ?? false;
  const [kindEmployeur, setKindEmployeur] = useState(false);
  const isEmployeur = sessionEmployeur || kindEmployeur;
  const profileType = rawProfileType as ProfileTypeKey;

  // Mode « couverture » (section 153, point 4/5) : un ASSISTANT rattaché à un poste peut
  // publier un REMPLACEMENT pour couvrir SON absence — il arrive ici avec ?cabinetPostId=…
  // et utilise le formulaire de recrutement (config titulaire), au lieu d'être redirigé.
  const coverMode = rawProfileType === "ASSISTANT" && !!searchParams.get("cabinetPostId");

  // Remplaçants et assistants publient leurs disponibilités, pas des missions —
  // sauf l'assistant en mode couverture (recrutement d'un remplaçant pour son poste).
  useEffect(() => {
    if (status === "authenticated" && rawProfileType !== "TITULAIRE" && !coverMode) {
      router.replace("/disponibilites/create");
    }
  }, [status, rawProfileType, router, coverMode]);

  const cfgKey: ProfileTypeKey =
    coverMode ? "TITULAIRE"
    : profileType === "TITULAIRE" && isEmployeur ? "TITULAIRE_EMPLOYEUR"
    : profileType;
  const cfg = CONFIG[cfgKey] ?? CONFIG.REMPLACANT;

  // Type de profil pour la MISE EN FORME (champs affichés, mise en page). Le mode couverture
  // n'était appliqué qu'à cfgKey, c'est-à-dire au vocabulaire : les drapeaux ci-dessous
  // lisaient le type brut du profil, si bien qu'un ASSISTANT n'obtenait ni les dates ni la
  // description — alors que la validation les exigeait. Le formulaire était donc impossible à
  // soumettre, et « Faire remplacer mon absence » ne menait nulle part. Le sélecteur de type
  // de besoin, lui, reste réservé au titulaire : l'assistant n'a pas ce choix à faire.
  const formType: ProfileTypeKey = coverMode ? "TITULAIRE" : profileType;

  // Labels mission type selon isEmployeur
  const needTypeLabels = isEmployeur
    ? { remplacement: "Vacation", assistant: "CDD", collaboration: "CDI" }
    : { remplacement: "Remplacement", assistant: "Assistanat", collaboration: "Collaboration" };
  const needTypeSubLabels = isEmployeur
    ? { remplacement: "Courte durée", assistant: "Contrat moyen terme", collaboration: "Contrat long terme" }
    : { remplacement: "Courte durée", assistant: "Contrat long terme", collaboration: "Libéral indépendant" };

  // Pour TITULAIRE : quel type de besoin ? Pré-sélectionné depuis le Planning Board
  // (section 92) via ?needType=… selon le postType du CabinetPost cliqué.
  const initialNeedType: NeedType = (() => {
    const n = searchParams.get("needType");
    if (n === "assistant" || n === "collaboration" || n === "remplacement") return n;
    // Mode couverture : un assistant rattaché ne peut publier QU'UN remplacement (garde côté
    // API). Sans ce repli, arriver sans ?needType laissait le formulaire sans dates de fin.
    return coverMode ? "remplacement" : "";
  })();
  const [needType, setNeedType] = useState<NeedType>(initialNeedType);

  // Poste précis du planning auquel lier l'annonce (section 92 / 55) — le futur
  // match s'attribuera directement à cette ligne du Planning Board. Stateful pour
  // survivre à l'aller-retour vers /compte (photo obligatoire, item 15).
  const [cabinetPostId, setCabinetPostId] = useState<string | null>(searchParams.get("cabinetPostId"));

  // Mode édition d'une annonce existante (menu CRUD Planning Board) — ?editId=…
  const editId = searchParams.get("editId");
  const isEdit = !!editId;

  // Item 8 — photo obligatoire avant publication
  const profileId = (session?.user as { profileId?: string })?.profileId;
  const [hasPhoto, setHasPhoto] = useState<boolean | null>(null); // null = en cours de chargement
  useEffect(() => {
    if (!profileId) return;
    fetch(`/api/profiles/${profileId}`)
      .then((r) => r.json())
      .then((p) => {
        setHasPhoto(Boolean(p?.photoUrl));
        // Structure privée (EHPAD/clinique/SSR) = employeur → parcours salarié
        setKindEmployeur(p?.titulaireKind === "STRUCTURE" || Boolean(p?.isEmployeur));
      })
      .catch(() => setHasPhoto(true)); // en cas d'échec réseau, ne pas bloquer inutilement
  }, [profileId]);

  const [form, setForm] = useState({
    title: searchParams.get("title") ?? "", location: "",
    specialties: [] as string[],
    startDate: searchParams.get("startDate") ?? "",
    endDate: searchParams.get("endDate") ?? "",
    minMonths: "",
    accroche: "",           // accroche de la carte de swipe — EXTRAITE du texte libre, éditable
    dateFlexibility: 0,
    logementPropose: false,
    vehiculePropose: false,
    secretairePresente: false, // secrétariat sur place (section 190)
    exerciceCoordonne: false,  // MSP / centre de santé / ESP (section 190)
    demiJourneesLibres: "", // demi-journées libres/semaine (feature terrain) — vide = non renseigné
    caMensuelEstime: "",    // CA mensuel estimé € (feature terrain) — optionnel, vide = non renseigné
    retrocessionRate: "",   // taux de rétrocession % — (ré)introduit dans le parcours cabinet
    rawText: "",            // texte libre de l'annonce (refonte saisie texte-libre)
  });

  // ── Assistance IA (refonte saisie) — chaque action = 1 appel serveur explicite ──
  const [aiBusy, setAiBusy] = useState<null | "extract" | "title" | "redaction" | "optimize">(null);
  const [aiDegraded, setAiDegraded] = useState(false);      // plafond DeepSeek atteint → repli manuel
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [optimizeTips, setOptimizeTips] = useState<string[]>([]);
  const [detectedTags, setDetectedTags] = useState<{ repartition?: string; methode?: string }>({});
  const [extractDone, setExtractDone] = useState(false);
  // On édite une absence pour la transformer en annonce (fusion, section 188) : à
  // l'enregistrement, la période passe d'ABSENT_* à RECHERCHE.
  const [editingAbsence, setEditingAbsence] = useState(false);
  // Texte libre tel qu'il était avant la dernière reformulation — null = rien à annuler.
  const [rawTextBeforeRedaction, setRawTextBeforeRedaction] = useState<string | null>(null);
  // Repli manuel : formulaire champ-par-champ. Masqué par défaut en création (parcours texte-libre
  // d'abord), ouvert en édition (on modifie des champs précis).
  const [showManual, setShowManual] = useState(false);

  // Bouton d'envoi à DEUX ÉTATS plutôt qu'un grisé silencieux : tant qu'il manque quelque
  // chose il reste ACTIF et conduit aux champs — sur mobile il les révèle, puis fait défiler
  // jusqu'à eux. Un bouton désactivé dit « non » sans dire où aller, alors que le geste
  // attendu est justement d'ouvrir des champs masqués. (Voir le formulaire de disponibilité,
  // même traitement.)
  const blocChampsRef = useRef<HTMLDivElement | null>(null);
  const scrollDemande = useRef(false);

  // On calcule la position et on pilote la FENÊTRE, au lieu d'appeler scrollIntoView sur le
  // bloc. Mesuré en conditions réelles (fenêtre 500x457) : les champs se révélaient bien à
  // 1038 px, et scrollIntoView ne déplaçait rien — il échoue en silence dès qu'un ancêtre porte
  // un overflow ou une transformation, sans erreur ni avertissement. window.scrollTo sur un
  // offset absolu ne dépend d'aucun ancêtre.
  //
  // Deux rAF : le premier laisse React peindre le bloc révélé, le second garantit que la mise
  // en page est calculée avant qu'on lise sa position — sinon on mesure un bloc encore masqué.
  function scrollVersChamps() {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = blocChampsRef.current;
        if (!el) return;
        // DÉFILEMENT INSTANTANÉ, PAS FLUIDE. `behavior: "smooth"` est purement IGNORÉ quand
        // l'utilisateur a activé la réduction des animations — mesuré : scrollTo à 500 px rend
        // 500 en "auto" et 0 en "smooth", sur la même page. Le bouton ne faisait donc rien du
        // tout pour ces utilisateurs, en silence. Aller droit au but est de toute façon le bon
        // geste ici : on a demandé à être emmené quelque part, pas à regarder un travelling.
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 12, behavior: "auto" });
      }),
    );
  }
  function allerAuxChamps() {
    // Champs déjà ouverts : on défile tout de suite. Sans ce cas, un second appui ne faisait
    // rien — l'effet ci-dessous ne se déclenche que quand showManual CHANGE.
    if (showManual) { scrollVersChamps(); return; }
    scrollDemande.current = true;
    setShowManual(true);
  }
  useEffect(() => {
    if (!showManual || !scrollDemande.current) return;
    scrollDemande.current = false;
    scrollVersChamps();
  }, [showManual]);

  // Item 15 — préserver le formulaire lors de la redirection photo obligatoire.
  // Le brouillon est sauvegardé en localStorage avant d'aller sur /compte, puis
  // restauré (et effacé) au retour sur le formulaire.
  const DRAFT_KEY = "missionDraft";
  const [draftRestored, setDraftRestored] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d?.form) setForm((prev) => ({ ...prev, ...d.form }));
      if (d?.needType) setNeedType(d.needType);
      if (d?.cabinetPostId) setCabinetPostId(d.cabinetPostId);
      setDraftRestored(true);
      localStorage.removeItem(DRAFT_KEY);
    } catch { /* brouillon illisible : ignoré */ }
  }, []);

  function goAddPhoto() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, needType, cabinetPostId }));
    } catch { /* quota indisponible : on redirige quand même */ }
    router.push("/compte?returnTo=/missions/create");
  }

  // Préremplissage en mode édition (section CRUD annonce)
  useEffect(() => {
    if (!editId) return;
    fetch(`/api/missions/${editId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        if (!m) return;
        const nt: NeedType =
          m.missionType === "ASSISTANAT" ? "assistant" :
          m.missionType === "COLLABORATION" ? "collaboration" : "remplacement";
        setNeedType(nt);
        if (m.cabinetPostId) setCabinetPostId(m.cabinetPostId);
        setForm((prev) => ({
          ...prev,
          title: m.title ?? "",
          location: m.location ?? "",
          specialties: m.specialties ?? [],
          startDate: m.startDate ? String(m.startDate).slice(0, 10) : "",
          endDate: m.endDate ? String(m.endDate).slice(0, 10) : "",
          minMonths: m.minMonths ? String(m.minMonths) : "",
          // L'accroche vit désormais sur bioTinder (carte de swipe + score) ; pitch reste
          // alimenté en parallèle et sert de repli pour les annonces antérieures.
          accroche: (m.bioTinder ?? m.pitch ?? "") as string,
          dateFlexibility: m.dateFlexibility ?? 0,
          logementPropose: m.logementPropose ?? false,
          vehiculePropose: m.vehiculePropose ?? false,
          secretairePresente: m.secretairePresente ?? false,
          exerciceCoordonne: m.exerciceCoordonne ?? false,
          demiJourneesLibres: m.demiJourneesLibres != null ? String(m.demiJourneesLibres) : "",
          caMensuelEstime: m.caMensuelEstime != null ? String(m.caMensuelEstime) : "",
          retrocessionRate: m.retrocessionRate != null ? String(m.retrocessionRate) : "",
          rawText: m.rawText ?? "",
          // Le titre d'une absence (« Congés ») n'est pas un titre d'annonce : on repart
          // d'un champ vide plutôt que de laisser publier « Congés » comme intitulé.
          ...(typeof m.briqueStatus === "string" && m.briqueStatus.startsWith("ABSENT") ? { title: "" } : {}),
        }));
        // Fusion (section 188) : on édite une ABSENCE pour la transformer en annonce. La
        // période devient RECHERCHE à l'enregistrement — pas de seconde brique créée.
        if (typeof m.briqueStatus === "string" && m.briqueStatus.startsWith("ABSENT")) {
          setEditingAbsence(true);
        }
        setShowManual(true); // édition = accès direct aux champs
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // Validation 90 jours pour ASSISTANAT/CDD (front-end)
  const missionDays = form.startDate && form.endDate
    ? Math.floor((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / 86400000)
    : null;
  const needs90Days = needType === "assistant";
  const under90Days = needs90Days && missionDays !== null && missionDays < 90;

  // Limite d'accroche différenciée (section 123) : cabinet 700, remplaçant 280.
  const bioLimit = bioLimitFor(profileType);

  // Accroche : min 40 caractères (section 71 / 88). Elle n'est plus saisie de zéro — elle est
  // proposée par l'analyse du texte libre, puis éditable ici.
  const accrocheTrim = form.accroche.trim();
  const accrocheValid = accrocheTrim.length >= 40;
  const [accrocheFocused, setAccrocheFocused] = useState(false);
  // Révèle le champ accroche sans passer par l'IA (budget épuisé, analyse indisponible, ou
  // simple préférence). Tant qu'il est faux et l'accroche vide, aucune seconde zone d'écriture.
  const [showAccrocheManual, setShowAccrocheManual] = useState(false);
  const accrocheRemaining = Math.max(0, 40 - accrocheTrim.length);

  // Contenu valide = texte libre suffisant (≥40) OU accroche valide. Sans accroche saisie ni
  // extraite (IA indisponible), le texte libre en tient lieu — la publication n'est jamais bloquée.
  const rawTextTrim = form.rawText.trim();
  const contentValid = rawTextTrim.length >= 40 || accrocheValid;

  // Hard-gate publication (parcours texte-libre) : type + contenu + commune + dates (remplacement).
  // Ces champs restent STRUCTURÉS et confirmés ; l'IA ne fait que pré-remplir. Taux/CA non bloquants.
  const missingRequired: string[] = [];
  if (profileType === "TITULAIRE" && !needType) missingRequired.push("le type de poste");
  if (!form.title.trim())                        missingRequired.push("un titre");
  if (!form.location)                            missingRequired.push("la commune");
  if (!contentValid)                             missingRequired.push("une description (≥ 40 caractères)");
  if (needType === "remplacement" && (!form.startDate || !form.endDate)) missingRequired.push("les dates de début et de fin");
  // Annonce rattachée à un poste du Planning : sans date de début, la brique ne se place sur
  // aucune ligne. On le dit AVANT publication plutôt que de laisser partir une annonce fantôme.
  if (cabinetPostId && needType !== "remplacement" && !form.startDate) missingRequired.push("la date de prise de poste");

  // Publication possible : les prérequis nommés, plus les deux gardes qui vivaient jusqu'ici
  // uniquement dans l'attribut `disabled` du bouton — durée minimale et photo de profil.
  const pretAPublier =
    missingRequired.length === 0 && !under90Days && (isEdit || hasPhoto !== false);

  // La date de DÉBUT est toujours nécessaire : c'est elle qui positionne la brique sur la
  // timeline du Planning (MissionBrick renvoie null sans startDate). Elle était masquée pour
  // assistanat/collaboration — l'annonce partait alors sans date, était publiée sans erreur,
  // et n'apparaissait jamais sur la ligne du poste (constaté sur 3 annonces en base).
  const showStartDate = formType === "REMPLACANT" || formType === "TITULAIRE";
  // La date de FIN n'a de sens qu'en remplacement : assistanat/collaboration sont bornés par
  // la durée minimale (minMonths), et un endDate court ferait échouer la validation 90 jours.
  const showEndDate =
    formType === "REMPLACANT" ||
    (formType === "TITULAIRE" && needType === "remplacement");

  const showMinMonths =
    (formType === "ASSISTANT") ||
    (formType === "TITULAIRE" && (needType === "assistant" || needType === "collaboration"));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Accroche de matching : l'accroche (extraite du texte puis validée/corrigée) prime ;
    // à défaut — IA indisponible et champ laissé vide — repli sur le texte libre tronqué au
    // cap de la colonne (700). Écrite sur pitch ET bioTinder : la carte de swipe et le score
    // DeepSeek lisent bioTinder, la fiche annonce publique lit pitch.
    const pitchFull = accrocheTrim
      ? accrocheTrim.slice(0, bioLimit)
      : rawTextTrim
      ? rawTextTrim.slice(0, bioLimit)
      : null;

    const missionTypeMap: Record<string, string> = {
      remplacement: "REMPLACEMENT",
      assistant:    "ASSISTANAT",
      collaboration: "COLLABORATION",
    };

    const payload = {
      title: form.title,
      location: form.location,
      specialties: form.specialties,
      startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
      endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
      minMonths: form.minMonths ? parseInt(form.minMonths) : null,
      pitch: pitchFull,
      bioTinder: pitchFull,
      missionType: missionTypeMap[needType] ?? "REMPLACEMENT",
      dateFlexibility: form.dateFlexibility,
      logementPropose: form.logementPropose,
      vehiculePropose: form.vehiculePropose,
      secretairePresente: form.secretairePresente,
      exerciceCoordonne: form.exerciceCoordonne,
      demiJourneesLibres: form.demiJourneesLibres ? parseInt(form.demiJourneesLibres, 10) : null,
      caMensuelEstime: form.caMensuelEstime ? parseInt(form.caMensuelEstime, 10) : null,
      retrocessionRate: form.retrocessionRate ? parseInt(form.retrocessionRate, 10) : null,
      rawText: rawTextTrim || null,
      // Transformation d'une absence en annonce : la période cesse d'être « absent sans
      // rien de prévu » et devient une recherche — c'est ce qui éteint l'alerte.
      ...(editingAbsence ? { briqueStatus: "RECHERCHE" } : {}),
      ...(isEdit ? {} : { cabinetPostId: cabinetPostId ?? undefined }),
    };

    const res = await fetch(isEdit ? `/api/missions/${editId}` : "/api/missions", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      // .catch : une réponse d'erreur non-JSON (ex. 500 brut) ne doit pas crasher le handler
      // ('Unexpected end of JSON input', section 186) — on retombe sur le message générique.
      const data = await res.json().catch(() => ({} as { needsPhoto?: boolean; error?: unknown }));
      if (data?.needsPhoto) setHasPhoto(false);
      setError(
        data?.needsPhoto
          ? "Ajoutez une photo de profil avant de publier."
          : (data.error?.fieldErrors?.title?.[0] ?? (typeof data.error === "string" ? data.error : (isEdit ? "Erreur lors de l'enregistrement" : "Erreur lors de la création")))
      );
      setLoading(false);
      return;
    }
    // Édition : retour au planning (resync timeline). Création : feed + confirmation explicite
    // (section 163) — on transmet l'id + le titre de l'annonce publiée pour la bannière de succès.
    if (isEdit) {
      router.push("/planning");
      return;
    }
    const created = await res.json().catch(() => null);
    const publishedId = created?.id ? String(created.id) : "";
    router.push(`/annonces?published=1&pid=${encodeURIComponent(publishedId)}&pt=${encodeURIComponent(form.title)}`);
  }

  // ── Assistance IA ────────────────────────────────────────────────────────────────
  const NEED_FROM_TYPE: Record<string, NeedType> = {
    REMPLACEMENT: "remplacement", ASSISTANAT: "assistant", COLLABORATION: "collaboration",
  };

  // Applique l'extraction : ne REMPLIT que les champs réellement extraits (jamais d'écrasement
  // par une valeur vide — l'IA n'invente rien, on ne détruit rien non plus).
  function applyExtracted(f: Record<string, unknown>) {
    if (typeof f.missionType === "string" && NEED_FROM_TYPE[f.missionType]) setNeedType(NEED_FROM_TYPE[f.missionType]);
    setForm((prev) => ({
      ...prev,
      // Accroche proposée (condensation du texte) — l'utilisateur la corrige, il ne l'écrit plus.
      ...(typeof f.accroche === "string" && f.accroche.trim() ? { accroche: f.accroche } : {}),
      ...(typeof f.startDate === "string" ? { startDate: f.startDate } : {}),
      ...(typeof f.endDate === "string" ? { endDate: f.endDate } : {}),
      ...(typeof f.minMonths === "number" ? { minMonths: String(f.minMonths) } : {}),
      ...(typeof f.commune === "string" ? { location: f.commune } : {}),
      ...(typeof f.retrocessionRate === "number" ? { retrocessionRate: String(f.retrocessionRate) } : {}),
      ...(typeof f.caMensuelEstime === "number" ? { caMensuelEstime: String(f.caMensuelEstime) } : {}),
      ...(typeof f.demiJourneesLibres === "number" ? { demiJourneesLibres: String(f.demiJourneesLibres) } : {}),
      ...(f.logementPropose === true ? { logementPropose: true } : {}),
      ...(f.vehiculePropose === true ? { vehiculePropose: true } : {}),
      ...(f.secretairePresente === true ? { secretairePresente: true } : {}),
      ...(f.exerciceCoordonne === true ? { exerciceCoordonne: true } : {}),
    }));
    setDetectedTags({
      repartition: typeof f.repartition === "string" ? f.repartition : undefined,
      methode: typeof f.methode === "string" ? f.methode : undefined,
    });
  }

  // Informations déjà renseignées — transmises à « Qu'est-ce qui manque ? » pour qu'il ne
  // suggère pas d'ajouter ce qui figure déjà dans le formulaire.
  function knownFields(): string[] {
    const k: string[] = [];
    if (form.location) k.push(`commune : ${form.location}`);
    if (form.startDate) k.push(`date de début : ${form.startDate}`);
    if (form.endDate) k.push(`date de fin : ${form.endDate}`);
    if (form.minMonths) k.push(`durée minimale : ${form.minMonths} mois`);
    if (form.retrocessionRate) k.push(`taux de rétrocession : ${form.retrocessionRate}%`);
    if (form.caMensuelEstime) k.push(`chiffre d'affaires estimé : ${form.caMensuelEstime} €/mois`);
    if (form.demiJourneesLibres) k.push(`demi-journées libres : ${form.demiJourneesLibres}/semaine`);
    if (form.logementPropose) k.push("logement proposé");
    if (form.vehiculePropose) k.push("véhicule mis à disposition");
    if (form.secretairePresente) k.push("secrétariat sur place");
    if (form.exerciceCoordonne) k.push("exercice coordonné (MSP / centre de santé)");
    if (detectedTags.repartition) k.push(`répartition : ${detectedTags.repartition}`);
    if (detectedTags.methode) k.push(`méthodes : ${detectedTags.methode}`);
    return k;
  }

  async function runAI(action: "extract" | "title" | "redaction" | "optimize") {
    if (aiBusy) return;
    setAiBusy(action); setAiDegraded(false); setAiNotice(null);
    try {
      const res = await fetch("/api/ai/annonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action, role: "cabinet", text: form.rawText,
          ...(action === "optimize" ? { known: knownFields() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.degraded) { setAiDegraded(true); return; }
      if (action === "extract") {
        applyExtracted(data.fields ?? {});
        setExtractDone(true);
        setShowManual(true); // on ouvre les champs pour vérification/complétion
        const n = Object.keys(data.fields ?? {}).length;
        setAiNotice(n > 0 ? `${n} information${n > 1 ? "s" : ""} détectée${n > 1 ? "s" : ""} — vérifiez ci-dessous.` : "Aucune information exploitable détectée — complétez à la main.");
      } else if (action === "title") {
        if (typeof data.title === "string" && data.title) setForm((p) => ({ ...p, title: data.title }));
      } else if (action === "redaction") {
        if (typeof data.text === "string" && data.text) {
          // Mémorise le texte AVANT écrasement pour rendre la reformulation annulable.
          setRawTextBeforeRedaction(form.rawText);
          setForm((p) => ({ ...p, rawText: data.text }));
        }
      } else if (action === "optimize") {
        setOptimizeTips(Array.isArray(data.suggestions) ? data.suggestions : []);
        if ((data.suggestions ?? []).length === 0) setAiNotice("Rien à ajouter — votre annonce est déjà complète 👍");
      }
    } catch {
      setAiDegraded(true);
    } finally {
      setAiBusy(null);
    }
  }

  // Champ titre — défini une fois, rendu à un seul endroit selon la mise en page :
  // sous le texte libre (colonne gauche, cabinet), ou en tête des champs si cette colonne
  // n'existe pas (assistant en mode couverture). Jamais les deux.
  const titleField = (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{cfg.titleLabel}</label>
      <input
        type="text"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        maxLength={100}
        required
        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 text-sm"
        placeholder={cfg.titlePlaceholder}
      />
    </div>
  );

  return (
    <div className={`${formType === "TITULAIRE" ? "max-w-lg lg:max-w-5xl" : "max-w-lg"} mx-auto px-4 py-8 animate-fade-up`}>
      {/* En-tête */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          {profileType === "TITULAIRE" && <span className="text-xl">🏥</span>}
          {profileType === "REMPLACANT" && <span className="text-xl">🩺</span>}
          {profileType === "ASSISTANT" && <span className="text-xl">👩‍⚕️</span>}
          <h1 className="text-2xl font-bold text-gray-800">{isEdit ? "Modifier l'annonce" : cfg.pageTitle}</h1>
        </div>
        <p className="text-gray-400 text-sm">{isEdit ? "Édition complète — dates, texte, tout champ de l'annonce" : cfg.pageSubtitle}</p>
      </div>

      {/* Bandeau de retour après ajout de photo (item 15) */}
      {draftRestored && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800">
          ✓ Votre annonce a été restaurée. {hasPhoto ? "Vous pouvez maintenant la publier." : "Reprenez où vous en étiez."}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">

        {/* ── Grille 2 colonnes sur desktop (section 2) : à gauche le texte libre + l'assistance,
            à droite l'extraction + les champs structurés éditables. Empilé sur mobile. ── */}
        <div className={formType === "TITULAIRE" ? "lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start space-y-5 lg:space-y-0" : ""}>

        {/* ── Colonne GAUCHE : texte libre + assistance IA (cabinet, et assistant en couverture) ── */}
        {formType === "TITULAIRE" && (
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-kine-700">
              Décrivez votre besoin en toute liberté{" "}
              <span className="text-kine-400 font-normal">— dates, commune, taux, logement, ambiance…</span>
            </label>
            <textarea
              value={form.rawText}
              onChange={(e) => setForm({ ...form, rawText: e.target.value })}
              rows={6}
              maxLength={8000}
              className="w-full px-4 py-3 border border-kine-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 resize-y text-sm bg-white text-gray-800"
              placeholder={"Ex : Cabinet à Sainte-Anne cherche remplaçant à partir du 1er septembre pour 3 semaines. Rétro 25%, CA ~8000€/mois. Logement et voiture à disposition. Ambiance familiale, 3 demi-journées libres par semaine, patientèle variée."}
            />
            {/* Boutons d'assistance — chacun = 1 appel IA explicite (jamais à la frappe).
                Libellés décrivant le RÉSULTAT, pas l'action : « Analyser » et « Optimiser »
                sonnaient pareil et rien n'indiquait lequel modifiait quoi. La ligne d'aide
                sous chacun dit ce qui change : les champs, le texte, ou rien. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button type="button" onClick={() => runAI("extract")} disabled={aiBusy !== null || form.rawText.trim().length < 10}
                className="flex flex-col items-start text-left gap-0.5 px-3 py-2 rounded-xl bg-kine-600 text-white hover:bg-kine-700 transition disabled:opacity-40">
                <span className="text-xs font-bold">{aiBusy === "extract" ? "Analyse…" : "✨ Remplir les champs"}</span>
                <span className="text-[10px] font-normal opacity-80 leading-snug">dates, commune, taux, accroche… extraits de votre texte</span>
              </button>
              <button type="button" onClick={() => runAI("redaction")} disabled={aiBusy !== null}
                className="flex flex-col items-start text-left gap-0.5 px-3 py-2 rounded-xl border border-kine-300 text-kine-700 hover:bg-kine-50 transition disabled:opacity-40">
                <span className="text-xs font-bold">{aiBusy === "redaction" ? "Rédaction…" : "✍️ Reformuler mon texte"}</span>
                <span className="text-[10px] font-normal opacity-70 leading-snug">réécrit ci-dessus, vous pourrez annuler</span>
              </button>
              <button type="button" onClick={() => runAI("optimize")} disabled={aiBusy !== null || form.rawText.trim().length < 10}
                className="flex flex-col items-start text-left gap-0.5 px-3 py-2 rounded-xl border border-kine-300 text-kine-700 hover:bg-kine-50 transition disabled:opacity-40">
                <span className="text-xs font-bold">{aiBusy === "optimize" ? "Analyse…" : "🚀 Qu'est-ce qui manque ?"}</span>
                <span className="text-[10px] font-normal opacity-70 leading-snug">suggestions d&apos;ajouts, rien n&apos;est modifié</span>
              </button>
              {/* Regroupé ici avec les autres assistances : il était isolé dans l'encart
                  « ce que j'ai compris » et n'apparaissait qu'après extraction. */}
              <button type="button" onClick={() => runAI("title")} disabled={aiBusy !== null || form.rawText.trim().length < 10}
                className="flex flex-col items-start text-left gap-0.5 px-3 py-2 rounded-xl border border-kine-300 text-kine-700 hover:bg-kine-50 transition disabled:opacity-40">
                <span className="text-xs font-bold">{aiBusy === "title" ? "Titre…" : "✨ Proposer un titre"}</span>
                <span className="text-[10px] font-normal opacity-70 leading-snug">remplit l&apos;intitulé du poste ci-dessous</span>
              </button>
            </div>

            {/* Annulation de la reformulation — seul geste destructif du formulaire : la
                réécriture remplace le texte de l'utilisateur sans confirmation. On garde
                l'ancien en mémoire, un clic le restaure. */}
            {rawTextBeforeRedaction !== null && (
              <div className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <span className="text-amber-800">Votre texte a été reformulé.</span>
                <button
                  type="button"
                  onClick={() => {
                    setForm((p) => ({ ...p, rawText: rawTextBeforeRedaction }));
                    setRawTextBeforeRedaction(null);
                  }}
                  className="ml-auto shrink-0 font-bold text-amber-900 underline hover:text-amber-950"
                >
                  Annuler la reformulation
                </button>
              </div>
            )}

            {aiDegraded && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                Assistance IA momentanément indisponible (limite atteinte). Aucun souci : remplissez les champs à la main ci-dessous, la publication reste possible.
              </p>
            )}
            {aiNotice && !aiDegraded && (
              <p className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">{aiNotice}</p>
            )}
            {optimizeTips.length > 0 && (
              <div className="rounded-xl bg-kine-50 border border-kine-100 px-3 py-2.5">
                <p className="text-[11px] font-bold text-kine-700 uppercase tracking-wide mb-1">Suggestions d&apos;ajout</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {optimizeTips.map((t, i) => <li key={i} className="text-xs text-gray-700">{t}</li>)}
                </ul>
              </div>
            )}

            {/* Repli manuel (mobile) : révèle les champs détaillés en dessous. Sur desktop les
                champs sont toujours affichés dans la colonne de droite → toggle masqué (lg:hidden). */}
            <button type="button" onClick={() => setShowManual((s) => !s)}
              className="lg:hidden text-xs font-semibold text-gray-500 hover:text-gray-700 underline">
              {showManual ? "Masquer les champs détaillés" : "Vérifier / compléter les champs à la main"}
            </button>

            {/* Titre — juste APRÈS le texte libre, et hors du repli. Après, pour ne pas
                accueillir l'utilisateur par un champ manuel : la refonte veut qu'il écrive
                d'abord. Hors du repli, car le titre est OBLIGATOIRE et bloque la publication. */}
            {titleField}
          </div>
        )}

        {/* ── Colonne DROITE (desktop) / repli (mobile) : « ce que j'ai compris » + champs
            structurés éditables. Toujours visible sur desktop (lg:block) ; sur mobile, révélée
            après extraction (showManual passe à true) ou via le toggle. ── */}
        <div ref={blocChampsRef} className={formType !== "TITULAIRE" ? "space-y-5" : `space-y-5 ${showManual ? "" : "hidden lg:block"}`}>

        {/* Sans colonne gauche (remplaçant/assistant hors couverture), le titre n'a pas été
            rendu au-dessus — on le place ici. En mode couverture la colonne gauche EXISTE :
            tester le type brut y affichait le champ une seconde fois. */}
        {formType !== "TITULAIRE" && titleField}

        {/* Résumé compact « ce que j'ai compris » + champs manquants requis (en tête de colonne) */}
        {formType === "TITULAIRE" && extractDone && (
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 space-y-2">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Ce que j&apos;ai compris</p>
            <div className="flex flex-wrap gap-1.5">
              {needType && <span className="px-2 py-0.5 rounded-full bg-kine-100 text-kine-700 text-[11px] font-semibold">{needTypeLabels[needType as keyof typeof needTypeLabels] ?? needType}</span>}
              {form.location && <span className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 text-[11px] font-semibold">📍 {form.location}</span>}
              {form.startDate && <span className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 text-[11px] font-semibold">📅 {form.startDate}{form.endDate ? ` → ${form.endDate}` : ""}</span>}
              {form.minMonths && <span className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 text-[11px] font-semibold">≥ {form.minMonths} mois</span>}
              {form.retrocessionRate && <span className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 text-[11px] font-semibold">Rétro {form.retrocessionRate}%</span>}
              {form.caMensuelEstime && <span className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 text-[11px] font-semibold">💶 {form.caMensuelEstime}€/mois</span>}
              {form.demiJourneesLibres && <span className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 text-[11px] font-semibold">🗓️ {form.demiJourneesLibres} dj/sem.</span>}
              {form.logementPropose && <span className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 text-[11px] font-semibold">🏠 Logement</span>}
              {form.vehiculePropose && <span className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 text-[11px] font-semibold">🚗 Véhicule</span>}
              {form.secretairePresente && <span className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 text-[11px] font-semibold">🗂️ Secrétariat</span>}
              {form.exerciceCoordonne && <span className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 text-[11px] font-semibold">🤝 Exercice coordonné</span>}
              {detectedTags.repartition && <span className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 text-[11px] font-semibold">{detectedTags.repartition}</span>}
              {detectedTags.methode && <span className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 text-[11px] font-semibold">{detectedTags.methode}</span>}
            </div>
            {missingRequired.length > 0 && (
              <p className="text-[11px] text-amber-700">À compléter : <strong>{missingRequired.join(", ")}</strong></p>
            )}
          </div>
        )}

        {/* ── Sélecteur de besoin (TITULAIRE uniquement) ── */}
        {profileType === "TITULAIRE" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type de besoin
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "remplacement"  as NeedType, icon: "📅", label: needTypeLabels.remplacement,  sub: needTypeSubLabels.remplacement },
                { value: "assistant"     as NeedType, icon: "📋", label: needTypeLabels.assistant,     sub: needTypeSubLabels.assistant },
                { value: "collaboration" as NeedType, icon: "🤝", label: needTypeLabels.collaboration,  sub: needTypeSubLabels.collaboration },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setNeedType(needType === opt.value ? "" : opt.value)}
                  className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border-2 text-center transition text-xs ${
                    needType === opt.value
                      ? "border-kine-500 bg-kine-50 text-kine-700"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <span className="text-xl">{opt.icon}</span>
                  <span className="font-semibold text-gray-800">{opt.label}</span>
                  <span className="text-gray-400">{opt.sub}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Accroche : champ EXTRAIT du texte libre (fusion des deux zones de saisie) ──
             Le textarea n'apparaît QUE s'il a du contenu (extraction faite) ou si l'utilisateur
             demande explicitement à l'écrire. Un textarea vide affiché en permanence redonnait
             exactement la friction que cette refonte supprime : deux zones d'écriture côte à côte.
             Repli : le lien ci-dessous reste toujours accessible, et à défaut d'accroche c'est le
             texte libre tronqué qui alimente la carte — la publication n'est jamais bloquée. */}
        {!form.accroche && !showAccrocheManual ? (
          <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
            <span className="font-semibold text-gray-600">Accroche de la carte</span> — tirée de
            votre texte par «&nbsp;✨ Analyser le texte&nbsp;».{" "}
            <button
              type="button"
              onClick={() => setShowAccrocheManual(true)}
              className="underline font-semibold text-kine-700 hover:text-kine-800"
            >
              L&apos;écrire à la main
            </button>
          </p>
        ) : (
        <div className="bg-kine-50 rounded-2xl p-4 space-y-2 border border-kine-100">
          <label className="block text-sm font-semibold text-kine-700">
            {cfg.pitchTitle}
            <span className="text-kine-400 font-normal ml-1">({bioLimit} signes)</span>
          </label>
          <p className="text-xs text-kine-600/70">
            {form.accroche
              ? "Proposée à partir de votre texte — modifiez-la librement. C'est elle qui s'affiche sur votre carte et alimente le matching."
              : "C'est elle qui s'affiche sur votre carte et alimente le matching."}
          </p>
          <textarea
            value={form.accroche}
            onChange={(e) => {
              if (e.target.value.length <= bioLimit) setForm({ ...form, accroche: e.target.value });
            }}
            onFocus={() => setAccrocheFocused(true)}
            onBlur={() => setAccrocheFocused(false)}
            rows={3}
            className="w-full py-2.5 px-3 border border-kine-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 resize-y text-sm bg-white text-gray-800 not-italic break-words whitespace-pre-wrap placeholder:text-gray-400 placeholder:italic"
            placeholder="Ex : Cabinet familial à Sainte-Anne, patientèle variée, logement et véhicule à disposition."
          />
          <div className="flex justify-end items-center min-h-[16px]">
            {!accrocheValid ? (
              (accrocheFocused || accrocheTrim.length > 0) && (
                <span className="text-xs text-amber-600 mr-auto">
                  40 caractères minimum ({accrocheRemaining} restant{accrocheRemaining > 1 ? "s" : ""}) — sinon votre texte libre sera utilisé
                </span>
              )
            ) : (
              <span className="text-xs text-gray-300">{form.accroche.length}/{bioLimit}</span>
            )}
          </div>
        </div>
        )}

        {/* ── Commune ── */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {cfg.communeLabel}
          </label>
          <select
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            required
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 text-sm"
          >
            <option value="">Sélectionner une commune…</option>
            {COMMUNES_GUADELOUPE.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Zones géographiques retirées côté cabinet (section 144) — un cabinet a une
            commune fixe ; la flexibilité géo n'existe que côté candidat (disponibilité). */}

        {/* ── Spécialités retirées (section 69) — le matching est géré par
             DeepSeek à partir du texte de l'accroche, plus de cases à cocher. ── */}

        {/* ── Avertissement durée minimale 3 mois ── */}
        {under90Days && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
            ⚠️ Les postes d&apos;{isEmployeur ? "CDD/CDI" : "assistanat"} nécessitent une durée minimale de <strong>3 mois (90 jours)</strong>.
          </div>
        )}

        {/* ── Dates — le DÉBUT est demandé pour tous les types (il place la brique sur la
             timeline) ; la FIN uniquement en remplacement. ── */}
        {showStartDate && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {formType !== "TITULAIRE"
                ? "Mes dates de disponibilité"
                : showEndDate
                ? "Période de remplacement"
                : "Date de prise de poste"}
            </label>
            <div className={showEndDate ? "grid grid-cols-2 gap-3" : ""}>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{showEndDate ? "Du" : "À partir du"}</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 text-sm"
                />
              </div>
              {showEndDate && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Au</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    min={form.startDate}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 text-sm"
                  />
                </div>
              )}
            </div>
            {!showEndDate && (
              <p className="text-xs text-gray-400 mt-1">
                Sans cette date, l&apos;annonce n&apos;apparaîtra pas sur la ligne du poste dans votre planning.
              </p>
            )}
          </div>
        )}

        {/* ── Flexibilité dates — porte sur une période, donc remplacement uniquement ── */}
        {showEndDate && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Flexibilité sur les dates
            </label>
            <div className="grid grid-cols-5 gap-1">
              {[
                { value: 0, label: "Exact" },
                { value: 1, label: "±3j" },
                { value: 2, label: "±1sem" },
                { value: 3, label: "±2sem" },
                { value: 4, label: "±1mois" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm({ ...form, dateFlexibility: opt.value })}
                  className={`py-2 rounded-xl text-xs font-semibold border-2 transition ${
                    form.dateFlexibility === opt.value
                      ? "border-kine-500 bg-kine-50 text-kine-700"
                      : "border-gray-200 text-gray-400 hover:border-gray-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Durée minimale (ASSISTANT ou TITULAIRE-assistant) ── */}
        {showMinMonths && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {formType === "TITULAIRE" ? "Durée minimale du contrat proposé" : "Durée minimale souhaitée"}
            </label>
            <select
              value={form.minMonths}
              onChange={(e) => setForm({ ...form, minMonths: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 text-sm"
            >
              <option value="">Non définie</option>
              <option value="3">3 mois minimum</option>
              <option value="6">6 mois minimum</option>
              <option value="12">12 mois (1 an)</option>
              <option value="18">18 mois</option>
              <option value="24">24 mois (2 ans)</option>
            </select>
          </div>
        )}

        {/* ── Logement proposé (section 120) — alimente le bonus logement du score ── */}
        <label className="flex items-center gap-3 cursor-pointer select-none rounded-xl border border-gray-200 px-4 py-3 hover:border-kine-300 transition">
          <input
            type="checkbox"
            checked={form.logementPropose}
            onChange={(e) => setForm({ ...form, logementPropose: e.target.checked })}
            className="w-4 h-4 rounded accent-kine-600"
          />
          <span className="text-sm text-gray-700">🏠 Logement proposé avec le poste</span>
        </label>

        {/* ── Véhicule proposé (feature terrain) — symétrique du logement, alimente le bonus
             véhicule du score. Souvent annoncé collé au logement dans les annonces réelles. ── */}
        <label className="flex items-center gap-3 cursor-pointer select-none rounded-xl border border-gray-200 px-4 py-3 hover:border-kine-300 transition">
          <input
            type="checkbox"
            checked={form.vehiculePropose}
            onChange={(e) => setForm({ ...form, vehiculePropose: e.target.checked })}
            className="w-4 h-4 rounded accent-kine-600"
          />
          <span className="text-sm text-gray-700">🚗 Véhicule mis à disposition</span>
        </label>

        {/* ── Secrétariat sur place (section 190) — alimente le bonus secrétariat du score.
             Argument récurrent des annonces réelles : moins de charge administrative. ── */}
        <label className="flex items-center gap-3 cursor-pointer select-none rounded-xl border border-gray-200 px-4 py-3 hover:border-kine-300 transition">
          <input
            type="checkbox"
            checked={form.secretairePresente}
            onChange={(e) => setForm({ ...form, secretairePresente: e.target.checked })}
            className="w-4 h-4 rounded accent-kine-600"
          />
          <span className="text-sm text-gray-700">🗂️ Secrétariat sur place</span>
        </label>

        {/* ── Exercice coordonné (section 190) — le libellé NOMME L'AVANTAGE avant le dispositif :
             « MSP » ne dit rien à qui n'y a jamais exercé, l'accès direct sans prescription
             (Avenant 7, jusqu'à 8 séances) dit exactement ce qu'on y gagne. C'est aussi ce qui
             justifie que ce critère pèse plus lourd que les trois autres au barème. ── */}
        <label className="flex items-start gap-3 cursor-pointer select-none rounded-xl border border-gray-200 px-4 py-3 hover:border-kine-300 transition">
          <input
            type="checkbox"
            checked={form.exerciceCoordonne}
            onChange={(e) => setForm({ ...form, exerciceCoordonne: e.target.checked })}
            className="w-4 h-4 rounded accent-kine-600 mt-0.5"
          />
          <span className="text-sm text-gray-700">
            🤝 Exercice coordonné (MSP, centre de santé, ESP)
            <span className="block text-xs text-gray-500 mt-0.5">
              Ouvre l&apos;accès direct sans prescription médicale préalable, jusqu&apos;à 8 séances.
            </span>
          </span>
        </label>

        {/* ── Demi-journées libres + CA estimé (feature terrain) — informations affichées sur
             la fiche annonce (hors score). Critères de qualité de vie annoncés spontanément. ── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Demi-journées libres <span className="text-gray-400 font-normal">/ sem. (opt.)</span>
            </label>
            <input
              type="number"
              min={0}
              max={10}
              step={1}
              value={form.demiJourneesLibres}
              onChange={(e) => setForm({ ...form, demiJourneesLibres: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 text-sm"
              placeholder="Ex : 3"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CA mensuel estimé <span className="text-gray-400 font-normal">€ (opt.)</span>
            </label>
            <input
              type="number"
              min={0}
              step={100}
              value={form.caMensuelEstime}
              onChange={(e) => setForm({ ...form, caMensuelEstime: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 text-sm"
              placeholder="Ex : 8000"
            />
          </div>
        </div>

        {/* ── Taux de rétrocession / redevance (structuré — atterrit dans le contrat) ──
             Le SENS de ce pourcentage s'inverse selon le type de poste, exactement comme sur
             la page contrat (match/[id]/contrat) :
               • remplacement           → part que le REMPLAÇANT conserve (contrat : « le
                 remplaçant percevra X% des honoraires »), usuellement 50-90
               • assistanat/collaboration → part que l'assistant REVERSE au cabinet, usuellement 10-60
             Le libellé figé « Taux de rétrocession » avec le placeholder « Ex : 25 » invitait à
             saisir la part du cabinet : un remplacement à 75/25 se retrouvait contractualisé à
             25% pour le remplaçant. */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {needType === "remplacement"
              ? "Taux de rétrocession pour le remplaçant"
              : "Redevance versée au cabinet"}{" "}
            <span className="text-gray-400 font-normal">% (opt.)</span>
          </label>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={form.retrocessionRate}
            onChange={(e) => setForm({ ...form, retrocessionRate: e.target.value })}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 text-sm"
            placeholder={needType === "remplacement" ? "Ex : 75" : "Ex : 25"}
          />
          <p className="text-xs text-gray-400 mt-1">
            {needType === "remplacement"
              ? "Part des honoraires que le remplaçant conserve — c'est ce chiffre qui figurera au contrat. Un « 75/25 » se saisit 75."
              : "Part des honoraires que l'assistant reverse au cabinet — c'est ce chiffre qui figurera au contrat."}
          </p>
        </div>

        </div>
        {/* ── fin colonne droite ── */}

        </div>
        {/* ── fin grille 2 colonnes ── */}

        {/* ── Photo obligatoire (item 8) — non requise en édition ── */}
        {!isEdit && hasPhoto === false && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-center justify-between gap-3">
            <span>📷 Ajoutez une photo avant de publier une annonce</span>
            <button
              type="button"
              onClick={goAddPhoto}
              className="shrink-0 font-semibold text-amber-900 underline hover:text-amber-950"
            >
              Ajouter →
            </button>
          </div>
        )}

        {error && (
          <p className="text-red-500 text-sm bg-red-50 px-4 py-2.5 rounded-xl border border-red-100">{error}</p>
        )}

        {/* Prérequis manquants (garde-gate) — explicite pourquoi la publication est bloquée */}
        {!loading && missingRequired.length > 0 && (
          <p className="text-xs text-gray-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
            Pour publier, il reste à renseigner : <strong>{missingRequired.join(", ")}</strong>.
            {/* `lg:hidden` : la colonne des champs structurés est en `hidden lg:block` — donc
                déjà dépliée à partir de `lg`, quel que soit showManual. Proposer de l'ouvrir sur
                desktop désignait des champs visibles à l'écran, et le clic ne changeait rien.
                Le message des prérequis, lui, reste utile aux deux tailles. */}
            {formType === "TITULAIRE" && !showManual && (
              <button type="button" onClick={() => setShowManual(true)} className="lg:hidden ml-1 underline font-semibold text-kine-700">Ouvrir les champs</button>
            )}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <Link
            href={isEdit ? "/planning" : "/annonces"}
            className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-500 text-center text-sm hover:bg-gray-50 transition"
          >
            {isEdit ? "Annuler" : "Plus tard"}
          </Link>
          <button
            type={pretAPublier ? "submit" : "button"}
            onClick={pretAPublier ? undefined : allerAuxChamps}
            disabled={loading}
            className="flex-1 py-3 bg-kine-600 text-white rounded-xl font-semibold hover:bg-kine-700 active:scale-[0.98] transition disabled:opacity-40 text-sm"
          >
            {loading
              ? (isEdit ? "Enregistrement…" : "Publication…")
              : !pretAPublier ? "Compléter ma fiche →"
              : isEdit ? "Enregistrer les modifications"
              : cfg.submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
