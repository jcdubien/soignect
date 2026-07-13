"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const DISMISS_KEY = "soignect_launch_banner_dismissed_v1";

/**
 * Bandeau de découverte Premium — affiché aux titulaires non abonnés.
 * IMPORTANT : masqué tant que le mode gratuit global (freeAccessMode) est actif, pour
 * ne JAMAIS laisser entendre que le gratuit mènera au payant pendant le lancement.
 * N'apparaît donc que lorsque le paywall est réellement en vigueur ; message factuel
 * (ce que Premium débloque), refermable (localStorage), adapté Cabinet vs Établissement.
 */
export default function LaunchOfferBanner({
  profileType,
  profileId,
  freeAccessMode = false,
}: {
  profileType: string;
  profileId: string;
  freeAccessMode?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [isStructure, setIsStructure] = useState(false);

  useEffect(() => {
    if (freeAccessMode) return; // mode lancement : aucune mention gratuit → payant
    if (profileType !== "TITULAIRE" || !profileId) return;
    if (typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY)) return;

    let alive = true;
    fetch(`/api/profiles/${profileId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (!alive || !p) return;
        // Abonné payant → pas de bandeau
        const paid = ["PREMIUM", "BOOST", "STRUCTURE"].includes(p.subscriptionPlan);
        if (paid) return;
        setIsStructure(p.titulaireKind === "STRUCTURE");
        setVisible(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [profileType, profileId, freeAccessMode]);

  if (!visible) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* stockage indisponible — on masque juste pour la session */
    }
    setVisible(false);
  }

  return (
    <div className="shrink-0 flex items-start gap-3 bg-amber-50 border-b border-amber-200 px-4 py-2.5">
      <span className="text-base leading-5 shrink-0" aria-hidden>
        ✨
      </span>
      <p className="text-xs sm:text-[13px] text-amber-900 min-w-0 flex-1 leading-snug">
        Vous êtes en <strong>plan Gratuit</strong>.{" "}
        <span className="text-amber-700">
          {isStructure
            ? "L'offre Établissement (89 €/mois + 20 €/contrat) débloque les vacations illimitées et l'accès aux profils."
            : "Premium (dès 9 €/mois) débloque les annonces illimitées et l'accès aux scores des remplaçants."}
        </span>
      </p>
      <Link
        href="/premium"
        className="shrink-0 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 transition whitespace-nowrap"
      >
        {isStructure ? "Voir l'offre →" : "Découvrir Premium →"}
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fermer"
        className="shrink-0 -mr-1 w-6 h-6 flex items-center justify-center text-amber-500 hover:text-amber-700 text-lg leading-none"
      >
        ✕
      </button>
    </div>
  );
}
