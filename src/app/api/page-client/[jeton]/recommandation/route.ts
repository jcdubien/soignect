import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { editeurConnecte, relationActive } from "@/lib/pageClient";
import { logTraceEventAttendu } from "@/lib/trace";
import { cleRecommandation } from "@/lib/recommandationTerritoire";
import { recommandationsDeLaPage } from "@/lib/recommandationTerritoireServeur";

export const dynamic = "force-dynamic";

// Trace de l'encart « Recommandation Soignect » (23/10) : proposition affichée, préremplie
// (« Appliquer… » a rempli le formulaire ; c'est l'enregistrement habituel qui applique, et le
// journal qui le prouve), ignorée. Aucune donnée personnelle : la structure, la règle, la case.
// Un événement n'est accepté que pour une proposition RÉELLEMENT calculée pour cette page — le
// jeton suffit à l'émettre (consultation comprise), pas à inventer des lignes.
const corps = z.object({
  evenement: z.enum(["affichee", "preremplie", "ignoree"]),
  cle: z.string().max(120),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const d = corps.safeParse(await req.json().catch(() => null));
  if (!d.success) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });

  const page = await prisma.pageClient.findUnique({
    where: { jetonEdition: jeton },
    select: { id: true, clientId: true, demo: true, communes: true, professions: true, client: { select: { nom: true, revueLe: true, debutLe: true, clotureLe: true } } },
  });
  if (!page || !relationActive(page.client)) return NextResponse.json({ error: "Page introuvable." }, { status: 404 });

  const { recommandations } = await recommandationsDeLaPage(page);
  const r = recommandations.find((x) => cleRecommandation(x) === d.data.cle);
  if (!r) return NextResponse.json({ error: "Proposition inconnue." }, { status: 404 });

  const editeur = await editeurConnecte(page.clientId);
  await logTraceEventAttendu({
    eventType: "RECOMMANDATION_TERRITOIRE",
    commune: r.codeInsee,
    profession: r.profession,
    metadata: { evenement: d.data.evenement, regle: r.regle, clientId: page.clientId, demo: page.demo, editeur: !!editeur },
  });
  return NextResponse.json({ ok: true });
}
