import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { SubscriptionPlan, MissionType } from "@prisma/client";
import { buildRemplacementPdf } from "@/lib/contrats/template-remplacement";
import { buildAssisanatPdf } from "@/lib/contrats/template-assistanat";
import { buildCollaborationPdf } from "@/lib/contrats/template-collaboration";
import type { ContractParty } from "@/lib/contrats/types";

export const dynamic = "force-dynamic";
// Force Node.js runtime — @react-pdf/renderer uses Node APIs
export const runtime = "nodejs";

function professionLabel(p: string): string {
  const map: Record<string, string> = {
    KINESITHERAPEUTE: "Masseur-kinésithérapeute",
    OSTEOPATHE:       "Ostéopathe",
    CHIROPRACTEUR:    "Chiropracteur",
  };
  return map[p] ?? p;
}

function partyFromProfile(profile: { name: string | null; profession: string; location?: string | null }, location: string): ContractParty {
  return {
    name:       profile.name ?? "",
    profession: professionLabel(profile.profession),
    location,
  };
}

interface Params { params: Promise<{ matchId: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.profileId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const profileId = session.user.profileId as string;
  const { matchId } = await params;

  // Récupération du match avec tous les profils et missions
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      profileA: true,
      profileB: true,
      missionA: true,
      missionB: true,
    },
  });

  if (!match) return NextResponse.json({ error: "Match introuvable" }, { status: 404 });

  // Vérifier l'appartenance
  if (match.profileAId !== profileId && match.profileBId !== profileId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Vérifier le plan d'abonnement (PREMIUM ou BOOST seulement)
  const myProfile = match.profileAId === profileId ? match.profileA : match.profileB;
  const plan = (myProfile as typeof myProfile & { subscriptionPlan: SubscriptionPlan }).subscriptionPlan;
  if (plan === SubscriptionPlan.FREE) {
    return NextResponse.json({ error: "Fonctionnalité réservée aux abonnés Premium" }, { status: 403 });
  }

  // Identifier TITULAIRE et l'autre partie
  const profileTitulaire = match.profileA.type === "TITULAIRE" ? match.profileA : match.profileB;
  const profileAutre      = match.profileA.type === "TITULAIRE" ? match.profileB : match.profileA;
  const missionTitulaire  = match.profileA.type === "TITULAIRE" ? match.missionA : match.missionB;
  const missionAutre      = match.profileA.type === "TITULAIRE" ? match.missionB : match.missionA;

  // Déterminer le type de contrat depuis la mission du titulaire (sinon mission de l'autre)
  const missionType: MissionType =
    (missionTitulaire?.missionType ?? missionAutre?.missionType ?? MissionType.REMPLACEMENT) as MissionType;

  const locationTitulaire = missionTitulaire?.location ?? profileTitulaire.name ?? "cabinet";
  const locationAutre     = missionAutre?.location ?? profileAutre.name ?? "domicile";

  const titulaireParty = partyFromProfile(profileTitulaire, locationTitulaire);
  const autreParty     = partyFromProfile(profileAutre, locationAutre);

  // Paramètres depuis query string
  const sp = new URL(req.url).searchParams;
  const rayonKm      = Math.max(1, parseInt(sp.get("rayonKm")      ?? "20", 10));
  const dureeAns     = Math.max(1, parseInt(sp.get("dureeAns")     ?? "2",  10));
  const periodeEssai = sp.get("periodeEssai") === "true";
  const retrocessionPct = parseInt(sp.get("retrocessionPct") ?? String(missionTitulaire?.retrocessionRate ?? 70), 10);
  const redevancePct    = parseInt(sp.get("redevancePct")    ?? "40", 10);

  const generatedAt = new Date().toISOString();

  let element: ReturnType<typeof buildRemplacementPdf>;
  let filename: string;

  if (missionType === MissionType.REMPLACEMENT) {
    element = buildRemplacementPdf({
      remplace: titulaireParty, remplacant: autreParty,
      startDate:  missionTitulaire?.startDate?.toISOString() ?? missionAutre?.startDate?.toISOString() ?? null,
      endDate:    missionTitulaire?.endDate?.toISOString()   ?? missionAutre?.endDate?.toISOString()   ?? null,
      retrocessionPct, rayonKm, periodeEssai, generatedAt,
    });
    filename = "contrat-remplacement.pdf";
  } else if (missionType === MissionType.ASSISTANAT) {
    element = buildAssisanatPdf({
      titulaire: titulaireParty, assistant: autreParty,
      startDate: missionTitulaire?.startDate?.toISOString() ?? missionAutre?.startDate?.toISOString() ?? null,
      minMonths: missionTitulaire?.minMonths ?? missionAutre?.minMonths ?? null,
      redevancePct, rayonKm, dureeAns, periodeEssai, generatedAt,
    });
    filename = "contrat-assistanat.pdf";
  } else {
    element = buildCollaborationPdf({
      titulaire: titulaireParty, collaborateur: autreParty,
      startDate: missionTitulaire?.startDate?.toISOString() ?? missionAutre?.startDate?.toISOString() ?? null,
      minMonths: missionTitulaire?.minMonths ?? missionAutre?.minMonths ?? null,
      redevancePct, rayonKm, dureeAns, periodeEssai, generatedAt,
    });
    filename = "contrat-collaboration.pdf";
  }

  const buffer = await renderToBuffer(element);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control":       "no-store",
    },
  });
}
