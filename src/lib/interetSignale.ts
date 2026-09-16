import { prisma } from "@/lib/prisma";
import { SwipeDirection } from "@prisma/client";
import { createNotification } from "@/lib/notifications";
import { sendInteretEmail } from "@/lib/email";

// Signal « quelqu'un s'intéresse à votre annonce » (sections 223-224, différé le 15/09).
//
// ── POURQUOI CE FICHIER EXISTE ────────────────────────────────────────────────────────────────
//
// Le signal part maintenant de DEUX endroits : au moment du swipe, et au moment où le swipeur
// publie enfin. Écrire deux fois la même règle, c'est accepter qu'elles divergent — ce dépôt l'a
// payé quatre fois cette quinzaine (sections 236, 237, 238, 246). Elle vit donc ici, une fois.
//
// ── CE QUI A CHANGÉ LE 15/09, ET LA MESURE QUI L'A DÉCIDÉ ─────────────────────────────────────
//
// Le signal partait sur TOUT swipe « Intéressé », que le swipeur ait publié ou non. Or un
// candidat sans disponibilité active ne peut pas produire de mise en relation : le swipe
// réciproque est cherché parmi SES annonces actives (`swipedMissionId: { in: mesAnnonces }`),
// une liste vide ne peut rien apparier. Il n'apparaît pas davantage dans le fil du cabinet, qui
// est construit sur des annonces. Le geste est donc doublement sans issue.
//
// Mesuré sur les 53 signaux du 3 au 15 septembre :
//
//     destinataires CABINET    32 reçus · 19 sans publication ·  59 %
//     destinataires CANDIDAT   19 reçus ·  1 sans publication ·   5 %
//
// Six personnes produisaient les 20 impasses, une seule en produisait la moitié. Le côté payant
// absorbait 59 % de notifications auxquelles il ne pouvait pas répondre — la liste nominative
// censée rattraper le cas n'offre aucune action, seulement un nom.
//
// ── LA RÈGLE RETENUE : DIFFÉRER, PAS SUPPRIMER ───────────────────────────────────────────────
//
// Le geste est conservé tel quel — le `Swipe` est enregistré comme avant, et rien n'est fermé au
// candidat. Seule la NOTIFICATION attend : elle part le jour où il publie, c'est-à-dire le jour
// où le cabinet peut enfin agir. Ce jour-là le message est même plus fort qu'avant : la personne
// est désormais visible dans le fil, et son intérêt est déjà acquis.
//
// AUCUN ÉVÉNEMENT DE TRACE N'EST ÉCRIT QUAND ON DIFFÈRE. `INTERET_SIGNALE` sert uniquement de
// déduplication — vérifié, il n'est lu nulle part ailleurs. L'écrire sans notifier condamnerait
// le rattrapage : la déduplication le prendrait pour un signal déjà émis. Le geste, lui, reste
// horodaté dans `Swipe.createdAt` ; rien n'est perdu.

export type ResultatSignal = "envoye" | "differe" | "deja_signale" | "sans_destinataire";

interface MissionSwipee {
  id: string;
  title: string;
  profileId: string;
}

/**
 * Émet le signal d'intérêt si le swipeur est joignable, le diffère sinon.
 *
 * NE JETTE JAMAIS — les deux appelants sont en fire-and-forget : ni un swipe ni une publication
 * ne doivent échouer parce qu'un email part mal.
 */
