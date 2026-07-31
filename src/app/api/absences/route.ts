import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { BriqueStatus, MissionType, MatchStatus } from "@prisma/client";
import { sendPeriodRemovedEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const absenceSchema = z.object({
  absenceType: z.nativeEnum(BriqueStatus),
  title: z.string().min(1).max(100),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.profileId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const profileId = session.user.profileId as string;

  const body = await req.json();
  const parsed = absenceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { absenceType, title, startDate, endDate } = parsed.data;

  const start = new Date(startDate);
  const end   = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    return NextResponse.json({ error: "Dates invalides." }, { status: 400 });
  }

  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { name: true },
  });

  const mission = await prisma.mission.create({
    data: {
      profileId,
      title,
      location: profile?.name ?? "cabinet",
      specialties: [],
      startDate: start,
      endDate:   end,
      missionType: MissionType.REMPLACEMENT,
      briqueStatus: absenceType,
      isSelfPresence: true,
    },
  });

  return NextResponse.json(mission, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.profileId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const profileId = session.user.profileId as string;
  const { searchParams } = new URL(req.url);
  const missionId = searchParams.get("id");
  if (!missionId) return NextResponse.json({ error: "id manquant" }, { status: 400 });

  const mission = await prisma.mission.findUnique({ where: { id: missionId }, select: { profileId: true } });
  if (!mission || mission.profileId !== profileId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  // Un match CONFIRMÉ peut porter un contrat signé : sa rupture est une autre démarche, qui
  // passe par « Annuler la mise en relation » (annulation du contrat, détachement du poste,
  // resync des timelines). On refuse ici, comme le fait DELETE /api/missions/[id].
  const matchConfirme = await prisma.match.findFirst({
    where: { OR: [{ missionAId: missionId }, { missionBId: missionId }], status: MatchStatus.CONFIRME },
    select: { id: true },
  });
  if (matchConfirme) {
    return NextResponse.json(
      { error: "Cette absence est liée à une mise en relation confirmée. Utilisez « Annuler la mise en relation » : le contrat sera annulé et l'autre partie prévenue." },
      { status: 409 }
    );
  }

  // Destinataires à prévenir : les mises en relation ENGAGÉES, c'est-à-dire en DISCUSSION.
  // Les EN_ATTENTE ne le sont pas — personne n'a encore répondu, un email serait du bruit.
  // DECLINE / EXPIRE n'engagent plus personne. On collecte AVANT la suppression, sinon les
  // Match n'existent plus.
  const matchsEngages = await prisma.match.findMany({
    where: { OR: [{ missionAId: missionId }, { missionBId: missionId }], status: MatchStatus.DISCUSSION },
    select: { profileAId: true, profileBId: true },
  });
  const autresProfils = Array.from(
    new Set(matchsEngages.map((m) => (m.profileAId === profileId ? m.profileBId : m.profileAId)))
  );
  const destinataires = autresProfils.length
    ? await prisma.user.findMany({
        where: { profile: { id: { in: autresProfils } } },
        select: { email: true, emailOptIn: true },
      })
    : [];
  const [moi, periode] = await Promise.all([
    prisma.profile.findUnique({ where: { id: profileId }, select: { name: true } }),
    prisma.mission.findUnique({ where: { id: missionId }, select: { startDate: true, endDate: true } }),
  ]);

  // Nettoyage des dépendances AVANT suppression, comme le fait déjà DELETE /api/missions/[id].
  // Sans ça, un seul Swipe reçu suffisait à faire échouer le delete sur contrainte de clé
  // étrangère (Swipe.swipedMission et Match.missionA/B n'ont pas de onDelete cascade) : la route
  // renvoyait 500 et le client, qui ne testait pas la réponse, laissait l'absence en place.
  await prisma.$transaction([
    prisma.swipe.deleteMany({ where: { swipedMissionId: missionId } }),
    prisma.match.deleteMany({ where: { OR: [{ missionAId: missionId }, { missionBId: missionId }] } }),
    prisma.mission.delete({ where: { id: missionId } }),
  ]);

  // Notification après suppression réussie (fire-and-forget, comme l'annulation de match) :
  // « le cabinet a retiré cette période ». Ton neutre — le destinataire n'a rien fait de mal,
  // le besoin a simplement disparu.
  if (destinataires.length) {
    const fmt = (d: Date | null) =>
      d ? d.toISOString().slice(0, 10).split("-").reverse().join("/") : null;
    const libelle =
      periode?.startDate && periode?.endDate
        ? `${fmt(periode.startDate)} → ${fmt(periode.endDate)}`
        : null;
    await Promise.all(
      destinataires.map((u) =>
        sendPeriodRemovedEmail(u.email, {
          optIn: u.emailOptIn,
          cabinetName: moi?.name ?? null,
          periode: libelle,
        })
      )
    );
  }

  return NextResponse.json({ ok: true, notifies: destinataires.length });
}
