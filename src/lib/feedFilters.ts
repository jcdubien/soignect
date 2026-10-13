import { BriqueStatus, MatchStatus, type Prisma } from "@prisma/client";
import { jourLocalUtc } from "@/lib/jourLocal";

// ── CE QUI EST UNE OFFRE (section 265) ───────────────────────────────────────────────────────
//
// Le feed décidait de la visibilité sur `isActive` seul, en n'écartant que `INDISPONIBLE`
// (« dates bloquées »). Or le produit dit « ceci est proposé » par le statut `RECHERCHE` : la
// page publique `/annonce/[id]` l'exigeait déjà, le feed non. Deux surfaces, deux définitions du
// mot « publié ».
//
// CE QUE ÇA LAISSAIT PASSER, mesuré le 24/09 : deux briques d'OCCUPATION (« Christelle »,
// « Assistant 1 » du Cabinet Christelle Délé) étaient servies au feed — des enregistrements de
// qui tient un poste, pas des annonces. Elles avaient absorbé **42 swipes** à elles deux. La
// section 184 ne pouvait rien pour elles : elle masque ce qu'un match actif engage, et ces
// briques n'ont aucun match.
//
// Ça rendait aussi INOPÉRANTE l'action « Je ne cherche plus personne » du Planning, qui passe la
// brique en `FERME` : le feed continuait de la servir. Un bouton qui dit qu'il retire une annonce
// et ne la retire pas est pire que pas de bouton.
//
// ── POURQUOI C'EST SÛR ───────────────────────────────────────────────────────────────────────
//
// L'annulation d'un match REMET la mission en `RECHERCHE` (`api/match/[matchId]`) : une mission
// libérée réapparaît donc, comme la section 184 le promet. `DECLINE` / `EXPIRE` ne touchent pas
// au statut, la mission n'a jamais quitté `RECHERCHE`. Seule la signature pose `CONFIRME` — et
// une mission dont le contrat est signé n'a effectivement plus rien à proposer.
export const EST_UNE_OFFRE = {
  isActive: true,
  briqueStatus: BriqueStatus.RECHERCHE,
  // Une absence du titulaire (congés, présence) n'est pas une offre : elle était pourtant
  // swipable, et un candidat s'est vu proposer une annonce « Congés ».
  isSelfPresence: false,
} as const;

// Section 184 : une mission engagée dans une mise en relation ACTIVE (match réciproque, quel que
// soit l'avancement du contrat) doit sortir du feed de TOUS les autres utilisateurs — sinon des
// tiers swipent un poste déjà pourvu. Un match REFUSÉ/EXPIRÉ ne masque pas (poste redevenu
// disponible ; un match annulé supprime carrément la ligne → réapparaît aussi).
// Filtre via les relations Mission.matchesA / matchesB.
// Exportée (section 276) : « cette mission est-elle engagée ? » se pose aussi hors du fil —
// la route de mission s'en sert pour refuser les gestes qui appartiennent à la mise en relation.
// Une seconde liste écrite à la main aurait fini par diverger de celle-ci.
export const ACTIVE_MATCH_STATUSES = [MatchStatus.EN_ATTENTE, MatchStatus.DISCUSSION, MatchStatus.CONFIRME];

export const NO_ACTIVE_MATCH_FILTER = {
  matchesA: { none: { status: { in: ACTIVE_MATCH_STATUSES } } },
  matchesB: { none: { status: { in: ACTIVE_MATCH_STATUSES } } },
} as const;

