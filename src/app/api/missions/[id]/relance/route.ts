import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SwipeDirection } from "@prisma/client";
import { signalerInteret, etatRelance } from "@/lib/interetSignale";

export const dynamic = "force-dynamic";

// POST /api/missions/[id]/relance — réémet le signal d'intérêt sur une annonce déjà choisie.
//
// ── CE QUE CETTE ROUTE N'OUVRE PAS ────────────────────────────────────────────────────────────
//
// Aucun canal de contact. `Message.matchId` est requis et lié à `Match` : sans réciprocité il
// n'existe aucune ligne où écrire. La relance réémet le seul signal non réciproque du produit —
// celui qui part déjà au swipe — et laisse au destinataire exactement la même décision.
//
// ── TOUT EST REVÉRIFIÉ ICI ───────────────────────────────────────────────────────────────────
//
// Le fil « Vos choix » calcule le même état pour griser son bouton, mais un état d'écran n'est
// pas une autorisation : la route ne croit rien du client, pas même l'identifiant d'annonce. Elle
// relit les quatre faits et rappelle `etatRelance`, la même fonction, pour que les deux réponses
// ne puissent pas diverger.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: missionId } = await params;
  const session = await auth();
  const swiperId = session?.user?.profileId as string | undefined;
  if (!swiperId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const mission = await prisma.mission.findUnique({
    where: { id: missionId },
    select: { id: true, title: true, profileId: true, isActive: true },
  });
  if (!mission) return NextResponse.json({ error: "Annonce introuvable" }, { status: 404 });

  // LE GESTE D'INTÉRÊT EST LE TITRE D'ENTRÉE. Sans lui, n'importe qui pourrait notifier
  // n'importe quelle annonce depuis une URL forgée, sans jamais passer par le fil.
  const swipe = await prisma.swipe.findFirst({
    where: { swiperId, swipedMissionId: missionId, direction: SwipeDirection.RIGHT },
    select: { id: true },
  });
  if (!swipe) return NextResponse.json({ error: "Aucun intérêt signalé sur cette annonce" }, { status: 403 });

  const [annonceVisiteur, match, dernierSignal] = await Promise.all([
    prisma.mission.findFirst({ where: { profileId: swiperId, isActive: true }, select: { id: true } }),
    prisma.match.findFirst({
      where: {
        OR: [{ profileAId: swiperId }, { profileBId: swiperId }],
        AND: [{ OR: [{ missionAId: missionId }, { missionBId: missionId }] }],
      },
      select: { id: true },
    }),
    prisma.traceEvent.findFirst({
      where: { eventType: "INTERET_SIGNALE", missionId, profileId: swiperId },
      orderBy: { occurredAt: "desc" },
      select: { occurredAt: true },
    }),
  ]);

  const etat = etatRelance({
    aPublieUneRecherche: !!annonceVisiteur,
    enRelation: !!match,
    annonceActive: mission.isActive,
    dernierSignalLe: dernierSignal?.occurredAt ?? null,
  });
  if (!etat.possible) {
    return NextResponse.json({ ...etat, envoye: false }, { status: 409 });
  }

  // ATTENDU, pas en fire-and-forget : c'est ici la seule différence avec le swipe. L'écran
  // annonce « relance envoyée » — il ne doit pas l'annoncer avant de le savoir.
  const resultat = await signalerInteret({
    swiperId,
    swiperType: (session?.user as { profileType?: string } | undefined)?.profileType,
    mission: { id: mission.id, title: mission.title, profileId: mission.profileId },
    relance: true,
  });

  if (resultat !== "envoye") {
    // `differe` et `deja_signale` sont improbables après `etatRelance`, mais possibles si l'état
    // a bougé entre les deux lectures. On refuse alors plutôt que d'annoncer un envoi.
    return NextResponse.json(
      { envoye: false, raison: resultat === "differe" ? "sans_recherche" : "trop_tot" },
      { status: 409 },
    );
  }
  return NextResponse.json({ envoye: true });
}
