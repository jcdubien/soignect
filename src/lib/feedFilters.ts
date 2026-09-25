import { BriqueStatus, MatchStatus } from "@prisma/client";

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
const ACTIVE_MATCH_STATUSES = [MatchStatus.EN_ATTENTE, MatchStatus.DISCUSSION, MatchStatus.CONFIRME];

export const NO_ACTIVE_MATCH_FILTER = {
  matchesA: { none: { status: { in: ACTIVE_MATCH_STATUSES } } },
  matchesB: { none: { status: { in: ACTIVE_MATCH_STATUSES } } },
} as const;
