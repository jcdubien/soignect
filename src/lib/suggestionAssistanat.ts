import { prisma } from "@/lib/prisma";
import { MissionType, ProfileType, SwipeDirection } from "@prisma/client";

// Section 191 — Repérer les remplaçants qui manifestent déjà un intérêt pour le long terme.
//
// LE SIGNAL EST OBSERVÉ, PAS DEVINÉ. On ne cherche pas qui « pourrait vouloir se poser » :
// on regarde qui a DÉJÀ dit oui à des postes d'assistanat ou de collaboration. Sur les données
// réelles, un remplaçant avait swipé à droite sur trois postes long terme en six swipes —
// la moitié de son activité — sans que rien ne le lui renvoie.
//
// L'hypothèse de départ (« repérer ceux qui n'ont jamais consulté d'assistanat ») ne tenait
// pas : le feed ne filtre pas par type de mission, tous les candidats voient déjà ces postes,
// et les deux remplaçants en base en avaient déjà swipé. Le manque n'est pas la découverte,
// c'est que l'intérêt exprimé ne mène nulle part.
export const SEUIL_INTERETS = 2;

export async function suggestionAssistanat(profileId: string): Promise<number | null> {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { type: true, suggestionAssistanatVueAt: true },
  });
  // Un assistant n'a rien à découvrir ici, et une suggestion écartée le reste (colonne portée
  // par le Profile, donc d'un appareil à l'autre).
  if (!profile || profile.type !== ProfileType.REMPLACANT) return null;
  if (profile.suggestionAssistanatVueAt) return null;

  const interets = await prisma.swipe.count({
    where: {
      swiperId: profileId,
      direction: SwipeDirection.RIGHT,
      swipedMission: { missionType: { in: [MissionType.ASSISTANAT, MissionType.COLLABORATION] } },
    },
  });
  return interets >= SEUIL_INTERETS ? interets : null;
}
