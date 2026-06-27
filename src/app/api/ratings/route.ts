import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ratingSchema = z.object({
  ratedId: z.string(),
  matchId: z.string().optional(),
  score: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.profileId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = ratingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { ratedId, matchId, score, comment } = parsed.data;
  const raterId = session.user.profileId;

  if (raterId === ratedId) {
    return NextResponse.json({ error: "Impossible de se noter soi-même" }, { status: 400 });
  }

  const canonicalMatchId = matchId ?? null;
  const rating = await prisma.rating.upsert({
    where: {
      raterId_ratedId_matchId: {
        raterId,
        ratedId,
        matchId: canonicalMatchId as string,
      },
    },
    create: { raterId, ratedId, matchId: canonicalMatchId, score, comment },
    update: { score, comment },
  });

  // Recalcul de la moyenne agrégée
  const agg = await prisma.rating.aggregate({
    where: { ratedId },
    _avg: { score: true },
    _count: { score: true },
  });

  await prisma.profile.update({
    where: { id: ratedId },
    data: {
      ratingAvg: agg._avg.score ?? undefined,
      ratingCount: agg._count.score,
    },
  });

  return NextResponse.json(rating, { status: 201 });
}
