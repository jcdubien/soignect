import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BriqueStatus } from "@prisma/client";
import { z } from "zod";

export const dynamic = "force-dynamic";

// POST /api/missions/active-check — parmi une liste d'ids, renvoie ceux encore ACTIFS.
// Sert à masquer de l'historique « annonces consultées » (localStorage) les annonces devenues
// inactives/supprimées. Volontairement SANS effet de bord (contrairement à /card qui notifie
// le propriétaire) : simple vérification de statut.
const schema = z.object({ ids: z.array(z.string()).max(50) });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  if (parsed.data.ids.length === 0) return NextResponse.json({ activeIds: [] });

  const rows = await prisma.mission.findMany({
    // Une INDISPONIBLE (« Dates bloquées ») est active en base mais n'est PAS une annonce
    // consultable — marqueur de calendrier privé. On l'exclut donc des « actifs » consultables.
    where: { id: { in: parsed.data.ids }, isActive: true, briqueStatus: { not: BriqueStatus.INDISPONIBLE } },
    select: { id: true },
  });
  return NextResponse.json({ activeIds: rows.map((r) => r.id) });
}
