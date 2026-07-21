import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess, isContractProfileEnforced } from "@/lib/platform";
import { missingContractLabels } from "@/lib/contractProfile";

const IDENTITY_SELECT = {
  type: true, name: true, rpps: true, numeroOrdre: true, adresse: true, siret: true, titulaireKind: true,
} as const;

export const dynamic = "force-dynamic";

interface Params { params: Promise<{ matchId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.profileId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const profileId = session.user.profileId as string;
  const { matchId } = await params;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      profileA: { select: { id: true, subscriptionPlan: true, billingTriggeredAt: true, institutionalPartner: true, ...IDENTITY_SELECT } },
      profileB: { select: { id: true, subscriptionPlan: true, billingTriggeredAt: true, institutionalPartner: true, ...IDENTITY_SELECT } },
      missionA: { select: { missionType: true, retrocessionRate: true } },
      missionB: { select: { missionType: true, retrocessionRate: true } },
    },
  });

  if (!match) return NextResponse.json({ error: "Match introuvable" }, { status: 404 });
  if (match.profileAId !== profileId && match.profileBId !== profileId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const isA       = match.profileAId === profileId;
  const myProfile = isA ? match.profileA : match.profileB;
  const theirProfile = isA ? match.profileB : match.profileA;

  // Même logique que la route de génération PDF (fce5be5) : partenaire institutionnel OU
  // accès premium effectif (hasPremiumAccess prend en compte freeAccessMode, fondateur,
  // abonnement payant et grâce de bascule individuelle). Le check brut plan===PREMIUM/BOOST
  // ignorait tout ça → verrou « Premium » à tort pendant le mode lancement gratuit.
  const hasPremium =
    myProfile.institutionalPartner ||
    (await hasPremiumAccess({
      subscriptionPlan: myProfile.subscriptionPlan,
      billingTriggeredAt: myProfile.billingTriggeredAt,
    }));

  const missionType =
    match.missionA?.missionType ?? match.missionB?.missionType ?? null;
  const retrocessionPct =
    match.missionA?.retrocessionRate ?? match.missionB?.retrocessionRate ?? 70;

  // Complétude de l'identité contractuelle (section 150) des deux parties.
  const missingSelf  = missingContractLabels(myProfile);
  const missingOther = missingContractLabels(theirProfile);
  const enforce = await isContractProfileEnforced();

  // Salariat (section 161) : le recruteur est une STRUCTURE (employeur) → CDD/CDI/Stage/Vacation.
  // Soignect ne génère PAS de contrat de travail (les 3 templates sont libéraux) → on bloque
  // le PDF et on affiche un message dédié.
  const titulaireParty =
    match.profileA.type === "TITULAIRE" ? match.profileA :
    match.profileB.type === "TITULAIRE" ? match.profileB : null;
  const isSalariat = titulaireParty?.titulaireKind === "STRUCTURE";

  return NextResponse.json({
    missionType,
    theirName:       theirProfile.name,
    hasPremium,
    retrocessionPct,
    missingSelf,      // champs manquants du profil courant → lien /compte
    missingOther,     // champs manquants de l'autre partie → message informatif
    enforce,          // true = blocage dur ; false = avertissement non bloquant
    isSalariat,       // recruteur = structure employeuse → pas de PDF libéral (section 161)
  });
}
