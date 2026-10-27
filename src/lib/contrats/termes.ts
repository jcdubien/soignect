// Termes du contrat figés à la première signature (27/10).
//
// LE DÉFAUT QUE CE FICHIER FERME. Les clauses n'étaient stockées nulle part : chaque partie
// recalculait le contrat depuis SON écran (paramètres de la route de génération). Le cabinet
// réglait 75 % et signait ; le remplaçant ouvrait la page, voyait les valeurs par défaut et
// signait autre chose ; le PDF « officiel » dépendait de qui le téléchargeait.
//
// Désormais la première signature fige la chaîne de paramètres sur `Match.termesContrat`. La
// seconde partie signe ces termes-là, et la route de génération les lit en priorité. Sans termes
// figés (contrats antérieurs), rien ne change : les paramètres de l'écran, comme avant.

/** Taille maximale acceptée — la chaîne la plus longue (contrat de travail, mentions comprises)
 *  reste très en dessous. */
export const TERMES_MAX = 8000;

/** Nettoie une chaîne de paramètres reçue du navigateur : sans `draft`, bornée. `null` si vide. */
export function normaliserTermes(brut: unknown): string | null {
  if (typeof brut !== "string" || !brut.trim() || brut.length > TERMES_MAX) return null;
  const p = new URLSearchParams(brut.startsWith("?") ? brut.slice(1) : brut);
  p.delete("draft");
  const s = p.toString();
  return s ? s : null;
}

/** Paramètres à appliquer au contrat : les termes figés s'il y en a, sinon ceux de l'écran. */
export function parametresDuContrat(termesFiges: string | null | undefined, ecran: URLSearchParams): URLSearchParams {
  return termesFiges ? new URLSearchParams(termesFiges) : ecran;
}
