import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { SubscriptionPlan, MissionType } from "@prisma/client";
import { buildRemplacementPdf } from "@/lib/contrats/template-remplacement";
import { buildAssisanatPdf } from "@/lib/contrats/template-assistanat";
import { buildCollaborationPdf } from "@/lib/contrats/template-collaboration";
import type { ContractParty } from "@/lib/contrats/types";
import { sendContratEmail } from "@/lib/email";
import { hasPremiumAccess, isContractProfileEnforced } from "@/lib/platform";
import { missingContractFields } from "@/lib/contractProfile";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

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

function partyFromProfile(
  profile: {
    name: string | null; profession: string; location?: string | null;
    rpps?: string | null; numeroOrdre?: string | null; adresse?: string | null;
    siret?: string | null; titulaireKind?: string | null;
  },
  location: string
): ContractParty {
  return {
    name:        profile.name ?? "",
    profession:  professionLabel(profile.profession),
    location,
    rpps:        profile.rpps ?? null,
    numeroOrdre: profile.numeroOrdre ?? null,
    adresse:     profile.adresse ?? null,
    siret:       profile.siret ?? null,
    isStructure: profile.titulaireKind === "STRUCTURE",
  };
}

interface Params { params: Promise<{ matchId: string }> }

// Télécharge une signature du bucket privé "signatures" et la renvoie en data URL base64
async function fetchSignatureDataUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  try {
    const { data, error } = await getSupabaseAdmin().storage.from("signatures").download(path);
    if (error || !data) return null;
    const buf = Buffer.from(await data.arrayBuffer());
    const ext = path.split(".").pop();
    const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

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

  // Accès Premium — via le helper unifié (mode gratuit global + grâce billing, section 100),
  // ou partenaire CPTS (Premium gratuit, item 25). Cohérent avec /annonces et /match/[id].
  const myProfile = match.profileAId === profileId ? match.profileA : match.profileB;
  const mp = myProfile as typeof myProfile & { subscriptionPlan: SubscriptionPlan; billingTriggeredAt?: Date | null; institutionalPartner?: boolean };
  const allowed = mp.institutionalPartner || await hasPremiumAccess({ subscriptionPlan: mp.subscriptionPlan, billingTriggeredAt: mp.billingTriggeredAt });
  if (!allowed) {
    return NextResponse.json({ error: "Fonctionnalité réservée aux abonnés Premium" }, { status: 403 });
  }

  // Verrou d'état (indépendant de l'abonnement, section signature/137) : le PDF OFFICIEL
  // (signatures apposées, sans filigrane) n'est téléchargeable qu'une fois les DEUX
  // signatures présentes — verrou inchangé (commit 8561438). Avant cela, seul un
  // BROUILLON filigrané « DOCUMENT NON OFFICIEL » est téléchargeable (draft=true),
  // pour que les parties relisent le contenu avant de signer à la main.
  const bothSigned = !!match.signatureTitulaireUrl && !!match.signatureRemplacantUrl;
  const isDraft = new URL(req.url).searchParams.get("draft") === "true";
  if (!isDraft && !bothSigned) {
    return NextResponse.json(
      { error: "Le contrat doit être signé par les deux parties avant de télécharger le PDF officiel." },
      { status: 409 }
    );
  }

  // Identifier TITULAIRE et l'autre partie
  const profileTitulaire = match.profileA.type === "TITULAIRE" ? match.profileA : match.profileB;
  const profileAutre      = match.profileA.type === "TITULAIRE" ? match.profileB : match.profileA;

  // Identité contractuelle (section 150) — blocage dur si activé et une des 2 parties
  // incomplète (RPPS/N° Ordre/adresse praticiens, SIRET/adresse structures). En phase
  // d'avertissement (flag off), on laisse générer avec des placeholders « à compléter ».
  if (await isContractProfileEnforced()) {
    const missSelf  = missingContractFields(myProfile);
    const missOther = missingContractFields(profileId === profileTitulaire.id ? profileAutre : profileTitulaire);
    if (missSelf.length > 0 || missOther.length > 0) {
      return NextResponse.json(
        { error: "Identité contractuelle incomplète — complétez votre profil (et l'autre partie le sien) avant de générer le contrat." },
        { status: 422 }
      );
    }
  }
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

  // Signatures photo (section 61) — apposées dans le PDF si présentes
  const signatureTitulaireImg  = await fetchSignatureDataUrl(match.signatureTitulaireUrl);
  const signatureRemplacantImg = await fetchSignatureDataUrl(match.signatureRemplacantUrl);

  let element: ReturnType<typeof buildRemplacementPdf>;
  let filename: string;

  if (missionType === MissionType.REMPLACEMENT) {
    element = buildRemplacementPdf({
      remplace: titulaireParty, remplacant: autreParty,
      startDate:  missionTitulaire?.startDate?.toISOString() ?? missionAutre?.startDate?.toISOString() ?? null,
      endDate:    missionTitulaire?.endDate?.toISOString()   ?? missionAutre?.endDate?.toISOString()   ?? null,
      retrocessionPct, rayonKm, periodeEssai, generatedAt,
      signatureTitulaireImg, signatureRemplacantImg, draft: isDraft,
    });
    filename = "contrat-remplacement.pdf";
  } else if (missionType === MissionType.ASSISTANAT) {
    element = buildAssisanatPdf({
      titulaire: titulaireParty, assistant: autreParty,
      startDate: missionTitulaire?.startDate?.toISOString() ?? missionAutre?.startDate?.toISOString() ?? null,
      minMonths: missionTitulaire?.minMonths ?? missionAutre?.minMonths ?? null,
      redevancePct, rayonKm, dureeAns, periodeEssai, generatedAt,
      signatureTitulaireImg, signatureRemplacantImg, draft: isDraft,
    });
    filename = "contrat-assistanat.pdf";
  } else {
    element = buildCollaborationPdf({
      titulaire: titulaireParty, collaborateur: autreParty,
      startDate: missionTitulaire?.startDate?.toISOString() ?? missionAutre?.startDate?.toISOString() ?? null,
      minMonths: missionTitulaire?.minMonths ?? missionAutre?.minMonths ?? null,
      redevancePct, rayonKm, dureeAns, periodeEssai, generatedAt,
      signatureTitulaireImg, signatureRemplacantImg, draft: isDraft,
    });
    filename = "contrat-collaboration.pdf";
  }

  if (isDraft) filename = filename.replace(/\.pdf$/, "-brouillon.pdf");

  const buffer = await renderToBuffer(element);

  // Email "contrat disponible" au remplaçant, quand c'est le titulaire qui le prépare.
  // Uniquement pour le PDF officiel — un aperçu brouillon ne déclenche aucune notification.
  if (!isDraft && profileId === profileTitulaire.id && profileAutre.id !== profileTitulaire.id) {
    const autreUser = await prisma.user.findFirst({
      where: { profile: { id: profileAutre.id } },
      select: { email: true, emailOptIn: true },
    });
    if (autreUser) {
      await sendContratEmail(autreUser.email, { matchId, optIn: autreUser.emailOptIn });
    }
  }

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control":       "no-store",
    },
  });
}
