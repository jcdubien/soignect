import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendConsultationEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// GET /api/missions/[id]/card — mission complète (profil + photos) + statut de l'utilisateur
// vis-à-vis de cette annonce (swipe / mise en relation). Sert la fiche détaillée hors carrousel.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const swiperId = session.user.profileId as string;

  const mission = await prisma.mission.findUnique({
    where: { id },
    select: {
      id: true, title: true, location: true, startDate: true, endDate: true,
      minMonths: true, missionType: true, bioTinder: true, profileId: true,
      profile: {
        select: {
          name: true, type: true, photoUrl: true,
          secondaryPhotoUrl1: true, secondaryPhotoUrl2: true, region: true, bioTinder: true,
        },
      },
    },
  });
  if (!mission) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const swipe = await prisma.swipe.findUnique({
    where: { swiperId_swipedMissionId: { swiperId, swipedMissionId: id } },
    select: { direction: true },
  });

  const match = await prisma.match.findFirst({
    where: {
      OR: [
        { profileAId: swiperId, missionBId: id },
        { profileBId: swiperId, missionBId: id },
        { profileAId: swiperId, missionAId: id },
        { profileBId: swiperId, missionAId: id },
      ],
    },
    select: { id: true },
  });

  // Notification recruteur — consultation d'annonce (section notifications).
  // On notifie le propriétaire uniquement lors d'une VRAIE consultation d'un tiers :
  // pas sa propre annonce, et avant tout swipe (une fois décidé, plus d'email de consult).
  // Dédup serveur (audit #6) : AU PLUS une notif/email par couple (annonce, visiteur), tracée
  // via TraceEvent "CARD_CONSULTED". Sans ce garde, des GET répétés (avant tout swipe) pouvaient
  // spammer le propriétaire. Fire-and-forget : ne bloque pas la réponse. Opt-out notifyConsultation.
  if (mission.profileId !== swiperId && !swipe) {
    (async () => {
      const already = await prisma.traceEvent.findFirst({
        where: { eventType: "CARD_CONSULTED", missionId: id, profileId: swiperId },
        select: { id: true },
      });
      if (already) return; // ce visiteur a déjà consulté cette annonce → pas de nouvelle notif
      await prisma.traceEvent.create({
        data: { eventType: "CARD_CONSULTED", missionId: id, profileId: swiperId, missionType: mission.missionType },
      });

      const owner = await prisma.profile.findUnique({
        where: { id: mission.profileId },
        select: { type: true, user: { select: { id: true, email: true, notifyConsultation: true } } },
      });
      if (!owner?.user?.email) return;
      const viewerType = (session.user as { profileType?: string }).profileType;
      const viewerLabel = viewerType === "TITULAIRE" ? "Un cabinet" : "Un remplaçant";
      // Lien + terme adaptés au propriétaire (section 157) : un cabinet a une « annonce »
      // et un Planning ; un candidat a une « disponibilité » et la page /disponibilites.
      const ownerIsCabinet = owner.type === "TITULAIRE";
      const listingWord = ownerIsCabinet ? "annonce" : "disponibilité";
      // Notification in-app (section 155) — en parallèle de l'email.
      createNotification({
        userId: owner.user.id,
        type: "consultation",
        message: `${viewerLabel} a consulté votre ${listingWord} « ${mission.title} »`,
        linkUrl: ownerIsCabinet ? "/planning" : "/disponibilites",
      });
      await sendConsultationEmail(owner.user.email, {
        viewerLabel,
        missionTitle: mission.title,
        optIn: owner.user.notifyConsultation,
      });
    })().catch(() => {});
  }

  return NextResponse.json({
    mission,
    relation: {
      swipeDirection: swipe?.direction ?? null,
      matchId: match?.id ?? null,
      // Sa propre annonce : on ne peut pas la swiper → l'UI masque les boutons de décision.
      isOwn: mission.profileId === swiperId,
    },
  });
}
