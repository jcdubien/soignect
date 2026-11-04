import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SwipeDirection } from "@prisma/client";
import { swipeExploitable } from "@/lib/camp";
import { memeMarche } from "@/lib/professions";
import { offreOuverteLe } from "@/lib/feedFilters";
import { etatNouveauSignal } from "@/lib/interetSignale";
import { contratConfirme } from "@/lib/matchEtat";

export const dynamic = "force-dynamic";

// ── DURÉE DE PRÉSENCE DANS LA COLONNE (03/11, décision JC) ───────────────────────────────────
// La colonne de l'écran principal montre ce qui vit, /matches garde tout.
//   · Une mise en relation y reste 7 jours SANS ACTIVITÉ : compté depuis son dernier message, ou
//     sa création s'il n'y en a pas. L'ancienne règle (7 jours après la création, filtrée par
//     l'écran) retirait une conversation en cours et gardait une relation muette.
//   · Un choix sans réciprocité y reste 30 jours, comptés depuis le swipe ou le dernier signal
//     d'intérêt (signaler à nouveau relance le compteur). Le geste reste enregistré : si l'autre
//     répond plus tard, la mise en relation se forme et réapparaît.
const JOUR_MS = 86_400_000;
const RELATION_PRESENTE_JOURS = 7;
const CHOIX_PRESENT_JOURS = 30;

