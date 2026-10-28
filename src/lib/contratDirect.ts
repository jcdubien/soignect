// « Faire un contrat » (section 372) — l'entrée directe vers le contrat avec un confrère trouvé
// EN DEHORS de Soignect (page /confreres, section 363 et suivantes). Un confrère déjà inscrit
// est refusé par la route (409) : le texte ne doit pas promettre le contraire. Libellés et
// règle d'accès lus ici seulement : en-tête, publication d'annonce et Planning les partagent.
//
// Cabinets libéraux seulement : un établissement emploie (contrat de travail, le sien), et la
// route refuse déjà tout autre profil (lib/confrereHorsSoignect, 403).
export const CONTRAT_DIRECT = {
  href: "/confreres",
  libelle: "Faire un contrat",
  question: "Vous avez trouvé votre remplaçant ou votre assistant en dehors de Soignect ?",
  invitation: "Faites le contrat ici : vous saisissez ses coordonnées, il complète sa partie avec le lien que vous lui envoyez.",
  complement: "avec un confrère hors Soignect",
} as const;

export function contratDirectOuvert(p: { type?: string | null; titulaireKind?: string | null }): boolean {
  return p.type === "TITULAIRE" && p.titulaireKind !== "STRUCTURE";
}
