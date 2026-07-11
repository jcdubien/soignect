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
