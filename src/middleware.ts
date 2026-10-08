import { NextResponse, type NextRequest } from "next/server";

// ── LE CHEMIN DEMANDÉ SURVIT À LA REDIRECTION VERS LA CONNEXION (section 290) ────────────────
//
// CE QUI ÉTAIT CASSÉ, vérifié à l'écran le 08/10. `(app)/layout.tsx` renvoie vers `/login` nu.
// Le formulaire de connexion sait pourtant revenir quelque part — il lit `?return_to=` — mais
// SEULE la page publique d'une annonce le posait. Un lien d'email vers `/annonces` produisait
// donc : 307 vers `/login`, connexion, puis `/disponibilites` par défaut. La feuille de saisie de
// la section 288, qui ne vit que sur le fil, n'était jamais atteinte.
//
// Ça ne concernait pas que l'email : toute arrivée profonde depuis un signet, une notification
// ou un lien partagé perdait sa destination dès que la session avait expiré.
//
// POURQUOI UN MIDDLEWARE, ALORS QU'IL N'Y EN AVAIT AUCUN. Un layout de serveur ne connaît pas
// l'URL demandée — c'est une limite de l'App Router, pas un oubli. Le seul endroit qui la voit
// avant le rendu est le middleware.
//
// IL NE DÉCIDE RIEN. Pas de lecture de session, pas de redirection, pas d'appel à la base : il
// recopie le chemin dans un en-tête de REQUÊTE et laisse passer. L'autorisation reste entière
// dans le layout, là où elle était — un contrôle d'accès à deux endroits finirait par diverger,
// et faire parler NextAuth depuis le runtime edge demanderait une configuration sans Prisma.
//
// Le `matcher` est NOMINATIF, limité aux segments servis par `(app)/layout.tsx`. Tout ce qui ne
// redirige jamais vers la connexion — pages publiques, API, fichiers statiques, images — ne paie
// rien du tout.
export const config = {
  matcher: [
    "/annonces/:path*",
    "/disponibilites/:path*",
    "/planning/:path*",
    "/compte/:path*",
    "/matches/:path*",
    "/match/:path*",
    "/missions/:path*",
    "/profile/:path*",
    "/premium/:path*",
    "/territoire/:path*",
  ],
};

/** En-tête porteur du chemin demandé. Nommé explicitement pour que le layout n'ait pas à deviner. */
export const EN_TETE_CHEMIN = "x-chemin-demande";

export function middleware(req: NextRequest) {
  const entetes = new Headers(req.headers);
  // Chemin ET query : `/annonces?card=xxx` doit revenir sur la bonne carte, pas sur le fil nu.
  entetes.set(EN_TETE_CHEMIN, req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.next({ request: { headers: entetes } });
}
