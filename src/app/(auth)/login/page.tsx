"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import LegalFooter from "@/components/legal/LegalFooter";

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
      // RECHARGEMENT COMPLET, PAS `router.push` (19/08). Une navigation côté client ne re-rend
      // PAS le layout : le segment `layout` vient du cache du routeur, seul le segment `page` est
      // refetché. Après une connexion sur un AUTRE compte, la barre de tête de
      // `(app)/layout.tsx` gardait donc le nom, la commune et le nombre d'annonces du compte
      // précédent, au-dessus d'un corps de page pourtant correct — voir SignOutButton.tsx pour
      // le constat détaillé. `window.location.assign` vide ce cache par construction.
      //
      // Les quatre destinations sont traitées pareil : ce sont toutes des entrées dans l'espace
      // connecté. N'en durcir que certaines aurait laissé le défaut vivant sur les autres, et
      // c'est exactement ainsi qu'il a survécu jusqu'ici.
      const cible =
        !su?.profileId
          // Profil incomplet → onboarding (en conservant la cible de retour)
          ? (returnTo ? `/register?return_to=${encodeURIComponent(returnTo)}` : "/register")
          // Retour vers l'annonce d'origine (section 3)
          : returnTo ? returnTo
          : su.profileType === "TITULAIRE" ? "/planning"
          // REMPLACANT / ASSISTANT
          : "/disponibilites";
      window.location.assign(cible);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-kine-900 via-kine-700 to-kine-500">
      {/* Hero — logo de marque réel (section 68). Le logo complet (carte claire)
          ressort bien sur le dégradé bleu foncé. */}
      <div className="flex flex-col items-center justify-center pt-12 pb-8 px-4 text-center">
        <Image
          src="/GeminiLogo.png"
          alt="Soignect"
          width={200}
          height={200}
          priority
          className="rounded-3xl shadow-2xl mb-4"
        />
        <p className="text-kine-100 text-sm font-medium tracking-wide">
          Trouvez. Remplacez. Collaborez.
        </p>
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
      <LegalFooter className="text-white/70 pb-6 px-4" />
    </div>
  );
}
