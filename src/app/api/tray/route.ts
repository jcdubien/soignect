import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SwipeDirection } from "@prisma/client";
import { swipeExploitable } from "@/lib/camp";
import { etatNouveauSignal } from "@/lib/interetSignale";

export const dynamic = "force-dynamic";

// GET /api/tray — swipes RIGHT triés par affinityScore desc (meilleur match en premier).
// Filtre optionnel ?disponibiliteId= (section 7) : ne garde que les mises en relation
// rattachées à CETTE disponibilité du remplaçant.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.profileId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const swiperId = session.user.profileId as string;
  const disponibiliteId = new URL(req.url).searchParams.get("disponibiliteId");

  const swipesBruts = await prisma.swipe.findMany({
    where: { swiperId, direction: SwipeDirection.RIGHT },
    include: {
      swipedMission: { include: { profile: true } },
    },
    orderBy: [
      { affinityScore: "desc" },
      { createdAt: "desc" },
    ],
    take: 50,
  });

  // Camps opposés seulement (section 226). Quelqu'un qui a changé de camp garde ses gestes
  // passés : sans ce filtre, un cabinet anciennement candidat voyait dans « Vos choix » des
  // annonces de cabinets, indéfiniment « en attente de réponse » alors qu'aucun match ne peut
  // s'y produire. Le geste a bien eu lieu ; il ne veut simplement plus rien dire.
  const moi = await prisma.profile.findUnique({ where: { id: swiperId }, select: { type: true } });
  const swipes = moi
    ? swipesBruts.filter((s) => swipeExploitable(moi.type, s.swipedMission.profile.type))
    : swipesBruts;

  const missionIds = swipes.map((s) => s.swipedMissionId);

  const matches = await prisma.match.findMany({
    where: {
      OR: [
        { profileAId: swiperId, missionBId: { in: missionIds } },
        { profileBId: swiperId, missionBId: { in: missionIds } },
        { profileAId: swiperId, missionAId: { in: missionIds } },
        { profileBId: swiperId, missionAId: { in: missionIds } },
      ],
    },
    select: {
      id: true, profileAId: true, profileBId: true,
      missionAId: true, missionBId: true, aiScore: true, createdAt: true, status: true,
      missionA: { select: { briqueStatus: true } },
      missionB: { select: { briqueStatus: true } },
    },
  });

  // ── Un nouveau signal d'intérêt est-il possible ? (section 253) ────────────────────────────
  //
  // Calculé ICI, en deux requêtes pour toute la liste, plutôt que par l'écran élément par
  // élément : cinquante fiches auraient produit cinquante allers-retours pour afficher un bouton.
  // La DÉCISION, elle, n'est pas dupliquée — `etatNouveauSignal` est la même fonction que celle
  // de la route d'intérêt, qui relira ces faits pour son propre compte.
  const [maRecherche, signaux] = await Promise.all([
    prisma.mission.findFirst({ where: { profileId: swiperId, isActive: true }, select: { id: true } }),
    prisma.traceEvent.findMany({
      where: {
        eventType: "INTERET_SIGNALE",
        profileId: swiperId,
        missionId: { in: swipes.map((s) => s.swipedMissionId) },
      },
      orderBy: { occurredAt: "desc" },
      select: { missionId: true, occurredAt: true },
    }),
  ]);
  // Tri décroissant + premier gagnant = le signal le plus récent par annonce.
  const dernierSignalParMission = new Map<string, Date>();
  for (const s of signaux) {
    if (s.missionId && !dernierSignalParMission.has(s.missionId)) {
      dernierSignalParMission.set(s.missionId, s.occurredAt);
    }
  }

  // Mission propre du remplaçant dans un match donné (= sa disponibilité)
  const ownMissionId = (m: { profileAId: string; missionAId: string | null; missionBId: string | null }) =>
    m.profileAId === swiperId ? m.missionAId : m.missionBId;

  const resultAll = swipes.map((s) => {
    const mId  = s.swipedMissionId;
    const match = matches.find((m) => m.missionAId === mId || m.missionBId === mId);
    // "Contrat confirmé" dérivé du briqueStatus des missions associées (pas de champ dédié)
    const contratConfirmed =
      match?.missionA?.briqueStatus === "CONFIRME" ||
      match?.missionB?.briqueStatus === "CONFIRME";
    return {
      mission:          s.swipedMission,
      affinityScore:    s.affinityScore,
      scoreDetails:     s.scoreDetails,
      matchId:          match?.id    ?? null,
      aiScore:          match?.aiScore ?? null,
      matchCreatedAt:   match?.createdAt ?? null,
      matchStatus:      match?.status ?? null,
      contratConfirmed: contratConfirmed ?? false,
      nouveauSignal: etatNouveauSignal({
        aPublieUneRecherche: !!maRecherche,
        enRelation: !!match,
        annonceActive: s.swipedMission.isActive,
        dernierSignalLe: dernierSignalParMission.get(mId) ?? null,
      }),
    };
  });

  // Filtre disponibilité (section 7) : uniquement les mises en relation de cette dispo
  const result = disponibiliteId
    ? resultAll.filter((item) => {
        if (!item.matchId) return false;
        const m = matches.find((mm) => mm.id === item.matchId);
        return m ? ownMissionId(m) === disponibiliteId : false;
      })
    : resultAll;

  return NextResponse.json(result);
}
