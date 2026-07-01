"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const PLANS = [
  {
    id: "FREE",
    name: "Gratuit",
    price: null,
    color: "border-gray-200",
    badge: null,
    features: [
      "1 annonce active",
      "Swipe illimité",
      "Messagerie post-match",
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
    price: "39€",
    period: "/mois",
    color: "border-kine-400 ring-2 ring-kine-200",
    badge: "Populaire",
    features: [
      "Annonces illimitées",
      "Boost visibilité +5",
      "Accès scores remplaçants",
      "Badge certifié ParaBoard",
      "Messagerie post-match",
    ],
    missing: ["Stats avancées", "Accès anticipé profils"],
    cta: "PREMIUM",
  },
  {
    id: "BOOST",
    name: "Boost",
    price: "79€",
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

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.profileType !== "TITULAIRE") {
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

  async function subscribe(plan: "PREMIUM" | "BOOST") {
    setLoading(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (res.ok) {
        const { url } = await res.json();
        if (url) window.location.href = url;
      } else {
        const err = await res.json();
        alert(err.error ?? "Erreur lors de la création de la session Stripe");
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto w-full px-4 py-10">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-black text-gray-900 mb-2">Boostez votre cabinet</h1>
        <p className="text-gray-500 max-w-lg mx-auto">
          Augmentez votre visibilité auprès des kinésithérapeutes, accédez aux scores et recrutez plus vite.
        </p>
      </div>

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

      <p className="text-center text-xs text-gray-400 mt-8">
        Paiement sécurisé par Stripe · Résiliation à tout moment · Sans engagement
      </p>
    </div>
  );
}
