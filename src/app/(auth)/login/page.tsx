"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

// N'autorise qu'un chemin interne relatif comme cible de retour (section 3)
function safeReturnTo(v: string | null): string | null {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : null;
}

export default function LoginPage() {
  // Suspense requis car LoginForm lit useSearchParams (section 3)
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const returnTo = safeReturnTo(useSearchParams().get("return_to"));
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
      const su = session?.user;
      // Profil incomplet → onboarding (en conservant la cible de retour)
      if (!su?.profileId) {
        router.push(returnTo ? `/register?return_to=${encodeURIComponent(returnTo)}` : "/register");
      } else if (returnTo) {
        // Retour vers l'annonce d'origine (section 3)
        router.push(returnTo);
      } else if (su.profileType === "TITULAIRE") {
        router.push("/planning");
      } else {
        // REMPLACANT / ASSISTANT
        router.push("/disponibilites");
      }
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-kine-900 via-kine-700 to-kine-500">
      {/* Hero — logo de marque réel (section 68). Le logo complet (carte claire)
          ressort bien sur le dégradé bleu foncé. */}
      <div className="flex flex-col items-center justify-center pt-12 pb-8 px-4 text-center">
        <Image
          src="/logo-soignect-web.png"
          alt="Soignect"
          width={200}
          height={200}
          priority
          className="rounded-3xl shadow-2xl mb-4"
        />
        <p className="text-kine-100 text-sm font-medium tracking-wide">
          Trouvez. Remplacez. Collaborez.
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
              <div className="text-sm bg-red-50 px-4 py-2.5 rounded-xl border border-red-100">
                <p className="text-red-500">{error}</p>
                <Link href="/forgot-password" className="text-red-600 font-semibold underline hover:text-red-700 mt-1 inline-block">
                  Réinitialiser mon mot de passe
                </Link>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="md3-ripple w-full py-3.5 bg-kine-600 text-white rounded-xl font-semibold hover:bg-kine-700 active:scale-[0.98] transition disabled:opacity-40 text-sm mt-2"
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
