import { prisma } from "@/lib/prisma";
import { MatchStatus } from "@prisma/client";
import { logMatchCancelled } from "@/lib/trace";
import { createNotification } from "@/lib/notifications";
import { sendPreavisExpirationEmail } from "@/lib/email";

// ── EXPIRATION DES MISES EN RELATION DORMANTES (section 279) ─────────────────────────────────
//
// ── LE DÉFAUT ────────────────────────────────────────────────────────────────────────────────
//
// Une mise en relation ne périmait JAMAIS. `MatchStatus.EXPIRE` existait dans le schéma depuis
// l'origine, et rien ne le posait : aucun automate, et aucun écran — `MatchStatusActions`
// n'offre que « Confirmer » et « Décliner ». La valeur n'était atteignable que par un PATCH
// direct sur l'API, dont le code de traçage `initiateur: "SYSTEME"` attendait un appelant qui
// n'a jamais existé.
//
// Ce n'était pas qu'un encombrement de liste. `ACTIVE_MATCH_STATUSES` (lib/feedFilters) compte
// `EN_ATTENTE` comme vivant, et `NO_ACTIVE_MATCH_FILTER` retire du fil de TOUS les autres
// utilisateurs toute annonce engagée dans une telle relation. Une réciprocité obtenue puis
// jamais suivie d'un mot **gelait donc les deux annonces indéfiniment** : le poste disparaissait
// du marché sans que personne ne l'occupe.
//
// ── POURQUOI CE PÉRIMÈTRE, ET PAS UN PLUS LARGE ──────────────────────────────────────────────
//
// On n'expire QUE les relations **sans un seul message**. La mesure du 21/09 (ROADMAP) est
// explicite : les 4 mises en relation confirmées se sont toutes formées en moins de 24 h, et
// celles qui ont traîné — de 1,9 à 14,9 jours — sont restées en attente ou ont été déclinées.
// **Rien n'a jamais abouti après un long délai.** Une relation où personne n'a parlé n'est donc
// pas « en cours » : elle est mort-née, et le produit n'a aucun autre moyen de s'en apercevoir
// (le cron de rappel ne regarde que les conversations qui ont au moins un message).
//
// Une relation où les deux parties ONT échangé puis se sont tues est un cas DIFFÉRENT, et il
// n'est pas traité ici. Y toucher demanderait de décider qu'une conversation réelle peut être
// close par un automate — un arbitrage produit, pas un correctif. Le laisser de côté coûte
// quelques lignes dans une liste ; le trancher à la légère coûterait une relation vivante.
//
// `DISCUSSION` n'est pas non plus dans le périmètre, et pour une raison plus simple : vérifié,
// **aucun code du dépôt ne pose jamais ce statut**. Toute relation vivante est `EN_ATTENTE`.
//
// ── POURQUOI UN PRÉAVIS, ET POURQUOI IL EST LA CONDITION DE L'EXPIRATION ─────────────────────
//
// Une relation qui se volatilise sans explication est pire que celle qui traîne : l'utilisateur
// n'a rien fait, rien lu, et son interlocuteur a disparu. Le préavis n'est donc pas une
// politesse ajoutée à côté de l'expiration — il en est **la clé d'entrée** : on n'expire que ce
// qui a reçu un préavis il y a au moins `DELAI_PREAVIS_JOURS`.
//
// Cette forme règle aussi, sans cas particulier, le premier passage sur l'existant : un arriéré
// de relations déjà dormantes depuis des mois ne part pas en masse le jour de la mise en ligne.
// Il reçoit son préavis, et expire trois jours plus tard — comme n'importe laquelle des
// suivantes.
//
// ── CE QUI N'EST PAS DÉTRUIT ─────────────────────────────────────────────────────────────────
//
// `EXPIRE` ne supprime rien : la ligne `Match` reste, ses messages aussi (il n'y en a pas), et
// la relation reste lisible dans « Déclinées / Expirées ». Même parti pris que l'invitation qui
// reste `PENDING` plutôt que de disparaître — une trace honnête de ce qui s'est passé.
//
// Et l'annonce se libère SEULE : `feedFilters` exclut `EXPIRE` de `ACTIVE_MATCH_STATUSES`, et la
// mission n'a jamais quitté `RECHERCHE`. Aucune écriture supplémentaire, donc aucun risque d'en
// oublier une.

