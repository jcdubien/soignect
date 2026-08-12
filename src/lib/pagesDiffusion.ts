// Textes des pages d'entrée publiques, exprimés comme {profession × territoire} (section 199).
//
// Les trois pages portaient chacune leur texte en dur, avec une seule variable apparente — le
// territoire — alors qu'il y en a deux. La profession y était figée sur « kinésithérapeute »
// dans une quinzaine d'endroits, ce que la cartographie du 12/08 avait classé ADAPTABLE :
// du texte, pas de la logique.
//
// CE MODULE NE PRÉPARE AUCUNE OUVERTURE. Une seule profession est déclarée, aucune autre ne
// s'active. Il rend simplement explicite ce qui était dupliqué — même intention que
// FENETRE_TENSION_GUADELOUPE : nommer, sans construire d'infrastructure pour un cas absent.
// Pas de table en base : rien ne consomme ces textes hors du rendu, et personne ne les édite.
//
// AJOUTER UNE PROFESSION OU UN TERRITOIRE = ajouter une entrée ici. Les trois pages n'ont pas
// à être touchées : elles lisent leur configuration par leur clé.

export interface Profession {
  /** « kinésithérapeute » — employé dans le titre personnifié. */
  singulier: string;
  /** « kinésithérapeutes » — employé dans l'accroche et les métadonnées. */
  pluriel: string;
  /** « kiné » — forme courte des titres de référencement, où la place manque. */
  court: string;
  /** « kinésithérapie » — nom de la discipline, pour « un remplacement en … ». */
  discipline: string;
}

export const KINESITHERAPEUTE: Profession = {
  singulier: "kinésithérapeute",
  pluriel: "kinésithérapeutes",
  court: "kiné",
  discipline: "kinésithérapie",
};

export interface Territoire {
  nom: string;
  /** Préposition PROPRE au territoire : « en Guadeloupe » mais « à Saint-Martin ». Ce n'est pas
   *  une constante unique — la grammaire varie, et un « à/en » figé produirait une faute sur
   *  l'un des deux. Elle voyage donc avec le territoire, pas avec le gabarit. */
  preposition: string;
  /** Forme courte pour les titres de référencement (« Saint-Barth » plutôt que le nom complet). */
  court: string;
  chemin: string;
  /** Clé de regroupement des événements LANDING_VIEW — voir /admin/diffusion. */
  cleTrace: string;
  /** Accroche sous le titre. Elle DIFFÈRE réellement d'un territoire à l'autre (la page
   *  guadeloupéenne annonce les trois types de poste, les deux autres situent la collectivité) :
   *  ce n'est pas un gabarit à variables, c'est un texte propre à chacune.
   *
   *  MÊME RÈGLE QUE LES BAS DE PAGE (10/08) : n'y écrire que ce qui est vrai par construction —
   *  le statut administratif du territoire, les types de poste, ce que fait Soignect. Pas de
   *  caractérisation de marché (« son propre marché », « conditions avantageuses », « patientèle
   *  internationale ») : personne ici ne peut la sourcer, et sur une page qui s'adresse à des
   *  professionnels décidant d'un contrat, l'invérifiable coûte plus en crédibilité qu'il ne
   *  rapporte en référencement. Le nettoyage du 10/08 n'avait porté que sur les bas de page ;
   *  les accroches y ont échappé jusqu'au 12/08. */
  accroche: (p: Profession) => string;
  metaTitre: (p: Profession) => string;
  metaDescription: (p: Profession) => string;
  ogTitre: (p: Profession) => string;
  ogDescription: (p: Profession) => string;
}

// Titre PERSONNIFIÉ, à la première personne (décision du 12/08) : il dit ce que le visiteur
// vient chercher plutôt que d'étiqueter la page. La profession y reste explicite, pour la
// reconnaissance immédiate.
export function titrePage(p: Profession, t: Territoire): string {
  return `Je souhaite organiser mon temps d'activité de ${p.singulier} ${t.preposition} ${t.nom}`;
}

export const TERRITOIRES: Record<string, Territoire> = {
  GUADELOUPE: {
    nom: "Guadeloupe",
    preposition: "en",
    court: "Guadeloupe",
    chemin: "/remplacement-kine-guadeloupe",
    cleTrace: "remplacement-kine-guadeloupe",
    accroche: (p) =>
      `Soignect est le job board des ${p.pluriel} de Guadeloupe. Une mission de quelques semaines, un assistanat sur la durée ou une collaboration libérale : cabinets et candidats se trouvent en quelques swipes, sans intermédiaire. Gratuit pour qui cherche un poste.`,
    metaTitre: (p) => `Remplacement, assistanat, collaboration ${p.court} en Guadeloupe | Soignect`,
    metaDescription: (p) =>
      `Postes de ${p.discipline} en Guadeloupe : remplacements ponctuels, assistanats et collaborations libérales. Annonces de cabinets et ${p.pluriel} disponibles sur toute la Guadeloupe (Grande-Terre, Basse-Terre, Marie-Galante, Les Saintes, La Désirade).`,
    ogTitre: (p) => `Postes de ${p.court} en Guadeloupe | Soignect`,
    ogDescription: (p) =>
      `Le job board des ${p.pluriel} de Guadeloupe : remplacement, assistanat, collaboration. Trouvez un cabinet ou un candidat en quelques swipes.`,
  },
  SAINT_MARTIN: {
    nom: "Saint-Martin",
    preposition: "à",
    court: "Saint-Martin",
    chemin: "/remplacement-kine-saint-martin",
    cleTrace: "remplacement-kine-saint-martin",
    accroche: (p) =>
      `Soignect connecte les ${p.pluriel} de Saint-Martin — collectivité d'outre-mer française, distincte de la Guadeloupe. Cabinets et remplaçants s'y trouvent sans intermédiaire. Gratuit pour qui cherche un poste.`,
    metaTitre: (p) => `Remplacement ${p.court} Saint-Martin — Annonces & disponibilités | Soignect`,
    metaDescription: (p) =>
      `Trouvez un remplacement en ${p.discipline} à Saint-Martin. Annonces de cabinets et remplaçants ${p.court}s disponibles à Marigot, Grand Case et sur toute la collectivité de Saint-Martin.`,
    ogTitre: (p) => `Remplacement ${p.court} Saint-Martin | Soignect`,
    ogDescription: (p) => `Le job board des ${p.pluriel} de Saint-Martin.`,
  },
  SAINT_BARTH: {
    nom: "Saint-Barthélemy",
    preposition: "à",
    court: "Saint-Barth",
    chemin: "/remplacement-kine-saint-barth",
    cleTrace: "remplacement-kine-saint-barth",
    accroche: (p) =>
      `Soignect connecte les ${p.pluriel} de Saint-Barthélemy — collectivité d'outre-mer française, distincte de la Guadeloupe et de Saint-Martin. Cabinets et remplaçants s'y trouvent sans intermédiaire. Gratuit pour qui cherche un poste.`,
    metaTitre: (p) => `Remplacement ${p.court} Saint-Barthélemy — Annonces & disponibilités | Soignect`,
    metaDescription: (p) =>
      `Trouvez un remplacement en ${p.discipline} à Saint-Barthélemy. Annonces de cabinets et remplaçants ${p.court}s disponibles à Gustavia et sur toute l'île de Saint-Barth.`,
    ogTitre: (p) => `Remplacement ${p.court} Saint-Barthélemy | Soignect`,
    ogDescription: (p) => `Le job board des ${p.pluriel} de Saint-Barthélemy.`,
  },
};
