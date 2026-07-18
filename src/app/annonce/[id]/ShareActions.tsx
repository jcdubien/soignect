"use client";

import { useEffect, useState } from "react";
import ShareFacebookButton from "./ShareFacebookButton";

// Actions de partage de l'annonce publique (section 101 + partage natif) :
//  1. « Copier le lien » — toujours disponible (desktop + mobile), confirmation temporaire.
//  2. « Partager… » — via navigator.share() (Web Share API), affiché uniquement quand
//     l'API est supportée (mobile en pratique, + certains navigateurs desktop). Le sélecteur
//     natif de l'OS liste toutes les apps capables de recevoir un lien (Instagram, TikTok,
//     WhatsApp, SMS, Mail…), sans intégration par réseau.
//  3. Le bouton Facebook existant (sharer.php) reste inchangé — seul réseau avec un vrai
//     mécanisme de partage web dédié.
// Fallback : si navigator.share n'existe pas, seuls « Copier le lien » + Facebook s'affichent.
export default function ShareActions({ path, title }: { path: string; title: string }) {
  const [copied, setCopied] = useState(false);
  // Détection après montage → évite tout écart d'hydratation SSR/CSR.
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  function fullUrl() {
    return `${window.location.origin}${path}`;
  }

  async function copyLink() {
    const url = fullUrl();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Repli presse-papier (contexte non sécurisé / anciens navigateurs)
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* copie impossible — on n'affiche pas de fausse confirmation */
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, text: title, url: fullUrl() });
    } catch {
      /* partage annulé par l'utilisateur ou indisponible — silencieux */
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={copyLink}
        className={`w-full py-2.5 rounded-xl text-sm font-bold border transition ${
          copied
            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
            : "border-gray-200 text-gray-700 hover:bg-gray-50"
        }`}
      >
        {copied ? "✓ Lien copié !" : "Copier le lien"}
      </button>

      {canShare && (
        <button
          type="button"
          onClick={nativeShare}
          className="w-full py-2.5 rounded-xl text-sm font-bold bg-kine-600 text-white hover:bg-kine-700 transition"
        >
          Partager…
        </button>
      )}

      <ShareFacebookButton path={path} />
    </div>
  );
}
