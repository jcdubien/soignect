"use client";

import { useEffect, useState } from "react";

// Actions de partage d'une annonce (section 101 + partage natif) — réutilisable partout
// (page publique /annonce/[id] ET gestion d'annonce dans l'app, section 159) :
//  1. « Copier le lien » — toujours disponible (desktop + mobile), confirmation temporaire.
//  2. « Partager… » — via navigator.share() (Web Share API) : sélecteur natif Android/iPhone
//     listant toutes les apps (Instagram, TikTok, WhatsApp, SMS, Mail…). Affiché seulement si supporté.
//
// Le bouton « Partager sur Facebook » dédié a été retiré : le sélecteur natif propose déjà
// Facebook parmi ses destinations, un second chemin vers la même app n'apportait rien.
// Réserve connue : Facebook n'apparaît dans ce sélecteur que si l'application est installée
// (Android/iOS) ; sur un poste sans elle, il reste « Copier le lien ».
//
// Le lien pointe vers la page publique de l'annonce, qui demande auth/création de compte.
export default function ShareActions({
  path,
  title,
  plateformes = false,
}: {
  path: string;
  title: string;
  /** Ajoute les liens de partage par plateforme (Facebook, WhatsApp) et la note Instagram.
   *  Faux par défaut : les surfaces existantes (page publique, bandeau de publication) gardent
   *  exactement les deux actions qu'elles avaient. */
  plateformes?: boolean;
}) {
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

  // ── Liens de partage par plateforme (section 231) ────────────────────────────────────────
  //
  // POURQUOI FACEBOOK REVIENT. Un bouton Facebook dédié avait été retiré, au motif que le
  // sélecteur natif le propose déjà. C'est vrai SUR MOBILE et seulement si l'application est
  // installée — la réserve était d'ailleurs écrite ci-dessus. Sur un ordinateur, `navigator.share`
  // n'existe souvent pas (Firefox de bureau ne l'implémente pas), et il ne restait alors AUCUN
  // chemin vers Facebook. `sharer.php` couvre ce cas, sans rien retirer au sélecteur natif.
  //
  // POURQUOI PAS DE BOUTON INSTAGRAM. Instagram n'expose aucune URL de partage de lien —
  // ni équivalent de `sharer.php`, ni de `wa.me`. Les schémas `instagram-stories://` sont
  // réservés aux applications natives déclarant un App ID, et ne fonctionnent pas depuis une
  // page web. Un bouton « Instagram » ne pourrait donc que copier le lien en se faisant passer
  // pour autre chose. On dit ce qui est vrai : sur mobile, Instagram apparaît dans le sélecteur
  // natif ; partout ailleurs, on copie le lien et on le colle en story ou en bio.
  function ouvrir(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
  const partageFacebook = () =>
    ouvrir(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl())}`);
  const partageWhatsApp = () =>
    ouvrir(`https://wa.me/?text=${encodeURIComponent(`${title} — ${fullUrl()}`)}`);

  async function nativeShare() {
    try {
      await navigator.share({ title, text: title, url: fullUrl() });
    } catch {
      /* annulé/indisponible — silencieux */
    }
  }

  // Empilé sur mobile — deux cibles pleine largeur, plus confortables au pouce. Côte à côte
  // dès `sm` : depuis le retrait du bouton Facebook il ne reste que deux actions, et les
  // empiler sur écran large laissait une colonne étroite avec du vide à droite.
  return (
    <div className="flex flex-col gap-2">
      {plateformes && (
        <>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={partageFacebook}
              className="flex-1 min-w-0 px-3 py-2.5 rounded-xl text-sm font-bold text-white bg-[#1877F2] hover:bg-[#0f66d0] transition"
            >
              Facebook
            </button>
            <button
              type="button"
              onClick={partageWhatsApp}
              className="flex-1 min-w-0 px-3 py-2.5 rounded-xl text-sm font-bold text-white bg-[#25D366] hover:bg-[#1eb457] transition"
            >
              WhatsApp
            </button>
          </div>
          {/* Instagram : pas de bouton, parce qu'aucun n'est possible. On nomme le chemin réel. */}
          <p className="text-[11px] leading-snug text-gray-500 px-0.5">
            <strong>Instagram</strong> n&apos;accepte pas de lien partagé depuis un site.
            {canShare
              ? " Passez par « Partager… » ci-dessous, Instagram y figure si l\u2019application est installée."
              : " Copiez le lien et collez-le dans votre story ou votre bio."}
          </p>
        </>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
      <button
        type="button"
        onClick={copyLink}
        className={`w-full sm:flex-1 sm:w-auto min-w-0 px-3 py-2.5 rounded-xl text-sm font-bold border whitespace-nowrap transition ${
          copied ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-700 hover:bg-gray-50"
        }`}
      >
        {copied ? "✓ Lien copié !" : "🔗 Copier le lien"}
      </button>

      {canShare && (
        <button
          type="button"
          onClick={nativeShare}
          className="w-full sm:flex-1 sm:w-auto min-w-0 px-3 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap bg-kine-600 text-white hover:bg-kine-700 transition"
        >
          Partager…
        </button>
      )}
      </div>
    </div>
  );
}
