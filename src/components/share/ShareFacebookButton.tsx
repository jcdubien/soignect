"use client";

// Bouton « Partager sur Facebook » (sections 8 / 139 / 181).
//
// Par défaut : sharer.php (fiable, ouvre le composer avec l'aperçu de l'annonce ; limité au
// Journal/profil — limite intrinsèque Meta, pas un bug).
//
// Le Share Dialog officiel (sélecteur Journal/Story/Groupe/Page) est prêt mais gardé DERRIÈRE
// UN FLAG explicite : il ne s'active que si NEXT_PUBLIC_FACEBOOK_SHARE_DIALOG=1 (ou "true").
// Raison : le Dialog exige une config Meta complète (App Domains = soignect.vercel.app + app en
// mode Live) ; sans elle, Facebook renvoie « Ce contenu n'est pas disponible » (vérifié en live).
// On n'active donc ce flag qu'APRÈS avoir confirmé la config Meta — sinon le repli sharer.php
// reste utilisé et rien n'est cassé. L'App ID vient de NEXT_PUBLIC_FACEBOOK_APP_ID (jamais en dur).
// Rappel Meta : impossible de présélectionner un groupe précis (anti-spam) — l'utilisateur
// choisit « Groupe » puis cherche le sien dans le sélecteur.
function dialogEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_FACEBOOK_SHARE_DIALOG;
  return v === "1" || v === "true";
}

export default function ShareFacebookButton({ path }: { path: string }) {
  function share() {
    const url = `${window.location.origin}${path}`;
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const useDialog = appId && dialogEnabled();
    const shareUrl = useDialog
      ? `https://www.facebook.com/dialog/share?app_id=${encodeURIComponent(appId!)}` +
        `&display=popup&href=${encodeURIComponent(url)}&redirect_uri=${encodeURIComponent(url)}`
      : `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    window.open(shareUrl, "_blank", "noopener,noreferrer,width=600,height=650");
  }
  return (
    <button
      type="button"
      onClick={share}
      className="w-full py-2.5 rounded-xl text-sm font-bold bg-[#1877F2] text-white hover:opacity-90 transition"
    >
      Partager sur Facebook
    </button>
  );
}
