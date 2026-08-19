import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Profession } from "@prisma/client";
import { inseeOfCommune } from "@/lib/communes";
import { z } from "zod";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAdmin(session: any): boolean {
  return session?.user?.role === "ADMIN";
}

// La commune arrive en LIBELLÉ PRODUIT (celui des annonces), pas en code INSEE : c'est ce que
// l'administrateur voit à l'écran et ce que la CPTS nomme au téléphone. La conversion passe par
// le pont (section 213), au même endroit que pour le feed — sans quoi une déclaration saisie sur
// « Terre-de-Bas (Les Saintes) » n'aurait jamais rencontré les annonces correspondantes.
const schema = z.object({
  commune: z.string().min(1).max(120),
  profession: z.nativeEnum(Profession),
  niveau: z.number().int().min(1).max(10),
  institution: z.string().min(2).max(160),
  declareLe: z.string().datetime({ offset: true }).or(z.string().date()),
  note: z.string().max(500).optional(),
  expireLe: z.string().datetime({ offset: true }).or(z.string().date()).optional().nullable(),
});

export async function GET() {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const priorites = await prisma.prioriteTerritoriale.findMany({
    orderBy: [{ profession: "asc" }, { commune: "asc" }],
    include: { saisiPar: { select: { email: true } } },
  });
  return NextResponse.json(priorites);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { commune, profession, niveau, institution, declareLe, note, expireLe } = parsed.data;

  // REFUS EXPLICITE plutôt que silence. Une commune que le pont ne connaît pas produirait une
  // déclaration qui n'agirait jamais — enregistrée, visible à l'écran, et sans effet. C'est
  // exactement la famille de défaut que cette table existe pour fermer : l'écran affirmerait à
  // l'administrateur qu'il a déclaré quelque chose, et le feed n'en saurait rien.
  const codeInsee = inseeOfCommune(commune);
  if (!codeInsee) {
    return NextResponse.json(
      { error: `« ${commune} » n'est pas une commune connue du pont INSEE — déclaration refusée, elle n'aurait eu aucun effet.` },
      { status: 400 },
    );
  }

  const existante = await prisma.prioriteTerritoriale.findUnique({
    where: { codeInsee_profession: { codeInsee, profession } },
    select: { id: true, institution: true },
  });
  if (existante) {
    return NextResponse.json(
      { error: `Une déclaration existe déjà pour cette commune et cette profession (${existante.institution}). La modifier plutôt que d'en ajouter une seconde.` },
      { status: 409 },
    );
  }

  const cree = await prisma.prioriteTerritoriale.create({
    data: {
      codeInsee,
      commune,
      profession,
      niveau,
      institution,
      declareLe: new Date(declareLe),
      note: note || null,
      expireLe: expireLe ? new Date(expireLe) : null,
      saisiParId: session!.user!.id as string,
    },
    include: { saisiPar: { select: { email: true } } },
  });

  console.log(`[admin] priorité territoriale déclarée — ${commune} (${codeInsee}) ${profession} niveau ${niveau}, ${institution}`);
  return NextResponse.json(cree, { status: 201 });
}
