import { prisma } from "@/lib/prisma";
import { sendBillingTriggeredEmail } from "@/lib/email";

// Bascule individuelle vers le payant (sections 99/100). Seuils configurables (pas de
// valeur codée en dur dispersée dans le code).
export const BILLING_USAGE_WINDOW_WEEKS = 6; // fenêtre glissante
export const BILLING_USAGE_MIN_WEEKS = 3;    // semaines calendaires distinctes d'activité requises
export const BILLING_GRACE_DAYS = 14;        // délai de grâce avant coupure effective (7-14j)

// Marque le déclenchement de facturation individuelle pour un cabinet, si pas déjà fait.
// Idempotent (updateMany filtré sur billingTriggeredAt null). Retourne true si nouvellement déclenché.
export async function triggerBillingIfNeeded(profileId: string): Promise<boolean> {
  const res = await prisma.profile.updateMany({
    where: { id: profileId, type: "TITULAIRE", billingTriggeredAt: null },
    data: { billingTriggeredAt: new Date() },
  });
  return res.count > 0;
}

// Fin de la période de grâce d'un cabinet (null si pas déclenché).
export function graceEndsAt(billingTriggeredAt: Date | null | undefined): Date | null {
  if (!billingTriggeredAt) return null;
  const d = new Date(billingTriggeredAt);
  d.setDate(d.getDate() + BILLING_GRACE_DAYS);
  return d;
}

// Numéro de semaine ISO (année-semaine) — clé de regroupement calendaire.
export function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export interface UsageScanResult {
  profileId: string;
  name: string | null;
  weeks: number;             // semaines distinctes d'activité sur la fenêtre
  alreadyTriggered: boolean; // billingTriggeredAt déjà renseigné
  triggered: boolean;        // déclenché par CE scan (apply=true)
}

// Critère 2 (section 100) — usage soutenu du Planning Board : au moins MIN_WEEKS semaines
// calendaires distinctes d'activité (PLANNING_ACTIVE) sur la fenêtre glissante WINDOW_WEEKS.
// apply=false → dry-run (aucune mutation). apply=true → renseigne billingTriggeredAt + notifie.
export async function scanSustainedUsage(apply: boolean): Promise<UsageScanResult[]> {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - BILLING_USAGE_WINDOW_WEEKS * 7);

  const events = await prisma.traceEvent.findMany({
    where: { eventType: "PLANNING_ACTIVE", occurredAt: { gte: windowStart }, NOT: { profileId: null } },
    select: { profileId: true, occurredAt: true },
  });

  const weeksByProfile = new Map<string, Set<string>>();
  for (const e of events) {
    if (!e.profileId) continue;
    const set = weeksByProfile.get(e.profileId) ?? new Set<string>();
    set.add(isoWeekKey(e.occurredAt));
    weeksByProfile.set(e.profileId, set);
  }

  const results: UsageScanResult[] = [];
  for (const [profileId, weeks] of Array.from(weeksByProfile.entries())) {
    if (weeks.size < BILLING_USAGE_MIN_WEEKS) continue;
    const prof = await prisma.profile.findUnique({
      where: { id: profileId },
      select: { name: true, type: true, billingTriggeredAt: true, user: { select: { email: true } } },
    });
    if (!prof || prof.type !== "TITULAIRE") continue;

    let triggered = false;
    if (apply && !prof.billingTriggeredAt) {
      triggered = await triggerBillingIfNeeded(profileId);
      if (triggered && prof.user?.email) {
        sendBillingTriggeredEmail(prof.user.email, { reason: "usage" });
      }
    }
    results.push({
      profileId,
      name: prof.name,
      weeks: weeks.size,
      alreadyTriggered: !!prof.billingTriggeredAt,
      triggered,
    });
  }
  return results;
}
