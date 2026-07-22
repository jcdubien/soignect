import { prisma } from "@/lib/prisma";

// Rate-limiting des appels DeepSeek — protection facture (Sprint 0.3 / audit #8).
// Chaque swipe RIGHT (et chaque création de match) déclenche un appel DeepSeek payant.
// On plafonne par utilisateur ET globalement, avec un REPLI DÉGRADÉ (jamais de blocage) :
// au-delà du plafond, l'appelant saute l'appel et retombe sur le score neutre — l'action
// utilisateur (swipe/match) s'enregistre normalement.
//
// Compteur porté par la table TraceEvent existante (aucune migration) : un event
// "DEEPSEEK_CALL" par appel réellement effectué ; comptage quotidien via l'index
// [profileId, eventType, occurredAt].
export const DEEPSEEK_DAILY_USER_LIMIT = 200;
export const DEEPSEEK_DAILY_GLOBAL_LIMIT = 3000;
const GLOBAL_ALERT_AT = Math.floor(DEEPSEEK_DAILY_GLOBAL_LIMIT * 0.8); // 2400 = 80 %
const CALL_EVENT = "DEEPSEEK_CALL";
const ALERT_EVENT = "DEEPSEEK_ALERT";

function startOfUtcDay(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// À appeler AVANT un appel DeepSeek. false → l'appelant doit sauter l'appel et utiliser le
// score neutre. En cas d'erreur de comptage, on autorise (ne jamais casser le matching pour
// un souci de compteur).
export async function checkDeepSeekBudget(profileId: string): Promise<boolean> {
  const since = startOfUtcDay();
  try {
    const [userCount, globalCount] = await Promise.all([
      prisma.traceEvent.count({ where: { eventType: CALL_EVENT, profileId, occurredAt: { gte: since } } }),
      prisma.traceEvent.count({ where: { eventType: CALL_EVENT, occurredAt: { gte: since } } }),
    ]);
    if (globalCount >= DEEPSEEK_DAILY_GLOBAL_LIMIT) {
      console.error(`[DeepSeek budget] Plafond GLOBAL atteint (${globalCount}/${DEEPSEEK_DAILY_GLOBAL_LIMIT}) — repli score neutre.`);
      return false;
    }
    if (userCount >= DEEPSEEK_DAILY_USER_LIMIT) {
      console.warn(`[DeepSeek budget] Plafond utilisateur atteint (profile=${profileId}, ${userCount}/${DEEPSEEK_DAILY_USER_LIMIT}) — repli score neutre.`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[DeepSeek budget] Erreur de comptage (autorisé par défaut) :", err);
    return true;
  }
}

// À appeler APRÈS un appel DeepSeek réellement effectué (fire-and-forget). Enregistre l'appel
// et émet une alerte admin (log — capté par Vercel, et par Sentry une fois branché) UNE fois
// par jour au franchissement du seuil de 80 % du plafond global.
export async function recordDeepSeekCall(profileId: string, missionType?: string | null): Promise<void> {
  try {
    await prisma.traceEvent.create({ data: { eventType: CALL_EVENT, profileId, missionType: missionType ?? null } });

    const since = startOfUtcDay();
    const globalCount = await prisma.traceEvent.count({ where: { eventType: CALL_EVENT, occurredAt: { gte: since } } });
    if (globalCount >= GLOBAL_ALERT_AT) {
      const alerted = await prisma.traceEvent.findFirst({
        where: { eventType: ALERT_EVENT, occurredAt: { gte: since } },
        select: { id: true },
      });
      if (!alerted) {
        await prisma.traceEvent.create({ data: { eventType: ALERT_EVENT } });
        console.error(
          `[DeepSeek budget] ⚠️ ALERTE : ${globalCount}/${DEEPSEEK_DAILY_GLOBAL_LIMIT} appels DeepSeek aujourd'hui ` +
            `(seuil ${GLOBAL_ALERT_AT} = 80 %). Surveiller la facture.`,
        );
      }
    }
  } catch {
    /* fire-and-forget : ne bloque jamais l'appelant */
  }
}
