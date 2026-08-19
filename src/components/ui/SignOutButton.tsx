"use client";

import { signOut } from "next-auth/react";

// RECHARGEMENT COMPLET, PAS `router.push` (19/08). Une navigation côté client ne re-rend PAS le
// layout : dans l'App Router, le segment `layout` est servi depuis le cache du routeur tandis que
// le segment `page` est refetché. Après un changement de compte, la barre de tête de
// `(app)/layout.tsx` continuait donc d'afficher le nom, la commune et le nombre d'annonces du
// compte PRÉCÉDENT, au-dessus d'un corps de page correct.
//
// Constaté le 19/08 : « Cabinet des ravines · Pointe-à-Pitre · 3 annonces » en tête, 5 postes de
// Jean-Charles DUBIEN dans le corps. Aucun mélange en base (profils et postes strictement
// disjoints, vérifié), aucun JWT périmé (le corps prouvait que la session était la bonne) : les
// deux moitiés dataient simplement de deux instants différents.
//
// `export const dynamic = "force-dynamic"` sur le layout ne protège pas de ça — il gouverne le
// rendu serveur, pas le cache client. `router.refresh()` marcherait aussi, mais il faudrait
// penser à l'ajouter à chaque nouveau point d'entrée ; un rechargement dur ne s'oublie pas.
//
// La portée n'a rien de personnel : sur tout poste où deux personnes se succèdent (cabinet
// partagé, démonstration), la barre affichait l'identité de la précédente. Les données servies
// restaient les bonnes — c'est le nom affiché qui mentait, ce qui suffit à faire croire à une fuite.
export function SignOutButton() {
  async function handleSignOut() {
    await signOut({ redirect: false });
    window.location.assign("/login");
  }

  return (
    <button
      onClick={handleSignOut}
      aria-label="Déconnexion"
      title="Déconnexion"
      className="shrink-0 text-sm text-gray-400 hover:text-red-500 transition inline-flex items-center gap-1"
    >
      {/* Mobile : icône compacte (évite la troncature « Déconnexio… » dans le header étroit).
          Desktop (sm+) : libellé complet. */}
      <svg
        className="sm:hidden"
        width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
      <span className="hidden sm:inline whitespace-nowrap">Déconnexion</span>
    </button>
  );
}