/**
 * Âge à partir duquel une relation sans un seul message reçoit son préavis.
 *
 * 12 jours, pour une expiration effective à **15** — arbitrage de Jean-Charles du 06/10.
 *
 * CE QUE CE CHOIX ASSUME, ET QU'IL FAUT DIRE. La mesure du 21/09 donne une fourchette de 1,9 à
 * 14,9 jours pour les relations qui ont fini par bouger — aucune n'a abouti, mais elles ont
 * bougé. À 18 jours (première version), le préavis tombait au-delà de TOUT ce que la base avait
 * vu vivre ; à 12, il tombe DEDANS. Ce n'est pas un oubli : le préavis ne détruit rien, il
 * annonce une échéance et offre de la lever d'un seul message. Le geste qui sauve la relation
 * est précisément celui qui lui manquait.
 *
 * Et l'expiration, elle, reste au-delà du plus long délai observé (15 > 14,9).
 *
 * MESURÉ AVANT D'APPLIQUER : sur la base du 06/10, 18 et 12 désignent **exactement les mêmes
 * deux relations** (50 jours chacune). Le changement ne vaut donc que pour l'avenir — il rend
 * l'annonce au fil six jours plus tôt, sans rien reclasser de l'existant.
 */
export const SEUIL_DORMANCE_JOURS = 12;

/** Délai entre le préavis et l'expiration. Trois jours : assez pour qu'un email soit lu, assez
 *  court pour que l'annonce ne reste pas gelée un mois de plus. */
export const DELAI_PREAVIS_JOURS = 3;

/** Marqueur de préavis. Un `TraceEvent` plutôt qu'une colonne — le dépôt emploie déjà ce motif
 *  pour marquer sans migration (budget DeepSeek, courrier aux inscrits sans publication), et
 *  `TraceEvent.matchId` existe, ce qui rend la relecture directe plutôt que fouillée en JSON. */
export const EVENT_PREAVIS = "MATCH_PREAVIS_EXPIRATION";

const JOUR_MS = 86_400_000;

export interface ResultatDormants {
  /** Relations dormantes examinées. */
  examinees: number;
  /** Préavis émis à ce passage. */
  preavis: number;
  /** Relations passées en EXPIRE à ce passage. */
  expirees: number;
}

/** Forme minimale d'un Match pour ce module — aligne les deux requêtes ci-dessous. */
const SELECTION_MATCH = {
  id: true,
  status: true,
  createdAt: true,
  profileAId: true,
  profileBId: true,
  missionAId: true,
  missionBId: true,
  signatureTitulaireAt: true,
  signatureRemplacantAt: true,
  missionA: { select: { title: true, location: true, missionType: true, briqueStatus: true } },
  missionB: { select: { title: true, location: true, missionType: true, briqueStatus: true } },
  profileA: { select: { id: true, name: true, user: { select: { id: true, email: true, emailOptIn: true } } } },
  profileB: { select: { id: true, name: true, user: { select: { id: true, email: true, emailOptIn: true } } } },
} as const;

/**
 * Les relations candidates : en attente, sans un seul message, assez vieilles, et dont aucune
 * signature n'a été déposée.
 *
 * La garde sur les signatures est une ceinture : une relation signée est `CONFIRME` et ne passe
 * déjà pas le filtre de statut. Mais le coût d'un `EXPIRE` posé sur un contrat signé serait sans
 * commune mesure avec celui de deux conditions en trop, et les reprises de données anciennes du
 * dépôt ont déjà montré des statuts qui ne suivaient pas les signatures.
 */
