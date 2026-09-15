// Lien de partage d'une annonce (section 249).
//
// ── LE PROBLÈME : LE SERVEUR EST À JOUR, L'APERÇU NE L'EST PAS ────────────────────────────────
//
// Signalé le 13/09 : annonce modifiée pour démarrer le 5 octobre, aperçu WhatsApp affichant encore
// le 1er. Vérifié à la source — le serveur sert bien la bonne date, à l'instant :
//
//   og:description = « Remplacement · Pointe-Noire · 5 octobre 2026 → 13 novembre 2026 »
//
// Ce n'est donc ni un cache applicatif ni un cache Vercel : c'est WhatsApp qui garde l'aperçu
// qu'il a scrapé la première fois. Les plateformes indexent un lien une fois et ne le revisitent
// pas — rien, côté produit, ne peut les en empêcher.
//
// ── LA PARADE : CHANGER D'URL QUAND L'ANNONCE CHANGE ──────────────────────────────────────────
//
// Un paramètre dérivé de `updatedAt` suffit. Tant que l'annonce ne bouge pas, le lien est stable
// et les partages s'accumulent sur la même entrée. Dès qu'elle est modifiée, le lien devient une
// URL que la plateforme n'a jamais vue : elle la scrape, et l'aperçu est juste.
//
// LES LIENS DÉJÀ PARTAGÉS CONTINUENT DE FONCTIONNER. Le paramètre n'est lu par personne — ni la
// page, ni la route d'image. Un lien sans `maj`, ou avec un `maj` ancien, ouvre exactement la même
// annonce ; il montrera simplement l'aperçu figé au moment où il a été scrapé, ce qui est déjà le
// cas aujourd'hui.
//
// ── CE QUE ÇA NE RÉSOUT PAS, ET POURQUOI ON N'Y TOUCHE PAS ────────────────────────────────────
//
// Facebook, contrairement à WhatsApp, suit `og:url` : il rattachera `/annonce/x?maj=…` à l'URL
// canonique `/annonce/x` et pourra resservir son aperçu en cache. Mettre le paramètre dans
// `og:url` le forcerait à rescanner — mais défferait la décision de la section 158 : sans og:url
// canonique, Facebook comptait « /annonce/x », « /annonce/x?fbclid=… » et le lien copié comme
// trois pages distinctes, sur la page la plus partagée du produit. On ne casse pas l'agrégation
// des partages pour rafraîchir un aperçu ; le rescan Facebook se demande par son propre outil.

/** Version d'un lien de partage — les secondes suffisent, et le nombre reste court. */
function version(updatedAt: Date | string): string {
  const t = new Date(updatedAt).getTime();
  return Number.isFinite(t) ? String(Math.floor(t / 1000)) : "";
}

/**
 * Chemin de partage d'une annonce, portant sa date de dernière modification.
 *
 * `updatedAt` est REQUIS et non optionnel : rendu facultatif, il aurait été omis au premier appel
 * pressé, et le lien serait retombé en silence sur un aperçu périmé — le défaut même qu'on corrige.
 * Un appelant qui ne dispose pas du champ doit l'ajouter à sa requête, pas s'en passer.
 */
export function cheminPartageAnnonce(m: { id: string; updatedAt: Date | string }): string {
  const v = version(m.updatedAt);
  return v ? `/annonce/${m.id}?maj=${v}` : `/annonce/${m.id}`;
}
