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

// ── LA RELANCE (section 253) ──────────────────────────────────────────────────────────────────
//
// Signalé le 13/09 : sur la fiche détaillée d'un profil déjà choisi (« Vos choix »), le seul geste
// proposé était « Retirer ce choix ». Une fois l'intérêt signalé, il n'y avait plus rien à faire
// que se dédire.
//
// LE CONTACT DIRECT RESTE IMPOSSIBLE, ET CE N'EST PAS UN RÉGLAGE D'ÉCRAN. `Message.matchId` est
// requis et lié à `Match` : sans réciprocité, il n'existe aucune ligne où écrire un message. La
// relance ne perce donc pas cette règle — elle réémet le SEUL signal non réciproque du produit,
// celui qui part déjà au swipe, et laisse au destinataire la même décision qu'avant.
//
// POURQUOI UN DÉLAI, ET PAS UN SIMPLE BOUTON. Le signal est un email plus une notification chez
// quelqu'un qui n'a rien demandé. Sans borne, « relancer » devient un bouton à cliquer deux fois
// par jour, et le côté payant — celui qui absorbait déjà 59 % de signaux sans issue avant le
// report du 15/09 — le paierait le premier. Une relance par semaine et par annonce : assez pour
// se rappeler au bon souvenir d'un cabinet qui n'a pas vu passer le premier signal, trop peu pour
// peser sur sa boîte.
export const DELAI_RELANCE_MS = 7 * 24 * 60 * 60 * 1000;

export type RaisonRelance =
  | "ok"
  | "sans_recherche"      // rien de publié : le signal serait différé, donc invisible
  | "trop_tot"            // moins d'une semaine depuis le dernier signal réellement émis
  | "deja_en_relation"    // un match existe : le chat dit strictement plus
  | "annonce_inactive";   // l'annonce ne recrute plus

export interface EtatRelance {
  possible: boolean;
  raison: RaisonRelance;
  /** Date à partir de laquelle une relance redevient possible — seulement si `trop_tot`. */
  prochaineLe: string | null;
}

/**
 * Décide si une relance est possible, à partir de faits DÉJÀ établis par l'appelant.
 *
 * Fonction PURE et sans requête, délibérément : deux appelants la consultent — le fil « Vos
 * choix », qui connaît ces faits en masse pour cinquante éléments, et la route de relance, qui
 * les relit pour un seul afin de ne rien croire du client. Leur imposer une forme de requête
 * commune aurait produit cinquante requêtes unitaires dans le premier cas ; leur laisser chacun
 * sa règle aurait produit la divergence que ce dépôt a déjà payé quatre fois.
 */
export function etatRelance(faits: {
  aPublieUneRecherche: boolean;
  enRelation: boolean;
  annonceActive: boolean;
  dernierSignalLe: Date | string | null;
  maintenant?: Date;
}): EtatRelance {
  const now = (faits.maintenant ?? new Date()).getTime();
  const non = (raison: RaisonRelance, prochaineLe: string | null = null) =>
    ({ possible: false, raison, prochaineLe }) satisfies EtatRelance;

  // L'ORDRE COMPTE : on nomme le motif le plus structurant d'abord. Quelqu'un en relation dont
  // l'annonce vient d'être fermée doit lire « vous êtes déjà en relation », pas « annonce
  // inactive » — le premier lui indique où continuer, le second a l'air d'une porte fermée.
  if (faits.enRelation) return non("deja_en_relation");
  if (!faits.annonceActive) return non("annonce_inactive");
  if (!faits.aPublieUneRecherche) return non("sans_recherche");

  if (faits.dernierSignalLe) {
    const echeance = new Date(faits.dernierSignalLe).getTime() + DELAI_RELANCE_MS;
    if (Number.isFinite(echeance) && now < echeance) {
      return non("trop_tot", new Date(echeance).toISOString());
    }
  }
  return { possible: true, raison: "ok", prochaineLe: null };
}

/**
 * Émet le signal d'intérêt si le swipeur est joignable, le diffère sinon.
 *
 * `relance` remplace la déduplication permanente par le délai ci-dessus : hors relance, un couple
 * (annonce, visiteur) ne produit qu'UN signal, pour toujours.
 *
 * NE JETTE JAMAIS — les appelants du swipe et de la publication sont en fire-and-forget : ni un
 * swipe ni une publication ne doivent échouer parce qu'un email part mal. La route de relance,
 * elle, lit la valeur de retour pour répondre à l'écran.
 */
export async function signalerInteret(opts: {
  swiperId: string;
  swiperType: string | undefined;
  mission: MissionSwipee;
  /** Geste explicite de relance : la borne devient le délai, plus l'unicité. */
  relance?: boolean;
}): Promise<ResultatSignal> {
  const { swiperId, swiperType, mission, relance = false } = opts;
  try {
    // Déduplication : au plus un signal par couple (annonce, visiteur) — sauf relance explicite,
    // bornée par DELAI_RELANCE_MS. On lit le PLUS RÉCENT, d'où le tri : sans lui, une relance
    // rouvrirait le délai à partir du tout premier signal, qui ne dit plus rien du dernier envoi.
    const deja = await prisma.traceEvent.findFirst({
      where: { eventType: "INTERET_SIGNALE", missionId: mission.id, profileId: swiperId },
      orderBy: { occurredAt: "desc" },
      select: { occurredAt: true },
    });
    if (deja && !relance) return "deja_signale";
    if (deja && relance && Date.now() - deja.occurredAt.getTime() < DELAI_RELANCE_MS) {
      return "deja_signale";
    }

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

    // Une relance se NOMME comme telle. Répéter mot pour mot « s'intéresse à votre annonce »
    // laisserait croire à un second visiteur, là où c'est le même qui insiste — et le
    // destinataire déciderait sur une fausse idée du nombre de personnes intéressées.
    createNotification({
      userId: proprio.user.id,
      type: "interet",
      message: relance
        ? `${libelleVisiteur} vous relance au sujet de votre ${motAnnonce} « ${mission.title} »`
        : `${libelleVisiteur} s'intéresse à votre ${motAnnonce} « ${mission.title} »`,
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
      relance,
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
