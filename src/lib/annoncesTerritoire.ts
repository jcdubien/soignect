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
