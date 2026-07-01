import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/rpps/verify?rpps=XXXXXXXXXX
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.profileId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const rpps = req.nextUrl.searchParams.get("rpps")?.trim();
  if (!rpps || !/^\d{10,11}$/.test(rpps)) {
    return NextResponse.json({ error: "Numéro RPPS invalide (10-11 chiffres requis)" }, { status: 400 });
  }

  const apiKey = process.env.ANS_API_KEY;
  if (!apiKey) {
    // Clé non configurée — vérification simulée en dev
    return NextResponse.json({ verified: false, error: "ANS_API_KEY non configurée" }, { status: 503 });
  }

  try {
    const res = await fetch(
      `https://gateway.api.esante.gouv.fr/fhir/v2/Practitioner?identifier=${rpps}`,
      {
        headers: { "GRAVITEE-API-KEY": apiKey },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!res.ok) {
      return NextResponse.json({ verified: false, error: `ANS API ${res.status}` }, { status: 502 });
    }

    const data = await res.json() as {
      entry?: Array<{ resource: { active?: boolean; name?: Array<{ family?: string; given?: string[] }>; qualification?: Array<{ code?: { coding?: Array<{ display?: string }> } }> } }>;
    };

    const praticien = data.entry?.[0]?.resource;
    if (!praticien || praticien.active !== true) {
      return NextResponse.json({ verified: false, error: "Praticien introuvable ou inactif" });
    }

    const profession = praticien.qualification?.[0]?.code?.coding?.[0]?.display ?? null;
    const nameEntry = praticien.name?.[0];
    const nom = nameEntry
      ? [nameEntry.family, ...(nameEntry.given ?? [])].filter(Boolean).join(" ")
      : null;

    // Mettre à jour le profil
    await prisma.profile.update({
      where: { id: session.user.profileId as string },
      data: { isVerified: true },
    });

    return NextResponse.json({ verified: true, profession, nom });
  } catch (e) {
    console.error("[RPPS verify]", e);
    return NextResponse.json({ verified: false, error: "Erreur réseau ANS" }, { status: 502 });
  }
}
