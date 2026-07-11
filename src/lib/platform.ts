import { prisma } from "@/lib/prisma";
import { graceEndsAt } from "@/lib/billing";

// Mode lancement gratuit (section 2). Tant que freeAccessMode = true, tous les
// comptes bénéficient des fonctionnalités Premium, quel que soit leur subscriptionPlan.
export async function isFreeAccessMode(): Promise<boolean> {
  try {
    const cfg = await prisma.platformConfig.findFirst({ select: { freeAccessMode: true } });
    return cfg?.freeAccessMode ?? false;
  } catch {
    return false;
  }
}

// Accès Premium effectif (sections 2 / 99 / 100) :
//   (freeAccessMode global ET (billingTriggeredAt null OU dans la période de grâce))
//   OU abonnement payant actif.
// La bascule individuelle (billingTriggeredAt) sort le cabinet du mode gratuit une fois
// la grâce écoulée.
export async function hasPremiumAccess(input?: {
  subscriptionPlan?: string | null;
  billingTriggeredAt?: Date | null;
}): Promise<boolean> {
  const plan = input?.subscriptionPlan;
  if (plan === "PREMIUM" || plan === "BOOST" || plan === "STRUCTURE") return true;
  if (!(await isFreeAccessMode())) return false;
  if (!input?.billingTriggeredAt) return true;
  const end = graceEndsAt(input.billingTriggeredAt);
  return end ? new Date() < end : true;
}
