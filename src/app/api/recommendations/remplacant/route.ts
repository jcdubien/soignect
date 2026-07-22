import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  matchId:     z.string(),
  ratedId:     z.string(), // REMPLACANT évalué
  recommended: z.boolean(),
  scorePonctualite:    z.number().int().min(1).max(5).optional(),
  scoreQualiteSoins:   z.number().int().min(1).max(5).optional(),
  scoreDossierPatient: z.number().int().min(1).max(5).optional(),
  scoreCommunication:  z.number().int().min(1).max(5).optional(),
});

// POST /api/recommendations/remplacant — évaluation privée du remplaçant par le cabinet
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const raterId = session.user.profileId as string;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { matchId, ratedId, recommended, scorePonctualite, scoreQualiteSoins, scoreDossierPatient, scoreCommunication } = parsed.data;

  if (raterId === ratedId) return NextResponse.json({ error: "Impossible de s'évaluer soi-même" }, { status: 400 });

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || (match.profileAId !== raterId && match.profileBId !== raterId)) {
    return NextResponse.json({ error: "Match introuvable ou accès interdit" }, { status: 403 });
  }

  // ratedId DOIT être la contre-partie de CE match (audit #3) : sinon un membre du match pouvait
  // noter un profil tiers arbitraire en l'attachant à son match → pollution du ratingAvg/classement.
  const otherPartyId = match.profileAId === raterId ? match.profileBId : match.profileAId;
  if (ratedId !== otherPartyId) {
    return NextResponse.json({ error: "Vous ne pouvez évaluer que l'autre partie de ce match." }, { status: 403 });
  }

  const scores = [scorePonctualite, scoreQualiteSoins, scoreDossierPatient, scoreCommunication].filter(Boolean) as number[];
  const scoreGlobal = scores.length === 4
    ? (scorePonctualite! + scoreQualiteSoins! + scoreDossierPatient! + scoreCommunication!) / 4
    : null;

  const rating = await prisma.remplacantRating.upsert({
    where: { raterId_ratedId_matchId: { raterId, ratedId, matchId } },
    create: {
      raterId, ratedId, matchId, recommended,
      scorePonctualite: scorePonctualite ?? null,
      scoreQualiteSoins: scoreQualiteSoins ?? null,
      scoreDossierPatient: scoreDossierPatient ?? null,
      scoreCommunication: scoreCommunication ?? null,
      scoreGlobal,
    },
    update: {
      recommended,
      scorePonctualite: scorePonctualite ?? null,
      scoreQualiteSoins: scoreQualiteSoins ?? null,
      scoreDossierPatient: scoreDossierPatient ?? null,
      scoreCommunication: scoreCommunication ?? null,
      scoreGlobal,
    },
  });

  return NextResponse.json(rating, { status: 201 });
}
