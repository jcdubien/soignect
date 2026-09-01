// Formatage des dates des contrats — source unique.
//
// La fonction existait en SEPT copies rigoureusement identiques, une par gabarit (vérifié par
// empreinte le 31/08). Le défaut corrigé ici — « 1 octobre » au lieu de « 1er octobre » — se
// serait donc corrigé sept fois, ou, plus probablement, six.

/**
 * Date longue en français, lue en UTC.
 *
 * UTC EST DÉLIBÉRÉ : les dates des annonces sont stockées à minuit UTC. Les interpréter dans le
 * fuseau du serveur ferait reculer le 1er octobre au 30 septembre pour tout fuseau négatif —
 * dont celui de la Guadeloupe (UTC−4), où le produit est utilisé. Sur un contrat, la date de
 * prise d'effet changerait de mois.
 *
 * Le premier jour du mois s'écrit « 1er » : c'est le seul quantième ordinal en français, et
 * `Intl` ne le produit pas. Les autres restent cardinaux (« 2 octobre », jamais « 2e »).
 */
export function fmtDateUTC(iso: string | null): string {
  if (!iso) return "[date à compléter]";
  const d = new Date(iso);
  const texte = d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return d.getUTCDate() === 1 ? texte.replace(/^1\b/, "1er") : texte;
}
