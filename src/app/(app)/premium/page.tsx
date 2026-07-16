"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export const dynamic = "force-dynamic";

const PLANS = [
  {
    id: "FREE",
    name: "Gratuit",
    price: null,
    color: "border-gray-200",
    badge: null,
    features: [
      "1 annonce active",
      "Consultation illimitée des profils",
      "Messagerie après mise en relation",
      "Score public visible",
    ],
    missing: [
      "Boost visibilité",
      "Scores remplaçants",
      "Annonces illimitées",
      "Badge certifié",
    ],
    cta: null,
  },
  {
    id: "PREMIUM",
    name: "Premium",
    price: "9€",
    period: "/mois",
    color: "border-kine-400 ring-2 ring-kine-200",
    badge: "Populaire",
    features: [
      "Annonces illimitées",
      "Boost visibilité +5",
      "Accès scores remplaçants",
      "Badge certifié Soignect",
      "Messagerie après mise en relation",
    ],
    missing: ["Stats avancées", "Accès anticipé profils"],
    cta: "PREMIUM",
  },
  {
    id: "BOOST",
    name: "Boost",
    price: "29€",
    period: "/mois",
    color: "border-orange-300 ring-2 ring-orange-100",
    badge: "Maximum",
    features: [
      "Tout le plan Premium",
      "Boost visibilité +8",
      "Badge prioritaire",
      "Stats avancées",
      "Accès anticipé profils",
    ],
    missing: [],
    cta: "BOOST",
  },
] as const;

