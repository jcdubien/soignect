import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAdmin(session: any): boolean {
  return session?.user?.role === "ADMIN";
}

export async function GET() {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const ratings = await prisma.cabinetRating.findMany({
    where: { isPublished: false },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      recommended: true,
      comment: true,
      scoreGlobal: true,
      scoreAccueil: true,
      scoreMateriel: true,
      scoreContrat: true,
      scoreAmbiance: true,
      isPublished: true,
      createdAt: true,
      rater: { select: { id: true, name: true, type: true } },
      rated: { select: { id: true, name: true, type: true } },
    },
  });

  return NextResponse.json(ratings);
}
