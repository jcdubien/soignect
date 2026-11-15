import { prisma } from "@/lib/prisma";
import { BriqueStatus, MissionType } from "@prisma/client";

// Règles qu'une annonce doit respecter pour vivre sur la ligne d'un poste du Planning.
//
// Deux chemins y mènent : la publication depuis un poste (POST /api/missions) et le rattachement
// a posteriori d'une annonce publiée sans poste (PUT /api/missions/[id]/poste, 15/11). Les règles
// vivaient dans la seule route de création : un rattachement après coup qui ne les rejouerait pas
// serait un contournement — un assistanat posé sur le siège du titulaire, une brique sans date
// donc invisible, deux remplaçants recrutés pour la même absence.

/** Le SIÈGE du titulaire n'accueille que du remplacement (section 191). */
export async function refusSiegeTitulaire(
  cabinetPostId: string,
  missionType: MissionType | null | undefined,
): Promise<string | null> {
  if (!missionType || missionType === MissionType.REMPLACEMENT) return null;
  const poste = await prisma.cabinetPost.findUnique({
    where: { id: cabinetPostId },
    select: { isOwnerSeat: true },
  });
  if (!poste?.isOwnerSeat) return null;
  return "Le poste du titulaire ne peut accueillir qu'un remplacement. Pour recruter un assistant, créez d'abord un poste dédié dans le Planning, puis publiez la demande depuis sa ligne.";
}

/**
 * Une annonce EN RECHERCHE rattachée à un poste DOIT avoir une date de début : c'est elle qui
 * positionne la brique sur la ligne (MissionBrick ne rend rien sans startDate).
 */
export function refusSansDateDebut(
  briqueStatus: BriqueStatus,
  startDate: Date | null | undefined,
): string | null {
  if (briqueStatus !== BriqueStatus.RECHERCHE || startDate) return null;
  return "Renseignez la date de prise de poste : sans elle, l'annonce n'apparaîtrait pas sur votre planning.";
}

/**
 * Anti-doublon de couverture : une annonce de remplacement ACTIVE couvrant déjà une période qui
 * se chevauche sur ce poste. Limité au REMPLACEMENT — un assistanat long terme et un remplacement
 * ponctuel se chevauchent légitimement.
 */
export async function doublonRemplacement(args: {
  cabinetPostId: string;
  missionType: MissionType | null | undefined;
  startDate: Date | null | undefined;
  endDate: Date | null | undefined;
  /** L'annonce elle-même, au rattachement : elle ne peut pas être son propre doublon. */
  saufMissionId?: string;
}) {
  const { cabinetPostId, missionType, startDate, endDate, saufMissionId } = args;
  if (missionType !== MissionType.REMPLACEMENT || !startDate || !endDate) return null;
  return prisma.mission.findFirst({
    where: {
      cabinetPostId,
      isActive: true,
      missionType: MissionType.REMPLACEMENT,
      briqueStatus: BriqueStatus.RECHERCHE,
      startDate: { lte: endDate },
      endDate: { gte: startDate },
      ...(saufMissionId ? { id: { not: saufMissionId } } : {}),
    },
    select: { id: true, title: true, startDate: true, endDate: true, profileId: true },
  });
}

/** Message du refus pour doublon, identique sur les deux chemins. */
export function messageDoublon(d: { title: string; startDate: Date | null; endDate: Date | null }) {
  const jour = (x: Date | null) => (x ? x.toISOString().slice(0, 10).split("-").reverse().join("/") : "?");
  return `Une annonce de remplacement couvre déjà cette période sur ce poste : « ${d.title} » (${jour(d.startDate)} → ${jour(d.endDate)}). Modifiez-la ou retirez-la plutôt que d'en publier une seconde.`;
}