export default function PremiumPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [kind, setKind] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  // Récupère la nature du titulaire (Cabinet/Structure) pour l'offre dédiée
  useEffect(() => {
    const pid = (session?.user as { profileId?: string })?.profileId;
    if (!pid) return;
    fetch(`/api/profiles/${pid}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => setKind(p?.titulaireKind ?? null))
      .catch(() => {});
  }, [session]);

  useEffect(() => {
    // Ne rediriger que lorsque le profileType est connu ET différent de TITULAIRE.
    // Tant qu'il est indéterminé (session en cours d'hydratation), on reste sur la page
    // pour éviter d'éjecter un titulaire légitime au chargement à froid.
    const pt = session?.user?.profileType;
    if (status === "authenticated" && pt && pt !== "TITULAIRE") {
      router.replace("/annonces");
    }
  }, [status, session, router]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-kine-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  async function subscribe(plan: "PREMIUM" | "BOOST" | "STRUCTURE") {
    setLoading(plan);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (res.ok) {
        const { url } = await res.json();
        if (url) window.location.href = url;
        else setError("Réponse inattendue du paiement. Réessayez dans un instant.");
      } else {
        const err = await res.json().catch(() => ({}));
        // 503 = paiement en ligne pas encore activé (Stripe non configuré côté serveur)
        if (res.status === 503) {
          setError(
            "Le paiement en ligne n'est pas encore activé sur cette version. " +
              "Écrivez-nous et nous activerons votre accès manuellement.",
          );
        } else {
          setError(
            typeof err.error === "string"
              ? err.error
              : "Impossible de démarrer le paiement. Réessayez dans un instant.",
          );
        }
      }
    } catch {
      setError("Problème de connexion. Vérifiez votre réseau et réessayez.");
    } finally {
      setLoading(null);
    }
  }

  // Parcours dissociés (pas une variante de bouton) : un compte Structure ne voit QUE
  // l'offre établissement ; un compte Cabinet ne voit QUE Gratuit/Premium/Boost.
  const isStructure = kind === "STRUCTURE";

  return (
    <div className="max-w-5xl mx-auto w-full px-4 py-10">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-black text-gray-900 mb-2">
          {isStructure ? "Offre établissement" : "Boostez votre cabinet"}
        </h1>
        <p className="text-gray-500 max-w-lg mx-auto">
          {isStructure
            ? "Recrutez des soignants pour votre EHPAD, clinique ou SSR — nettement moins cher qu'une agence d'intérim."
            : "Augmentez votre visibilité auprès des kinésithérapeutes, accédez aux scores et recrutez plus vite."}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="max-w-lg mx-auto mb-8 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {error}
        </div>
      )}

      {kind === null ? (
        // Type de compte en cours de chargement — on ne montre ni Cabinet ni Structure
        // pour éviter tout mélange / flash du mauvais parcours.
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-kine-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : isStructure ? (
        // ── Parcours STRUCTURE : UNIQUEMENT l'offre établissement ──
        <div className="max-w-2xl mx-auto">
          <div className="rounded-3xl border-2 border-[#0B3D5C]/25 bg-white p-6">
            <h2 className="text-lg font-bold text-gray-900">Structures privées (EHPAD, cliniques, SSR)</h2>
            <div className="flex items-baseline gap-1 mt-1 flex-wrap">
              <span className="text-3xl font-black text-gray-900">89€</span>
              <span className="text-gray-400 text-sm">/mois</span>
              <span className="text-gray-500 text-sm ml-2">+ 20€ / contrat signé</span>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Modèle hybride, nettement moins cher qu&apos;une agence d&apos;intérim. Le montant à
              l&apos;usage (20€) est facturé automatiquement à chaque contrat signé.
            </p>
            <button
              type="button"
              onClick={() => subscribe("STRUCTURE")}
              disabled={loading === "STRUCTURE"}
              className="mt-5 w-full py-3 bg-[#0B3D5C] text-white rounded-2xl font-bold text-sm hover:opacity-90 transition disabled:opacity-40"
            >
              {loading === "STRUCTURE" ? "Redirection…" : "S'abonner →"}
            </button>
          </div>
        </div>
      ) : (
        // ── Parcours CABINET : UNIQUEMENT Gratuit / Premium / Boost ──
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map(plan => (
          <div
            key={plan.id}
            className={`relative bg-white rounded-3xl border-2 ${plan.color} p-6 flex flex-col`}
          >
            {plan.badge && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className={`px-3 py-1 text-xs font-bold rounded-full shadow-sm ${
                  plan.id === "PREMIUM" ? "bg-kine-600 text-white" : "bg-orange-500 text-white"
                }`}>
                  {plan.badge}
                </span>
              </div>
            )}

            <div className="mb-5">
              <h2 className="text-lg font-bold text-gray-900">{plan.name}</h2>
              {plan.price ? (
                <div className="flex items-baseline gap-0.5 mt-1">
                  <span className="text-3xl font-black text-gray-900">{plan.price}</span>
                  <span className="text-gray-400 text-sm">{plan.period}</span>
                </div>
              ) : (
                <p className="text-2xl font-black text-gray-400 mt-1">Gratuit</p>
              )}
            </div>

            <ul className="flex flex-col gap-2 flex-1 mb-6">
              {plan.features.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                  {f}
                </li>
              ))}
              {plan.missing.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-400">
                  <span className="mt-0.5 shrink-0">✕</span>
                  {f}
                </li>
              ))}
            </ul>

            {plan.cta ? (
              <button
                onClick={() => subscribe(plan.cta as "PREMIUM" | "BOOST")}
                disabled={loading !== null}
                className={`w-full py-3 rounded-2xl font-bold text-sm transition active:scale-95 disabled:opacity-50 ${
                  plan.id === "PREMIUM"
                    ? "bg-kine-600 hover:bg-kine-700 text-white"
                    : "bg-orange-500 hover:bg-orange-600 text-white"
                }`}
              >
                {loading === plan.cta ? "Redirection…" : "S'abonner →"}
              </button>
            ) : (
              <div className="w-full py-3 rounded-2xl text-center text-sm font-medium text-gray-400 bg-gray-50">
                Plan actuel
              </div>
            )}
          </div>
        ))}
        </div>
      )}

      <p className="text-center text-xs text-gray-400 mt-8">
        Paiement sécurisé par Stripe · Résiliation à tout moment · Sans engagement
      </p>
    </div>
  );
}