// ── UNE OFFRE SUR LAQUELLE ON PEUT ENCORE AGIR AUJOURD'HUI (section 289) ─────────────────────
//
// Trois conditions vivaient côte à côte sans jamais être nommées ensemble : être une offre
// (`EST_UNE_OFFRE`), ne pas être déjà engagée (`NO_ACTIVE_MATCH_FILTER`), et ne pas avoir une
// période écoulée. Chaque surface les recomposait à la main — et le rattrapage des intérêts
// différés, lui, n'en appliquait AUCUNE hormis `isActive`.
//
// CE QUE ÇA PRODUISAIT, mesuré le 08/10 sur les candidats sans publication : à la première
// publication, `rattraperInteretsDifferes` aurait notifié **11 annonces sur lesquelles personne
// ne peut plus rien** — 2 postes pourvus (dont les briques d'OCCUPATION « Assistant 1 » et
// « Christelle », exactement ce que la section 265 avait écarté du fil), 2 périodes closes depuis
// août et septembre, et 7 annonces déjà engagées dans une mise en relation avec quelqu'un d'autre.
//
// La docstring de `rattraperInteretsDifferes` ANNONÇAIT pourtant ces exclusions. L'écart n'était
// pas une omission de pensée mais de code : le commentaire disait le produit, la requête disait
// autre chose. C'est le genre de divergence qui ne se voit qu'en comptant.
//
// Fonction et non constante : la borne du jour se calcule à l'appel. Une constante de module
// figerait « aujourd'hui » à l'instant du premier import — sur un serveur de longue durée, elle
// vieillirait sans bruit.
//
// ── UN SEUL PRÉDICAT POUR TOUTES LES SURFACES (section 298) ──────────────────────────────────
//
// Fil, page publique, image de partage, sitemap, pages de diffusion, module embed, route de
// swipe, signal d'intérêt, rattrapages : tous lisent CETTE fonction. Mesuré le 13/10 : 4 annonces
// à période échue restaient proposées, et 3 emails « quelqu'un s'intéresse à votre annonce »
// étaient partis pour une période déjà passée. Filtre à la LECTURE : aucune donnée n'est touchée,
// `isActive` et `briqueStatus` restent tels quels, le cabinet garde l'annonce dans son Planning.
//
// ── LE JOUR EST CELUI DE LA GUADELOUPE, PAS CELUI DU SERVEUR ─────────────────────────────────
//
// La borne se calculait par `setHours(0, 0, 0, 0)` — minuit du fuseau du SERVEUR, UTC en
// production. Or 20 h en Guadeloupe, c'est déjà minuit UTC le lendemain : dès 20 h locales, une
// annonce qui se terminait le jour même sortait du fil. Voir `lib/jourLocal` : l'annonce reste
// ouverte toute sa dernière journée, jusqu'à minuit en Guadeloupe.

/**
 * Une offre sur laquelle un tiers peut encore agir à l'instant `instant`.
 *
 * Contient un `OR` de premier niveau : à composer par `AND: [offreOuverteLe(now), { … }]` dès
 * que la requête porte son propre `OR`, sinon l'un écraserait l'autre en silence.
 */
export function offreOuverteLe(instant: Date): Prisma.MissionWhereInput {
  return { ...offreRecevableLe(instant), ...NO_ACTIVE_MATCH_FILTER };
}

/**
 * Une offre qui peut encore RECEVOIR un geste d'intérêt : publiée, en recherche, période non
 * échue — sans le filtre des relations en cours. C'est la garde du swipe, du signal d'intérêt et
 * de son bouton « signaler à nouveau » : la mise en relation depuis le tiroir des intérêts reçus
 * doit rester possible sur une annonce déjà engagée ailleurs, comme avant la section 298.
 * `offreOuverteLe` en dérive : la borne de date n'est écrite qu'une fois.
 */
export function offreRecevableLe(instant: Date): Prisma.MissionWhereInput {
  return { ...EST_UNE_OFFRE, ...periodeNonEchueLe(instant) };
}

/** La borne de date seule — un `OR` de premier niveau, voir `offreOuverteLe`. */
export function periodeNonEchueLe(instant: Date): Prisma.MissionWhereInput {
  // `endDate: null` = poste durable sans terme (section 179) : il reste ouvert indéfiniment.
  return { OR: [{ endDate: null }, { endDate: { gte: jourLocalUtc(instant) } }] };
}
