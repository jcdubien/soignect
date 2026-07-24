import { MatchStatus } from "@prisma/client";

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
