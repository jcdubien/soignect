import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// Back-office de traçabilité (section 86).
// Insert fire-and-forget : ne bloque JAMAIS ni ne ralentit la route appelante,
// et n'échoue jamais visiblement (toute erreur est avalée). À appeler SANS await.
export function logTraceEvent(input: {
  eventType: string;
  missionId?: string | null;
  matchId?: string | null;
  profileId?: string | null;
  commune?: string | null;
  profession?: string | null;
  missionType?: string | null;
  metadata?: Prisma.InputJsonValue;
}): void {
  prisma.traceEvent
    .create({
      data: {
        eventType: input.eventType,
        missionId: input.missionId ?? null,
        matchId: input.matchId ?? null,
        profileId: input.profileId ?? null,
        commune: input.commune ?? null,
        profession: input.profession ?? null,
        missionType: input.missionType ?? null,
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      },
    })
    .catch((err) => {
      console.error("[TraceEvent] insert échoué (ignoré):", err);
    });
}

// ── Annulations de mises en relation ─────────────────────────────────────────
//
// Une annulation DÉTRUIT sa propre preuve : la ligne Match est supprimée (avec ses Swipe et ses
// Message), et rien ne subsistait de l'événement. Contrairement à un compteur qu'on peut
// recalculer plus tard sur les données existantes, une annulation non capturée est perdue
// définitivement. D'où ce capteur, à appeler AVANT toute suppression.
//
// UN SEUL eventType, `MATCH_CANCELLED`, avec le stade en metadata plutôt que deux types
// distincts : l'annulation est le même fait métier, seul son moment change, et un type unique
// évite qu'une agrégation future compte deux fois ou en oublie un.
//
// Pas de profileId : le rôle de l'initiateur (cabinet / candidat) suffit à mesurer la fiabilité
// du marché, là où l'identité permettrait de profiler les praticiens qui annulent — ce que le
// cadre RGPD posé pour l'Observatoire (agrégation, pas d'exploitation individuelle) exclut.
// Décision réversible : si un usage légitime de la déduplication apparaît, le champ existe.

export type OrigineAnnulation =
  | "MATCH_SUPPRIME"      // annulation explicite d'une mise en relation (section 145/149)
  | "DECLINE"             // refus via le statut, sans suppression
  | "ANNONCE_SUPPRIMEE"   // l'annonce disparaît → ses mises en relation avec
  | "ABSENCE_SUPPRIMEE"   // idem pour une période d'absence publiée
  | "ADMIN";              // suppression par l'administration

export type InitiateurAnnulation = "CABINET" | "CANDIDAT" | "ADMIN" | "SYSTEME";

// Forme minimale attendue d'un Match pour la traçabilité — compatible avec les `include`
// existants des routes appelantes.
export interface MatchAnnulable {
  id: string;
  status: string;
  createdAt: Date;
  signatureTitulaireAt?: Date | null;
  signatureRemplacantAt?: Date | null;
  missionAId?: string | null;
  missionBId?: string | null;
  missionA?: { location?: string | null; missionType?: string | null; briqueStatus?: string | null } | null;
  missionB?: { location?: string | null; missionType?: string | null; briqueStatus?: string | null } | null;
}

export function logMatchCancelled(
  match: MatchAnnulable,
  opts: { origine: OrigineAnnulation; initiateur: InitiateurAnnulation }
): void {
  const signatures = (match.signatureTitulaireAt ? 1 : 0) + (match.signatureRemplacantAt ? 1 : 0);
  // Le contrat est signé quand les DEUX parties l'ont signé ; le statut CONFIRME de la brique
  // en est le reflet côté planning. On retient l'un ou l'autre pour ne pas rater le cas d'une
  // brique confirmée dont les dates de signature manqueraient (reprises de données anciennes).
  const contratSigne =
    signatures === 2 ||
    match.missionA?.briqueStatus === "CONFIRME" ||
    match.missionB?.briqueStatus === "CONFIRME";

  // missionA porte l'annonce du cabinet par convention (voir api/swipe) ; repli sur B.
  const cote = match.missionA ?? match.missionB ?? null;

  logTraceEvent({
    eventType: "MATCH_CANCELLED",
    matchId: match.id,
    missionId: match.missionAId ?? match.missionBId ?? null,
    commune: cote?.location ?? null,
    missionType: cote?.missionType ?? null,
    metadata: {
      stade: contratSigne ? "CONTRAT_SIGNE" : match.status,
      phase: contratSigne ? "APRES_SIGNATURE" : "AVANT_SIGNATURE",
      signatures,
      joursDepuisMatch: Math.max(0, Math.floor((Date.now() - match.createdAt.getTime()) / 86_400_000)),
      initiateur: opts.initiateur,
      origine: opts.origine,
    },
  });
}
