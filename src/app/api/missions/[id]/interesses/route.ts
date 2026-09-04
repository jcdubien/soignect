import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SwipeDirection } from "@prisma/client";
import { swipeExploitable } from "@/lib/camp";

export const dynamic = "force-dynamic";

// GET /api/missions/[id]/interesses — qui s'est signalé sur CETTE annonce (section 206).
//
// Réservé au PROPRIÉTAIRE de l'annonce. Ne renvoie que des personnes ayant fait un geste
// explicite (swipe RIGHT) sur cette annonce précise : aucune exposition de profil qui ne
// résulterait pas d'un consentement actif, conformément à la décision de positionnement du
// 13/08 (pas de profils navigables, pas de feed de profils sans annonce).
//
// POURQUOI CETTE ROUTE EXISTE : le badge « N candidatures en attente » mène au feed, filtré
// sur l'annonce. Or le feed liste des ANNONCES — un candidat qui n'a rien publié n'y figure
// pas. Le compteur annonçait donc des intérêts que le cabinet ne pouvait jamais atteindre :
// mesuré le 13/08, 2 des 8 swipes RIGHT venaient de personnes sans aucune recherche active.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const mission = await prisma.mission.findUnique({
    where: { id },
    // `profile.type` sert au filtre de camp ci-dessous : un swipe de même camp est une
    // affirmation fausse, pas une candidature.
    select: { profileId: true, profile: { select: { type: true } } },
  });
  if (!mission) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (mission.profileId !== session.user.profileId) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const swipes = await prisma.swipe.findMany({
    where: { swipedMissionId: id, direction: SwipeDirection.RIGHT },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      swiper: {
        select: {
          id: true, name: true, type: true, bioTinder: true,
          // Une seule suffit à trancher : a-t-il quelque chose de swipable en face ?
          missions: { where: { isActive: true }, select: { id: true }, take: 1 },
        },
      },
    },
  });

  // Déjà en relation → la personne est atteignable par les écrans habituels, on ne la répète
  // pas ici. Cette vue ne sert qu'à ce qui n'apparaît nulle part ailleurs.
  const dejaEnRelation = await prisma.match.findMany({
    where: { OR: [{ profileAId: mission.profileId }, { profileBId: mission.profileId }] },
    select: { profileAId: true, profileBId: true },
  });
  const enRelation = new Set(dejaEnRelation.flatMap((m) => [m.profileAId, m.profileBId]));

  const interesses = swipes
    // Camps opposés seulement (section 226). Sans ce filtre, un cabinet qui s'était d'abord
    // inscrit comme candidat restait listé ici comme « personne intéressée » — son accroche
    // étant en réalité son offre de recrutement.
    .filter((s) => swipeExploitable(s.swiper.type, mission.profile.type))
    .filter((s) => !enRelation.has(s.swiper.id))
    .map((s) => ({
      profileId: s.swiper.id,
      name: s.swiper.name,
      type: s.swiper.type,
      accroche: s.swiper.bioTinder,
      aPublieUneRecherche: s.swiper.missions.length > 0,
      date: s.createdAt,
    }));

  return NextResponse.json({
    interesses,
    // Ceux-là sont le vrai angle mort : signalés, mais introuvables dans le feed.
    sansRecherche: interesses.filter((i) => !i.aPublieUneRecherche).length,
  });
}
