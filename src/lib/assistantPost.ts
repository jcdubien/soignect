import { prisma } from "@/lib/prisma";
import { PostType, MissionType, ProfileType } from "@prisma/client";

// Rattachement compte ASSISTANT ↔ CabinetPost (section 153). Un assistant placé dans un
// cabinet devient « double casquette » : rattaché à un poste du Planning, il peut gérer sa
// propre couverture. Helpers réutilisés par la signature (auto), l'annulation de match
// (détach) et le rattachement manuel. Aucun ne jette : ne bloque jamais le flux appelant.

// Rattachement AUTOMATIQUE à la signature d'un contrat ASSISTANAT (point 1).
// - Si la mission du cabinet est déjà liée à un CabinetPost → on y pose linkedUserId.
// - Sinon → on crée un CabinetPost (nommé d'après l'assistant, postType ASSISTANT) et on
//   y rattache le compte + la mission d'occupation.
export async function attachAssistantPostForMatch(matchId: string): Promise<void> {
  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        profileAId: true, profileBId: true,
        profileA: { select: { type: true, name: true, userId: true } },
        profileB: { select: { type: true, name: true, userId: true } },
        missionA: { select: { id: true, missionType: true, cabinetPostId: true } },
        missionB: { select: { id: true, missionType: true, cabinetPostId: true } },
      },
    });
    if (!match) return;

    // Contrats longue durée (ASSISTANAT ou COLLABORATION, section 154 — collaborateur = même
    // statut que l'assistant) entre un TITULAIRE et un candidat ASSISTANT.
    const type = match.missionA?.missionType ?? match.missionB?.missionType;
    if (type !== MissionType.ASSISTANAT && type !== MissionType.COLLABORATION) return;

    const aIsTitulaire = match.profileA.type === ProfileType.TITULAIRE;
    const cabinet   = aIsTitulaire ? match.profileA : match.profileB;
    const assistant = aIsTitulaire ? match.profileB : match.profileA;
    const cabinetId = aIsTitulaire ? match.profileAId : match.profileBId;
    const cabinetMission = aIsTitulaire ? match.missionA : match.missionB;

    // Sécurité : l'autre partie doit bien être un ASSISTANT (sinon on ne rattache rien).
    if (cabinet.type !== ProfileType.TITULAIRE || assistant.type !== ProfileType.ASSISTANT) return;
    const assistantUserId = assistant.userId;

    // Un compte ne peut être rattaché qu'à UN poste : on détache d'abord un éventuel poste
    // précédent de cet assistant (il change de cabinet).
    await prisma.cabinetPost.updateMany({
      where: { linkedUserId: assistantUserId },
      data: { linkedUserId: null },
    });

    if (cabinetMission?.cabinetPostId) {
      // Le poste existe déjà (créé via le Planning) → simple rattachement.
      await prisma.cabinetPost.update({
        where: { id: cabinetMission.cabinetPostId },
        data: { linkedUserId: assistantUserId },
      });
    } else {
      // Pas de poste → on en crée un, nommé d'après l'assistant (même convention que la
      // création manuelle : le label porte le nom de l'occupant), et on y lie la mission.
      const post = await prisma.cabinetPost.create({
        data: {
          cabinetId,
          label: assistant.name ?? "Assistant",
          postType: type === MissionType.COLLABORATION ? PostType.COLLABORATION : PostType.ASSISTANT,
          linkedUserId: assistantUserId,
        },
      });
      if (cabinetMission?.id) {
        await prisma.mission.update({
          where: { id: cabinetMission.id },
          data: { cabinetPostId: post.id },
        });
      }
    }
  } catch (e) {
    console.error("[assistantPost] rattachement auto échoué (ignoré):", e);
  }
}

// Détachement lié à un match (point 3) — appelé à l'annulation de match (section 145).
// Détache le poste du cabinet concerné rattaché à l'assistant de ce match.
export async function detachAssistantPostForMatch(match: {
  profileAId: string; profileBId: string;
  profileA: { type: ProfileType; userId: string };
  profileB: { type: ProfileType; userId: string };
}): Promise<void> {
  try {
    const aIsTitulaire = match.profileA.type === ProfileType.TITULAIRE;
    const cabinetId = aIsTitulaire ? match.profileAId : match.profileBId;
    const assistant = aIsTitulaire ? match.profileB : match.profileA;
    if (assistant.type !== ProfileType.ASSISTANT) return;

    await prisma.cabinetPost.updateMany({
      where: { cabinetId, linkedUserId: assistant.userId },
      data: { linkedUserId: null },
    });
  } catch (e) {
    console.error("[assistantPost] détachement échoué (ignoré):", e);
  }
}
