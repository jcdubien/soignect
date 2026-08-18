import { Profession, ZoneGeographique } from "@prisma/client";

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
export function filtreAnnoncesVivantes(
  zones: ZoneGeographique[],
  communes: string[],
  profession: Profession,
  maintenant: Date = new Date(),
) {
  return {
    isActive: true,
    profile: { profession },
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
