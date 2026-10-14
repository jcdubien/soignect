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

import { MissionType, Profession as ProfessionDb } from "@prisma/client";
import type { Camp } from "@/lib/annoncesTerritoire";
import { missionTypesPour } from "@/lib/contrats/gabarits";

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
  /** La valeur de l'enum `Profession` de Prisma que ce vocabulaire désigne — le lien entre les
   *  MOTS d'une page et les PROFILS qu'elle doit montrer. Déclaré pour la même raison que
   *  `slug` : le nom d'affichage (« kinésithérapeute ») et la valeur en base
   *  (`KINESITHERAPEUTE`) coïncident ici par hasard, pas par règle — les dériver l'un de
   *  l'autre marcherait aujourd'hui et casserait en silence à la première profession dont les
   *  deux formes divergent. */
  enumBase: ProfessionDb;
  /** « un kinésithérapeute » — l'article ne se compose pas : « un » ici, « une » ailleurs. */
  unSingulier: string;
  /** « de kinésithérapeute », mais « d'infirmier » : l'élision ne se compose pas non plus. */
  deSingulier: string;
  /** « de kiné », mais « d'infirmier ». */
  deCourt: string;
  /** Le modèle de contrat que la plateforme pré-remplit, nommé comme le connaît la profession. */
  contratPreRempli: string;
}

export const KINESITHERAPEUTE: Profession = {
  singulier: "kinésithérapeute",
  pluriel: "kinésithérapeutes",
  court: "kiné",
  discipline: "kinésithérapie",
  slug: "kine",
  enumBase: ProfessionDb.KINESITHERAPEUTE,
  unSingulier: "un kinésithérapeute",
  deSingulier: "de kinésithérapeute",
  deCourt: "de kiné",
  contratPreRempli: "contrat CNOMK pré-rempli",
};

export const INFIRMIER: Profession = {
  singulier: "infirmier",
  pluriel: "infirmiers",
  court: "infirmier",
  discipline: "soins infirmiers",
  slug: "infirmier",
  enumBase: ProfessionDb.INFIRMIER,
  unSingulier: "un infirmier",
  deSingulier: "d'infirmier",
  deCourt: "d'infirmier",
  contratPreRempli: "contrat de l'Ordre des infirmiers pré-rempli",
};

// ── LES TYPES DE POSTE SE DÉRIVENT DES CONTRATS, ILS NE S'ÉCRIVENT PAS (section 299) ────────
//
// Les textes nommaient « assistanat » en dur. L'assistanat n'existe pas chez les infirmiers
// (gabarits infirmier du 27/08 : aucun modèle de l'Ordre), et la page aurait promis un poste qu'aucun formulaire
// ne permet de publier. La source est le registre des gabarits — la même que le formulaire de
// création d'annonce : une page ne peut pas annoncer un type que l'écran de publication refuse.
function proposeAssistanat(p: Profession): boolean {
  return missionTypesPour(p.enumBase).includes(MissionType.ASSISTANAT);
}
/** « Remplacement de quelques semaines, assistanat sur la durée ou collaboration libérale ». */
function formesDuPoste(p: Profession): string {
  return proposeAssistanat(p)
    ? "Remplacement de quelques semaines, assistanat sur la durée ou collaboration libérale"
    : "Remplacement de quelques semaines ou collaboration libérale";
}
/** « Remplacement, assistanat, collaboration libérale ». */
function listeTypes(p: Profession): string {
  return proposeAssistanat(p)
    ? "Remplacement, assistanat, collaboration libérale"
    : "Remplacement, collaboration libérale";
}
/** « remplaçant, assistant, collaborateur ». */
function listePersonnes(p: Profession): string {
  return proposeAssistanat(p) ? "remplaçant, assistant, collaborateur" : "remplaçant, collaborateur";
}

/** Vocabulaire DÉCLARÉ, indexé par valeur d'enum. Partiel à dessein : une profession absente
 *  d'ici n'a pas de vocabulaire, et rien ne doit lui en inventer un.
 *
 *  Sert à afficher un libellé lisible là où le produit manipule l'enum brute (écrans admin).
 *  `libelleProfession` rend la valeur d'enum telle quelle quand rien n'est déclaré — délibéré :
 *  voir « SAGE_FEMME » dans une liste déroulante SIGNALE que sa déclaration manque, là où un
 *  « Sage-femme » fabriqué par translittération l'aurait masqué. Même raisonnement que le slug
 *  d'URL déclaré plutôt que dérivé (14/08) : ce qui n'a pas été décidé doit se voir. */
