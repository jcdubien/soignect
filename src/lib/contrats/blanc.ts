// Blanc à remplir à la main (09/11).
//
// Les données manquantes s'imprimaient en orange gras — « [N° RPPS à compléter] », « […] ».
// Sur un contrat envoyé à l'autre partie, ce sont des consignes internes qui s'affichent comme
// des erreurs. Un contrat papier laisse un blanc : c'est ce qu'on imprime désormais, à l'encre
// du texte. L'identité professionnelle, elle, est exigée de chaque signataire au moment où il
// signe (route de signature) : un contrat signé des deux côtés n'en garde aucun.

const LONG = "______________________";
const COURT = "________";

/** Le blanc qui remplace un libellé d'attente : court pour un nombre (« […] »), long sinon. */
export function blanc(libelleAttente?: string): string {
  return !libelleAttente || libelleAttente.length <= 5 ? COURT : LONG;
}
