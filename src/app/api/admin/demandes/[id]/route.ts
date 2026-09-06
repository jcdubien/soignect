import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatutDemande } from "@prisma/client";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Arbitrage d'une demande de partenaire (section 233) — ADMIN seul.
//
// Répondre NE CRÉE PAS la priorité. Marquer « retenue » dit au partenaire que sa demande est
// acceptée ; la déclaration reste un geste séparé, fait sur l'écran des priorités avec sa relation
// institutionnelle et sa date de revue. Enchaîner les deux aurait créé un levier sans client
// rattaché — exactement ce que le gating du 19/08 interdit.
const schema = z.object({
  statut: z.nativeEnum(StatutDemande),
  reponse: z.string().max(500).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== "ADMIN") {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

  const maj = await prisma.demandePriorite.update({
    where: { id },
    data: {
      statut: parsed.data.statut,
      reponse: parsed.data.reponse ?? null,
      traiteeLe: parsed.data.statut === StatutDemande.EN_ATTENTE ? null : new Date(),
    },
    select: { id: true, statut: true, reponse: true, traiteeLe: true },
  });
  return NextResponse.json(maj);
}
