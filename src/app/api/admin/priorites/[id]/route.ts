import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAdmin(session: any): boolean {
  return session?.user?.role === "ADMIN";
}

// NI LA COMMUNE NI LA PROFESSION NE SONT MODIFIABLES. Changer l'une des deux ne corrige pas une
// déclaration : ça en fabrique une autre, en gardant l'auteur et la date de la première. Pour
// déclarer ailleurs, on supprime et on ressaisit — le geste est plus lourd, et c'est voulu.
const schema = z.object({
  niveau: z.number().int().min(1).max(10).optional(),
  institution: z.string().min(2).max(160).optional(),
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
  const { niveau, institution, note, expireLe } = parsed.data;

  const modifiee = await prisma.prioriteTerritoriale.update({
    where: { id },
    data: {
      ...(niveau !== undefined && { niveau }),
      ...(institution !== undefined && { institution }),
      ...(note !== undefined && { note: note || null }),
      ...(expireLe !== undefined && { expireLe: expireLe ? new Date(expireLe) : null }),
    },
    include: { saisiPar: { select: { email: true } } },
  });

  console.log(`[admin] priorité territoriale modifiée — ${modifiee.commune} ${modifiee.profession}`, parsed.data);
  return NextResponse.json(modifiee);
}

// La suppression retire réellement la ligne. Une déclaration n'est pas une trace d'audit : si
// l'institution revient dessus, le produit ne doit pas continuer à porter au feed un jugement
// qu'elle ne tient plus. `expireLe` sert au cas où l'on veut la voir s'éteindre à une date.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const { id } = await params;
  const supprimee = await prisma.prioriteTerritoriale.delete({
    where: { id },
    select: { commune: true, profession: true, institution: true },
  });

  console.log(`[admin] priorité territoriale supprimée — ${supprimee.commune} ${supprimee.profession} (${supprimee.institution})`);
  return NextResponse.json({ ok: true });
}
