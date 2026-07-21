"use client";

// Bouton "Partager sur Facebook" (section 8) — ouvre la boîte de partage native
// (sharer), pré-remplie avec l'URL publique de l'annonce. Aucune automatisation.
export default function ShareFacebookButton({ path }: { path: string }) {
  function share() {
    const url = `${window.location.origin}${path}`;
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer"
    );
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
