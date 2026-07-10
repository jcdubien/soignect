import { prisma } from "@/lib/prisma";

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

// Accès Premium effectif : vrai si mode gratuit actif OU abonnement payant.
export async function hasPremiumAccess(subscriptionPlan?: string | null): Promise<boolean> {
  if (await isFreeAccessMode()) return true;
  return subscriptionPlan === "PREMIUM" || subscriptionPlan === "BOOST";
}
