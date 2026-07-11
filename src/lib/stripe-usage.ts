import { prisma } from "@/lib/prisma";

// Reporting d'usage metered pour une structure privée (section 7) : 1 unité (20€) par
// contrat signé. Idempotent via idempotencyKey (rejoue sans double-facturer). No-op si
// la structure n'a pas d'abonnement metered actif. À appeler sans bloquer la route.
export async function reportStructureContractUsage(profileId: string, idempotencyKey: string): Promise<void> {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_STRUCTURE_USAGE) return;

  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { subscriptionPlan: true, stripeSubscriptionId: true },
  });
  if (!profile || profile.subscriptionPlan !== "STRUCTURE" || !profile.stripeSubscriptionId) return;

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const sub = await stripe.subscriptions.retrieve(profile.stripeSubscriptionId);
    const item = sub.items.data.find((i) => i.price?.id === process.env.STRIPE_PRICE_STRUCTURE_USAGE);
    if (!item) return;
    // Métode d'usage historique (subscriptionItems.createUsageRecord) — voir section 7
    await (stripe.subscriptionItems as unknown as {
      createUsageRecord: (id: string, params: object, opts: object) => Promise<unknown>;
    }).createUsageRecord(
      item.id,
      { quantity: 1, action: "increment", timestamp: Math.floor(Date.now() / 1000) },
      { idempotencyKey }
    );
  } catch (e) {
    console.error("[stripe] usage record structure échoué (ignoré):", e);
  }
}
