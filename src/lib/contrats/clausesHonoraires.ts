// Balnéothérapie et aide à la télétransmission (24/10, demande de JC) — SOURCE UNIQUE des options
// et des phrases, lues par l'écran de contrat et par les trois modèles kiné libéraux.
//
// Clauses OPTIONNELLES : non choisies, aucune phrase n'est ajoutée et le contrat reste celui
// d'avant. Elles s'insèrent DANS l'article de la rétrocession ou de la redevance — jamais un
// article de plus : la numérotation, et donc la clause de non-concurrence et ses renvois, ne
// bougent pas.
//
// Balnéothérapie : validée par JC le 28/10 — trois choix, et aucun n'est imposé : intégralement
// reversée au cabinet, soumise à la même rétrocession que les autres actes, ou gardée
// intégralement par le remplaçant / l'assistant / le collaborateur.
// Télétransmission : rédaction Soignect, à valider par JC. Fond donné par JC le 24/10 : le
// remplaçant facture sur sa CPS de remplaçant ; l'aide est reversée si c'est ce que les parties
// ont décidé.

export type OptionBalneo = "COMPRIS" | "TITULAIRE" | "PRATICIEN";
export type OptionTeletransmission = "PRATICIEN" | "TITULAIRE";

export const OPTIONS_BALNEO: OptionBalneo[] = ["COMPRIS", "TITULAIRE", "PRATICIEN"];
export const OPTIONS_TELETRANSMISSION: OptionTeletransmission[] = ["PRATICIEN", "TITULAIRE"];

/** Les deux parties telles que chaque modèle les nomme, et l'assiette de l'article. */
export interface PartiesClause {
  titulaire: string;  // « le remplacé », « le titulaire »
  praticien: string;  // « le remplaçant », « l'assistant », « le collaborateur »
  assiette: string;   // « la rétrocession », « la redevance »
}

export const PARTIES_REMPLACEMENT: PartiesClause = { titulaire: "le remplacé", praticien: "le remplaçant", assiette: "la rétrocession" };
export const PARTIES_ASSISTANAT: PartiesClause = { titulaire: "le titulaire", praticien: "l'assistant", assiette: "la redevance" };
export const PARTIES_COLLABORATION: PartiesClause = { titulaire: "le titulaire", praticien: "le collaborateur", assiette: "la redevance" };

/** Libellés de l'écran (côté praticien générique : le type de contrat n'est pas toujours connu). */
export const LIBELLE_BALNEO: Record<OptionBalneo, string> = {
  COMPRIS: "Compris dans la rétrocession / redevance (même pourcentage)",
  TITULAIRE: "Reversés en totalité au titulaire",
  PRATICIEN: "Conservés en totalité par le remplaçant / l'assistant",
};
export const LIBELLE_TELETRANSMISSION: Record<OptionTeletransmission, string> = {
  PRATICIEN: "Reste acquise au remplaçant / à l'assistant",
  TITULAIRE: "Reversée au titulaire",
};

// « au remplacé », « au titulaire » — l'article contracté ne se compose pas avec « le ».
const au = (partie: string) => partie.replace(/^le /, "au ").replace(/^l'/, "à l'");

export function phraseBalneo(o: OptionBalneo | null | undefined, p: PartiesClause): string | null {
  if (!o) return null;
  if (o === "COMPRIS") return `Les honoraires des actes réalisés en balnéothérapie entrent dans l'assiette de ${p.assiette}, dans les mêmes conditions que les autres actes.`;
  if (o === "TITULAIRE") return `Les honoraires des actes réalisés en balnéothérapie sont exclus de l'assiette de ${p.assiette} et sont reversés en totalité ${au(p.titulaire)}.`;
  return `Les honoraires des actes réalisés en balnéothérapie sont exclus de l'assiette de ${p.assiette} et restent acquis en totalité ${au(p.praticien)}.`;
}

export function phraseTeletransmission(o: OptionTeletransmission | null | undefined, p: PartiesClause): string | null {
  if (!o) return null;
  const sujet = `L'aide à la télétransmission perçue par ${p.praticien} au titre de son activité pendant la durée du contrat`;
  return o === "PRATICIEN"
    ? `${sujet} lui reste acquise.`
    : `${sujet} est reversée ${au(p.titulaire)}, selon les mêmes modalités de paiement que ${p.assiette}.`;
}

/** Lecture tolérante d'un paramètre d'URL : une valeur inconnue vaut « non choisie ». */
export function lireOption<T extends string>(v: string | null, options: readonly T[]): T | null {
  return v && (options as readonly string[]).includes(v) ? (v as T) : null;
}
