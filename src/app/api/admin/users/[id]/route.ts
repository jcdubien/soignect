import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supprimerCompte } from "@/lib/suppressionCompte";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAdmin(session: any): boolean {
  return session?.user?.role === "ADMIN";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  if (!["ADMIN", "USER"].includes(body.role)) {
    return NextResponse.json({ error: "Rôle invalide" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role: body.role },
    select: { id: true, email: true, role: true },
  });

  console.log(`[admin] role: ${id} → ${body.role}`);
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const { id } = await params;
  // Même chemin que la suppression self-service (section 230) : les deux routes faisaient un
  // `user.delete()` nu et échouaient identiquement. Un admin ne pouvait donc pas non plus
  // supprimer un compte ayant le moindre swipe.
  const r = await supprimerCompte(id);
  if (!r.supprime) {
    console.warn(`[admin] suppression refusée pour ${id}: ${r.blocage?.motif}`);
    return NextResponse.json({ error: r.blocage?.motif, details: r.blocage?.details }, { status: 409 });
  }

  console.log(`[admin] user deleted: ${id}`, r.compte);
  return NextResponse.json({ ok: true, supprime: r.compte });
}
