"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      setError("Email ou mot de passe incorrect");
      setLoading(false);
    } else {
      const session = await fetch("/api/auth/session").then(r => r.json()).catch(() => null);
      const profileType = session?.user?.profileType;
      router.push(profileType === "TITULAIRE" ? "/planning" : "/annonces");
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-kine-900 via-kine-700 to-kine-500">
      {/* Hero */}
      <div className="flex flex-col items-center justify-center pt-14 pb-8 px-4 text-center">
        <div className="flex items-baseline gap-1 mb-2">
          <span className="text-4xl font-black text-white tracking-tight">Kiné</span>
          <span className="text-4xl font-black text-kine-100 tracking-tight">Board</span>
        </div>
        <p className="text-kine-100 text-sm font-medium tracking-wide">
          Le job board des kinés de Guadeloupe
        </p>
        {/* Vague décorative */}
        <div className="mt-6 flex gap-2 opacity-40">
          {["🌊","🌴","🌊"].map((e, i) => (
            <span key={i} className="text-2xl">{e}</span>
          ))}
        </div>
      </div>

      {/* Card formulaire */}
      <div className="flex-1 flex flex-col">
        <div className="bg-white rounded-t-3xl flex-1 px-6 pt-8 pb-10 shadow-2xl max-w-md mx-auto w-full">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Connexion</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email ou identifiant</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 text-sm"
                placeholder="vous@exemple.fr"
                autoCapitalize="none"
                autoCorrect="off"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 text-sm"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm bg-red-50 px-4 py-2.5 rounded-xl border border-red-100">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-kine-600 text-white rounded-xl font-semibold hover:bg-kine-700 active:scale-[0.98] transition disabled:opacity-40 text-sm mt-2"
            >
              {loading ? "Connexion…" : "Se connecter →"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-4">
            <Link href="/forgot-password" className="text-gray-400 hover:text-kine-600 transition hover:underline">
              Mot de passe oublié ?
            </Link>
          </p>

          <p className="text-center text-sm text-gray-400 mt-4">
            Pas encore de compte ?{" "}
            <Link href="/register" className="text-kine-600 font-semibold hover:underline">
              S&apos;inscrire
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
