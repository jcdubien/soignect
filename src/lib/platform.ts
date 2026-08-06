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

// Blocage dur des contrats si identité contractuelle incomplète (section 150).
// false (défaut) = phase d'avertissement non bloquant ; true = accès contrat refusé.
export async function isContractProfileEnforced(): Promise<boolean> {
  try {
    const cfg = await prisma.platformConfig.findFirst({ select: { enforceContractProfile: true } });
    return cfg?.enforceContractProfile ?? false;
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
  isFounding?: boolean | null;
}): Promise<boolean> {
  const plan = input?.subscriptionPlan;
  if (plan === "PREMIUM" || plan === "BOOST" || plan === "STRUCTURE") return true;
  // Cabinet fondateur : accès Premium À VIE, décision commerciale de Jean-Charles (06/08).
  // Placé AVANT le test du mode gratuit, donc l'exemption survit à la fin de la bêta —
  // contrairement à une première version qui ne levait que la bascule individuelle.
  // Ce que ça engage : le drapeau est attribuable depuis /admin/profiles, et il vaut
  // désormais gratuité perpétuelle en plus de la désirabilité à 100 %. À n'accorder qu'en
  // connaissance de ces deux effets. Un seul compte le porte aujourd'hui.
  if (input?.isFounding) return true;
  if (!(await isFreeAccessMode())) return false;
  if (!input?.billingTriggeredAt) return true;
  const end = graceEndsAt(input.billingTriggeredAt);
  return end ? new Date() < end : true;
}
