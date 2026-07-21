"use client";

import { useEffect, useState } from "react";
import ShareFacebookButton from "./ShareFacebookButton";

// Actions de partage d'une annonce (section 101 + partage natif) — réutilisable partout
// (page publique /annonce/[id] ET gestion d'annonce dans l'app, section 159) :
//  1. « Copier le lien » — toujours disponible (desktop + mobile), confirmation temporaire.
//  2. « Partager… » — via navigator.share() (Web Share API) : sélecteur natif Android/iPhone
//     listant toutes les apps (Instagram, TikTok, WhatsApp, SMS, Mail…). Affiché seulement si supporté.
//  3. Bouton Facebook (sharer.php) — toujours présent.
// Le lien pointe vers la page publique de l'annonce, qui demande auth/création de compte.
export default function ShareActions({ path, title }: { path: string; title: string }) {
  const [copied, setCopied] = useState(false);
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
      /* copie impossible — pas de fausse confirmation */
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, text: title, url: fullUrl() });
    } catch {
      /* annulé/indisponible — silencieux */
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={copyLink}
        className={`w-full py-2.5 rounded-xl text-sm font-bold border transition ${
          copied ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-700 hover:bg-gray-50"
        }`}
      >
        {copied ? "✓ Lien copié !" : "🔗 Copier le lien"}
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
