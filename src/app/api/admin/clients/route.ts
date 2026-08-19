import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NatureRelationInstitutionnelle, TypeInstitution } from "@prisma/client";
import { z } from "zod";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAdmin(session: any): boolean {
  return session?.user?.role === "ADMIN";
}

// `revueLe` est OBLIGATOIRE — pas de valeur par défaut, pas d'optionnalité. Une relation sans
// échéance de revue serait exactement le « silencieusement permanent » que le principe du 19/08
// écarte. La saisie doit poser une date, l'API ne la devine pas à sa place.
const schema = z.object({
  nom: z.string().min(2).max(160),
  type: z.nativeEnum(TypeInstitution),
  nature: z.nativeEnum(NatureRelationInstitutionnelle),
  debutLe: z.string().datetime({ offset: true }).or(z.string().date()),
  revueLe: z.string().datetime({ offset: true }).or(z.string().date()),
  note: z.string().max(500).optional(),
});

export async function GET() {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const clients = await prisma.clientInstitutionnel.findMany({
    orderBy: [{ clotureLe: "asc" }, { revueLe: "asc" }],
    include: { _count: { select: { priorites: true } } },
  });
  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { nom, type, nature, debutLe, revueLe, note } = parsed.data;

  const debut = new Date(debutLe);
  const revue = new Date(revueLe);

  // Une revue antérieure au début décrirait une relation morte-née. Refus explicite plutôt que
  // d'enregistrer une ligne dont le levier ne s'activerait jamais sans que personne comprenne
  // pourquoi — même discipline que le refus de commune inconnue du pont INSEE.
  if (revue <= debut) {
    return NextResponse.json(
      { error: "La date de revue doit être postérieure au début de la relation — sinon le levier ne s'activerait jamais." },
      { status: 400 },
    );
  }

  const existant = await prisma.clientInstitutionnel.findUnique({ where: { nom }, select: { id: true } });
  if (existant) {
    return NextResponse.json({ error: `Une relation existe déjà pour « ${nom} ».` }, { status: 409 });
  }

  const cree = await prisma.clientInstitutionnel.create({
    data: { nom, type, nature, debutLe: debut, revueLe: revue, note: note || null },
    include: { _count: { select: { priorites: true } } },
  });

  console.log(`[admin] relation institutionnelle créée — ${nom} (${type}, ${nature}), revue le ${revue.toISOString().slice(0, 10)}`);
  return NextResponse.json(cree, { status: 201 });
}
