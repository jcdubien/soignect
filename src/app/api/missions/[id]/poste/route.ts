import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { refusSiegeTitulaire, refusSansDateDebut, doublonRemplacement, messageDoublon } from "@/lib/rattachementPoste";

export const dynamic = "force-dynamic";

// PUT /api/missions/[id]/poste — rattacher A POSTERIORI une annonce à un poste du Planning (15/11).
//
// Une annonce publiée par « + Annonce » sans cible sur la timeline reste « non rattachée »
// (cabinetPostId = null) : listée sous le Planning, jamais posée sur une ligne. Rien ne
// permettait de la rattacher ensuite — il fallait l'annuler et la republier depuis le poste,
// en perdant ses mises en relation.
//
// Portée volontairement étroite : seulement une annonce SANS poste, vers un poste du même
// cabinet. Déplacer une annonce d'un poste à un autre est un autre geste (la brique change de
// ligne, l'assistant rattaché à l'ancien poste la perd de vue) et n'est pas demandé.
// Les règles de la publication depuis un poste sont rejouées (lib/rattachementPoste).

const schema = z.object({ cabinetPostId: z.string().min(1) });

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const profileId = session?.user?.profileId as string | undefined;
  if (!profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Poste manquant." }, { status: 400 });
  const { cabinetPostId } = parsed.data;

  const mission = await prisma.mission.findUnique({
    where: { id },
    select: {
      id: true, profileId: true, cabinetPostId: true, isActive: true, isSelfPresence: true,
      missionType: true, briqueStatus: true, startDate: true, endDate: true,
    },
  });
  if (!mission) return NextResponse.json({ error: "Annonce introuvable." }, { status: 404 });
  if (mission.profileId !== profileId) return NextResponse.json({ error: "Interdit" }, { status: 403 });
  if (mission.isSelfPresence || !mission.isActive) {
    return NextResponse.json({ error: "Cette annonce ne peut pas être rattachée." }, { status: 422 });
  }
  if (mission.cabinetPostId) {
    return NextResponse.json({ error: "Cette annonce est déjà rattachée à un poste." }, { status: 409 });
  }

  const post = await prisma.cabinetPost.findUnique({
    where: { id: cabinetPostId },
    select: { cabinetId: true, isActive: true },
  });
  if (!post) return NextResponse.json({ error: "Poste introuvable." }, { status: 404 });
  if (post.cabinetId !== profileId) return NextResponse.json({ error: "Interdit" }, { status: 403 });
  if (!post.isActive) return NextResponse.json({ error: "Ce poste est fermé." }, { status: 422 });

  const refusSiege = await refusSiegeTitulaire(cabinetPostId, mission.missionType);
  if (refusSiege) return NextResponse.json({ error: refusSiege }, { status: 422 });

  const refusDate = refusSansDateDebut(mission.briqueStatus, mission.startDate);
  if (refusDate) {
    return NextResponse.json(
      { error: "Ajoutez d'abord une date de début à l'annonce (bouton « Modifier ») : sans elle, elle n'apparaîtrait pas sur la ligne du poste." },
      { status: 422 },
    );
  }

  const doublon = await doublonRemplacement({
    cabinetPostId,
    missionType: mission.missionType,
    startDate: mission.startDate,
    endDate: mission.endDate,
    saufMissionId: mission.id,
  });
  if (doublon) {
    return NextResponse.json({ error: messageDoublon(doublon), duplicateMissionId: doublon.id }, { status: 409 });
  }

  // updateMany conditionné à cabinetPostId null : deux clics concurrents ne rattachent pas
  // l'annonce à deux postes successifs.
  const res = await prisma.mission.updateMany({
    where: { id: mission.id, cabinetPostId: null },
    data: { cabinetPostId },
  });
  if (res.count === 0) {
    return NextResponse.json({ error: "Cette annonce est déjà rattachée à un poste." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
