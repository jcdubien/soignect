"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ZONE_ORDER, ZONE_LABELS, type ZoneGeo } from "@/lib/communes";
import ZoneSelector from "@/components/ui/ZoneSelector";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function CreateDisponibilitePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const profileType = (session?.user as { profileType?: string })?.profileType;

  // TITULAIRE ne doit pas accéder à cette page
  useEffect(() => {
    if (status === "authenticated" && profileType === "TITULAIRE") {
      router.replace("/missions/create");
    }
  }, [status, profileType, router]);

  // Photo de profil obligatoire pour publier (ferme la brèche — cohérent avec le serveur)
  const profileId = (session?.user as { profileId?: string })?.profileId;
  const [hasPhoto, setHasPhoto] = useState<boolean | null>(null);
  const [bioPrefilled, setBioPrefilled] = useState(false); // accroche reprise du profil
  const [bioFromText, setBioFromText] = useState(false);   // accroche extraite du texte libre
  useEffect(() => {
    if (!profileId) return;
    fetch(`/api/profiles/${profileId}`)
      .then((r) => r.json())
      .then((p) => {
        setHasPhoto(Boolean(p?.photoUrl));
        // Reco n°3 (audit UX) : pré-remplir l'accroche avec la bio du profil (saisie à
        // l'inscription) pour éviter une re-saisie. N'écrase jamais une saisie en cours ;
        // l'analyse du texte libre, elle, remplace cette valeur par une accroche extraite.
        const profileBio = (p?.bioTinder ?? "").trim();
        if (profileBio) {
          setForm((prev) => (prev.bioTinder.trim() === "" ? { ...prev, bioTinder: profileBio } : prev));
          setBioPrefilled(true);
        }
        // Pré-cocher « ouvert au salariat » selon la préférence déjà enregistrée (section 154).
        if (typeof p?.ouvertSalariat === "boolean") {
          setForm((prev) => ({ ...prev, ouvertSalariat: p.ouvertSalariat }));
        }
      })
      .catch(() => setHasPhoto(true));
  }, [profileId]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    bioTinder: "",
    zones: [] as ZoneGeo[],
    specialties: [] as string[],
    startDate: searchParams.get("startDate") ?? "",
    endDate: searchParams.get("endDate") ?? "", // préremplis depuis le menu rapide timeline (section 178)
    minMonths: "",
    dateFlexibility: 0,
    rechercheLogement: false,
    rechercheVehicule: false,
    rechercheSecretariat: false,       // privilégie un cabinet avec secrétariat (section 190)
    rechercheExerciceCoordonne: false, // souhaite exercer en structure coordonnée (section 190)
    ouvertSalariat: false,
    rawText: "", // texte libre (refonte saisie texte-libre + extraction IA)
  });

  // Ce que je cherche MAINTENANT — distinct de ce que je SUIS (section 191). Un remplaçant ne
  // pouvait pas publier de recherche long terme : missionType était figé à REMPLACEMENT et le
  // sélecteur réservé aux profils ASSISTANT. Son seul recours était qu'un administrateur change
  // son type de compte. C'est le pas minimal vers la bascule chercheur/pourvoyeur documentée en
  // Phase 3, sans y toucher : l'identité ne bouge pas, seule la recherche devient un choix.
  const typeInitial = searchParams.get("type");
  const [postKind, setPostKind] = useState<"REMPLACEMENT" | "ASSISTANAT" | "COLLABORATION">(
    typeInitial === "ASSISTANAT" || typeInitial === "COLLABORATION" ? typeInitial
      : profileType === "ASSISTANT" ? "ASSISTANAT"
      : "REMPLACEMENT",
  );

  // Ce drapeau ne dit pas « je suis assistant » mais « la recherche porte sur un poste long
  // terme » — c'est déjà le sens de ses vingt lectures (dates masquées, durée minimale exigée,
  // libellés de projet). Il suit donc le type de poste choisi, plus le type de compte.
  const isAssistant = postKind !== "REMPLACEMENT";

  // ── Assistance IA (refonte saisie) — chaque action = 1 appel serveur explicite ──
  const [aiBusy, setAiBusy] = useState<null | "extract" | "title" | "redaction" | "optimize">(null);
  const [aiDegraded, setAiDegraded] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [optimizeTips, setOptimizeTips] = useState<string[]>([]);
  const [detectedTags, setDetectedTags] = useState<{ methode?: string }>({});
  const [extractDone, setExtractDone] = useState(false);
  // Texte libre tel qu'il était avant la dernière reformulation — null = rien à annuler.
  const [rawTextBeforeRedaction, setRawTextBeforeRedaction] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  // Mode blocage (section 178) : unifie le « bloquer ces dates » du menu rapide timeline via CE
  // formulaire (au lieu d'un POST direct). Variante compacte Du/Au → mission INDISPONIBLE.
  const isBlockMode = searchParams.get("mode") === "block";
  const blockValid = !!form.startDate && !!form.endDate && form.endDate >= form.startDate;
  // Un profil ASSISTANT couvre assistant ET collaborateur (même statut, seule diff = patientèle
  // propre au niveau du contrat). On le laisse donc choisir son type de poste recherché.

  // Validation 90 jours pour ASSISTANT (section 37.E)
  const missionDays = form.startDate && form.endDate
    ? Math.floor((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / 86400000)
    : null;
  const under90Days = isAssistant && missionDays !== null && missionDays < 90;

  // Accroche 280 signes — min 40 caractères (section 71 / 88). Elle n'est plus saisie de zéro :
  // « Analyser le texte » la propose à partir du texte libre, l'utilisateur la corrige.
  const bioValid = form.bioTinder.trim().length >= 40;
  const [bioFocused, setBioFocused] = useState(false);
  // Révèle le champ accroche sans passer par l'IA (budget épuisé, indisponible, ou préférence).
  // Tant qu'il est faux et l'accroche vide, aucune seconde zone d'écriture n'est affichée.
  const [showBioManual, setShowBioManual] = useState(false);
  const bioRemaining = Math.max(0, 40 - form.bioTinder.trim().length);

  // Contenu valide = texte libre suffisant (≥40) OU accroche valide. Sans accroche (IA
  // indisponible et champ vide), le texte libre en tient lieu — publication jamais bloquée.
  const rawTextTrim = form.rawText.trim();
  const contentValid = rawTextTrim.length >= 40 || bioValid;

  // Dates requises pour un REMPLAÇANT (section 165) : sans dates, la dispo n'apparaît sur
  // aucun segment de la timeline (les briques exigent startDate ET endDate). L'assistanat
  // n'a pas de champ date ici (durée minimale à la place).
  const datesMissing = !isAssistant && (!form.startDate || !form.endDate);

  // Prérequis de publication explicités (section 165) — évite le bouton « grisé » silencieux :
  // on liste précisément ce qu'il reste à renseigner.
  const missingReqs: string[] = [];
  if (!form.title.trim())          missingReqs.push("un titre");
  if (form.zones.length === 0)     missingReqs.push("au moins une zone géographique");
  if (!contentValid)               missingReqs.push("une description (texte libre ou accroche, ≥ 40 caractères)");
  if (datesMissing)                missingReqs.push("vos dates de disponibilité (du / au)");
  if (isAssistant && !form.minMonths) missingReqs.push("une durée minimale (3 mois ou plus)"); // section 179 (C6)
  if (under90Days)                 missingReqs.push("une durée d'au moins 90 jours");
  if (hasPhoto === false)          missingReqs.push("une photo de profil");
  const canSubmit = missingReqs.length === 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // location dérivé des zones (section 148) — plus de commune saisie côté remplaçant.
    // Sert uniquement à l'affichage (📍 carte/sheet) ; le matching se fait via zones.
    const geoLabel =
      form.zones.length === ZONE_ORDER.length
        ? "Toute la Guadeloupe"
        : form.zones.map((z) => ZONE_LABELS[z]).join(", ");

    const res = await fetch("/api/missions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description || undefined,
        // Accroche de matching : l'accroche (extraite du texte puis validée/corrigée) prime ;
        // à défaut, repli sur le texte libre tronqué au cap candidat (280). Le texte complet
        // est conservé dans rawText.
        bioTinder: (form.bioTinder.trim() || rawTextTrim.slice(0, 280)) || undefined,
        rawText: rawTextTrim || undefined,
        location: geoLabel,
        zones: form.zones,
        specialties: form.specialties,
        // Assistant = poste long terme SANS dates (section 179, Option 1) : on n'envoie jamais de
        // dates, même si le query en contient (cohérence : une dispo assistant reste sans dates,
        // pilotée par la durée minimale). Le matching assistant repose sur l'accroche, pas les dates.
        startDate: isAssistant ? null : (form.startDate ? new Date(form.startDate).toISOString() : null),
        endDate: isAssistant ? null : (form.endDate ? new Date(form.endDate).toISOString() : null),
        minMonths: form.minMonths ? parseInt(form.minMonths) : null,
        missionType: postKind,
        dateFlexibility: form.dateFlexibility,
        rechercheLogement: form.rechercheLogement,
        rechercheVehicule: form.rechercheVehicule,
        rechercheSecretariat: form.rechercheSecretariat,
        rechercheExerciceCoordonne: form.rechercheExerciceCoordonne,
        ouvertSalariat: form.ouvertSalariat,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      if (data?.needsPhoto) setHasPhoto(false);
      setError(
        data?.needsPhoto
          ? "Ajoutez une photo de profil avant de publier."
          : (data.error?.fieldErrors?.title?.[0] ?? (typeof data.error === "string" ? data.error : "Erreur lors de la publication"))
      );
      setLoading(false);
      return;
    }
    // Symétrie avec la publication d'annonce côté cabinet : confirmation explicite ET partage
    // à chaud. Le candidat repartait jusqu'ici vers le feed sans un mot — sa recherche est
    // pourtant publique et partageable exactement de la même façon.
    const created = await res.json().catch(() => null);
    const publishedId = created?.id ? String(created.id) : "";
    router.push(`/annonces?published=1&pid=${encodeURIComponent(publishedId)}&pt=${encodeURIComponent(form.title)}`);
  }

  // ── Assistance IA (candidat) ────────────────────────────────────────────────────
  function applyExtracted(f: Record<string, unknown>) {
    if (f.missionType === "ASSISTANAT" || f.missionType === "COLLABORATION") setPostKind(f.missionType);
    const accroche = typeof f.accroche === "string" ? f.accroche.trim() : "";
    if (accroche) { setBioPrefilled(false); setBioFromText(true); }
    setForm((prev) => ({
      ...prev,
      // Accroche proposée (condensation du texte) — remplace le pré-remplissage venu du profil,
      // l'analyse est une action explicite de l'utilisateur. Reste éditable.
      ...(typeof f.accroche === "string" && f.accroche.trim() ? { bioTinder: f.accroche.slice(0, 280) } : {}),
      ...(typeof f.startDate === "string" ? { startDate: f.startDate } : {}),
      ...(typeof f.endDate === "string" ? { endDate: f.endDate } : {}),
      ...(typeof f.minMonths === "number" ? { minMonths: String(f.minMonths) } : {}),
      ...(Array.isArray(f.zones)
        ? { zones: (f.zones as unknown[]).filter((z): z is ZoneGeo => typeof z === "string" && (ZONE_ORDER as string[]).includes(z)) }
        : {}),
      ...(f.rechercheLogement === true ? { rechercheLogement: true } : {}),
      ...(f.rechercheVehicule === true ? { rechercheVehicule: true } : {}),
      ...(f.rechercheSecretariat === true ? { rechercheSecretariat: true } : {}),
      ...(f.rechercheExerciceCoordonne === true ? { rechercheExerciceCoordonne: true } : {}),
      ...(f.ouvertSalariat === true ? { ouvertSalariat: true } : {}),
    }));
    setDetectedTags({ methode: typeof f.methode === "string" ? f.methode : undefined });
  }

  // Informations déjà renseignées — évite que « Qu'est-ce qui manque ? » suggère du déjà-là.
  function knownFields(): string[] {
    const k: string[] = [];
    if (form.zones.length) k.push(`zones : ${form.zones.map((z) => ZONE_LABELS[z]).join(", ")}`);
    if (form.startDate) k.push(`disponible à partir du ${form.startDate}`);
    if (form.endDate) k.push(`jusqu'au ${form.endDate}`);
    if (form.minMonths) k.push(`durée minimale : ${form.minMonths} mois`);
    if (form.rechercheLogement) k.push("recherche un logement");
    if (form.rechercheVehicule) k.push("besoin d'un véhicule");
    if (form.rechercheSecretariat) k.push("privilégie un cabinet avec secrétariat");
    if (form.rechercheExerciceCoordonne) k.push("souhaite l'exercice coordonné (MSP / centre de santé)");
    if (form.ouvertSalariat) k.push("ouvert au salariat");
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
          action, role: "candidat", text: form.rawText,
          ...(action === "optimize" ? { known: knownFields() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.degraded) { setAiDegraded(true); return; }
      if (action === "extract") {
        applyExtracted(data.fields ?? {});
        setExtractDone(true);
        setShowManual(true);
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
        if ((data.suggestions ?? []).length === 0) setAiNotice("Rien à ajouter — votre disponibilité est déjà complète 👍");
      }
    } catch {
      setAiDegraded(true);
    } finally {
      setAiBusy(null);
    }
  }

  async function handleBlockSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!blockValid) return;
    setLoading(true);
    setError("");
    // Mission INDISPONIBLE (isActive=false) — non matchable, apparaît en hachuré sur la timeline.
    // Exemptée de photo/zones/accroche côté serveur (briqueStatus INDISPONIBLE).
    const res = await fetch("/api/missions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Dates bloquées",
        location: "Indisponibilité",
        specialties: [],
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        missionType: "REMPLACEMENT",
        briqueStatus: "INDISPONIBLE",
        isActive: false,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data?.error === "string" ? data.error : "Le blocage des dates a échoué.");
      setLoading(false);
      return;
    }
    router.push("/disponibilites");
  }

  if (status === "loading" || profileType === "TITULAIRE") return null;

  // ── Mode blocage (section 178) : formulaire compact, uniquement Du/Au ──
  if (isBlockMode) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 animate-fade-up">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🚫</span>
            <h1 className="text-2xl font-bold text-gray-800">Bloquer des dates</h1>
          </div>
          <p className="text-gray-400 text-sm">
            Ces dates apparaîtront en « indisponible » sur votre timeline et ne seront pas proposées aux cabinets.
          </p>
        </div>

        <form onSubmit={handleBlockSubmit} className="space-y-5 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Période à bloquer</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Du</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Au</label>
                <input
                  type="date"
                  value={form.endDate}
                  min={form.startDate || undefined}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 text-sm"
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm bg-red-50 px-4 py-2.5 rounded-xl border border-red-100">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <Link
              href="/disponibilites"
              className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-500 text-center text-sm hover:bg-gray-50 transition"
            >
              Annuler
            </Link>
            <button
              type="submit"
              disabled={loading || !blockValid}
              className="flex-1 py-3 bg-gray-800 text-white rounded-xl font-semibold hover:bg-black active:scale-[0.98] transition disabled:opacity-40 text-sm"
            >
              {loading ? "Blocage…" : "Bloquer ces dates"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 animate-fade-up">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">{profileType === "ASSISTANT" ? "👩‍⚕️" : "🩺"}</span>
          <h1 className="text-2xl font-bold text-gray-800">Publier mes disponibilités</h1>
        </div>
        <p className="text-gray-400 text-sm">
          {isAssistant
            ? "Visible par les cabinets proposant des postes longue durée"
            : "Visible par les cabinets recherchant un remplaçant en Guadeloupe"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">

        {/* ── Refonte saisie : texte libre + assistance IA ── */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-kine-700">
            {isAssistant ? "Présentez votre projet en toute liberté" : "Décrivez votre disponibilité en toute liberté"}{" "}
            <span className="text-kine-400 font-normal">— dates, zones, méthodes, logement…</span>
          </label>
          <textarea
            value={form.rawText}
            onChange={(e) => setForm({ ...form, rawText: e.target.value })}
            rows={6}
            maxLength={8000}
            className="w-full px-4 py-3 border border-kine-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 resize-y text-sm bg-white text-gray-800"
            placeholder={isAssistant
              ? "Ex : Kiné diplômé, je recherche un assistanat longue durée sur Grande-Terre à partir de septembre, minimum 12 mois. Formé en thérapie manuelle et sport. Je cherche un logement."
              : "Ex : Disponible du 1er au 30 septembre sur le Sud Grande-Terre (Sainte-Anne, Le Gosier). Mobile, méthode Mézières et respiratoire. Je recherche un logement et un véhicule."}
          />
          {/* Libellés décrivant le RÉSULTAT, pas l'action, avec une ligne d'aide indiquant
              ce qui change : les champs, le texte, ou rien. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button type="button" onClick={() => runAI("extract")} disabled={aiBusy !== null || form.rawText.trim().length < 10}
              className="flex flex-col items-start text-left gap-0.5 px-3 py-2 rounded-xl bg-kine-600 text-white hover:bg-kine-700 transition disabled:opacity-40">
              <span className="text-xs font-bold">{aiBusy === "extract" ? "Analyse…" : "✨ Remplir les champs"}</span>
              <span className="text-[10px] font-normal opacity-80 leading-snug">dates, zones, accroche… extraits de votre texte</span>
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
            {/* Regroupé avec les autres assistances : il était isolé dans l'encart
                « ce que j'ai compris » et n'apparaissait qu'après extraction. */}
            <button type="button" onClick={() => runAI("title")} disabled={aiBusy !== null || form.rawText.trim().length < 10}
              className="flex flex-col items-start text-left gap-0.5 px-3 py-2 rounded-xl border border-kine-300 text-kine-700 hover:bg-kine-50 transition disabled:opacity-40">
              <span className="text-xs font-bold">{aiBusy === "title" ? "Titre…" : "✨ Proposer un titre"}</span>
              <span className="text-[10px] font-normal opacity-70 leading-snug">remplit le titre de l&apos;annonce ci-dessous</span>
            </button>
          </div>

          {/* Annulation de la reformulation — seul geste destructif du formulaire. */}
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

          {extractDone && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 space-y-2">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Ce que j&apos;ai compris</p>
              <div className="flex flex-wrap gap-1.5">
                {isAssistant && <span className="px-2 py-0.5 rounded-full bg-kine-100 text-kine-700 text-[11px] font-semibold">{postKind === "COLLABORATION" ? "Collaboration" : "Assistanat"}</span>}
                {form.zones.length > 0 && <span className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 text-[11px] font-semibold">📍 {form.zones.map((z) => ZONE_LABELS[z]).join(", ")}</span>}
                {form.startDate && <span className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 text-[11px] font-semibold">📅 {form.startDate}{form.endDate ? ` → ${form.endDate}` : ""}</span>}
                {form.minMonths && <span className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 text-[11px] font-semibold">≥ {form.minMonths} mois</span>}
                {form.rechercheLogement && <span className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 text-[11px] font-semibold">🏠 Cherche logement</span>}
                {form.rechercheVehicule && <span className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 text-[11px] font-semibold">🚗 Besoin véhicule</span>}
                {form.rechercheSecretariat && <span className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 text-[11px] font-semibold">🗂️ Secrétariat</span>}
                {form.rechercheExerciceCoordonne && <span className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 text-[11px] font-semibold">🤝 Exercice coordonné</span>}
                {form.ouvertSalariat && <span className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 text-[11px] font-semibold">💼 Ouvert salariat</span>}
                {detectedTags.methode && <span className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 text-[11px] font-semibold">{detectedTags.methode}</span>}
              </div>
              {missingReqs.length > 0 && (
                <p className="text-[11px] text-amber-700">À compléter : <strong>{missingReqs.join(", ")}</strong></p>
              )}
            </div>
          )}

          <button type="button" onClick={() => setShowManual((s) => !s)}
            className="text-xs font-semibold text-gray-500 hover:text-gray-700 underline">
            {showManual ? "Masquer les champs détaillés" : "Vérifier / compléter les champs à la main"}
          </button>
        </div>

        {/* ── Titre — juste APRÈS la zone de texte libre, et hors du repli ──
             Après, pour ne pas accueillir l'utilisateur par un champ à remplir à la main :
             la refonte veut qu'il écrive d'abord librement. Mais hors du repli, car le titre
             est OBLIGATOIRE : enfermé dans « champs détaillés », il était invisible par défaut
             sur mobile alors qu'il bloque la publication. « ✨ Proposer un titre » le remplit
             automatiquement après analyse. */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {isAssistant ? "Mon projet en quelques mots" : "Titre de mon annonce"}
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            maxLength={100}
            required
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 text-sm"
            placeholder={
              isAssistant
                ? "Ex : Recherche CDI kiné sport · Guadeloupe à partir de septembre"
                : "Ex : Disponible juillet-août · Pointe-à-Pitre et alentours"
            }
          />
        </div>

        {/* ── Formulaire manuel (repli) — masqué par défaut ── */}
        <div className={showManual ? "space-y-5" : "hidden"}>

        {/* Type de poste recherché — ouvert à TOUS les candidats. Le sélecteur ne peut pas être
            conditionné par `isAssistant`, qu'il pilote : choisir « Remplacement » le ferait
            disparaître et l'utilisateur ne pourrait plus revenir sur son choix. */}
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Type de poste recherché</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {([["REMPLACEMENT", "Remplacement", "Dates précises, court terme"],
                 ["ASSISTANAT", "Assistanat", "Long terme, patientèle du cabinet"],
                 ["COLLABORATION", "Collaboration libérale", "Je me constitue ma patientèle"]] as const).map(([val, title, sub]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setPostKind(val)}
                  className={`text-left rounded-xl border px-3 py-2.5 transition ${
                    postKind === val ? "border-kine-500 bg-kine-50 ring-1 ring-kine-400" : "border-gray-200 hover:border-kine-300"
                  }`}
                >
                  <span className="block text-sm font-semibold text-gray-800">{title}</span>
                  <span className="block text-[11px] text-gray-400 leading-snug">{sub}</span>
                </button>
              ))}
            </div>
        </div>

        {/* Accroche — champ EXTRAIT du texte libre (fusion des deux zones de saisie).
            Le textarea n'apparaît QUE s'il a du contenu (extraction faite, ou reprise du profil)
            ou si l'utilisateur demande à l'écrire : un textarea vide affiché en permanence
            redonnait la double saisie que cette refonte supprime. Repli toujours accessible,
            et à défaut le texte libre tronqué alimente la carte — publication jamais bloquée. */}
        {!form.bioTinder && !showBioManual ? (
          <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
            <span className="font-semibold text-gray-600">Accroche de la carte</span> — tirée de
            votre texte par «&nbsp;✨ Analyser le texte&nbsp;».{" "}
            <button
              type="button"
              onClick={() => setShowBioManual(true)}
              className="underline font-semibold text-kine-700 hover:text-kine-800"
            >
              L&apos;écrire à la main
            </button>
          </p>
        ) : (
        <div className="bg-kine-50 rounded-2xl p-4 border border-kine-100">
          <label className="block text-sm font-semibold text-kine-700 mb-1">
            En une phrase, qui vous êtes
            <span className="text-kine-400 font-normal ml-1">(280 signes)</span>
          </label>
          <p className="text-xs text-kine-600/70 mb-2">
            C&apos;est cette phrase qui s&apos;affiche sur votre carte et alimente le matching —
            modifiez-la librement.
          </p>
          {bioFromText ? (
            <p className="text-xs text-emerald-600 mb-2">
              ✓ Tirée de votre texte — reformulez-la si besoin.
            </p>
          ) : bioPrefilled && (
            <p className="text-xs text-emerald-600 mb-2">
              ✓ Reprise de votre profil — modifiable pour cette annonce.
            </p>
          )}
          <textarea
            value={form.bioTinder}
            onChange={(e) => {
              if (e.target.value.length <= 280)
                setForm({ ...form, bioTinder: e.target.value });
            }}
            onFocus={() => setBioFocused(true)}
            onBlur={() => setBioFocused(false)}
            rows={2}
            className="w-full px-4 py-3 border border-kine-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 resize-none text-sm bg-white text-gray-800 not-italic break-words whitespace-pre-wrap placeholder:text-gray-400 placeholder:italic"
            placeholder={
              isAssistant
                ? "J'aspire à intégrer un cabinet dynamique en Guadeloupe…"
                : "Je suis un kiné passionné, disponible pour remplacements courts en Guadeloupe…"
            }
          />
          <div className="flex justify-end items-center mt-0.5 min-h-[16px]">
            {!bioValid ? (
              // Message MINIMUM (40 requis) — masqué tant que le champ est vide et non focus
              (bioFocused || form.bioTinder.length > 0) && (
                <span className="text-xs text-amber-600 mr-auto">
                  40 caractères minimum ({bioRemaining} restant{bioRemaining > 1 ? "s" : ""}) — sinon votre texte libre sera utilisé
                </span>
              )
            ) : (
              // Une fois le minimum atteint : compteur de maximum classique
              <span className="text-xs text-gray-300">{form.bioTinder.length}/280</span>
            )}
          </div>
        </div>
        )}

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {isAssistant ? "Mon profil et mon projet professionnel" : "Mon profil et mes attentes"}
            <span className="text-gray-400 font-normal ml-1">(optionnel)</span>
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            maxLength={500}
            rows={3}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 resize-none text-sm"
            placeholder="Expérience, techniques pratiquées, type de patientèle apprécié, mobilité…"
          />
          <p className="text-right text-xs text-gray-300 mt-0.5">{form.description.length}/500</p>
        </div>

        {/* Champ commune retiré (section 148) — la recherche géo remplaçant repose UNIQUEMENT
            sur les zones ci-dessous (dispositif provisoire en attendant le rayon temps de
            trajet, section 135). La commune côté cabinet (Mission.location) reste inchangée. */}

        {/* Zones souhaitées (seul critère géo) — multi-sélection + « Toute la Guadeloupe » */}
        <ZoneSelector
          value={form.zones}
          onChange={(zones) => setForm({ ...form, zones })}
          label="Zones où vous cherchez à travailler"
          hint="Sélectionnez une ou plusieurs zones, ou « Toute la Guadeloupe » pour ne poser aucune restriction géographique."
        />

        {/* Spécialités retirées (section 69) — matching via DeepSeek à partir de l'accroche */}

        {/* Dates de disponibilité (REMPLACANT) */}
        {!isAssistant && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mes dates de disponibilité
              <span className="text-red-500 font-normal ml-1">· obligatoire</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Du</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 text-sm"
                />
              </div>
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
            </div>
          </div>
        )}

        {/* Durée minimale (ASSISTANT) */}
        {isAssistant && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Durée minimale souhaitée
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

        {/* Flexibilité dates (REMPLACANT uniquement) */}
        {!isAssistant && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ma flexibilité sur les dates
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

        {/* ── Recherche de logement (section 120) — alimente le bonus logement du score ── */}
        <label className="flex items-center gap-3 cursor-pointer select-none rounded-xl border border-gray-200 px-4 py-3 hover:border-kine-300 transition">
          <input
            type="checkbox"
            checked={form.rechercheLogement}
            onChange={(e) => setForm({ ...form, rechercheLogement: e.target.checked })}
            className="w-4 h-4 rounded accent-kine-600"
          />
          <span className="text-sm text-gray-700">🏠 Je recherche un logement</span>
        </label>

        {/* ── Besoin d'un véhicule (feature terrain) — symétrique du logement, alimente le
             bonus véhicule du score face aux annonces qui mettent un véhicule à disposition. ── */}
        <label className="flex items-center gap-3 cursor-pointer select-none rounded-xl border border-gray-200 px-4 py-3 hover:border-kine-300 transition">
          <input
            type="checkbox"
            checked={form.rechercheVehicule}
            onChange={(e) => setForm({ ...form, rechercheVehicule: e.target.checked })}
            className="w-4 h-4 rounded accent-kine-600"
          />
          <span className="text-sm text-gray-700">🚗 J&apos;ai besoin d&apos;un véhicule</span>
        </label>

        {/* ── Attentes de cadre d'exercice (section 190) — RENORMALISATION : ne cocher que ce
             qui compte vraiment. Un critère coché entre au barème du score et coûte des points
             face aux cabinets qui ne l'offrent pas ; un critère laissé décoché ne pénalise
             personne, son poids retourne aux dates, au secteur et aux profils. ── */}
        <label className="flex items-center gap-3 cursor-pointer select-none rounded-xl border border-gray-200 px-4 py-3 hover:border-kine-300 transition">
          <input
            type="checkbox"
            checked={form.rechercheSecretariat}
            onChange={(e) => setForm({ ...form, rechercheSecretariat: e.target.checked })}
            className="w-4 h-4 rounded accent-kine-600"
          />
          <span className="text-sm text-gray-700">🗂️ Je privilégie un cabinet avec secrétariat</span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer select-none rounded-xl border border-gray-200 px-4 py-3 hover:border-kine-300 transition">
          <input
            type="checkbox"
            checked={form.rechercheExerciceCoordonne}
            onChange={(e) => setForm({ ...form, rechercheExerciceCoordonne: e.target.checked })}
            className="w-4 h-4 rounded accent-kine-600 mt-0.5"
          />
          <span className="text-sm text-gray-700">
            🤝 Je souhaite exercer en structure coordonnée
            <span className="block text-xs text-gray-500 mt-0.5">
              MSP, centre de santé, ESP — accès direct sans prescription médicale préalable,
              jusqu&apos;à 8 séances.
            </span>
          </span>
        </label>

        {/* ── Ouverture au salariat (section 154) — opt-in : rend le profil visible/matchable
             avec les postes salariés (CDD/CDI/Stage/Vacation) publiés par les établissements ── */}
        <label className="flex items-start gap-3 cursor-pointer select-none rounded-xl border border-gray-200 px-4 py-3 hover:border-kine-300 transition">
          <input
            type="checkbox"
            checked={form.ouvertSalariat}
            onChange={(e) => setForm({ ...form, ouvertSalariat: e.target.checked })}
            className="mt-0.5 w-4 h-4 rounded accent-kine-600 shrink-0"
          />
          <span className="text-sm text-gray-700">
            💼 Je suis aussi ouvert·e aux postes salariés (CDD / CDI / Stage / Vacation)
            <span className="block text-xs text-gray-400">Vous serez alors proposé·e aux établissements (EHPAD, clinique, SSR…).</span>
          </span>
        </label>

        {/* Taux de rétrocession retiré (section 88) — se négocie dans la discussion/le contrat */}

        </div>
        {/* ── fin du formulaire manuel (repli) ── */}

        {/* Avertissement 90j minimum pour les assistants */}
        {under90Days && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
            ⚠️ Les postes d&apos;assistanat nécessitent une durée minimale de <strong>3 mois (90 jours)</strong>.
          </div>
        )}

        {/* Photo de profil obligatoire pour publier */}
        {hasPhoto === false && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-center justify-between gap-3">
            <span>📷 Ajoutez une photo de profil avant de publier</span>
            <Link href="/compte" className="shrink-0 font-semibold text-amber-900 underline hover:text-amber-950">
              Ajouter →
            </Link>
          </div>
        )}

        {error && (
          <p className="text-red-500 text-sm bg-red-50 px-4 py-2.5 rounded-xl border border-red-100">{error}</p>
        )}

        {/* Reco n°2 (audit UX) : expliciter le geste suivant — le matching est réciproque,
            publier ne suffit pas, il faut aussi swiper les cabinets qui recrutent. */}
        <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5">
          🔎 Après publication, vous arrivez sur le fil des cabinets qui recrutent :
          <strong> swipez « Intéressé »</strong> sur ceux qui vous plaisent pour créer une mise en relation.
        </p>

        {/* Prérequis manquants (section 165) — explique pourquoi le bouton est désactivé,
            au lieu d'un grisé silencieux. Masqué dès que tout est rempli ou pendant l'envoi. */}
        {!loading && !canSubmit && (
          <p className="text-xs text-gray-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
            Pour publier, il reste à renseigner : <strong>{missingReqs.join(", ")}</strong>.
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <Link
            href="/annonces"
            className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-500 text-center text-sm hover:bg-gray-50 transition"
          >
            Plus tard
          </Link>
          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="flex-1 py-3 bg-kine-600 text-white rounded-xl font-semibold hover:bg-kine-700 active:scale-[0.98] transition disabled:opacity-40 text-sm"
          >
            {loading ? "Publication…" : "Publier mes disponibilités →"}
          </button>
        </div>
      </form>
    </div>
  );
}
