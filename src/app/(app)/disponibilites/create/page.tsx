"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { COMMUNES_GUADELOUPE } from "@/lib/communes";
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

  const [form, setForm] = useState({
    title: "",
    description: "",
    bioTinder: "",
    location: "",
    specialties: [] as string[],
    startDate: searchParams.get("startDate") ?? "",
    endDate: searchParams.get("endDate") ?? "",
    minMonths: "",
    dateFlexibility: 0,
  });

  const isAssistant = profileType === "ASSISTANT";

  // Validation 90 jours pour ASSISTANT (section 37.E)
  const missionDays = form.startDate && form.endDate
    ? Math.floor((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / 86400000)
    : null;
  const under90Days = isAssistant && missionDays !== null && missionDays < 90;

  // Accroche 280 signes OBLIGATOIRE — min 40 caractères (section 71 / 88)
  const bioValid = form.bioTinder.trim().length >= 40;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/missions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description || undefined,
        bioTinder: form.bioTinder || undefined,
        location: form.location,
        specialties: form.specialties,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
        minMonths: form.minMonths ? parseInt(form.minMonths) : null,
        missionType: isAssistant ? "ASSISTANAT" : "REMPLACEMENT",
        dateFlexibility: form.dateFlexibility,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error?.fieldErrors?.title?.[0] ?? "Erreur lors de la publication");
      setLoading(false);
      return;
    }
    router.push("/annonces");
  }

  if (status === "loading" || profileType === "TITULAIRE") return null;

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

        {/* Titre */}
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

        {/* Bio Tinder — phrase accrocheuse */}
        <div className="bg-kine-50 rounded-2xl p-4 border border-kine-100">
          <label className="block text-sm font-semibold text-kine-700 mb-1">
            En une phrase, qui vous êtes
            <span className="text-kine-400 font-normal ml-1">(280 signes · obligatoire)</span>
          </label>
          <p className="text-xs text-kine-600/70 mb-2">
            C&apos;est ce texte qui alimente le matching intelligent — présentez-vous en quelques mots (40 caractères minimum).
          </p>
          <textarea
            value={form.bioTinder}
            onChange={(e) => {
              if (e.target.value.length <= 280)
                setForm({ ...form, bioTinder: e.target.value });
            }}
            rows={2}
            className="w-full px-4 py-3 border border-kine-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 resize-none text-sm bg-white"
            placeholder={
              isAssistant
                ? "J'aspire à intégrer un cabinet dynamique en Guadeloupe…"
                : "Je suis un kiné passionné, disponible pour remplacements courts en Guadeloupe…"
            }
          />
          <div className="flex justify-between items-center mt-0.5">
            {!bioValid ? (
              <span className="text-xs text-amber-600">Encore {Math.max(0, 40 - form.bioTinder.trim().length)} caractère(s)</span>
            ) : <span />}
            <span className="text-xs text-gray-300">{form.bioTinder.length}/280</span>
          </div>
        </div>

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

        {/* Zone géographique */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Commune ou zone souhaitée
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

        {/* Spécialités retirées (section 69) — matching via DeepSeek à partir de l'accroche */}

        {/* Dates de disponibilité (REMPLACANT) */}
        {!isAssistant && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mes dates de disponibilité
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

        {/* Taux de rétrocession retiré (section 88) — se négocie dans la discussion/le contrat */}

        {/* Avertissement 90j minimum pour les assistants */}
        {under90Days && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
            ⚠️ Les postes d&apos;assistanat nécessitent une durée minimale de <strong>3 mois (90 jours)</strong>.
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
            disabled={loading || !form.title || !form.location || !bioValid || !!under90Days}
            className="flex-1 py-3 bg-kine-600 text-white rounded-xl font-semibold hover:bg-kine-700 active:scale-[0.98] transition disabled:opacity-40 text-sm"
          >
            {loading ? "Publication…" : "Publier mes disponibilités →"}
          </button>
        </div>
      </form>
    </div>
  );
}
