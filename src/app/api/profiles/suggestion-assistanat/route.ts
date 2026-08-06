import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST — l'utilisateur écarte la suggestion « poste long terme » (section 191).
// Rien à passer en corps : on n'agit que sur son propre profil, jamais sur celui d'un autre.
export async function POST() {
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  await prisma.profile.update({
    where: { id: session.user.profileId as string },
    data: { suggestionAssistanatVueAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
