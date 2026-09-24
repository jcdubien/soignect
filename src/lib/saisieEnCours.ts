// Saisie non enregistrée en cours (section 263).
//
// ── POURQUOI UN MODULE, ET PAS UN CONTEXTE REACT ─────────────────────────────────────────────
//
// Le lien de navigation vit dans `app/(app)/layout.tsx`, un composant SERVEUR ; le formulaire qui
// sait s'il reste du texte non enregistré est un composant CLIENT, monté bien plus bas. Un
// contexte aurait demandé d'envelopper tout le layout dans un provider client — c'est-à-dire de
// faire passer l'arbre entier côté client pour un booléen.
//
// Ici, les deux composants concernés sont des clients du même bundle : un module partagé suffit.
//
// ── CE QU'IL NE FAUT PAS EN FAIRE ────────────────────────────────────────────────────────────
//
// C'est un état de SESSION D'ÉCRAN, pas une donnée. Il n'est jamais persisté, jamais lu par le
// serveur, et il retombe à faux dès que le formulaire est démonté. Un drapeau global qui
// survivrait à la page produirait exactement le faux positif le plus agaçant : une confirmation
// de sortie sur un écran où l'on n'a rien tapé.

type Abonne = (valeur: boolean) => void;

let saisie = false;
const abonnes = new Set<Abonne>();

/** Déclare qu'une saisie non enregistrée existe (ou n'existe plus). */
export function marquerSaisieEnCours(valeur: boolean): void {
  if (saisie === valeur) return;
  saisie = valeur;
  abonnes.forEach((f) => f(valeur));
}

/** Y a-t-il une saisie non enregistrée à l'écran ? */
export function saisieEnCours(): boolean {
  return saisie;
}

/** S'abonner aux changements. Renvoie la fonction de désabonnement. */
export function surSaisieEnCours(f: Abonne): () => void {
  abonnes.add(f);
  return () => abonnes.delete(f);
}
