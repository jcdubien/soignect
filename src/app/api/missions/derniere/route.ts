import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BriqueStatus, MissionType } from "@prisma/client";

export const dynamic = "force-dynamic";

// GET /api/missions/derniere — de quoi pré-remplir l'annonce en 4 champs (section 369).
//
// LES DATES NE SORTENT PAS. C'est la règle de la section 243 : une période passée recopiée
// produirait une annonce fausse. Le `select` ne les contient pas, comme dans textes-precedents.
// Le poste du Planning non plus : il vient de l'URL, jamais d'une annonce ancienne.
//
// Ce qui sort est AFFICHÉ par l'écran dans les champs visibles (commune, rétrocession), ou
// énuméré sous le bouton « Republier comme la dernière » — jamais recopié en silence.
//
// PAR TYPE, car le pourcentage change de sens : sur un remplacement c'est la part du remplaçant
// (75), sur un assistanat la redevance versée au cabinet (25). Reprendre l'un pour l'autre
// inverserait l'accord.
const SELECT = {
  missionType: true,
  location: true,
  retrocessionRate: true,
  retrocessionMode: true,
  retrocessionFixeEuros: true,
  retrocessionPlafondEuros: true,
  minMonths: true,
  dateFlexibility: true,
  logementPropose: true,
  vehiculePropose: true,
  secretairePresente: true,
  exerciceCoordonne: true,
  demiJourneesLibres: true,
  caMensuelEstime: true,
  rawText: true,
  bioTinder: true,
  pitch: true,
} as const;

export async function GET() {
  const session = await auth();
  if (!session?.user?.profileId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const annonces = await prisma.mission.findMany({
    where: {
      profileId: session.user.profileId as string,
      // Une absence ou un blocage d'agenda n'est pas une annonce ; un poste salarié a sa nature
      // de contrat, qui ne se reprend pas d'une annonce à l'autre.
      isSelfPresence: false,
      estSalariat: false,
      briqueStatus: {
        notIn: [BriqueStatus.INDISPONIBLE, BriqueStatus.ABSENT_CONGE, BriqueStatus.ABSENT_MALADIE, BriqueStatus.ABSENT_FORMATION],
      },
    },
    select: SELECT,
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const forme = (a: (typeof annonces)[number]) => ({
    missionType: a.missionType,
    location: a.location,
    retrocessionRate: a.retrocessionRate,
    retrocessionMode: a.retrocessionMode,
    retrocessionFixeEuros: a.retrocessionFixeEuros,
    retrocessionPlafondEuros: a.retrocessionPlafondEuros,
    minMonths: a.minMonths,
    dateFlexibility: a.dateFlexibility,
    logementPropose: a.logementPropose,
    vehiculePropose: a.vehiculePropose,
    secretairePresente: a.secretairePresente,
    exerciceCoordonne: a.exerciceCoordonne,
    demiJourneesLibres: a.demiJourneesLibres,
    caMensuelEstime: a.caMensuelEstime,
    rawText: a.rawText ?? "",
    accroche: a.bioTinder ?? a.pitch ?? "",
  });

  const parType: Partial<Record<MissionType, ReturnType<typeof forme>>> = {};
  for (const a of annonces) if (!parType[a.missionType]) parType[a.missionType] = forme(a);

  return NextResponse.json({
    derniere: annonces[0] ? forme(annonces[0]) : null,
    parType,
  });
}