async function relationsDormantes(avant: Date) {
  return prisma.match.findMany({
    where: {
      status: MatchStatus.EN_ATTENTE,
      createdAt: { lte: avant },
      messages: { none: {} },
      signatureTitulaireUrl: null,
      signatureRemplacantUrl: null,
    },
    select: SELECTION_MATCH,
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Un passage complet : émettre les préavis dus, puis expirer ce qui a été prévenu à temps.
 *
 * L'ORDRE COMPTE, et dans ce sens-là seulement. Expirer d'abord ferait porter le balayage sur
 * des relations que le préavis du jour vient de désigner, donc expirerait sans délai ce qu'on
 * vient à peine d'annoncer. Les préavis du jour ne peuvent pas satisfaire la condition des
 * trois jours — c'est vrai par construction, mais ça ne l'est que dans cet ordre.
 */
export async function traiterMatchsDormants(opts: { simulation: boolean }): Promise<ResultatDormants> {
  const maintenant = Date.now();
  const seuilPreavis = new Date(maintenant - SEUIL_DORMANCE_JOURS * JOUR_MS);
  const candidates = await relationsDormantes(seuilPreavis);

  const r: ResultatDormants = { examinees: candidates.length, preavis: 0, expirees: 0 };
  if (candidates.length === 0) return r;

  // Préavis déjà émis, lus en UNE requête pour toute la liste.
  const dejaPrevenus = new Map<string, Date>();
  for (const e of await prisma.traceEvent.findMany({
    where: { eventType: EVENT_PREAVIS, matchId: { in: candidates.map((m) => m.id) } },
    select: { matchId: true, occurredAt: true },
    orderBy: { occurredAt: "asc" },
  })) {
    // Le PREMIER préavis fait foi : c'est lui qui a ouvert le délai.
    if (e.matchId && !dejaPrevenus.has(e.matchId)) dejaPrevenus.set(e.matchId, e.occurredAt);
  }

  const limitePreavis = new Date(maintenant - DELAI_PREAVIS_JOURS * JOUR_MS);

  for (const m of candidates) {
    const prevenuLe = dejaPrevenus.get(m.id);

    // ── 1. Jamais prévenue → préavis ──────────────────────────────────────────────────────
    if (!prevenuLe) {
      r.preavis++;
      if (opts.simulation) continue;
      await emettrePreavis(m);
      continue;
    }

    // ── 2. Prévenue il y a assez longtemps → expiration ───────────────────────────────────
    if (prevenuLe <= limitePreavis) {
      r.expirees++;
      if (opts.simulation) continue;
      await expirer(m);
    }
    // ── 3. Prévenue récemment → on ne fait rien, le délai court.
  }

  return r;
}

type MatchDormant = Awaited<ReturnType<typeof relationsDormantes>>[number];

/** L'annonce d'EN FACE, du point de vue d'une partie — c'est elle qui nomme la relation. */
function titrePour(m: MatchDormant, cote: "A" | "B"): string | null {
  return (cote === "A" ? m.missionB?.title : m.missionA?.title) ?? null;
}

/**
 * Préavis aux DEUX parties. Les deux ont dit oui, aucune n'a écrit : la responsabilité du
 * silence est partagée, et n'en prévenir qu'une désignerait un coupable que les données ne
 * nomment pas.
 */
async function emettrePreavis(m: MatchDormant): Promise<void> {
  const joursRestants = DELAI_PREAVIS_JOURS;
  for (const cote of ["A", "B"] as const) {
    const moi = cote === "A" ? m.profileA : m.profileB;
    const autre = cote === "A" ? m.profileB : m.profileA;
    await createNotification({
      userId: moi.user?.id,
      type: "match",
      message: `Sans réponse, votre mise en relation avec ${autre.name ?? "un professionnel"} prendra fin dans ${joursRestants} jours.`,
      linkUrl: `/match/${m.id}?chat=1`,
    });
    if (moi.user?.email) {
      await sendPreavisExpirationEmail(moi.user.email, {
        partnerName: autre.name,
        missionTitle: titrePour(m, cote),
        matchId: m.id,
        joursRestants,
        optIn: moi.user.emailOptIn,
      });
    }
  }
  // Marqueur APRÈS l'envoi, et volontairement : un échec en cours de route laisse la relation
  // sans marqueur, donc reprise au prochain passage. Marquer d'abord aurait consommé le préavis
  // sans que personne ne l'ait reçu.
  await prisma.traceEvent.create({ data: { eventType: EVENT_PREAVIS, matchId: m.id } });
}

/** L'expiration elle-même : statut, trace, et notification aux deux parties. */
async function expirer(m: MatchDormant): Promise<void> {
  // La trace AVANT l'écriture : `logMatchCancelled` lit le statut, et le lire après le passage
  // à EXPIRE enregistrerait « expirée » comme stade de départ au lieu de « en attente ».
  logMatchCancelled(m, { origine: "EXPIRATION", initiateur: "SYSTEME" });

  await prisma.match.update({ where: { id: m.id }, data: { status: MatchStatus.EXPIRE } });

  for (const cote of ["A", "B"] as const) {
    const moi = cote === "A" ? m.profileA : m.profileB;
    const autre = cote === "A" ? m.profileB : m.profileA;
    await createNotification({
      userId: moi.user?.id,
      type: "match",
      message: `Faute de réponse, votre mise en relation avec ${autre.name ?? "un professionnel"} a pris fin. Votre annonce est de nouveau proposée.`,
      linkUrl: "/matches",
    });
  }
  // Pas de second email : la personne a déjà reçu le préavis, qui annonçait exactement ceci.
  // Un courrier pour confirmer qu'il ne s'est rien passé serait du bruit.
}
