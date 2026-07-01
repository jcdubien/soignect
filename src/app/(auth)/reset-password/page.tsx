"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) router.replace("/forgot-password");
  }, [token, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    if (res.ok) {
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } else {
      const data = await res.json();
      setError(data.error ?? "Lien invalide ou expiré. Recommencez.");
    }
    setLoading(false);
  }

  if (!token) return null;

  return (
    <div className="bg-white rounded-t-3xl flex-1 px-6 pt-8 pb-10 shadow-2xl max-w-md mx-auto w-full">
      {done ? (
        <div className="flex flex-col items-center text-center gap-4 py-6">
          <span className="text-5xl">✅</span>
          <h2 className="text-xl font-bold text-gray-800">Mot de passe mis à jour !</h2>
          <p className="text-gray-500 text-sm">Vous allez être redirigé vers la connexion…</p>
        </div>
      ) : (
        <>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Nouveau mot de passe</h2>
          <p className="text-gray-400 text-sm mb-6">
            Choisissez un mot de passe sécurisé d&apos;au moins 6 caractères.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nouveau mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 text-sm"
                placeholder="••••••••"
                minLength={6}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirmer le mot de passe
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 text-sm"
                placeholder="••••••••"
                minLength={6}
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
              className="w-full py-3.5 bg-kine-600 text-white rounded-xl font-semibold hover:bg-kine-700 active:scale-[0.98] transition disabled:opacity-40 text-sm"
            >
              {loading ? "Mise à jour…" : "Enregistrer le nouveau mot de passe →"}
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
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-kine-900 via-kine-700 to-kine-500">
      <div className="flex flex-col items-center justify-center pt-14 pb-8 px-4 text-center">
        <div className="flex items-baseline gap-1 mb-2">
          <span className="text-4xl font-black text-white tracking-tight">Kiné</span>
          <span className="text-4xl font-black text-kine-100 tracking-tight">Board</span>
        </div>
        <p className="text-kine-100 text-sm font-medium tracking-wide">
          Nouveau mot de passe
        </p>
      </div>

      <div className="flex-1 flex flex-col">
        <Suspense fallback={
          <div className="bg-white rounded-t-3xl flex-1 max-w-md mx-auto w-full flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-kine-400 border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
