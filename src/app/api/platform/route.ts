import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isFreeAccessMode } from "@/lib/platform";

export const dynamic = "force-dynamic";

// GET /api/platform — expose l'état du mode lancement gratuit (section 100) au client
// (ex. /premium, qui masque la carte Gratuit tant que freeAccessMode est actif).
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  return NextResponse.json({ freeAccessMode: await isFreeAccessMode() });
}
