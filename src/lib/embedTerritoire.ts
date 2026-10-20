// Registre des instances du module embarquable (section 208).
//
// POURQUOI CE FICHIER EXISTE, PLUTÔT QUE LA CONSTANTE DANS LA PAGE
// Le registre vivait dans `src/app/embed/territoire/[zone]/page.tsx`. Il y était déjà bien
// formé — ajouter une zone = ajouter une entrée — mais il n'était visible que d'elle. Résultat :
// `/admin/diffusion` codait l'entrée « nord-basse-terre » à la main (chemin, titre, clé de
// trace), alors que le reste de ce fichier est DÉRIVÉ du module de portes depuis le 14/08,
// précisément pour fermer le risque de pages découvertes après coup.
//
// Une deuxième CPTS aurait donc marché côté module et disparu côté admin — visible nulle part,
// sauf à connaître l'URL. C'est le même défaut que Saint-Martin/Saint-Barth en juillet.
//
// AJOUTER UNE CPTS = UNE ENTRÉE ICI. La page et l'écran d'administration s'alignent seuls.
//
// CE MODULE N'OUVRE RIEN : une seule zone est déclarée, aucune autre ne s'active. Il rend
// interrogeable ce qui était déjà là — même intention que `pagesDiffusion` et
// `FENETRE_TENSION_GUADELOUPE`.

import { Profession, ZoneGeographique } from "@prisma/client";

export interface InstanceEmbed {
  /** Segment d'URL — `/embed/territoire/{slug}`. Déclaré, jamais dérivé du nom de la zone :
   *  `NORD_BASSE_TERRE` → `nord-basse-terre` marcherait ici et casserait sur une zone dont les
   *  deux formes divergent. Même règle que le slug de profession (14/08). */
  slug: string;
  zone: ZoneGeographique;
  /** Professions affichées ET filtrées — les deux doivent rester d'accord, sans quoi le titre
   *  contredirait la liste (défaut trouvé le 14/08). Le 15/10, la CPTS Nord Basse-Terre passe
   *  de « kinés seulement » à toutes les professions déclarées : une CPTS pilote toute l'offre
   *  de soins de son territoire (même raison que la page territoire, section 302). Le module
   *  ne renvoie plus vers une page de campagne kiné, mais vers l'inscription — il n'existe pas
   *  de page publique commune à toutes les professions.
   *  Le 20/10, « toutes les professions » cesse de vouloir dire « celles qui ont un vocabulaire
   *  de campagne » (kinés, infirmiers, aides-soignants) : les priorités de la CPTS suivent
   *  l'APL de chaque profession, et la moitié d'entre elles portent sur des médecins
   *  généralistes et des sages-femmes, qui s'inscrivent déjà. Le module les filtrait. */
  professions: Profession[];
  /** Nom de l'institution destinataire, tel qu'affiché (écran d'administration, module). */
  destinataire: string;
  /** `ClientInstitutionnel.nom` de cette institution — relie le module à ses zones prioritaires
   *  déclarées (15/10). Le module listait jusque-là des annonces à plat, sans rien de propre à
   *  la CPTS qui l'héberge. Facultatif : sans relation client active, aucune priorité ne
   *  s'affiche et le module reste une liste — on ne met pas en avant ce que personne n'a
   *  déclaré. */
  clientNom?: string;
}

export const INSTANCES_EMBED: InstanceEmbed[] = [
  {
    slug: "nord-basse-terre",
    zone: ZoneGeographique.NORD_BASSE_TERRE,
    professions: Object.values(Profession),
    destinataire: "CPTS Nord Basse-Terre",
    clientNom: "CPTS Nord Basse-Terre",
  },
];

/** Indexé par slug — ce dont la page a besoin pour résoudre son paramètre d'URL. */
export const EMBED_PAR_SLUG: Record<string, InstanceEmbed> = Object.fromEntries(
  INSTANCES_EMBED.map((i) => [i.slug, i]),
);

export const cheminEmbed = (i: InstanceEmbed) => `/embed/territoire/${i.slug}`;
/** Clé de trace — même motif que `cleTracePage`, pour que `/admin/diffusion` agrège pareil. */
export const cleTraceEmbed = (i: InstanceEmbed) => `embed-${i.slug}`;
