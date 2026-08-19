import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NatureRelationInstitutionnelle } from "@prisma/client";
import { z } from "zod";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAdmin(session: any): boolean {
  return session?.user?.role === "ADMIN";
}

// RECONDUIRE OU CLORE — les deux seuls gestes attendus à l'échéance de revue.
//
// `revueLe` est reportable (reconduction) et `clotureLe` posable (fin de relation). Le nom et le
// type ne sont pas modifiables : changer l'institution d'une relation ne la corrige pas, elle en
// fabrique une autre en gardant l'historique de la première — même raisonnement que sur la
// commune d'une déclaration.
const schema = z.object({
  revueLe: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  nature: z.nativeEnum(NatureRelationInstitutionnelle).optional(),
  clotureLe: z.string().datetime({ offset: true }).or(z.string().date()).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { revueLe, nature, clotureLe, note } = parsed.data;

  const actuel = await prisma.clientInstitutionnel.findUnique({
    where: { id },
    select: { debutLe: true, nom: true },
  });
  if (!actuel) return NextResponse.json({ error: "Relation introuvable" }, { status: 404 });

  if (revueLe && new Date(revueLe) <= actuel.debutLe) {
    return NextResponse.json(
      { error: "La date de revue doit rester postérieure au début de la relation." },
      { status: 400 },
    );
  }

  const modifie = await prisma.clientInstitutionnel.update({
    where: { id },
    data: {
      ...(revueLe !== undefined && { revueLe: new Date(revueLe) }),
      ...(nature !== undefined && { nature }),
      ...(clotureLe !== undefined && { clotureLe: clotureLe ? new Date(clotureLe) : null }),
      ...(note !== undefined && { note: note || null }),
    },
    include: { _count: { select: { priorites: true } } },
  });

  console.log(`[admin] relation institutionnelle modifiée — ${actuel.nom}`, parsed.data);
  return NextResponse.json(modifie);
}

// La suppression n'est possible que si AUCUNE déclaration ne s'y adosse (la clé étrangère est en
// RESTRICT côté base, on rend ici une erreur lisible plutôt qu'une violation de contrainte).
// Pour une relation qui a servi, le geste juste est la clôture, pas l'effacement : le produit
// doit pouvoir dire pourquoi telle commune a été mise en avant l'an dernier.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const { id } = await params;
  const n = await prisma.prioriteTerritoriale.count({ where: { clientId: id } });
  if (n > 0) {
    return NextResponse.json(
      { error: `${n} déclaration(s) s'appuient sur cette relation. La clore plutôt que la supprimer.` },
      { status: 409 },
    );
  }

  const supprime = await prisma.clientInstitutionnel.delete({ where: { id }, select: { nom: true } });
  console.log(`[admin] relation institutionnelle supprimée — ${supprime.nom} (aucune déclaration rattachée)`);
  return NextResponse.json({ ok: true });
}
