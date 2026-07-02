import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  matchId:     z.string(),
  ratedId:     z.string(), // TITULAIRE noté
  recommended: z.boolean(),
  comment:     z.string().max(500).optional(),
  scoreAccueil:  z.number().int().min(1).max(5).optional(),
  scoreMateriel: z.number().int().min(1).max(5).optional(),
  scoreContrat:  z.number().int().min(1).max(5).optional(),
  scoreAmbiance: z.number().int().min(1).max(5).optional(),
});

// POST /api/recommendations/cabinet — notation publique du cabinet par un remplaçant
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const raterId = session.user.profileId as string;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { matchId, ratedId, recommended, comment, scoreAccueil, scoreMateriel, scoreContrat, scoreAmbiance } = parsed.data;

  if (raterId === ratedId) return NextResponse.json({ error: "Impossible de se noter soi-même" }, { status: 400 });

  // Vérifier que le match existe et que le rater en fait partie
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || (match.profileAId !== raterId && match.profileBId !== raterId)) {
    return NextResponse.json({ error: "Match introuvable ou accès interdit" }, { status: 403 });
  }

  const scores = [scoreAccueil, scoreMateriel, scoreContrat, scoreAmbiance].filter(Boolean) as number[];
  const scoreGlobal = scores.length === 4
    ? (scoreAccueil! + scoreMateriel! + scoreContrat! + scoreAmbiance!) / 4
    : null;

  const rating = await prisma.cabinetRating.upsert({
    where: { raterId_ratedId_matchId: { raterId, ratedId, matchId } },
    create: {
      raterId, ratedId, matchId, recommended,
      comment: comment ?? null,
      scoreAccueil: scoreAccueil ?? null,
      scoreMateriel: scoreMateriel ?? null,
      scoreContrat: scoreContrat ?? null,
      scoreAmbiance: scoreAmbiance ?? null,
      scoreGlobal,
      isPublished: false,
    },
    update: {
      recommended,
      comment: comment ?? null,
      scoreAccueil: scoreAccueil ?? null,
      scoreMateriel: scoreMateriel ?? null,
      scoreContrat: scoreContrat ?? null,
      scoreAmbiance: scoreAmbiance ?? null,
      scoreGlobal,
    },
  });

  return NextResponse.json(rating, { status: 201 });
}
