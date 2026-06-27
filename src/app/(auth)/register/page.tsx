"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    email: "",
    password: "",
    type: "" as "REMPLACANT" | "ASSISTANT" | "TITULAIRE" | "",
    bio: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.type) return;
    setLoading(true);
    setError("");

    const res = await fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(
        data.error?.fieldErrors?.email?.[0] ?? "Erreur lors de l'inscription"
      );
      setLoading(false);
      return;
    }

    await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });
    router.push("/missions/create");
  }

  const types = [
    {
      value: "REMPLACANT" as const,
      icon: "🩺",
      label: "Remplaçant",
      desc: "Courte période définie",
    },
    {
      value: "ASSISTANT" as const,
      icon: "👩‍⚕️",
      label: "Assistant",
      desc: "Poste long terme (≥ 3 mois)",
    },
    {
      value: "TITULAIRE" as const,
      icon: "🏥",
      label: "Cabinet / Titulaire",
      desc: "Je propose des missions",
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-kine-500 to-kine-800 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-kine-700">Créer mon compte</h1>
          <p className="text-gray-400 text-sm mt-1">
            Les détails de vos missions se renseignent après l&apos;inscription
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email professionnel
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400"
              placeholder="vous@exemple.fr"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400"
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Je suis…
            </label>
            <div className="space-y-2">
              {types.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm({ ...form, type: t.value })}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition ${
                    form.type === t.value
                      ? "border-kine-500 bg-kine-50"
                      : "border-gray-200 hover:border-kine-300"
                  }`}
                >
                  <span className="text-2xl">{t.icon}</span>
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{t.label}</p>
                    <p className="text-xs text-gray-400">{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Présentation courte
              <span className="text-gray-400 font-normal ml-1">(optionnel)</span>
            </label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              maxLength={300}
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 resize-none text-sm"
              placeholder="Quelques mots sur vous, votre expérience…"
            />
            <p className="text-right text-xs text-gray-300 mt-0.5">
              {form.bio.length}/300
            </p>
          </div>

          {error && (
            <p className="text-red-500 text-sm bg-red-50 px-4 py-2 rounded-lg">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !form.email || !form.password || !form.type}
            className="w-full py-3 bg-kine-600 text-white rounded-xl font-semibold hover:bg-kine-700 transition disabled:opacity-40"
          >
            {loading ? "Création…" : "Créer mon compte →"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-6">
          Déjà un compte ?{" "}
          <Link href="/login" className="text-kine-600 font-medium hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