// GET /api/tray — swipes RIGHT triés par affinityScore desc (meilleur match en premier).
// Filtre optionnel ?disponibiliteId= (section 7) : ne garde que les mises en relation
// rattachées à CETTE disponibilité du remplaçant.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.profileId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const swiperId = session.user.profileId as string;
  const disponibiliteId = new URL(req.url).searchParams.get("disponibiliteId");

  const swipesBruts = await prisma.swipe.findMany({
    where: { swiperId, direction: SwipeDirection.RIGHT },
    include: {
      swipedMission: { include: { profile: true } },
    },
    orderBy: [
      { affinityScore: "desc" },
      { createdAt: "desc" },
    ],
    take: 50,
  });

  // Camps opposés seulement (section 226). Quelqu'un qui a changé de camp garde ses gestes
  // passés : sans ce filtre, un cabinet anciennement candidat voyait dans « Vos choix » des
  // annonces de cabinets, indéfiniment « en attente de réponse » alors qu'aucun match ne peut
  // s'y produire. Le geste a bien eu lieu ; il ne veut simplement plus rien dire.
  //
  // MÊME MOTIF SUR LA PROFESSION (section 278). `/compte` laisse changer de profession comme il
  // laissait changer de camp : un kiné devenu infirmier gardait ici ses choix sur des annonces de
  // cabinets de kiné, que le feed ne lui montre plus et avec lesquelles aucun match ne peut
  // naître. Les deux axes se filtrent au même endroit et pour la même raison.
  const moi = await prisma.profile.findUnique({
    where: { id: swiperId },
    select: { type: true, profession: true },
  });
  const swipes = moi
    ? swipesBruts.filter(
        (s) =>
          swipeExploitable(moi.type, s.swipedMission.profile.type) &&
          memeMarche(moi.profession, s.swipedMission.profile.profession),
      )
    : swipesBruts;

  const missionIds = swipes.map((s) => s.swipedMissionId);

  const matches = await prisma.match.findMany({
    where: {
      OR: [
        { profileAId: swiperId, missionBId: { in: missionIds } },
        { profileBId: swiperId, missionBId: { in: missionIds } },
        { profileAId: swiperId, missionAId: { in: missionIds } },
        { profileBId: swiperId, missionAId: { in: missionIds } },
      ],
    },
    select: {
      id: true, profileAId: true, profileBId: true,
      missionAId: true, missionBId: true, aiScore: true, createdAt: true, status: true,
      missionA: { select: { briqueStatus: true } },
      missionB: { select: { briqueStatus: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });

  // ── Un nouveau signal d'intérêt est-il possible ? (section 253) ────────────────────────────
  //
  // Calculé ICI, en deux requêtes pour toute la liste, plutôt que par l'écran élément par
  // élément : cinquante fiches auraient produit cinquante allers-retours pour afficher un bouton.
  // La DÉCISION, elle, n'est pas dupliquée — `etatNouveauSignal` est la même fonction que celle
  // de la route d'intérêt, qui relira ces faits pour son propre compte.
  const [maRecherche, signaux, recevables] = await Promise.all([
    prisma.mission.findFirst({ where: { profileId: swiperId, isActive: true }, select: { id: true } }),
    prisma.traceEvent.findMany({
      where: {
        eventType: "INTERET_SIGNALE",
        profileId: swiperId,
        missionId: { in: swipes.map((s) => s.swipedMissionId) },
      },
      orderBy: { occurredAt: "desc" },
      select: { missionId: true, occurredAt: true },
    }),
    // Même garde que la route d'intérêt (section 298) : une annonce échue ne recrute plus, le
    // bouton « signaler à nouveau » doit le dire plutôt que d'échouer au clic.
    prisma.mission.findMany({
      where: { id: { in: swipes.map((s) => s.swipedMissionId) }, ...offreOuverteLe(new Date()) },
      select: { id: true },
    }),
  ]);
  const idsRecevables = new Set(recevables.map((m) => m.id));
  // Tri décroissant + premier gagnant = le signal le plus récent par annonce.
  const dernierSignalParMission = new Map<string, Date>();
  for (const s of signaux) {
    if (s.missionId && !dernierSignalParMission.has(s.missionId)) {
      dernierSignalParMission.set(s.missionId, s.occurredAt);
    }
  }

  // Mission propre du remplaçant dans un match donné (= sa disponibilité)
  const ownMissionId = (m: { profileAId: string; missionAId: string | null; missionBId: string | null }) =>
    m.profileAId === swiperId ? m.missionAId : m.missionBId;

  const maintenant = Date.now();
  const resultAll = swipes.flatMap((s) => {
    const mId  = s.swipedMissionId;
    const match = matches.find((m) => m.missionAId === mId || m.missionBId === mId);
    // "Contrat confirmé" dérivé du briqueStatus des missions associées (pas de champ dédié)
    const contratConfirmed = contratConfirme(match);
    if (match) {
      const activiteLe = match.messages[0]?.createdAt ?? match.createdAt;
      if (maintenant - activiteLe.getTime() >= RELATION_PRESENTE_JOURS * JOUR_MS) return [];
    } else {
      const signal = dernierSignalParMission.get(mId);
      const depuis = signal && signal > s.createdAt ? signal : s.createdAt;
      if (maintenant - depuis.getTime() >= CHOIX_PRESENT_JOURS * JOUR_MS) return [];
    }
    return [{
      mission:          s.swipedMission,
      affinityScore:    s.affinityScore,
      scoreDetails:     s.scoreDetails,
      matchId:          match?.id    ?? null,
      aiScore:          match?.aiScore ?? null,
      matchCreatedAt:   match?.createdAt ?? null,
      matchStatus:      match?.status ?? null,
      contratConfirmed: contratConfirmed ?? false,
      nouveauSignal: etatNouveauSignal({
        aPublieUneRecherche: !!maRecherche,
        enRelation: !!match,
        annonceActive: idsRecevables.has(mId),
        dernierSignalLe: dernierSignalParMission.get(mId) ?? null,
      }),
    }];
  });

  // Filtre disponibilité (section 7) : uniquement les mises en relation de cette dispo
  const result = disponibiliteId
    ? resultAll.filter((item) => {
        if (!item.matchId) return false;
        const m = matches.find((mm) => mm.id === item.matchId);
        return m ? ownMissionId(m) === disponibiliteId : false;
      })
    : resultAll;

  return NextResponse.json(result);
}
