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

import { ZoneGeographique } from "@prisma/client";
import { KINESITHERAPEUTE, type Profession } from "@/lib/pagesDiffusion";

export interface InstanceEmbed {
  /** Segment d'URL — `/embed/territoire/{slug}`. Déclaré, jamais dérivé du nom de la zone :
   *  `NORD_BASSE_TERRE` → `nord-basse-terre` marcherait ici et casserait sur une zone dont les
   *  deux formes divergent. Même règle que le slug de profession (14/08). */
  slug: string;
  zone: ZoneGeographique;
  /** Page de campagne vers laquelle le module renvoie, hors iframe. */
  page: string;
  /** Profession affichée ET filtrée — les deux doivent rester d'accord, sans quoi le titre
   *  contredirait la liste (défaut trouvé le 14/08). */
  profession: Profession;
  /** Nom de l'institution destinataire, pour l'écran d'administration. Purement descriptif :
   *  aucune logique ne le lit, et il n'est PAS relié à `ClientInstitutionnel` — le module
   *  embarquable ne dépend d'aucune relation client, il liste des annonces publiques. */
  destinataire: string;
}

export const INSTANCES_EMBED: InstanceEmbed[] = [
  {
    slug: "nord-basse-terre",
    zone: ZoneGeographique.NORD_BASSE_TERRE,
    page: "/remplacement-kine-guadeloupe",
    profession: KINESITHERAPEUTE,
    destinataire: "CPTS Nord Basse-Terre",
  },
];

/** Indexé par slug — ce dont la page a besoin pour résoudre son paramètre d'URL. */
export const EMBED_PAR_SLUG: Record<string, InstanceEmbed> = Object.fromEntries(
  INSTANCES_EMBED.map((i) => [i.slug, i]),
);

export const cheminEmbed = (i: InstanceEmbed) => `/embed/territoire/${i.slug}`;
/** Clé de trace — même motif que `cleTracePage`, pour que `/admin/diffusion` agrège pareil. */
export const cleTraceEmbed = (i: InstanceEmbed) => `embed-${i.slug}`;
