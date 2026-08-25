import { Profession, ProfileType, ZoneGeographique } from "@prisma/client";

/** Camp d'un annonceur. `Profile.type` est le SEUL discriminant fiable — `missionType`
 *  (REMPLACEMENT / ASSISTANAT / COLLABORATION) décrit la NATURE du poste, pas qui le publie :
 *  un cabinet cherchant un remplaçant et un remplaçant cherchant un cabinet portent tous deux
 *  `REMPLACEMENT`. Les distinguer par là aurait marché sur les libellés et faux sur le sens.
 *
 *  `EMPLOYEUR` = TITULAIRE, ce qui couvre cabinets libéraux ET structures (EHPAD, clinique) —
 *  une STRUCTURE est un TITULAIRE dont `titulaireKind` vaut STRUCTURE, jamais un type à part.
 *  `CANDIDAT` = REMPLACANT + ASSISTANT confondus : les deux camps voient l'INTÉGRALITÉ du pool
 *  d'en face, ce qui préserve le multi-préférences (un candidat publiant plusieurs types de
 *  recherche reste visible depuis les pages employeur, quel que soit leur nombre). */
export type Camp = "CANDIDAT" | "EMPLOYEUR";

const TYPES_DU_CAMP: Record<Camp, ProfileType[]> = {
  EMPLOYEUR: [ProfileType.TITULAIRE],
  CANDIDAT:  [ProfileType.REMPLACANT, ProfileType.ASSISTANT],
};

// Filtre « annonces vivantes sur un territoire » (section 208), extrait de la page de
// propagande guadeloupéenne pour être partagé avec le module embarquable.
//
// Il porte DEUX corrections apprises en production, qu'une réécriture referait à coup sûr :
//
//  1. LE PRODUIT EST PASSÉ AUX MACRO-ZONES (section 138), mais les annonces antérieures n'en
//     ont pas : elles ne portent qu'un `location` en texte libre. Ne comparer que les zones
//     écartait en silence 3 annonces actives sur 10 — dont les DEUX SEULES disponibilités de
//     remplaçants. On accepte donc les deux formes.
//
//  2. `NOT (null < maintenant)` NE VAUT PAS VRAI EN SQL. Écrire le filtre d'expiration en
//     négatif faisait disparaître toutes les annonces sans date de fin — « dès septembre »,
//     qui sont ouvertes, surtout pas périmées. 3 des 9 au moment du test.
//
//  3. LA PROFESSION EST UN PARAMÈTRE OBLIGATOIRE depuis le 17/08, et elle n'a pas de valeur
//     par défaut exprès. `Profile.profession` est un enum à 5 valeurs, modifiable par
//     l'utilisateur lui-même dans /compte, et AUCUN filtre ne le lisait nulle part : un
//     orthophoniste qui changeait sa profession serait apparu sous le titre « Postes de
//     kinésithérapie » du module embarqué sur le site d'une CPTS. Personne ne l'a vu parce
//     que les 15 profils en base sont tous KINESITHERAPEUTE — la fuite était réelle et sans
//     occurrence, c'est-à-dire invisible jusqu'au premier cas.
//     Obligatoire plutôt que défaut à KINESITHERAPEUTE : un défaut aurait refermé la fuite
//     aujourd'hui et l'aurait rouverte en silence à la première page oubliée.
//
//  4. LE CAMP EST OBLIGATOIRE depuis le 25/08, et sans valeur par défaut pour exactement la
//     même raison que la profession. Le filtre ne distinguait PAS qui avait publié : la page
//     « Je recherche un kinésithérapeute pour renforcer mon cabinet » affichait 18 annonces
//     dont l'essentiel étaient des offres D'AUTRES CABINETS — sans le moindre intérêt pour un
//     visiteur qui recrute — noyant l'unique disponibilité candidate, la seule qu'il cherchait.
//
//     RÈGLE : chaque page montre à son visiteur l'INVERSE de lui-même, jamais son propre camp.
//     C'est la même logique que `oppositeTypes` dans /api/feed, appliquée aux pages publiques
//     où elle manquait.
export function filtreAnnoncesVivantes(
  zones: ZoneGeographique[],
  communes: string[],
  profession: Profession,
  camp: Camp,
  maintenant: Date = new Date(),
) {
  return {
    isActive: true,
    // `isSelfPresence` exclu : une absence du titulaire (congés, formation) n'est pas une offre.
    // Elle passait jusqu'ici sur les pages publiques, alors que le feed l'écarte depuis
    // longtemps — même correction, un cran plus loin.
    isSelfPresence: false,
    profile: { profession, type: { in: TYPES_DU_CAMP[camp] } },
    AND: [
      { OR: [{ zones: { hasSome: zones } }, { location: { in: communes } }] },
      { OR: [{ endDate: null }, { endDate: { gte: maintenant } }] },
    ],
  };
}

// Périmètre guadeloupéen — extrait des pages de campagne, où il était recopié à l'identique.
// Les communes restent nécessaires malgré les zones : les annonces antérieures au système de
// zones n'en portent pas (voir le commentaire du filtre ci-dessus).
export const PERIMETRE_GUADELOUPE = {
  // Saint-Martin et Saint-Barthélemy en sont volontairement absentes : elles ont leurs
  // propres pages d'entrée.
  zones: [
    "CENTRE_CAP_EXCELLENCE", "SUD_GRANDE_TERRE", "NORD_GRANDE_TERRE", "SUD_BASSE_TERRE",
    "NORD_BASSE_TERRE", "MARIE_GALANTE", "LES_SAINTES", "LA_DESIRADE",
  ] as ZoneGeographique[],
  communes: [
    "Pointe-à-Pitre", "Les Abymes", "Baie-Mahault", "Le Gosier", "Sainte-Anne",
    "Saint-François", "Le Moule", "Morne-à-l'Eau", "Anse-Bertrand", "Port-Louis",
    "Petit-Canal", "Basse-Terre", "Gourbeyre", "Baillif", "Saint-Claude", "Vieux-Fort",
    "Capesterre-Belle-Eau", "Trois-Rivières", "Vieux-Habitants", "Bouillante",
    "Pointe-Noire", "Deshaies", "Sainte-Rose", "Lamentin", "Petit-Bourg", "Goyave",
    "Grand-Bourg (Marie-Galante)", "Capesterre-de-Marie-Galante", "Saint-Louis (Marie-Galante)",
    "La Désirade", "Terre-de-Haut (Les Saintes)", "Terre-de-Bas (Les Saintes)",
  ],
};
