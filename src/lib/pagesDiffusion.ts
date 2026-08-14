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
  /** « kine » — forme SANS ACCENT ni espace, pour les URL. Déclarée plutôt que dérivée de
   *  `court` : une translittération automatique produirait « kine » ici mais échouerait sur
   *  d'autres professions, et surtout elle serait invisible. Le chemin d'une page est une
   *  adresse publique — il se lit, il ne se devine pas.
   *  Le défaut trouvé le 14/08 venait de là : `court` (« kiné ») servait à construire l'URL,
   *  qui pointait donc vers /emploi-kiné-guadeloupe quand la route est /emploi-kine-guadeloupe.
   *  Les pages répondaient, mais le lien de /admin/diffusion et les canoniques étaient faux. */
  slug: string;
}

export const KINESITHERAPEUTE: Profession = {
  singulier: "kinésithérapeute",
  pluriel: "kinésithérapeutes",
  court: "kiné",
  discipline: "kinésithérapie",
  slug: "kine",
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

// ── Troisième axe : la PORTE, c'est-à-dire À QUI la page s'adresse (section 212) ────────
//
// POURQUOI ÇA N'EXPLOSE PAS EN MATRICE. Trois axes pourraient laisser craindre 3 professions
// × N territoires × 4 portes de textes à écrire. Ce n'est pas le cas, parce que chaque axe ne
// déclare QUE ce qui varie avec lui :
//   • Profession → le vocabulaire (4 formes du même mot) ;
//   • Territoire → le nom, la préposition, la forme courte — des données, pas des phrases ;
//   • Porte      → les phrases, écrites COMME FONCTIONS de (profession, territoire).
// La porte compose, les deux autres sont ses ingrédients. Ajouter une porte = une entrée ;
// ajouter un territoire = une entrée. Jamais un produit cartésien à maintenir.
//
// La porte CHERCHEUR délègue aux champs déjà portés par Territoire : ces textes SONT les
// siens depuis l'origine, ils y vivaient sans être nommés. On les nomme sans les réécrire —
// les trois pages géographiques, vérifiées à l'écran, ne changent pas d'un caractère.
export interface Porte {
  /** Segment d'URL, préfixe du motif {porte}-{profession}-{territoire}. */
  slug: string;
  /** Nom de la porte pour l'administration — pas affiché au public. */
  libelle: string;
  /** Sous-titre dans /admin/diffusion : à qui cette porte parle. */
  cible: string;
  titre: (p: Profession, t: Territoire) => string;
  accroche: (p: Profession, t: Territoire) => string;
  metaTitre: (p: Profession, t: Territoire) => string;
  metaDescription: (p: Profession, t: Territoire) => string;
  /** Libellé du bouton d'inscription — l'intention diffère radicalement d'une porte à l'autre. */
  cta: string;
  /** Ce que le visiteur vient chercher, sous le CTA. */
  ctaSous: string;
}

export const PORTES: Record<string, Porte> = {
  CHERCHEUR: {
    slug: "remplacement",
    libelle: "Chercheur de poste",
    cible: "Remplaçants et assistants — page principale de campagne",
    titre: titrePage,
    accroche: (p, t) => t.accroche(p),
    metaTitre: (p, t) => t.metaTitre(p),
    metaDescription: (p, t) => t.metaDescription(p),
    cta: "S'inscrire →",
    ctaSous: "Remplaçants : accès à vie, sans aucun frais.",
  },
  CABINET: {
    slug: "recrutement",
    libelle: "Cabinet",
    cible: "Cabinets libéraux qui recrutent",
    titre: (p, t) => `Je recherche un ${p.singulier} pour renforcer mon cabinet ${t.preposition} ${t.nom}`,
    accroche: (p, t) =>
      `Publiez votre poste et voyez qui s'y intéresse. Remplacement de quelques semaines, assistanat sur la durée ou collaboration libérale : vous décidez du cadre, les ${p.pluriel} disponibles ${t.preposition} ${t.nom} vous répondent sans intermédiaire.`,
    metaTitre: (p, t) => `Recruter un ${p.court} ${t.preposition} ${t.nom} — remplaçant, assistant, collaborateur | Soignect`,
    metaDescription: (p, t) =>
      `Cabinets de ${t.nom} : publiez votre recherche de ${p.singulier} et recevez des candidatures. Remplacement, assistanat, collaboration libérale — contrat CNOMK pré-rempli, sans commission sur les honoraires.`,
    cta: "Publier mon poste →",
    ctaSous: "Publication gratuite pendant la bêta.",
  },
  ETABLISSEMENT: {
    slug: "emploi",
    libelle: "Établissement",
    cible: "Hôpitaux, cliniques, EHPAD, SSR, CAMSP — recrutement salarié",
    titre: (p, t) => `Nous recrutons un ${p.singulier} pour notre établissement ${t.preposition} ${t.nom}`,
    accroche: (p, t) =>
      `CDI, CDD, vacation : publiez votre offre et touchez les ${p.pluriel} ouverts au salariat ${t.preposition} ${t.nom}. Vous décrivez le poste et la rémunération ; le contrat reste le vôtre, Soignect ne s'y substitue pas.`,
    metaTitre: (p, t) => `Recrutement ${p.court} salarié ${t.preposition} ${t.nom} — CDI, CDD, vacation | Soignect`,
    metaDescription: (p, t) =>
      `Établissements de ${t.nom} — hôpital, clinique, EHPAD, SSR, CAMSP : publiez vos postes de ${p.singulier} salarié et touchez les candidats ouverts au salariat.`,
    cta: "Publier une offre →",
    ctaSous: "Le contrat de travail relève de votre établissement.",
  },
  // La porte TERRITOIRE ne suit PAS le gabarit des trois autres — voir la page dédiée.
  // Elle est déclarée ici pour le slug, la trace et /admin/diffusion ; son contenu est un
  // argumentaire, pas un couple titre + accroche.
  TERRITOIRE: {
    slug: "territoire",
    libelle: "MSP / CPTS / territoire",
    cible: "Structures territoriales — pitch institutionnel, pas une page d'acquisition",
    titre: (p) => `Structurer l'offre de ${p.discipline} sur mon territoire`,
    accroche: (p, t) =>
      `Soignect donne à une CPTS, une MSP ou une collectivité une vue sur les postes ouverts et les tensions de recrutement en ${p.discipline} ${t.preposition} ${t.nom} — et un module à intégrer sur son propre site.`,
    metaTitre: (p, t) => `Structurer l'offre de ${p.discipline} ${t.preposition} ${t.nom} — CPTS, MSP, collectivités | Soignect`,
    metaDescription: (p, t) =>
      `CPTS, MSP et collectivités de ${t.nom} : suivez les postes de ${p.discipline} ouverts sur votre territoire et intégrez-les à votre site.`,
    cta: "Échanger sur un partenariat →",
    ctaSous: "Gratuit pour les structures territoriales pendant la bêta.",
  },
};

/** URL d'une page de diffusion — motif unique {porte}-{profession}-{territoire}. */
export function cheminPage(porte: Porte, p: Profession, t: Territoire): string {
  // La porte CHERCHEUR garde le chemin historique déclaré sur le territoire : il est indexé,
  // partagé, et cité dans les traces depuis des semaines. Le reconstruire le casserait.
  return porte.slug === "remplacement"
    ? t.chemin
    : `/${porte.slug}-${p.slug}-${slugTerritoire(t)}`;
}

/** Clé de trace — identique au chemin sans la barre initiale (convention de traceLanding). */
export function cleTracePage(porte: Porte, p: Profession, t: Territoire): string {
  return cheminPage(porte, p, t).slice(1);
}

function slugTerritoire(t: Territoire): string {
  return t.chemin.replace(/^\/remplacement-[^-]+-/, "");
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
