import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BriqueStatus } from "@prisma/client";

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
      minMonths: true, missionType: true, bioTinder: true, profileId: true, briqueStatus: true,
      demiJourneesLibres: true, caMensuelEstime: true, // feature terrain — affichage fiche

      profile: {
        select: {
          name: true, type: true, photoUrl: true,
          secondaryPhotoUrl1: true, secondaryPhotoUrl2: true, region: true, bioTinder: true,
        },
      },
    },
  });
  if (!mission) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  // Une INDISPONIBLE (« Dates bloquées ») n'est jamais une annonce consultable → 404 (comme
  // supprimée) ; le RecentMissionsTray la purge alors de l'historique.
  if (mission.briqueStatus === BriqueStatus.INDISPONIBLE) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

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

  // AUCUNE NOTIFICATION ICI (section 223, 02/09).
  //
  // Cette route envoyait un email et une notification « untel vient de consulter votre annonce »
  // dès qu'une carte était PRÉSENTÉE — « vue = consultation », section 157. Le garde était
  // `!swipe` : on notifiait tant que le visiteur n'avait rien décidé, et on cessait dès qu'il
  // décidait. Le signal était donc envoyé exactement quand il valait le moins.
  //
  // Mesuré le 02/09 sur 235 consultations : 77 % ont été suivies d'un geste, dont seulement
  // 14 % d'un « Intéressé ». **86 % des emails annonçaient donc l'attention de quelqu'un qui
  // n'était pas intéressé**, ou qui ne s'est jamais prononcé.
  //
  // Le geste de consentement qui rend une personne notifiable est le swipe « Intéressé », pas
  // l'affichage d'une carte que le visiteur n'a pas choisi de voir. La notification vit désormais
  // dans POST /api/swipe, branche RIGHT. `notifyConsultation` et la déduplication par
  // TraceEvent sont conservés tels quels — c'est le DÉCLENCHEUR qui change, pas le réglage.

  // Le lecteur a-t-il lui-même publié une recherche (section 206) ? De la réponse dépend le
  // SENS de son geste : avec une recherche, « Intéressé » ouvre une réciprocité possible — le
  // cabinet peut swiper la sienne en retour. Sans recherche, le cabinet ne peut RIEN swiper en
  // face : le geste ne vaut que comme signalement, et l'écran doit le dire.
  // Requête indexée sur profileId, bornée à 1 : coût négligeable.
  const aPublieUneRecherche =
    (await prisma.mission.count({ where: { profileId: swiperId, isActive: true }, take: 1 })) > 0;

  return NextResponse.json({
    mission,
    relation: {
      swipeDirection: swipe?.direction ?? null,
      matchId: match?.id ?? null,
      // Sa propre annonce : on ne peut pas la swiper → l'UI masque les boutons de décision.
      isOwn: mission.profileId === swiperId,
      aPublieUneRecherche,
    },
  });
}
