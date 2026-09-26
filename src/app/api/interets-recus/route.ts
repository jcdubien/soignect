import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileType, SwipeDirection } from "@prisma/client";
import { EST_UNE_OFFRE } from "@/lib/feedFilters";

export const dynamic = "force-dynamic";

// GET /api/interets-recus — les candidats qui ont retenu une de MES annonces et attendent.
//
// ── CE QUE LA MESURE A TROUVÉ (section 268) ──────────────────────────────────────────────────
//
// 78 intérêts de candidats vers une annonce de cabinet, dont **66 sans aucun match en retour** —
// 85 %. Le plus ancien remontait au 1er août. Ce n'est PAS un défaut de notification : 104
// signaux d'intérêt ont bien été émis pour 119 swipes à droite, et le compte par annonce existe
// déjà (`pendingCount`). Mais il vit derrière le compteur du header, qui se lit comme un
// inventaire — « 5 annonces actives » — et non comme une file d'attente.
//
// Rien non plus ne les remonte dans le fil : l'ordre d'affichage tient compte de la désirabilité
// commerciale, du bonus saisonnier et de la priorité territoriale, jamais du fait qu'une personne
// a déjà dit oui. Un candidat à UN SWIPE d'une mise en relation était donc classé exactement
// comme un autre.
//
// ── CE QUI EST SERVI, ET CE QUI NE L'EST PAS ─────────────────────────────────────────────────
//
// Sur les 45 intérêts en attente sur une annonce vivante, 24 viennent de candidats qui ont publié
// une disponibilité, et 21 de candidats qui n'ont RIEN publié. Ces derniers n'ont pas de fiche à
// ouvrir ni de mission à swiper : le cabinet ne peut rien en faire, et `lib/interetSignale` diffère
// déjà leur signal jusqu'au jour où ils publient. On ne les sert donc pas — mais on les COMPTE,
// parce qu'un écran qui en laisse tomber la moitié en silence ment par omission.
export async function GET() {
  const session = await auth();
  if (!session?.user?.profileId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const profileId = session.user.profileId as string;
  const profileType = (session.user as { profileType?: string }).profileType;

  // Ce tiroir n'a de sens que côté annonceur : c'est lui qui reçoit des intérêts sur ses postes.
  if (profileType !== ProfileType.TITULAIRE) {
    return NextResponse.json({ items: [], sansPublication: 0 });
  }

  const auj = new Date();
  auj.setHours(0, 0, 0, 0);

  // MES annonces réellement proposables. Le prédicat partagé (section 265) plus l'exclusion des
  // périodes écoulées : un intérêt sur une annonce morte n'appelle plus d'action.
  const mesAnnonces = await prisma.mission.findMany({
    where: {
      ...EST_UNE_OFFRE,
      profileId,
      OR: [{ endDate: null }, { endDate: { gte: auj } }],
    },
    select: { id: true, title: true },
  });
  if (mesAnnonces.length === 0) return NextResponse.json({ items: [], sansPublication: 0 });

  const titreParAnnonce = new Map(mesAnnonces.map((a) => [a.id, a.title]));

  const interets = await prisma.swipe.findMany({
    where: {
      direction: SwipeDirection.RIGHT,
      swipedMissionId: { in: mesAnnonces.map((a) => a.id) },
    },
    select: { swiperId: true, swipedMissionId: true, createdAt: true, affinityScore: true },
    orderBy: { createdAt: "asc" },
  });
  if (interets.length === 0) return NextResponse.json({ items: [], sansPublication: 0 });

  // Déjà en relation ? On ne le redemande pas. Le garde porte sur la PAIRE (personne, annonce),
  // comme celui de /api/swipe : un cabinet et un candidat peuvent mener deux relations sur deux
  // postes différents, et l'une ne doit pas masquer l'autre.
  const matchs = await prisma.match.findMany({
    where: { OR: [{ profileAId: profileId }, { profileBId: profileId }] },
    select: { profileAId: true, profileBId: true, missionAId: true, missionBId: true },
  });
  const dejaEnRelation = new Set<string>();
  for (const m of matchs) {
    for (const pr of [m.profileAId, m.profileBId]) {
      for (const mi of [m.missionAId, m.missionBId]) if (mi) dejaEnRelation.add(`${pr}|${mi}`);
    }
  }

  const enAttente = interets.filter((s) => !dejaEnRelation.has(`${s.swiperId}|${s.swipedMissionId}`));
  if (enAttente.length === 0) return NextResponse.json({ items: [], sansPublication: 0 });

  // La disponibilité publiée de chaque candidat — c'est ELLE que le cabinet swipe pour fermer la
  // boucle, et c'est elle qui porte les dates et l'accroche à lire.
  const dispos = await prisma.mission.findMany({
    where: { ...EST_UNE_OFFRE, profileId: { in: enAttente.map((s) => s.swiperId) } },
    include: { profile: true },
    orderBy: { updatedAt: "desc" },
  });
  const dispoParProfil = new Map<string, (typeof dispos)[number]>();
  for (const d of dispos) if (!dispoParProfil.has(d.profileId)) dispoParProfil.set(d.profileId, d);

  // UN CANDIDAT, UNE LIGNE. Quelqu'un qui a retenu trois de mes annonces attend une réponse, pas
  // trois : le lister trois fois gonflerait le compteur sans rien ajouter à faire.
  const parCandidat = new Map<string, { premier: Date; annonces: string[]; score: number | null }>();
  for (const s of enAttente) {
    const e = parCandidat.get(s.swiperId);
    const titre = titreParAnnonce.get(s.swipedMissionId) ?? "";
    if (!e) parCandidat.set(s.swiperId, { premier: s.createdAt, annonces: [titre], score: s.affinityScore });
    else {
      e.annonces.push(titre);
      if (s.createdAt < e.premier) e.premier = s.createdAt;
      if (e.score === null) e.score = s.affinityScore;
    }
  }

  const items = [];
  let sansPublication = 0;
  for (const [swiperId, e] of Array.from(parCandidat.entries())) {
    const dispo = dispoParProfil.get(swiperId);
    if (!dispo) { sansPublication++; continue; }
    items.push({
      mission: dispo,
      affinityScore: e.score,
      scoreDetails: null,
      matchId: null,
      aiScore: null,
      matchCreatedAt: null,
      matchStatus: null,
      contratConfirmed: false,
      interetRecu: { depuis: e.premier, annonces: Array.from(new Set(e.annonces)) },
    });
  }
  // Le plus ancien d'abord : c'est celui qui attend depuis le plus longtemps qui appelle le geste.
  items.sort((a, b) => a.interetRecu.depuis.getTime() - b.interetRecu.depuis.getTime());

  return NextResponse.json({ items, sansPublication });
}