export const VOCABULAIRE_PROFESSION: Partial<Record<ProfessionDb, Profession>> = {
  [ProfessionDb.KINESITHERAPEUTE]: KINESITHERAPEUTE,
  [ProfessionDb.INFIRMIER]: INFIRMIER,
};

export function libelleProfession(valeur: ProfessionDb): string {
  const declare = VOCABULAIRE_PROFESSION[valeur];
  if (!declare) return valeur;
  return declare.singulier.charAt(0).toUpperCase() + declare.singulier.slice(1);
}

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
  return `Je souhaite organiser mon temps d'activité ${p.deSingulier} ${t.preposition} ${t.nom}`;
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
  /** Image de partage (section 300) : titre COURT — l'image en a 600 px utiles, recadrée au carré
   *  par certaines destinations — et une phrase. */
  ogTitre: (p: Profession, t: Territoire) => string;
  ogSousTitre: (p: Profession, t: Territoire) => string;
  /** Vrai pour les structures qui pilotent un territoire ou des besoins durables — CPTS, MSP,
   *  établissements : la page leur présente l'offre partenaire (section 301). Un cabinet libéral
   *  ou un candidat n'y est pas concerné. */
  offrePartenaire: boolean;
  /** Le camp des annonces que cette porte AFFICHE — l'inverse de son visiteur, jamais le sien.
   *  Déclaré par porte plutôt que dérivé : ajouter une porte oblige à trancher à qui elle parle,
   *  au lieu de laisser un défaut décider en silence. */
  montre: Camp;
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
    ogTitre: (p, t) => `Postes ${p.deCourt} ${t.preposition} ${t.nom}`,
    ogSousTitre: (p, t) =>
      `${proposeAssistanat(p) ? "Remplacements, assistanats et collaborations" : "Remplacements et collaborations"} ${t.preposition} ${t.nom}. Gratuit pour qui cherche un poste.`,
    /** un chercheur de poste vient voir des POSTES, pas d'autres candidats. */
    montre: "EMPLOYEUR",
    offrePartenaire: false,
  },
  CABINET: {
    slug: "recrutement",
    libelle: "Cabinet",
    cible: "Cabinets libéraux qui recrutent",
    titre: (p, t) => `Je recherche ${p.unSingulier} pour renforcer mon cabinet ${t.preposition} ${t.nom}`,
    accroche: (p, t) =>
      `Publiez votre poste et voyez qui s'y intéresse. ${formesDuPoste(p)} : vous décidez du cadre, les ${p.pluriel} disponibles ${t.preposition} ${t.nom} vous répondent sans intermédiaire.`,
    metaTitre: (p, t) => `Recruter un ${p.court} ${t.preposition} ${t.nom} — ${listePersonnes(p)} | Soignect`,
    metaDescription: (p, t) =>
      `Cabinets de ${t.nom} : publiez votre recherche ${p.deSingulier} et recevez des candidatures. ${listeTypes(p)} — ${p.contratPreRempli}, sans commission sur les honoraires.`,
    cta: "Publier mon poste →",
    ctaSous: "Publication gratuite pendant la bêta.",
    ogTitre: (p, t) => `Recruter ${p.unSingulier} ${t.preposition} ${t.nom}`,
    ogSousTitre: (p) => `${formesDuPoste(p)} : publiez votre poste, les ${p.pluriel} disponibles vous répondent.`,
    /** un cabinet qui recrute vient voir des CANDIDATS, pas les annonces d'autres cabinets. */
    montre: "CANDIDAT",
    offrePartenaire: false,
  },
  ETABLISSEMENT: {
    slug: "emploi",
    libelle: "Établissement",
    cible: "Hôpitaux, cliniques, EHPAD, SSR, CAMSP — recrutement salarié",
    titre: (p, t) => `Nous recrutons ${p.unSingulier} pour notre établissement ${t.preposition} ${t.nom}`,
    accroche: (p, t) =>
      `CDI, CDD, vacation : publiez votre offre et touchez les ${p.pluriel} ouverts au salariat ${t.preposition} ${t.nom}. Vous décrivez le poste et la rémunération ; le contrat reste le vôtre, Soignect ne s'y substitue pas.`,
    metaTitre: (p, t) => `Recrutement ${p.court} salarié ${t.preposition} ${t.nom} — CDI, CDD, vacation | Soignect`,
    metaDescription: (p, t) =>
      `Établissements de ${t.nom} — hôpital, clinique, EHPAD, SSR, CAMSP : publiez vos postes ${p.deSingulier} salarié et touchez les candidats ouverts au salariat.`,
    cta: "Publier une offre →",
    ctaSous: "Le contrat de travail relève de votre établissement.",
    ogTitre: (p) => `Recrutement ${p.court} salarié`,
    ogSousTitre: (p) => `Hôpitaux, cliniques, EHPAD, SSR : vos offres en CDI, CDD ou vacation, présentées aux ${p.pluriel} ouverts au salariat.`,
    /** meme raison que la porte CABINET : un employeur vient voir qui est disponible. */
    montre: "CANDIDAT",
    offrePartenaire: true,
  },
  // Une MSP recrute comme un cabinet — même camp montré, mêmes types de poste — mais elle a un
  // argument qu'un cabinet isolé n'a pas : l'exercice coordonné. La case existe sur l'annonce
  // (section 190) et compte dans le score de compatibilité d'un candidat qui la recherche
  // (`rechercheExerciceCoordonne`). On ne promet RIEN de plus : ni badge sur la carte, ni
  // meilleur rang dans le fil — le fil trie sur la désirabilité, pas sur ce critère.
  MAISON_DE_SANTE: {
    slug: "maison-de-sante",
    libelle: "Maison de santé (MSP)",
    cible: "Maisons de santé pluriprofessionnelles qui recrutent — exercice coordonné",
    titre: (p, t) => `Notre maison de santé cherche ${p.unSingulier} ${t.preposition} ${t.nom}`,
    accroche: (p, t) =>
      `${formesDuPoste(p)} : publiez le poste de votre MSP et cochez « exercice coordonné ». Les ${p.pluriel} disponibles ${t.preposition} ${t.nom} vous répondent sans intermédiaire, et le score de compatibilité en tient compte pour ceux qui recherchent ce mode d'exercice.`,
    metaTitre: (p, t) => `Maison de santé ${t.preposition} ${t.nom} : recruter un ${p.court} — ${listePersonnes(p)} | Soignect`,
    metaDescription: (p, t) =>
      `MSP de ${t.nom} : publiez vos postes ${p.deSingulier} et signalez l'exercice coordonné. ${listeTypes(p)} — ${p.contratPreRempli}, sans commission sur les honoraires.`,
    cta: "Publier le poste de la MSP →",
    ctaSous: "Publication gratuite pendant la bêta.",
    ogTitre: (p) => `Votre maison de santé recrute ${p.unSingulier}`,
    ogSousTitre: (p) => `${formesDuPoste(p)}. Publiez le poste et signalez l'exercice coordonné.`,
    /** même camp que la porte CABINET : une MSP qui recrute vient voir qui est disponible. */
    montre: "CANDIDAT",
    offrePartenaire: true,
  },
  // La porte TERRITOIRE ne suit PAS le gabarit des trois autres — voir la page dédiée.
  // Elle est déclarée ici pour le slug, la trace et /admin/diffusion ; son contenu est un
  // argumentaire, pas un couple titre + accroche.
  TERRITOIRE: {
    slug: "territoire",
    // Les MSP ont leur propre porte depuis la section 299 : celle-ci parle aux CPTS et aux
    // collectivités, qui pilotent une offre de soins sans recruter elles-mêmes.
    libelle: "CPTS / territoire",
    cible: "CPTS et collectivités — pitch institutionnel, pas une page d'acquisition",
    titre: (p) => `Structurer l'offre de ${p.discipline} sur mon territoire`,
    accroche: (p, t) =>
      `Soignect donne à une CPTS ou à une collectivité une vue sur les postes ouverts et les tensions de recrutement en ${p.discipline} ${t.preposition} ${t.nom} — et un module à intégrer sur son propre site.`,
    metaTitre: (p, t) => `Structurer l'offre de ${p.discipline} ${t.preposition} ${t.nom} — CPTS, collectivités | Soignect`,
    metaDescription: (p, t) =>
      `CPTS et collectivités de ${t.nom} : suivez les postes de ${p.discipline} ouverts sur votre territoire et intégrez-les à votre site.`,
    cta: "Échanger sur un partenariat →",
    // La consultation reste gratuite ; la mise en avant des zones est l'offre partenaire, payante
    // (section 301). L'ancienne phrase — « gratuit pendant la bêta » — couvrait les deux.
    ctaSous: "Consultation gratuite pendant la bêta. Mise en avant de vos zones : offre partenaire.",
    ogTitre: (p) => `Structurer l'offre de ${p.discipline}`,
    ogSousTitre: () => "CPTS et collectivités : vos zones en tension mises en avant, les postes ouverts, un module pour votre site.",
    /** la page compte les POSTES OUVERTS du territoire, ce qu'elle dit d'ailleurs en toutes lettres. */
    montre: "EMPLOYEUR",
    offrePartenaire: true,
  },
};

