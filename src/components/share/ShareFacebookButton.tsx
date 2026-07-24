"use client";

// Bouton « Partager sur Facebook » (sections 8 / 139).
// Utilise le Share Dialog officiel (app_id) → vrai sélecteur de destination
// (Journal / Story / Groupe / Page). Repli sur sharer.php tant que
// NEXT_PUBLIC_FACEBOOK_APP_ID n'est pas défini (aucune régression).
// Rappel Meta : impossible de présélectionner un groupe précis (anti-spam) —
// l'utilisateur choisit « Groupe » puis cherche le sien dans le sélecteur.
export default function ShareFacebookButton({ path }: { path: string }) {
  function share() {
    const url = `${window.location.origin}${path}`;
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const shareUrl = appId
      ? `https://www.facebook.com/dialog/share?app_id=${encodeURIComponent(appId)}` +
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
