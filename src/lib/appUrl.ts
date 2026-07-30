// URL publique de l'application — source unique pour TOUT lien absolu généré côté serveur
// (emails, redirections Stripe, sitemap, métadonnées Open Graph).
//
// Pourquoi ce fichier existe : cinq points d'appel dérivaient chacun leur base, avec trois
// replis différents. Deux d'entre eux retombaient sur http://localhost:3000 en production
// (liens de réinitialisation morts, retour de paiement Stripe cassé), et checkout ne lisait
// que NEXTAUTH_URL — donc poser AUTH_URL seule ne le corrigeait pas. NextAuth, lui, ne passe
// pas par ici : il DÉDUIT son origine des en-têtes de la requête, ce qui masquait le problème.
//
// Ordre de résolution :
//   1. AUTH_URL      — variable NextAuth v5, celle à basculer le jour du passage à soignect.fr
//   2. NEXTAUTH_URL  — nom historique (v4), conservé par compatibilité
//   3. VERCEL_PROJECT_PRODUCTION_URL — domaine de production stable, posé par Vercel
//   4. VERCEL_URL    — URL du déploiement courant (preview) ; sans protocole, on l'ajoute
//   5. http://localhost:3000 — développement uniquement
//
// Le repli 3/4 garantit qu'une variable oubliée ne produit JAMAIS un lien vers localhost
// depuis un déploiement Vercel.

function withProtocol(host: string): string {
  return /^https?:\/\//.test(host) ? host : `https://${host}`;
}

export function appBaseUrl(): string {
  const configured = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (configured) return withProtocol(configured).replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return withProtocol(vercel).replace(/\/+$/, "");

  return "http://localhost:3000";
}
