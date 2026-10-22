import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { reglerCase, retirerCases } from "@/lib/casesPriorite";
import { JUSTIFICATION_MAX, NIVEAU_MAX, erreurReglage } from "@/lib/boostTerritorial";

export const dynamic = "force-dynamic";

// ADMIN SEUL — y compris en lecture (section 233). Le partenaire territorial ne règle rien :
// il consulte des agrégats sur son propre écran et REMONTE des demandes. Cette route reste donc
// fermée pour lui, écriture comme lecture — elle expose le détail des relations institutionnelles
// (nom du client, dates de revue), qui n'a pas à sortir.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAdmin(session: any): boolean {
  return session?.user?.role === "ADMIN";
}

// NI LA COMMUNE NI LA PROFESSION NE SONT MODIFIABLES. Changer l'une des deux ne corrige pas une
// déclaration : ça en fabrique une autre, en gardant l'auteur et la date de la première. Pour
// déclarer ailleurs, on supprime et on ressaisit — le geste est plus lourd, et c'est voulu.
const schema = z.object({
  niveau: z.number().int().min(1).max(NIVEAU_MAX).optional(),
  // Point 8 : exigée si le niveau s'écarte de plus d'un cran de l'APL, ou sans APL.
  justification: z.string().trim().max(JUSTIFICATION_MAX).nullish(),
  note: z.string().max(500).nullable().optional(),
  expireLe: z.string().datetime({ offset: true }).or(z.string().date()).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { niveau, note, expireLe } = parsed.data;
  const avant = await prisma.prioriteTerritoriale.findUnique({
    where: { id }, include: { client: { select: { id: true, nom: true, type: true, nature: true } } },
  });
  if (!avant) return NextResponse.json({ error: "Priorité introuvable." }, { status: 404 });

  // Le niveau passe par la règle du point 8 et par le journal ; la note et l'échéance, non.
  if (niveau !== undefined && (niveau !== avant.niveau || parsed.data.justification !== undefined)) {
    const justification = parsed.data.justification === undefined ? avant.justification : (parsed.data.justification || null);
    const refus = erreurReglage(niveau, avant.niveauApl, justification);
    if (refus) return NextResponse.json({ error: refus, niveauApl: avant.niveauApl }, { status: 400 });
    const { client, ...ligne } = avant;
    await reglerCase(ligne, client, { id: session!.user!.id as string, nom: "Administrateur Soignect" }, { niveau, justification });
  }

  const modifiee = await prisma.prioriteTerritoriale.update({
    where: { id },
    data: {
      ...(note !== undefined && { note: note || null }),
      ...(expireLe !== undefined && { expireLe: expireLe ? new Date(expireLe) : null }),
    },
    include: { saisiPar: { select: { email: true } }, client: { select: { nom: true, nature: true, revueLe: true, clotureLe: true } } },
  });

  console.log(`[admin] priorité territoriale modifiée — ${modifiee.commune} ${modifiee.profession}`, parsed.data);
  return NextResponse.json(modifiee);
}

// La suppression retire réellement la ligne : si l'institution revient dessus, le produit ne doit
// pas continuer à porter au feed un jugement qu'elle ne tient plus. La trace d'audit, elle, vit
// dans `JournalReglage` (point 8, ajout seul). `expireLe` sert à la voir s'éteindre à une date.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const { id } = await params;
  const ligne = await prisma.prioriteTerritoriale.findUnique({
    where: { id }, include: { client: { select: { id: true, nom: true, type: true, nature: true } } },
  });
  if (!ligne) return NextResponse.json({ error: "Priorité introuvable." }, { status: 404 });
  const { client, ...l } = ligne;
  await retirerCases([l], client, { id: session!.user!.id as string, nom: "Administrateur Soignect" });
  const supprimee = ligne;

  console.log(`[admin] priorité territoriale supprimée — ${supprimee.commune} ${supprimee.profession} (${supprimee.client.nom})`);
  return NextResponse.json({ ok: true });
}