/** URL d'une page de diffusion — motif unique {porte}-{profession}-{territoire}. */
export function cheminPage(porte: Porte, p: Profession, t: Territoire): string {
  // La porte CHERCHEUR garde le chemin historique déclaré sur le territoire : il est indexé,
  // partagé, et cité dans les traces depuis des semaines. Le reconstruire le casserait.
  // Ce chemin historique est celui des KINÉS : une autre profession suit le motif commun.
  return porte.slug === "remplacement" && p.enumBase === ProfessionDb.KINESITHERAPEUTE
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
      `Soignect est le job board des ${p.pluriel} de Guadeloupe. ${proposeAssistanat(p) ? "Une mission de quelques semaines, un assistanat sur la durée ou une collaboration libérale" : "Une mission de quelques semaines ou une collaboration libérale"} : cabinets et candidats se trouvent en quelques swipes, sans intermédiaire. Gratuit pour qui cherche un poste.`,
    metaTitre: (p) => `${proposeAssistanat(p) ? "Remplacement, assistanat, collaboration" : "Remplacement, collaboration"} ${p.court} en Guadeloupe | Soignect`,
    metaDescription: (p) =>
      `Postes de ${p.discipline} en Guadeloupe : ${proposeAssistanat(p) ? "remplacements ponctuels, assistanats et collaborations libérales" : "remplacements ponctuels et collaborations libérales"}. Annonces de cabinets et ${p.pluriel} disponibles sur toute la Guadeloupe (Grande-Terre, Basse-Terre, Marie-Galante, Les Saintes, La Désirade).`,
    ogTitre: (p) => `Postes ${p.deCourt} en Guadeloupe | Soignect`,
    ogDescription: (p) =>
      `Le job board des ${p.pluriel} de Guadeloupe : ${proposeAssistanat(p) ? "remplacement, assistanat, collaboration" : "remplacement, collaboration"}. Trouvez un cabinet ou un candidat en quelques swipes.`,
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

// ── LES PAGES RÉELLEMENT SERVIES (section 299) ─────────────────────────────────────────────
//
// Chaque entrée correspond à une route sous src/app. Le sitemap et /admin/diffusion la lisent :
// une page ajoutée ici est indexée et suivie sans qu'on ait à s'en souvenir ailleurs. L'oubli
// inverse — une route sans entrée — reste possible, mais il se voit : la page n'apparaît pas
// dans l'administration.
export interface PagePubliee {
  porte: Porte;
  profession: Profession;
  territoire: Territoire;
}

export const PAGES_PUBLIEES: PagePubliee[] = [
  // Les pages historiques des kinés, sur les trois territoires.
  ...Object.values(TERRITOIRES).map((territoire) => ({ porte: PORTES.CHERCHEUR, profession: KINESITHERAPEUTE, territoire })),
  ...[PORTES.CABINET, PORTES.ETABLISSEMENT, PORTES.MAISON_DE_SANTE, PORTES.TERRITOIRE].map((porte) => ({
    porte, profession: KINESITHERAPEUTE, territoire: TERRITOIRES.GUADELOUPE,
  })),
  // Infirmiers : Guadeloupe seule, et pas de porte TERRITOIRE — sa page compte les postes
  // ouverts par zone, et une CPTS se voit proposer la page commune, pas une page par métier.
  ...[PORTES.CHERCHEUR, PORTES.CABINET, PORTES.ETABLISSEMENT, PORTES.MAISON_DE_SANTE].map((porte) => ({
    porte, profession: INFIRMIER, territoire: TERRITOIRES.GUADELOUPE,
  })),
];

/** Métadonnées d'une page composée par PagePorte — titre, description, canonique, Open Graph. */
export function metadonneesPage(porte: Porte, p: Profession, t: Territoire) {
  const chemin = cheminPage(porte, p, t);
  return {
    alternates: { canonical: chemin },
    title: porte.metaTitre(p, t),
    description: porte.metaDescription(p, t),
    openGraph: { url: chemin, title: porte.metaTitre(p, t), description: porte.metaDescription(p, t), type: "website" as const },
  };
}