export async function signalerInteret(opts: {
  swiperId: string;
  swiperType: string | undefined;
  mission: MissionSwipee;
}): Promise<ResultatSignal> {
  const { swiperId, swiperType, mission } = opts;
  try {
    // Déduplication : au plus un signal par couple (annonce, visiteur).
    const deja = await prisma.traceEvent.findFirst({
      where: { eventType: "INTERET_SIGNALE", missionId: mission.id, profileId: swiperId },
      select: { id: true },
    });
    if (deja) return "deja_signale";

    // Le swipeur est-il joignable, c'est-à-dire a-t-il quelque chose à aller voir ? C'est la
    // MÊME condition que celle du swipe réciproque et celle de la liste nominative — les trois
    // doivent se recouper, sans quoi on notifierait pour un geste qui ne peut pas aboutir.
    const annonceVisiteur = await prisma.mission.findFirst({
      where: { profileId: swiperId, isActive: true },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!annonceVisiteur) return "differe";

    const proprio = await prisma.profile.findUnique({
      where: { id: mission.profileId },
      select: { type: true, user: { select: { id: true, email: true, notifyConsultation: true } } },
    });
    if (!proprio?.user?.email) return "sans_destinataire";

    await prisma.traceEvent.create({
      data: { eventType: "INTERET_SIGNALE", missionId: mission.id, profileId: swiperId },
    });

    const libelleVisiteur =
      swiperType === "TITULAIRE" ? "Un cabinet"
      : swiperType === "ASSISTANT" ? "Un assistant"
      : "Un remplaçant";
    const motAnnonce = proprio.type === "TITULAIRE" ? "annonce" : "disponibilité";
    const cta = {
      label: swiperType === "TITULAIRE" ? "Voir son annonce →" : "Voir sa recherche →",
      path: `/annonce/${annonceVisiteur.id}`,
    };

    createNotification({
      userId: proprio.user.id,
      type: "interet",
      message: `${libelleVisiteur} s'intéresse à votre ${motAnnonce} « ${mission.title} »`,
      linkUrl: `/annonces?card=${annonceVisiteur.id}`,
    });
    await sendInteretEmail(proprio.user.email, {
      viewerLabel: libelleVisiteur,
      listingWord: motAnnonce,
      missionTitle: mission.title,
      optIn: proprio.user.notifyConsultation,
      // Toujours vrai désormais : sans publication on n'arrive pas jusqu'ici. Le paramètre reste
      // dans la signature de l'email, qui sert aussi d'archive des envois passés.
      visiteurJoignable: true,
      cta,
    });
    return "envoye";
  } catch {
    return "sans_destinataire";
  }
}

/**
 * Rattrape les intérêts différés d'une personne qui vient de publier.
 *
 * Appelée après la création d'une annonce. Rejoue tous ses « Intéressé » passés qui n'ont jamais
 * notifié — ceux d'avant sa première publication.
 *
 * DEUX EXCLUSIONS, POUR LA MÊME RAISON : on ne notifie que ce sur quoi le destinataire peut agir.
 *   • les annonces devenues inactives entre-temps — elles ne recrutent plus ;
 *   • celles déjà en mise en relation — le cabinet a reçu mieux, et le code du swipe applique
 *     déjà cette règle (« quand le swipe est réciproque, le propriétaire reçoit déjà nouvelle
 *     mise en relation, qui dit strictement plus »).
 *
 * NE JETTE JAMAIS : une publication ne doit pas échouer parce qu'un rattrapage se passe mal.
 */
export async function rattraperInteretsDifferes(swiperId: string): Promise<number> {
  try {
    // LE TYPE EST LU ICI, PAS REÇU. En mode couverture (section 153) un ASSISTANT publie une
    // annonce dont le propriétaire est le CABINET : le type de la session et celui du profil qui
    // devient visible diffèrent alors, et un libellé passé par l'appelant annoncerait
    // « Un assistant » là où c'est un cabinet. Le lire supprime la question.
    const moi = await prisma.profile.findUnique({ where: { id: swiperId }, select: { type: true } });
    const swiperType = moi?.type;

    const swipes = await prisma.swipe.findMany({
      where: { swiperId, direction: SwipeDirection.RIGHT, swipedMission: { isActive: true } },
      select: { swipedMission: { select: { id: true, title: true, profileId: true } } },
      orderBy: { createdAt: "asc" },
    });
    if (swipes.length === 0) return 0;

    const enRelation = await prisma.match.findMany({
      where: { OR: [{ profileAId: swiperId }, { profileBId: swiperId }] },
      select: { missionAId: true, missionBId: true },
    });
    const dejaApparies = new Set(
      enRelation.flatMap((m) => [m.missionAId, m.missionBId]).filter((x): x is string => !!x),
    );

    let envoyes = 0;
    for (const s of swipes) {
      if (dejaApparies.has(s.swipedMission.id)) continue;
      // En série, pas en parallèle : quelqu'un comme le cas mesuré le 15/09 — dix intérêts
      // signalés sans jamais publier — enverrait sinon dix emails d'un coup au fournisseur.
      const r = await signalerInteret({ swiperId, swiperType, mission: s.swipedMission });
      if (r === "envoye") envoyes++;
    }
    return envoyes;
  } catch {
    return 0;
  }
}
