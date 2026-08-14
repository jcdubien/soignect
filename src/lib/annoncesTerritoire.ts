import { ZoneGeographique } from "@prisma/client";

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
export function filtreAnnoncesVivantes(
  zones: ZoneGeographique[],
  communes: string[],
  maintenant: Date = new Date(),
) {
  return {
    isActive: true,
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
