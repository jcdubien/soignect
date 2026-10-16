import { prisma } from "@/lib/prisma";
import { BriqueStatus } from "@prisma/client";

// Le candidat est-il libre sur les dates d'un poste qu'il retient ? (15/10, demande de JC)
//
// LE PROBLÈME. Un « Intéressé » sur un remplacement du 28/12 au 08/01 était enregistré quel que
// soit le planning du candidat : déjà pris ces jours-là par un remplacement signé, ou ayant
// bloqué ces dates, il signalait quand même son intérêt — et le cabinet découvrait l'impossibilité
// dans la conversation. À l'inverse, libre mais sans disponibilité publiée sur ces dates, il
// n'apparaissait dans le fil d'aucun recruteur : son intérêt ne pouvait pas recevoir de réponse.
//
// LA RÈGLE, lue sur le planning du candidat (ses propres briques) :
//   · OCCUPÉ = remplacement signé (`CONFIRME`) ou dates bloquées (`INDISPONIBLE`). Une relation
//     en attente n'occupe rien : rien n'est conclu, et plusieurs peuvent coexister.
//   · COUVERT = disponibilité publiée (`RECHERCHE`, datée, active).
// La période du poste moins les jours occupés donne les jours LIBRES ; les jours libres moins
// les jours couverts, ceux qu'il reste à publier.
//
// Jours CIVILS inclusifs, en texte AAAA-MM-JJ. Les dates sont stockées à 00:00 UTC : les lire en
// UTC est la seule lecture qui ne recule pas d'un jour à l'ouest de Greenwich (section 288).

import {
  evaluerDisponibilite, jourIso, type Disponibilite,
} from "@/lib/disponibilitePure";
export * from "@/lib/disponibilitePure";

/**
 * Disponibilité du candidat `profileId` sur la période d'une annonce. `null` quand l'annonce n'a
 * pas de période fermée (poste durable « dès septembre ») : il n'y a rien à vérifier.
 *
 * Une période déjà commencée n'est examinée qu'à partir d'aujourd'hui : on ne peut ni se
 * proposer ni être pris sur des jours passés.
 */
export async function disponibiliteSurPeriode(
  profileId: string,
  annonce: { startDate: Date | null; endDate: Date | null },
  maintenant: Date = new Date(),
): Promise<Disponibilite | null> {
  if (!annonce.startDate || !annonce.endDate) return null;
  const aujourdhui = jourIso(maintenant);
  const debut = jourIso(annonce.startDate);
  const periode = { debut: debut < aujourdhui ? aujourdhui : debut, fin: jourIso(annonce.endDate) };
  if (periode.fin < periode.debut) return null;

  const briques = await prisma.mission.findMany({
    where: {
      profileId,
      isActive: true,
      briqueStatus: { in: [BriqueStatus.CONFIRME, BriqueStatus.INDISPONIBLE, BriqueStatus.RECHERCHE] },
      startDate: { lte: annonce.endDate },
      endDate: { gte: new Date(`${periode.debut}T00:00:00Z`) },
    },
    select: { briqueStatus: true, startDate: true, endDate: true },
  });
  return evaluerDisponibilite(periode, briques);
}

