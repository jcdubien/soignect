import { NextRequest, NextResponse } from "next/server";
import { gabaritsPour } from "@/lib/contrats/gabarits";
import { gabaritsSalariePour, NATURE_PAR_MISSION } from "@/lib/contrats/gabaritsSalarie";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess, isContractProfileEnforced } from "@/lib/platform";
import { missingContractLabels, CONTRACT_IDENTITY_SELECT } from "@/lib/contractProfile";
import { periodeParDefaut } from "@/lib/contrats/periode";
import {
  lieuTravailParDefaut, HEURES_HEBDOMADAIRES_DEFAUT, HEURES_COMPLEMENTAIRES_DEFAUT,
} from "@/lib/contrats/defauts";

// `type` en plus des champs d'identité : il sert au choix du gabarit, pas à la vérification.
// Le reste vient de la source unique (section 236) — c'est la copie manuscrite de cette liste,
// dans la route de signature, qui avait perdu `name`.
const IDENTITY_SELECT = { type: true, ...CONTRACT_IDENTITY_SELECT } as const;

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
      profileA: { select: { id: true, subscriptionPlan: true, billingTriggeredAt: true, institutionalPartner: true, isFounding: true, profession: true, ...IDENTITY_SELECT } },
      profileB: { select: { id: true, subscriptionPlan: true, billingTriggeredAt: true, institutionalPartner: true, isFounding: true, profession: true, ...IDENTITY_SELECT } },
      // `startDate`/`endDate` : l'écran doit pré-remplir la période ET pouvoir dire d'où elle
      // vient quand les deux annonces divergent (section 237).
      missionA: { select: { missionType: true, retrocessionRate: true, startDate: true, endDate: true, location: true } },
      missionB: { select: { missionType: true, retrocessionRate: true, startDate: true, endDate: true, location: true } },
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
      isFounding: myProfile.isFounding,
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

  // Période par défaut du contrat (section 237) — MÊME fonction que la route de génération, pour
  // que l'écran ne puisse pas annoncer une date que le PDF ne reprendrait pas. Le repli
  // « annonce du titulaire d'abord » est identifié des deux côtés au même endroit.
  const missionTitulaire = match.profileA.type === "TITULAIRE" ? match.missionA : match.missionB;
  const periode = periodeParDefaut(
    missionTitulaire,
    match.profileA.type === "TITULAIRE" ? match.missionB : match.missionA,
  );

  // Valeurs par défaut du contrat de travail (section 237, lot 2). Renvoyées pour que l'écran les
  // AFFICHE avant génération : aucune valeur ne doit atteindre le PDF sans avoir été montrée.
  // Même fonction que la route de génération — l'écran ne peut donc pas annoncer autre chose.
  const defautsSalarie = {
    lieuTravail: lieuTravailParDefaut(missionTitulaire, titulaireParty),
    heuresHebdomadaires: HEURES_HEBDOMADAIRES_DEFAUT,
    heuresComplementairesMax: HEURES_COMPLEMENTAIRES_DEFAUT,
  };

  // Modèles de contrat applicables (section 216). Le formulaire en a besoin AVANT de générer :
  // quand la paire (profession, type de mission) en compte plusieurs — le remplacement infirmier
  // en a deux —, c'est aux parties de choisir, pas au produit. Une liste vide dit qu'aucun modèle
  // n'existe pour ce statut dans cette profession ; l'écran doit le dire plutôt que de laisser
  // cliquer sur un bouton qui échouera.
  // Registre LIBÉRAL ou SALARIÉ selon le camp du recruteur (section 217). `isSalariat` ne bloque
  // plus aveuglément la génération : il oriente vers l'autre registre. Une liste vide continue de
  // signifier « aucun modèle pour ce cas », ce que l'écran doit dire plutôt que de laisser
  // cliquer sur un bouton qui échouera.
  const memeProfession = match.profileA.profession === match.profileB.profession;
  const gabarits =
    !missionType || !memeProfession
      ? []
      : isSalariat
        ? gabaritsSalariePour(match.profileA.profession, NATURE_PAR_MISSION[missionType]).map((g) => ({
            id: g.id, libelle: g.libelle, quandLUtiliser: null,
            source: g.source, composeSansModele: g.composeSansModele ?? false,
          }))
        : gabaritsPour(match.profileA.profession, missionType).map((g) => ({
            id: g.id, libelle: g.libelle, quandLUtiliser: g.quandLUtiliser ?? null,
            source: g.source, composeSansModele: false,
          }));

  return NextResponse.json({
    gabarits,
    missionType,
    theirName:       theirProfile.name,
    hasPremium,
    retrocessionPct,
    missingSelf,      // champs manquants du profil courant → lien /compte
    missingOther,     // champs manquants de l'autre partie → message informatif
    enforce,          // true = blocage dur ; false = avertissement non bloquant
    isSalariat,       // recruteur = structure employeuse → pas de PDF libéral (section 161)
    periode,          // dates par défaut + provenance, pour pré-remplir et signaler la divergence
    jeSuisTitulaire: titulaireParty?.id === profileId,
    defautsSalarie,   // valeurs pré-remplies du contrat de travail (aucune n'atteint le PDF sans être vue)
  });
}
