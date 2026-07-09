"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { COMMUNES_GUADELOUPE } from "@/lib/communes";
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
    pitchStarters:    ["Je recherche…"] as const,
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
    pitchStarters:    ["Nous recherchons…"] as const,
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
    pitchStarters:    ["Je suis…", "Je recherche…", "J'aspire à…"] as const,
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
    pitchStarters:    ["J'aspire à…", "Je suis…", "Je recherche…"] as const,
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
  const isEmployeur = (session?.user as { isEmployeur?: boolean })?.isEmployeur ?? false;
  const profileType = rawProfileType as ProfileTypeKey;

  // Remplaçants et assistants publient leurs disponibilités, pas des missions
  useEffect(() => {
    if (status === "authenticated" && rawProfileType !== "TITULAIRE") {
      router.replace("/disponibilites/create");
    }
  }, [status, rawProfileType, router]);

  const cfgKey: ProfileTypeKey = profileType === "TITULAIRE" && isEmployeur ? "TITULAIRE_EMPLOYEUR" : profileType;
  const cfg = CONFIG[cfgKey] ?? CONFIG.REMPLACANT;

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
    return n === "assistant" || n === "collaboration" || n === "remplacement" ? n : "";
  })();
  const [needType, setNeedType] = useState<NeedType>(initialNeedType);

  // Poste précis du planning auquel lier l'annonce (section 92 / 55) — le futur
  // match s'attribuera directement à cette ligne du Planning Board. Stateful pour
  // survivre à l'aller-retour vers /compte (photo obligatoire, item 15).
  const [cabinetPostId, setCabinetPostId] = useState<string | null>(searchParams.get("cabinetPostId"));

  // Item 8 — photo obligatoire avant publication
  const profileId = (session?.user as { profileId?: string })?.profileId;
  const [hasPhoto, setHasPhoto] = useState<boolean | null>(null); // null = en cours de chargement
  useEffect(() => {
    if (!profileId) return;
    fetch(`/api/profiles/${profileId}`)
      .then((r) => r.json())
      .then((p) => setHasPhoto(Boolean(p?.photoUrl)))
      .catch(() => setHasPhoto(true)); // en cas d'échec réseau, ne pas bloquer inutilement
  }, [profileId]);

  const [form, setForm] = useState({
    title: "", location: "",
    specialties: [] as string[],
    startDate: searchParams.get("startDate") ?? "",
    endDate: searchParams.get("endDate") ?? "",
    minMonths: "",
    pitchStarter: "" as string,
    pitchText: "",
    dateFlexibility: 0,
  });

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

  // Validation 90 jours pour ASSISTANAT/CDD (front-end)
  const missionDays = form.startDate && form.endDate
    ? Math.floor((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / 86400000)
    : null;
  const needs90Days = needType === "assistant";
  const under90Days = needs90Days && missionDays !== null && missionDays < 90;

  // Accroche 280 signes OBLIGATOIRE — min 40 caractères (section 71 / 88)
  const pitchCombined = `${form.pitchStarter ? form.pitchStarter + " " : ""}${form.pitchText.trim()}`.trim();
  const pitchValid = pitchCombined.length >= 40;

  const showDates =
    profileType === "REMPLACANT" ||
    (profileType === "TITULAIRE" && needType === "remplacement");

  const showMinMonths =
    profileType === "ASSISTANT" ||
    (profileType === "TITULAIRE" && (needType === "assistant" || needType === "collaboration"));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const pitchFull =
      form.pitchStarter && form.pitchText.trim()
        ? `${form.pitchStarter} ${form.pitchText.trim()}`
        : null;

    const missionTypeMap: Record<string, string> = {
      remplacement: "REMPLACEMENT",
      assistant:    "ASSISTANAT",
      collaboration: "COLLABORATION",
    };

    const res = await fetch("/api/missions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        location: form.location,
        specialties: form.specialties,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
        minMonths: form.minMonths ? parseInt(form.minMonths) : null,
        pitch: pitchFull,
        missionType: missionTypeMap[needType] ?? "REMPLACEMENT",
        dateFlexibility: form.dateFlexibility,
        cabinetPostId: cabinetPostId ?? undefined,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error?.fieldErrors?.title?.[0] ?? "Erreur lors de la création");
      setLoading(false);
      return;
    }
    router.push("/annonces");
  }

  const maxPitchText = form.pitchStarter ? 280 - form.pitchStarter.length - 1 : 260;

  return (
    <div className="max-w-lg mx-auto px-4 py-8 animate-fade-up">
      {/* En-tête */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          {profileType === "TITULAIRE" && <span className="text-xl">🏥</span>}
          {profileType === "REMPLACANT" && <span className="text-xl">🩺</span>}
          {profileType === "ASSISTANT" && <span className="text-xl">👩‍⚕️</span>}
          <h1 className="text-2xl font-bold text-gray-800">{cfg.pageTitle}</h1>
        </div>
        <p className="text-gray-400 text-sm">{cfg.pageSubtitle}</p>
      </div>

      {/* Bandeau de retour après ajout de photo (item 15) */}
      {draftRestored && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800">
          ✓ Votre annonce a été restaurée. {hasPhoto ? "Vous pouvez maintenant la publier." : "Reprenez où vous en étiez."}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">

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

        {/* ── Titre ── */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {cfg.titleLabel}
          </label>
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

        {/* ── Phrase clé (pitch) ── */}
        <div className="bg-kine-50 rounded-2xl p-4 space-y-3 border border-kine-100">
          <label className="block text-sm font-semibold text-kine-700">
            {cfg.pitchTitle}
            <span className="text-kine-400 font-normal ml-1">(280 signes · obligatoire)</span>
          </label>
          <p className="text-xs text-kine-600/70">
            C&apos;est ce texte qui alimente le matching intelligent — décrivez ce que vous recherchez en quelques mots (40 caractères minimum).
          </p>
          <div className="flex gap-2 flex-wrap">
            {cfg.pitchStarters.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    pitchStarter: prev.pitchStarter === s ? "" : s,
                    pitchText: prev.pitchStarter === s ? "" : prev.pitchText,
                  }))
                }
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                  form.pitchStarter === s
                    ? "bg-kine-600 text-white border-kine-600"
                    : "bg-white text-kine-700 border-kine-300 hover:border-kine-500"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {form.pitchStarter && (
            <div>
              <div className="relative">
                <span className="absolute left-3 top-3 text-xs text-kine-500 font-medium select-none pointer-events-none">
                  {form.pitchStarter}&nbsp;
                </span>
                <textarea
                  value={form.pitchText}
                  onChange={(e) => {
                    if (e.target.value.length <= maxPitchText)
                      setForm({ ...form, pitchText: e.target.value });
                  }}
                  rows={3}
                  className="w-full pt-7 pb-2 px-3 border border-kine-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 resize-none text-sm bg-white"
                  placeholder="…complétez en quelques mots"
                />
              </div>
              <div className="flex justify-between items-center mt-0.5">
                {!pitchValid ? (
                  <span className="text-xs text-amber-600">Encore {Math.max(0, 40 - pitchCombined.length)} caractère(s)</span>
                ) : <span />}
                <span className="text-xs text-gray-300">{form.pitchStarter.length + 1 + form.pitchText.length}/280</span>
              </div>
            </div>
          )}
        </div>

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

        {/* ── Spécialités retirées (section 69) — le matching est géré par
             DeepSeek à partir du texte de l'accroche, plus de cases à cocher. ── */}

        {/* ── Avertissement durée minimale 3 mois ── */}
        {under90Days && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
            ⚠️ Les postes d&apos;{isEmployeur ? "CDD/CDI" : "assistanat"} nécessitent une durée minimale de <strong>3 mois (90 jours)</strong>.
          </div>
        )}

        {/* ── Dates (REMPLAÇANT ou TITULAIRE-remplacement) ── */}
        {showDates && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {profileType === "TITULAIRE" ? "Période de remplacement" : "Mes dates de disponibilité"}
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

        {/* ── Flexibilité dates ── */}
        {showDates && (
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
              {profileType === "TITULAIRE" ? "Durée minimale du contrat proposé" : "Durée minimale souhaitée"}
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

        {/* ── Photo obligatoire (item 8) — préserve le brouillon (item 15) ── */}
        {hasPhoto === false && (
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

        <div className="flex gap-3 pt-1">
          <Link
            href="/annonces"
            className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-500 text-center text-sm hover:bg-gray-50 transition"
          >
            Plus tard
          </Link>
          <button
            type="submit"
            disabled={loading || !form.title || !form.location || !pitchValid || !!under90Days || hasPhoto === false}
            className="flex-1 py-3 bg-kine-600 text-white rounded-xl font-semibold hover:bg-kine-700 active:scale-[0.98] transition disabled:opacity-40 text-sm"
          >
            {loading ? "Publication…" : cfg.submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
