import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Profession } from "@prisma/client";
import { z } from "zod";
import { peutRemonterDemande } from "@/lib/roles";

export const dynamic = "force-dynamic";

// Demandes de priorisation remontées par un partenaire (section 233).
//
// Hors de `/api/admin/*` volontairement : ce n'est pas une route d'administration, c'est la seule
// action d'écriture d'un rôle qui n'administre rien. La ranger avec les autres aurait brouillé
// exactement la frontière que ce rôle existe pour tracer.
const schema = z.object({
  commune: z.string().min(1).max(120),
  profession: z.nativeEnum(Profession),
  niveau: z.number().int().min(1).max(10),
  // Obligatoire : une demande sans motif ne peut pas être arbitrée, et c'est TOUT ce que le
  // partenaire apporte que la plateforme ne sait pas déjà.
  motif: z.string().min(10).max(500),
});

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || !peutRemonterDemande(role)) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }
  // Un partenaire ne voit QUE ses propres demandes. Un admin les voit toutes, depuis son écran.
  const demandes = await prisma.demandePriorite.findMany({
    where: { demandeurId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, commune: true, profession: true, niveau: true, motif: true,
              statut: true, reponse: true, traiteeLe: true, createdAt: true },
  });
  return NextResponse.json(demandes);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || !peutRemonterDemande(role)) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Demande incomplète", details: parsed.error.flatten() }, { status: 400 });
  }

  const demande = await prisma.demandePriorite.create({
    data: { ...parsed.data, demandeurId: session.user.id },
    select: { id: true, commune: true, profession: true, niveau: true, statut: true, createdAt: true },
  });
  return NextResponse.json(demande, { status: 201 });
}
