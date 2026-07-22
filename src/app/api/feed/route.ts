import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileType, TitulaireKind, Prisma } from "@prisma/client";
import { stripMissionProfiles } from "@/lib/publicProfile";

export const dynamic = "force-dynamic";

// GET /api/feed — annonces triées par desirabilityScore desc (nouveau feed Sprint 3)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.profileId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const myProfile = await prisma.profile.findUnique({
    where: { id: session.user.profileId as string },
  });
  if (!myProfile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  const swipedIds = await prisma.swipe.findMany({
    where: { swiperId: myProfile.id },
    select: { swipedMissionId: true },
  });
  const excludeMissionIds = swipedIds.map((s) => s.swipedMissionId);

  const oppositeTypes =
    myProfile.type === ProfileType.TITULAIRE
      ? [ProfileType.REMPLACANT, ProfileType.ASSISTANT]
      : [ProfileType.TITULAIRE];

  const { searchParams } = new URL(req.url);
  const location        = searchParams.get("location");
  const limit           = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
  const targetMissionId = searchParams.get("targetMissionId");

  // When TITULAIRE selects a specific mission chip, filter candidats whose dates overlap
  let dateFilter: { startDate?: object; endDate?: object } = {};
  if (myProfile.type === ProfileType.TITULAIRE && targetMissionId) {
    const targetMission = await prisma.mission.findUnique({
      where: { id: targetMissionId },
      select: { startDate: true, endDate: true },
    });
    if (targetMission?.startDate && targetMission?.endDate) {
      dateFilter = {
        startDate: { lte: targetMission.endDate },
        endDate:   { gte: targetMission.startDate },
      };
    }
  }

  // Gating « ouverture au salariat » (section 154, opt-in) :
  //  - Candidat (REMPLACANT/ASSISTANT) NON opté → ne voit pas les missions des STRUCTURES
  //    (contrats salariés CDD/CDI/Stage/Vacation). Les cabinets libéraux restent visibles.
  //  - Viewer STRUCTURE → ne voit que les candidats ayant coché « ouvert au salariat ».
  //    (Un cabinet libéral titulaire, lui, voit tous les candidats — comportement inchangé.)
  const profileWhere: Prisma.ProfileWhereInput = {
    type: { in: oppositeTypes },
    isActive: true,
    id: { not: myProfile.id },
  };
  const isCandidateViewer = myProfile.type !== ProfileType.TITULAIRE;
  const isStructureViewer =
    myProfile.type === ProfileType.TITULAIRE && myProfile.titulaireKind === TitulaireKind.STRUCTURE;
  if (isCandidateViewer && !myProfile.ouvertSalariat) {
    profileWhere.titulaireKind = { not: TitulaireKind.STRUCTURE };
  }
  if (isStructureViewer) {
    profileWhere.ouvertSalariat = true;
  }

  const missions = await prisma.mission.findMany({
    where: {
      isActive: true,
      id: { notIn: excludeMissionIds },
      profile: profileWhere,
      ...(location ? { location } : {}),
      ...dateFilter,
    },
    include: { profile: true },
    orderBy: [
      { profile: { desirabilityScore: "desc" } },
      { profile: { ratingAvg: "desc" } },
      { createdAt: "desc" },
    ],
    take: limit,
  });

  // Expurge les champs sensibles du profil de chaque annonce (audit permissions, section 165) :
  // le feed ne doit exposer que les champs d'affichage (nom/photo/bio/région/note…).
  return NextResponse.json(stripMissionProfiles(missions));
}
