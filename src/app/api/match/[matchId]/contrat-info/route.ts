import { NextRequest, NextResponse } from "next/server";
import { gabaritsPour } from "@/lib/contrats/gabarits";
import { gabaritsSalariePour, NATURE_PAR_MISSION } from "@/lib/contrats/gabaritsSalarie";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess, isContractProfileEnforced } from "@/lib/platform";
import { missingContractLabels, CONTRACT_IDENTITY_SELECT } from "@/lib/contractProfile";
import { periodeParDefaut } from "@/lib/contrats/periode";
import { cotesDuMatch, typeDeMissionDuContrat } from "@/lib/contrats/cotes";
import {
  lieuTravailParDefaut, HEURES_HEBDOMADAIRES_DEFAUT, HEURES_COMPLEMENTAIRES_DEFAUT,
  REVERSEMENT_PCT_DEFAUT, REVERSEMENT_DELAI_MOIS_DEFAUT, REDEVANCE_CABINET_PCT_DEFAUT,
  REDEVANCE_CABINET_SEUIL_ALERTE, JOUR_VERSEMENT_REDEVANCE_DEFAUT,
  FORFAIT_DELAI_REVERSEMENT_JOURS_DEFAUT,
  PREAVIS_JOURS_DEFAUT, PREAVIS_COMMUN_ACCORD_JOURS_DEFAUT, PREAVIS_UNILATERAL_JOURS_DEFAUT,
  PREAVIS_ESSAI_JOURS_DEFAUT, PERIODE_ESSAI_MOIS_INFIRMIER_DEFAUT, PERIODE_ESSAI_MOIS_CDI_DEFAUT,
  RENOUVELLEMENTS_MAX_DEFAUT, DUREE_MAX_MOIS_DEFAUT, dureeMoisParDefaut,
  NON_CONCURRENCE_DUREE_MOIS_DEFAUT, NON_CONCURRENCE_INDEMNITE_PCT_DEFAUT,
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
      // `profession` était listée ici à la main ; elle est entrée dans `CONTRACT_IDENTITY_SELECT`
      // avec la section 287, et la garder en double la faisait écraser par le spread. Une liste
      // de champs recopiée est une liste qui divergera — c'est le motif même de cette constante.
      profileA: { select: { id: true, subscriptionPlan: true, billingTriggeredAt: true, institutionalPartner: true, isFounding: true, ...IDENTITY_SELECT } },
      profileB: { select: { id: true, subscriptionPlan: true, billingTriggeredAt: true, institutionalPartner: true, isFounding: true, ...IDENTITY_SELECT } },
      // `startDate`/`endDate` : l'écran doit pré-remplir la période ET pouvoir dire d'où elle
      // vient quand les deux annonces divergent (section 237).
      missionA: { select: { missionType: true, retrocessionRate: true, retrocessionMode: true, retrocessionFixeEuros: true, retrocessionPlafondEuros: true, startDate: true, endDate: true, location: true, minMonths: true, estSalariat: true, natureSalariat: true, createdAt: true } },
      missionB: { select: { missionType: true, retrocessionRate: true, retrocessionMode: true, retrocessionFixeEuros: true, retrocessionPlafondEuros: true, startDate: true, endDate: true, location: true, minMonths: true, estSalariat: true, natureSalariat: true, createdAt: true } },
    },
  });

  if (!match) return NextResponse.json({ error: "Match introuvable" }, { status: 404 });
  if (match.profileAId !== profileId && match.profileBId !== profileId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const isA       = match.profileAId === profileId;
  const myProfile = isA ? match.profileA : match.profileB;
  const theirProfile = isA ? match.profileB : match.profileA;

  // Côtés du match — MÊME fonction que la route de génération (section 238). Ce fichier les
  // déduisait auparavant par ses propres moyens, et n'en tirait pas les mêmes conclusions.
  const { profilTitulaire, missionTitulaire, missionCandidat } = cotesDuMatch(match);

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

  // Type de contrat : l'annonce du TITULAIRE d'abord, comme la génération (section 238). Ce
  // calcul partait de `missionA`, dont l'ordre A/B ne dit rien du rôle : sur `cmsvtatr` l'écran
  // annonçait « Assistanat libéral » et « aucun modèle », quand la route produisait un CDI.
  const missionType = typeDeMissionDuContrat(missionTitulaire, missionCandidat);
  const retrocessionPct =
    missionTitulaire?.retrocessionRate ?? missionCandidat?.retrocessionRate ?? 70;

  // Complétude de l'identité contractuelle (section 150) des deux parties.
  const missingSelf  = missingContractLabels(myProfile);
  const missingOther = missingContractLabels(theirProfile);
  const enforce = await isContractProfileEnforced();

  // ── LE SALARIAT EST UNE PROPRIÉTÉ DE L'ANNONCE, PAS DU RECRUTEUR (section 294) ───────────
  //
  // Le test portait sur `titulaireKind === "STRUCTURE"`. Il datait d'un temps où seules les
  // structures employaient. La section 262 a ouvert le salariat aux cabinets LIBÉRAUX — le
  // modèle CNOMK du CDD est écrit mot pour mot pour « le masseur-kinésithérapeute libéral » qui
  // embauche son remplaçant — mais ce test-ci n'a pas suivi : un cabinet libéral publiant un
  // poste salarié se voyait proposer les gabarits LIBÉRAUX, c'est-à-dire exactement le contraire
  // de ce qu'il a publié.
  //
  // REPLI SUR LA STRUCTURE, ET SEULEMENT POUR L'ANCIEN. Avant le 22/09, `estSalariat` n'existait
  // pas : une annonce de structure ne pouvait pas le porter, et la déduire du recruteur était la
  // seule lecture possible. Après cette date, l'annonce dit elle-même ce qu'elle propose, et la
  // déduire à nouveau écraserait un choix explicite.
  //
  // Mesuré le 09/10 avant bascule : 41 annonces de titulaires, 4 publiées par une structure,
  // TOUTES antérieures au 22/09 — donc couvertes par le repli. Zéro annonce change de registre.
  const DEBUT_SALARIAT_EN_BASE = new Date("2026-09-22T00:00:00Z");
  const annonceAnterieure =
    !missionTitulaire || missionTitulaire.createdAt < DEBUT_SALARIAT_EN_BASE;
  const isSalariat =
    missionTitulaire?.estSalariat === true ||
    (annonceAnterieure && profilTitulaire.titulaireKind === "STRUCTURE");

  // La NATURE vient de l'annonce quand elle la porte. `NATURE_PAR_MISSION` déduit du type de
  // mission — un assistanat devient un CDD — ce qui reste juste faute de mieux, mais un cabinet
  // qui a coché « CDI » ne doit pas se voir proposer un CDD parce que son annonce est rangée en
  // assistanat. `CDD_TERME` et `CDD_SANS_TERME` désignent deux variantes du même gabarit CDD.
  const natureContrat =
    missionTitulaire?.natureSalariat === "CDI"
      ? ("CDI" as const)
      : missionTitulaire?.natureSalariat?.startsWith("CDD")
        ? ("CDD" as const)
        : missionType
          ? NATURE_PAR_MISSION[missionType]
          : ("CDD" as const);

  // Période par défaut du contrat (section 237) — MÊME fonction que la route de génération, pour
  // que l'écran ne puisse pas annoncer une date que le PDF ne reprendrait pas. Le repli
  // « annonce du titulaire d'abord » est identifié des deux côtés au même endroit.
  const periode = periodeParDefaut(missionTitulaire, missionCandidat);

  // Valeurs par défaut du contrat de travail (section 237, lot 2). Renvoyées pour que l'écran les
  // AFFICHE avant génération : aucune valeur ne doit atteindre le PDF sans avoir été montrée.
  // Même fonction que la route de génération — l'écran ne peut donc pas annoncer autre chose.
  const defautsSalarie = {
    lieuTravail: lieuTravailParDefaut(missionTitulaire, profilTitulaire),
    heuresHebdomadaires: HEURES_HEBDOMADAIRES_DEFAUT,
    heuresComplementairesMax: HEURES_COMPLEMENTAIRES_DEFAUT,
  };

  // Honoraires et reversements des modèles INFIRMIER (section 237, lot 3). Mêmes constantes que
  // la route de génération : l'écran ne peut donc pas annoncer un taux que le PDF ne reprendrait
  // pas. `redevanceCabinetPct` porte un nom DISTINCT de `redevancePct` parce que les deux
  // décrivent des flux de sens opposés — voir le commentaire de `defauts.ts`.
  const defautsInfirmier = {
    reversementPct: REVERSEMENT_PCT_DEFAUT,
    reversementDelaiMois: REVERSEMENT_DELAI_MOIS_DEFAUT,
    redevanceCabinetPct: REDEVANCE_CABINET_PCT_DEFAUT,
    redevanceCabinetSeuilAlerte: REDEVANCE_CABINET_SEUIL_ALERTE,
    jourVersementRedevance: JOUR_VERSEMENT_REDEVANCE_DEFAUT,
    forfaitDelaiReversementJours: FORFAIT_DELAI_REVERSEMENT_JOURS_DEFAUT,
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
        ? gabaritsSalariePour(profilTitulaire.profession, natureContrat).map((g) => ({
            id: g.id, libelle: g.libelle, quandLUtiliser: null,
            source: g.source, composeSansModele: g.composeSansModele ?? false,
          }))
        : gabaritsPour(profilTitulaire.profession, missionType).map((g) => ({
            id: g.id, libelle: g.libelle, quandLUtiliser: g.quandLUtiliser ?? null,
            source: g.source, composeSansModele: false,
          }));

  // Durée, préavis et non-concurrence (section 237, lot 4). Mêmes constantes que la génération.
  // `dureeMois` est la seule qui dépende des annonces : la durée déclarée y prime sur le défaut.
  const defautsDuree = {
    preavisJours: PREAVIS_JOURS_DEFAUT,
    preavisCommunAccordJours: PREAVIS_COMMUN_ACCORD_JOURS_DEFAUT,
    preavisUnilateralJours: PREAVIS_UNILATERAL_JOURS_DEFAUT,
    preavisEssaiJours: PREAVIS_ESSAI_JOURS_DEFAUT,
    periodeEssaiMoisInfirmier: PERIODE_ESSAI_MOIS_INFIRMIER_DEFAUT,
    periodeEssaiMoisCdi: PERIODE_ESSAI_MOIS_CDI_DEFAUT,
    dureeMois: dureeMoisParDefaut(missionTitulaire, missionCandidat),
    renouvellementsMax: RENOUVELLEMENTS_MAX_DEFAUT,
    dureeMaxMois: DUREE_MAX_MOIS_DEFAUT,
    nonConcurrenceDureeMois: NON_CONCURRENCE_DUREE_MOIS_DEFAUT,
    nonConcurrenceIndemnitePct: NON_CONCURRENCE_INDEMNITE_PCT_DEFAUT,
  };

  return NextResponse.json({
    gabarits,
    defautsDuree,     // durée, préavis, non-concurrence — lot 4
    missionType,
    theirName:       theirProfile.name,
    hasPremium,
    retrocessionPct,
    // Le MODE vient de l'annonce du cabinet (section 293) : l'écran de génération doit montrer
    // un forfait là où l'annonce en propose un, et non un curseur de pourcentage sans objet.
    retrocession: {
      mode: missionTitulaire?.retrocessionMode ?? "POURCENTAGE",
      fixeEuros: missionTitulaire?.retrocessionFixeEuros ?? null,
      plafondEuros: missionTitulaire?.retrocessionPlafondEuros ?? null,
    },
    missingSelf,      // champs manquants du profil courant → lien /compte
    missingOther,     // champs manquants de l'autre partie → message informatif
    enforce,          // true = blocage dur ; false = avertissement non bloquant
    isSalariat,       // recruteur = structure employeuse → pas de PDF libéral (section 161)
    periode,          // dates par défaut + provenance, pour pré-remplir et signaler la divergence
    jeSuisTitulaire: profilTitulaire.id === profileId,
    defautsSalarie,   // valeurs pré-remplies du contrat de travail (aucune n'atteint le PDF sans être vue)
    defautsInfirmier, // idem pour les honoraires et reversements des modèles CNOI
    // Profession du contrat — celle du TITULAIRE, comme le gabarit (section 240). L'écran en a
    // besoin pour nommer le bon ordre professionnel et le bon article de code : il les codait
    // en dur pour les kinés, et les affichait donc faux à un infirmier.
    profession: profilTitulaire.profession,
  });
}
