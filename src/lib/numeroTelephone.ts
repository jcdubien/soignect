// ── RECONNAÎTRE UN NUMÉRO DE TÉLÉPHONE DANS UN TEXTE LIBRE (section 292) ─────────────────────
//
// CE QUE LA MESURE A TROUVÉ, le 08/10 sur toute la base :
//
//   messages de chat contenant un numéro     7 / 100   (7 %)
//   conversations concernées                 6 / 17    (35 %)
//   textes de profil                         0 / 88
//   textes d'annonce                         0 / 80
//   postérieurs à une signature de contrat   0
//
// Deux faits dictent tout ce fichier. D'abord la fuite est EXCLUSIVEMENT conversationnelle :
// personne ne met son numéro dans son annonce ou son profil. Ensuite, aucun de ces échanges ne
// suit un contrat signé — on ne s'échange pas un numéro après avoir contractualisé, on s'en
// échange un AU LIEU de contractualiser. Un tiers des conversations sort de la plateforme avant
// qu'elle n'ait rien capté.
//
// ── POURQUOI « DIX CHIFFRES NUS » N'EST PAS UN MOTIF ────────────────────────────────────────
//
// La première passe de mesure cherchait aussi les suites de dix chiffres sans préfixe. Sur les
// sept trouvailles, elle n'a rien apporté — les sept commençaient toutes par `+` ou `0` :
//
//   international  +590…  × 3
//   mobile 06/07          × 4
//   dix chiffres nus      × 0
//
// Elle n'aurait ramassé que des faux positifs : un SIRET tronqué, un montant suivi d'une année,
// une référence. Exiger le préfixe donne 7 vrais sur 7 et zéro faux sur ce corpus. Un motif qui
// n'attrape rien de plus mais se trompe parfois n'a pas sa place.
//
// ── CE QUE CE FICHIER NE FAIT PAS ───────────────────────────────────────────────────────────
//
// Il ne bloque rien, nulle part. Partager un numéro est légitime : celui du cabinet pour une
// visite, un numéro mal recopié, une référence. Et un blocage se contourne en trois secondes
// (« zéro six point… »), ce qui ne retient que les gens honnêtes. Le produit avertit, puis
// s'efface.

/** Séparateur toléré entre deux chiffres : espace, point, tiret, ou rien. */
const SEP = "[\\s.\\-]?";

/**
 * Indicatifs retenus : Antilles-Guyane-Réunion et métropole. Volontairement court — la base est
 * à 100 % en Guadeloupe (31 numéros déclarés en `GP`, 48 en `FR`), et élargir à tous les
 * indicatifs du monde ferait entrer des suites de chiffres qui n'ont rien de téléphonique.
 */
const INDICATIFS = "590|596|594|262|33";

const MOTIFS = [
  // International : +590 6 90 12 34 56
  new RegExp(`\\+\\s?(?:${INDICATIFS})${SEP}(?:\\d${SEP}){8,9}\\d`),
  // National : 0690123456, 06.90.12.34.56, 06 90 12 34 56
  new RegExp(`(?:^|[^\\d])0${SEP}(?:\\d${SEP}){8}\\d(?:$|[^\\d])`),
];

/** Ce texte contient-il quelque chose qui ressemble à un numéro de téléphone français ? */
export function contientUnNumero(texte: string | null | undefined): boolean {
  if (!texte) return false;
  return MOTIFS.some((r) => r.test(texte));
}
