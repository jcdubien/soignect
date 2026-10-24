import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { nouveauLien } from "@/lib/confrereHorsSoignect";

export const dynamic = "force-dynamic";

// Nouveau lien d'activation (l'ancien cesse de fonctionner) — titulaire de la relation seulement.
export async function POST(_req: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { matchId } = await params;
  const lien = await nouveauLien(session.user.profileId, matchId);
  if (!lien) return NextResponse.json({ error: "Lien indisponible (compte déjà activé ou relation introuvable)." }, { status: 404 });
  return NextResponse.json({ lien });
}
