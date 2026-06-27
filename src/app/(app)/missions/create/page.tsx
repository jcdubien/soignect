"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { COMMUNES_GUADELOUPE, SPECIALTIES_KINE } from "@/lib/communes";
import Link from "next/link";

export default function CreateMissionPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const profileType = (session?.user as { type?: string })?.type;

  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    specialties: [] as string[],
    startDate: "",
    endDate: "",
    minMonths: "",
  });

  function toggleSpecialty(s: string) {
    setForm((prev) => ({
      ...prev,
      specialties: prev.specialties.includes(s)
        ? prev.specialties.filter((x) => x !== s)
        : [...prev.specialties, s],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const body = {
      title: form.title,
      description: form.description || undefined,
      location: form.location,
      specialties: form.specialties,
      startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
      endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
      minMonths: form.minMonths ? parseInt(form.minMonths) : null,
    };

    const res = await fetch("/api/missions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error?.fieldErrors?.title?.[0] ?? "Erreur lors de la création");
      setLoading(false);
      return;
    }

    router.push("/swipe");
  }

  const isAssistant = profileType === "ASSISTANT";

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          {profileType === "TITULAIRE"
            ? "Publier une mission"
            : isAssistant
            ? "Décrire ma recherche de poste"
            : "Décrire ma disponibilité"}
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Vous pourrez créer plusieurs annonces depuis votre profil
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Titre de l&apos;annonce
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            maxLength={100}
            required
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 text-sm"
            placeholder={
              profileType === "TITULAIRE"
                ? "Ex : Remplacement vacances été 2025"
                : isAssistant
                ? "Ex : Recherche poste assistant longue durée"
                : "Ex : Disponible juillet-août, Pointe-à-Pitre"
            }
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
            <span className="text-gray-400 font-normal ml-1">(optionnel)</span>
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            maxLength={500}
            rows={4}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 resize-none text-sm"
            placeholder="Détails supplémentaires : patientèle, matériel, conditions, attentes…"
          />
          <p className="text-right text-xs text-gray-300 mt-0.5">{form.description.length}/500</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Commune</label>
          <select
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            required
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 text-sm"
          >
            <option value="">Sélectionner une commune…</option>
            {COMMUNES_GUADELOUPE.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Spécialités concernées
          </label>
          <div className="flex flex-wrap gap-2">
            {SPECIALTIES_KINE.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSpecialty(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                  form.specialties.includes(s)
                    ? "bg-kine-500 text-white border-kine-500"
                    : "bg-white text-gray-600 border-gray-200 hover:border-kine-300"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Dates : pour REMPLACANT et TITULAIRE */}
        {!isAssistant && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {profileType === "TITULAIRE" ? "Poste disponible du" : "Disponible du"}
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Au</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                min={form.startDate}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 text-sm"
              />
            </div>
          </div>
        )}

        {/* Durée minimale : pour ASSISTANT */}
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

        {error && (
          <p className="text-red-500 text-sm bg-red-50 px-4 py-2 rounded-lg">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <Link
            href="/swipe"
            className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-500 text-center text-sm hover:bg-gray-50 transition"
          >
            Plus tard
          </Link>
          <button
            type="submit"
            disabled={loading || !form.title || !form.location}
            className="flex-1 py-3 bg-kine-600 text-white rounded-xl font-semibold hover:bg-kine-700 transition disabled:opacity-40 text-sm"
          >
            {loading ? "Publication…" : "Publier l'annonce ✓"}
          </button>
        </div>
      </form>
    </div>
  );
}
