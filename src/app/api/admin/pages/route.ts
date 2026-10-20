import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { inseeOfCommune, COMMUNES_GUADELOUPE } from "@/lib/communes";
import { PERIMETRE_MAX, nouveauJeton, synchroniserPrioritesApl } from "@/lib/pageClient";

export const dynamic = "force-dynamic";

// Pages clients côté administrateur (20/10) : ouvrir la page d'un client, régler son périmètre
// (borné par l'offre), régénérer un jeton, recalculer les priorités depuis l'APL.

const CODES_CONNUS = new Set(COMMUNES_GUADELOUPE.map(inseeOfCommune).filter((c): c is string => !!c));

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("perimetre"), clientId: z.string(), communes: z.array(z.string()).min(1) }),
  z.object({ action: z.literal("jeton"), clientId: z.string(), quel: z.enum(["public", "edition"]) }),
  z.object({ action: z.literal("apl"), clientId: z.string() }),
]);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Interdit" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const d = parsed.data;
  const client = await prisma.clientInstitutionnel.findUnique({ where: { id: d.clientId }, include: { page: true } });
  if (!client) return NextResponse.json({ error: "Client inconnu." }, { status: 404 });

  if (d.action === "perimetre") {
    const communes = Array.from(new Set(d.communes));
    if (communes.some((c) => !CODES_CONNUS.has(c))) {
      return NextResponse.json({ error: "Commune inconnue." }, { status: 400 });
    }
    const max = PERIMETRE_MAX[client.type];
    if (max !== null && communes.length > max) {
      return NextResponse.json({ error: `L'offre ${client.type} couvre ${max} commune${max > 1 ? "s" : ""} au plus.` }, { status: 400 });
    }
    await prisma.pageClient.upsert({
      where: { clientId: client.id },
      update: { communes },
      create: {
        clientId: client.id, communes, creeParId: session.user.id,
        jetonPublic: nouveauJeton(), jetonEdition: nouveauJeton(),
      },
    });
    // Le périmètre change les priorités APL : on les recalcule dans le même geste, sans quoi
    // une commune retirée resterait prioritaire.
    const bilan = await synchroniserPrioritesApl(client.id, session.user.id);
    return NextResponse.json({ ok: true, bilan });
  }

  if (!client.page) return NextResponse.json({ error: "Ce client n'a pas encore de page." }, { status: 409 });

  if (d.action === "jeton") {
    await prisma.pageClient.update({
      where: { clientId: client.id },
      data: d.quel === "public" ? { jetonPublic: nouveauJeton() } : { jetonEdition: nouveauJeton() },
    });
    return NextResponse.json({ ok: true });
  }

  const bilan = await synchroniserPrioritesApl(client.id, session.user.id);
  return NextResponse.json({ ok: true, bilan });
}
