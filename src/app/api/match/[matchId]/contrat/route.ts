import { NextRequest, NextResponse } from "next/server";
import { professionLabel } from "@/lib/professions";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { SubscriptionPlan, MissionType } from "@prisma/client";
import { buildRemplacementPdf } from "@/lib/contrats/template-remplacement";
import { buildAssisanatPdf } from "@/lib/contrats/template-assistanat";
import { buildCollaborationPdf } from "@/lib/contrats/template-collaboration";
import { buildRemplacementInfirmierAutorisePdf } from "@/lib/contrats/template-infirmier-remplacement-autorisation";
import { buildRemplacementInfirmierConfrerePdf } from "@/lib/contrats/template-infirmier-remplacement-confrere";
import { buildCollaborationInfirmierPdf } from "@/lib/contrats/template-infirmier-collaboration";
import { gabaritsPour } from "@/lib/contrats/gabarits";
import { buildKineSalariatCdiPdf } from "@/lib/contrats/template-kine-salariat-cdi";
import { NATURE_PAR_MISSION, gabaritsSalariePour } from "@/lib/contrats/gabaritsSalarie";
import type { ContractParty } from "@/lib/contrats/types";
import { sendContratEmail } from "@/lib/email";
import { hasPremiumAccess, isContractProfileEnforced } from "@/lib/platform";
import { missingContractFields } from "@/lib/contractProfile";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
// Force Node.js runtime — @react-pdf/renderer uses Node APIs
export const runtime = "nodejs";

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
    // Dénomination légale, pas l'usage courant : un contrat désigne un
    // « masseur-kinésithérapeute ». Source unique et typée dans lib/professions.
    profession:  professionLabel(profile.profession, "contrat"),
    location,
    rpps:        profile.rpps ?? null,
    numeroOrdre: profile.numeroOrdre ?? null,
    adresse:     profile.adresse ?? null,
    siret:       profile.siret ?? null,
    isStructure: profile.titulaireKind === "STRUCTURE",
    // Valeur d'enum, en plus du libellé : elle choisit le VOCABULAIRE de l'ordre concerné
    // (« N° Ordre » chez le CNOMK, « n° ordinal » chez le CNOI). Voir party-identity.tsx.
    professionEnum: profile.profession,
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

  // Salariat (section 161) : recruteur = STRUCTURE employeuse → pas de PDF (templates libéraux
  // uniquement). Garde défensif si l'API est appelée directement.
  const titulaireForKind =
    (match.profileA as { type: string; titulaireKind?: string }).type === "TITULAIRE" ? match.profileA : match.profileB;
  if ((titulaireForKind as { titulaireKind?: string }).titulaireKind === "STRUCTURE") {
    return NextResponse.json(
      { error: "Poste salarié : le contrat de travail est établi par l'établissement, hors plateforme." },
      { status: 422 }
    );
  }

  // Accès Premium — via le helper unifié (mode gratuit global + grâce billing, section 100),
  // ou partenaire CPTS (Premium gratuit, item 25). Cohérent avec /annonces et /match/[id].
  const myProfile = match.profileAId === profileId ? match.profileA : match.profileB;
  const mp = myProfile as typeof myProfile & { subscriptionPlan: SubscriptionPlan; billingTriggeredAt?: Date | null; institutionalPartner?: boolean; isFounding?: boolean };
  const allowed = mp.institutionalPartner || await hasPremiumAccess({ subscriptionPlan: mp.subscriptionPlan, billingTriggeredAt: mp.billingTriggeredAt, isFounding: mp.isFounding });
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

  // Type de contrat : mission du titulaire, sinon mission de l'autre partie.
  //
  // AUCUN REPLI (section 210). Ce calcul retombait sur REMPLACEMENT quand aucune des deux
  // missions n'existait — un gabarit choisi par défaut, sans le moindre signal à l'écran ni
  // dans le PDF. Inoffensif tant qu'un match porte toujours au moins une mission, mais c'est
  // désormais possible : l'unicité repose sur la paire de missions (section 209) et missionBId
  // est nullable. Le jour où une mise en relation naîtra sans mission des deux côtés, deviner
  // produirait un contrat de REMPLACEMENT pour un assistanat — un document juridique faux,
  // signé, sans que rien ne l'ait dit.
  //
  // On refuse. Un contrat absent se remarque et se corrige ; un contrat faux se découvre trop
  // tard. C'est la règle d'écriture opposable appliquée au document lui-même.
  const missionType = (missionTitulaire?.missionType ?? missionAutre?.missionType) as MissionType | undefined;
  if (!missionType) {
    return NextResponse.json(
      {
        error:
          "Impossible de générer le contrat : aucune annonce n'est rattachée à cette mise en " +
          "relation, le type de contrat ne peut donc pas être déterminé. Rattachez l'annonce " +
          "concernée avant de poursuivre.",
      },
      { status: 422 },
    );
  }

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

  // Clauses négociables in-app (section 164) — remplacent les placeholders figés des templates.
  const ALLOWED_MODES = ["Virement bancaire", "Chèque", "Espèces", "Autre"];
  const rawMode = sp.get("modePaiement") ?? "";
  const modePaiement = ALLOWED_MODES.includes(rawMode) ? rawMode : "Virement bancaire";
  const delaiParsed = parseInt(sp.get("delaiPaiementJours") ?? "5", 10);
  const delaiPaiementJours = Number.isFinite(delaiParsed) ? Math.min(60, Math.max(1, delaiParsed)) : 5;
  const modalitesLocaux = (sp.get("modalitesLocaux") ?? "").slice(0, 600); // borne anti-débordement PDF

  const generatedAt = new Date().toISOString();

  // Signatures photo (section 61) — apposées dans le PDF si présentes
  const signatureTitulaireImg  = await fetchSignatureDataUrl(match.signatureTitulaireUrl);
  const signatureRemplacantImg = await fetchSignatureDataUrl(match.signatureRemplacantUrl);

  // ── Choix du gabarit (section 216) ────────────────────────────────────────────────────────
  //
  // La sélection se faisait sur `missionType` SEUL, ce qui supposait un gabarit unique par type.
  // Faux depuis les modèles infirmier : le remplacement en compte deux selon que le remplaçant
  // soit installé ou simplement autorisé, et l'assistanat n'existe pas dans cette profession.
  //
  // LES DEUX PARTIES DOIVENT EXERCER LA MÊME PROFESSION. Le feed le garantit — il borne chaque
  // lecteur à la sienne depuis le 17/08 — mais `Profile.profession` reste modifiable dans
  // /compte APRÈS la mise en relation. On refuse plutôt que de choisir l'une des deux : générer
  // un contrat de kiné entre un kiné et un infirmier serait un document faux et signé.
  if (profileTitulaire.profession !== profileAutre.profession) {
    return NextResponse.json(
      {
        error:
          "Impossible de générer le contrat : les deux parties ne déclarent pas la même " +
          "profession. Le modèle applicable dépend de l'ordre professionnel concerné.",
      },
      { status: 422 },
    );
  }

  let element: ReturnType<typeof buildRemplacementPdf>;
  let filename: string;

  // ── SALARIAT : bifurcation AVANT la résolution libérale (section 217) ─────────────────────
  //
  // Le recruteur est une STRUCTURE → c'est un contrat de travail, pas un engagement libéral.
  // Cette bifurcation ne passe PAS par `MissionType` : ajouter `SALARIE` à l'enum aurait compilé
  // en silence dans 43 fichiers dont aucun ne l'énumère exhaustivement, et un salariat serait
  // sorti en contrat de collaboration libérale via le `else` final ci-dessous. Le champ qui
  // distingue les deux mondes existe déjà et pilote déjà le vocabulaire des formulaires.
  //
  // `missionType` reste la source de la nature CDI/CDD, via une table déclarée — voir
  // NATURE_PAR_MISSION et le commentaire qui l'accompagne : la même valeur d'enum désigne une
  // collaboration libérale chez un cabinet et un CDI chez une structure.
  if (profileTitulaire.titulaireKind === "STRUCTURE") {
    const nature = NATURE_PAR_MISSION[missionType];
    const candidatsSalarie = gabaritsSalariePour(profileTitulaire.profession, nature);

    // Trois des quatre gabarits salariés ne sont pas écrits. Refus explicite, jamais un repli
    // sur un gabarit voisin : un contrat de travail rendu avec un modèle libéral serait un
    // document faux et signé.
    if (candidatsSalarie.length === 0) {
      return NextResponse.json(
        {
          error:
            `Impossible de générer le contrat : aucun modèle de contrat de travail (${nature}) ` +
            "n'est encore disponible pour cette profession.",
        },
        { status: 422 },
      );
    }

    const demandeSalarie = sp.get("gabaritId");
    const gabaritSalarie = candidatsSalarie.length === 1
      ? candidatsSalarie[0]
      : candidatsSalarie.find((g) => g.id === demandeSalarie);

    if (!gabaritSalarie) {
      return NextResponse.json(
        {
          error: "Plusieurs modèles de contrat de travail existent : précisez lequel s'applique.",
          choix: candidatsSalarie.map((g) => ({ id: g.id, libelle: g.libelle, source: g.source })),
        },
        { status: 422 },
      );
    }

    // Paramètres du contrat de travail, saisis à la génération comme pour les variantes
    // libérales. `temps` est une union discriminée : un temps partiel ne peut pas être construit
    // sans sa répartition horaire, que le Code du travail exige.
    const entierS = (cle: string, defaut: number, min: number, max: number) => {
      const v = parseInt(sp.get(cle) ?? String(defaut), 10);
      return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : defaut;
    };
    const texteS = (cle: string, max = 200) => (sp.get(cle) ?? "").slice(0, max);
    const heures = entierS("heuresHebdomadaires", 35, 1, 48);
    const estPartiel = sp.get("tempsPartiel") === "true";
    const repartition = texteS("repartitionHoraire", 600)
      .split(";")
      .map((seg) => seg.split("|"))
      .filter((x) => x.length === 3 && x[0].trim())
      .map(([jour, debut, fin]) => ({ jour: jour.trim(), debut: debut.trim(), fin: fin.trim() }));

    const essaiBrut = sp.get("periodeEssaiMois");
    const debut = missionTitulaire?.startDate?.toISOString() ?? missionAutre?.startDate?.toISOString() ?? null;

    if (gabaritSalarie.id === "KINE_SALARIAT_CDI") {
      element = buildKineSalariatCdiPdf({
        employeur: titulaireParty,
        salarie: autreParty,
        nature: { type: "CDI", debut },
        temps: estPartiel
          ? {
              type: "PARTIEL",
              heuresHebdomadaires: heures,
              repartition,
              heuresComplementairesMax: entierS("heuresComplementairesMax", 4, 0, 20),
            }
          : { type: "COMPLET", heuresHebdomadaires: heures },
        urssafVille: texteS("urssafVille", 80),
        numeroSecuriteSociale: texteS("numeroSecuriteSociale", 25),
        lieuTravail: texteS("lieuTravail") || locationTitulaire,
        periodeEssaiMois: essaiBrut === null || essaiBrut === "" ? null : entierS("periodeEssaiMois", 2, 0, 8),
        remunerationBrutMensuelle: entierS("remunerationBrutMensuelle", 0, 0, 100000),
        caisseRetraite:   texteS("caisseRetraite", 120),
        regimeFraisSante: texteS("regimeFraisSante", 120),
        regimePrevoyance: texteS("regimePrevoyance", 120),
        nonConcurrence: {
          dureeMois:    entierS("nonConcurrenceDureeMois", 12, 0, 60),
          rayonKm,
          indemnitePct: entierS("nonConcurrenceIndemnitePct", 25, 0, 100),
          periodicite: sp.get("nonConcurrencePeriodicite") === "TRIMESTRIELLE" ? "TRIMESTRIELLE" : "MENSUELLE",
        },
        indemnitePrecaritePct: null, // sans objet en CDI
        preavisJours: entierS("preavisJours", 30, 0, 180),
        generatedAt, signatureTitulaireImg, signatureRemplacantImg, draft: isDraft,
      });
      filename = "contrat-travail-cdi.pdf";
    } else {
      // Inatteignable aujourd'hui — un seul gabarit salarié est enregistré. Refus explicite
      // plutôt qu'un repli, pour que l'ajout du prochain gabarit sans branchement se voie.
      return NextResponse.json(
        { error: "Modèle de contrat de travail reconnu mais non encore branché à la génération." },
        { status: 500 },
      );
    }

  } else {
    // ── Résolution LIBÉRALE, inchangée depuis le 28/08 ───────────────────────────────────────
  const candidats = gabaritsPour(profileTitulaire.profession, missionType);

  // AUCUN GABARIT — même refus explicite que pour un `missionType` indéterminable. C'est le cas
  // d'un assistanat entre infirmiers, ou de toute profession dont les modèles ne sont pas encore
  // transcrits. Le formulaire de publication empêche déjà d'en arriver là ; cette garde couvre
  // les annonces publiées AVANT lui, et un changement de profession après coup.
  if (candidats.length === 0) {
    return NextResponse.json(
      {
        error:
          "Impossible de générer le contrat : aucun modèle n'existe pour ce type de mission dans " +
          "votre profession. Ce statut n'a pas nécessairement d'équivalent d'un ordre à l'autre.",
      },
      { status: 422 },
    );
  }

  // PLUSIEURS VARIANTES — le choix appartient aux parties, pas au produit. On ne prend pas la
  // première : les deux régimes de facturation du remplacement infirmier sont économiquement
  // opposés, et en choisir un par défaut inverserait le sens de l'argent sur un document signé.
  const gabaritDemande = sp.get("gabaritId");
  const gabarit = candidats.length === 1
    ? candidats[0]
    : candidats.find((g) => g.id === gabaritDemande);

  if (!gabarit) {
    return NextResponse.json(
      {
        error:
          "Plusieurs modèles de contrat existent pour ce type de mission : précisez lequel " +
          "s'applique avant de générer le document.",
        choix: candidats.map((g) => ({ id: g.id, libelle: g.libelle, quandLUtiliser: g.quandLUtiliser })),
      },
      { status: 422 },
    );
  }

  // Paramètres propres aux gabarits infirmier — saisis à la génération (décision du 27/08),
  // faute d'exister sur `Profile`. Bornés comme les autres, pour la même raison.
  const entier = (cle: string, defaut: number, min: number, max: number) => {
    const v = parseInt(sp.get(cle) ?? String(defaut), 10);
    return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : defaut;
  };
  const texte = (cle: string, max = 600) => (sp.get(cle) ?? "").slice(0, max);

  if (gabarit.id === "INFIRMIER_REMPLACEMENT_AUTORISATION") {
    element = buildRemplacementInfirmierAutorisePdf({
      remplace: titulaireParty,
      remplacant: {
        ...autreParty,
        autorisationNumero: texte("autorisationNumero", 60) || null,
        autorisationDate:   texte("autorisationDate", 40) || null,
        cpamRattachement:   texte("cpamRattachement", 120) || null,
      },
      startDate: missionTitulaire?.startDate?.toISOString() ?? missionAutre?.startDate?.toISOString() ?? null,
      endDate:   missionTitulaire?.endDate?.toISOString()   ?? missionAutre?.endDate?.toISOString()   ?? null,
      reversementDirectPct:          entier("reversementDirectPct", 70, 0, 100),
      reversementDirectDelaiMois:    entier("reversementDirectDelaiMois", 1, 0, 12),
      reversementTiersPayantPct:     entier("reversementTiersPayantPct", 70, 0, 100),
      reversementTiersPayantDelaiMois: entier("reversementTiersPayantDelaiMois", 1, 0, 12),
      rayonKm,
      preavisCommunAccordJours: entier("preavisCommunAccordJours", 8, 0, 180),
      preavisUnilateralJours:   entier("preavisUnilateralJours", 8, 0, 180),
      moyensMisADisposition: texte("moyensMisADisposition"),
      generatedAt, signatureTitulaireImg, signatureRemplacantImg, draft: isDraft,
    });
    filename = "contrat-remplacement-infirmier.pdf";
  } else if (gabarit.id === "INFIRMIER_REMPLACEMENT_CONFRERE") {
    element = buildRemplacementInfirmierConfrerePdf({
      remplace: titulaireParty, remplacant: autreParty,
      startDate: missionTitulaire?.startDate?.toISOString() ?? missionAutre?.startDate?.toISOString() ?? null,
      endDate:   missionTitulaire?.endDate?.toISOString()   ?? missionAutre?.endDate?.toISOString()   ?? null,
      // L'Ordre constate un usage de 5 à 10 % et rappelle qu'un taux trop élevé s'apparenterait
      // à un partage d'honoraires (R.4312-30). Défaut au bas de cette fourchette.
      redevancePct: entier("redevancePct", 5, 0, 100),
      moyensMisADisposition: texte("moyensMisADisposition"),
      cabinetRemplacant:     texte("cabinetRemplacant", 200),
      preavisCommunAccordJours: entier("preavisCommunAccordJours", 8, 0, 180),
      preavisUnilateralJours:   entier("preavisUnilateralJours", 8, 0, 180),
      dureeInformationSollicitation: texte("dureeInformationSollicitation", 60),
      generatedAt, signatureTitulaireImg, signatureRemplacantImg, draft: isDraft,
    });
    filename = "contrat-remplacement-infirmier.pdf";
  } else if (gabarit.id === "INFIRMIER_COLLABORATION") {
    const partageBrut = sp.get("forfaitPartage");
    const forfaitPartage =
      partageBrut === "PARTS_EGALES" || partageBrut === "CHARGE_TRAVAIL" ? partageBrut : "TOUR_DE_ROLE";
    element = buildCollaborationInfirmierPdf({
      titulaire: titulaireParty, collaborateur: autreParty,
      startDate: missionTitulaire?.startDate?.toISOString() ?? missionAutre?.startDate?.toISOString() ?? null,
      dureeMois:          entier("dureeMois", missionTitulaire?.minMonths ?? missionAutre?.minMonths ?? 12, 1, 240),
      renouvellementsMax: entier("renouvellementsMax", 1, 0, 20),
      dureeMaxMois:       entier("dureeMaxMois", 24, 1, 480),
      redevancePct,
      jourVersementRedevance: entier("jourVersementRedevance", 10, 1, 31),
      moyensMisADisposition:   texte("moyensMisADisposition"),
      recensementDispositions: texte("recensementDispositions"),
      forfaitPartage,
      forfaitRepartition:           texte("forfaitRepartition", 300),
      forfaitDelaiReversementJours: entier("forfaitDelaiReversementJours", 30, 0, 365),
      periodeEssaiMois:  entier("periodeEssaiMois", 3, 0, 24),
      preavisEssaiJours: entier("preavisEssaiJours", 15, 0, 180),
      dureeInformationSollicitation: texte("dureeInformationSollicitation", 60),
      generatedAt, signatureTitulaireImg, signatureRemplacantImg, draft: isDraft,
    });
    filename = "contrat-collaboration-infirmier.pdf";
  } else if (missionType === MissionType.REMPLACEMENT) {
    element = buildRemplacementPdf({
      remplace: titulaireParty, remplacant: autreParty,
      startDate:  missionTitulaire?.startDate?.toISOString() ?? missionAutre?.startDate?.toISOString() ?? null,
      endDate:    missionTitulaire?.endDate?.toISOString()   ?? missionAutre?.endDate?.toISOString()   ?? null,
      retrocessionPct, rayonKm, periodeEssai, generatedAt,
      modePaiement, delaiPaiementJours, modalitesLocaux,
      signatureTitulaireImg, signatureRemplacantImg, draft: isDraft,
    });
    filename = "contrat-remplacement.pdf";
  } else if (missionType === MissionType.ASSISTANAT) {
    element = buildAssisanatPdf({
      titulaire: titulaireParty, assistant: autreParty,
      startDate: missionTitulaire?.startDate?.toISOString() ?? missionAutre?.startDate?.toISOString() ?? null,
      minMonths: missionTitulaire?.minMonths ?? missionAutre?.minMonths ?? null,
      redevancePct, rayonKm, dureeAns, periodeEssai, generatedAt,
      modePaiement, delaiPaiementJours, modalitesLocaux,
      signatureTitulaireImg, signatureRemplacantImg, draft: isDraft,
    });
    filename = "contrat-assistanat.pdf";
  } else {
    element = buildCollaborationPdf({
      titulaire: titulaireParty, collaborateur: autreParty,
      startDate: missionTitulaire?.startDate?.toISOString() ?? missionAutre?.startDate?.toISOString() ?? null,
      minMonths: missionTitulaire?.minMonths ?? missionAutre?.minMonths ?? null,
      redevancePct, rayonKm, dureeAns, periodeEssai, generatedAt,
      modePaiement, delaiPaiementJours, modalitesLocaux,
      signatureTitulaireImg, signatureRemplacantImg, draft: isDraft,
    });
    filename = "contrat-collaboration.pdf";
  }

  }

  // ── Queue COMMUNE aux deux mondes : brouillon, rendu, notification, réponse ────────────────
  // Partagée volontairement. La première version de la branche salariée renvoyait son propre PDF,
  // et divergeait sur trois points sans que rien ne le signale : `inline` au lieu d'`attachment`,
  // pas de `Cache-Control: no-store` sur un document contractuel, et surtout AUCUN email
  // « contrat disponible » à l'autre partie. Dupliquer une fin de fonction, c'est accepter que
  // les deux copies divergent — ici elles l'avaient déjà fait avant le premier commit.
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
