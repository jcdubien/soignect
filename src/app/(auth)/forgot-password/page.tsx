"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (res.ok) {
      setSent(true);
    } else {
      setError("Une erreur est survenue. Réessayez.");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-kine-900 via-kine-700 to-kine-500">
      <div className="flex flex-col items-center justify-center pt-14 pb-8 px-4 text-center">
        <Image src="/GeminiLogo.png" alt="Soignect" width={140} height={140} priority className="rounded-2xl shadow-xl mb-2" />
        <p className="text-kine-100 text-sm font-medium tracking-wide">
          Réinitialisation de mot de passe
        </p>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="bg-white rounded-t-3xl flex-1 px-6 pt-8 pb-10 shadow-2xl max-w-md mx-auto w-full">
          {sent ? (
            <div className="flex flex-col items-center text-center gap-4 py-6">
              <span className="text-5xl">📬</span>
              <h2 className="text-xl font-bold text-gray-800">Email envoyé !</h2>
              <p className="text-gray-500 text-sm max-w-xs">
                Si un compte existe avec cet email, vous recevrez un lien de réinitialisation valable 1 heure.
              </p>
              <Link
                href="/login"
                className="mt-2 text-kine-600 font-semibold text-sm hover:underline"
              >
                ← Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Mot de passe oublié ?</h2>
              <p className="text-gray-400 text-sm mb-6">
                Entrez votre adresse email et nous vous enverrons un lien de réinitialisation.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Adresse email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 text-sm"
                    placeholder="vous@exemple.fr"
                    required
                    autoCapitalize="none"
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
                  className="w-full py-3.5 bg-kine-600 text-white rounded-xl font-semibold hover:bg-kine-700 active:scale-[0.98] transition disabled:opacity-40 text-sm"
                >
                  {loading ? "Envoi…" : "Envoyer le lien de réinitialisation →"}
                </button>
              </form>

              <p className="text-center text-sm text-gray-400 mt-6">
                <Link href="/login" className="text-kine-600 font-semibold hover:underline">
                  ← Retour à la connexion
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
