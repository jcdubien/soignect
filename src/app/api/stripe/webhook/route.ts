import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { SubscriptionPlan } from "@prisma/client";
import { enrolInPreventionCourse } from "@/lib/moodle";

export const dynamic = "force-dynamic";

function planScore(plan: SubscriptionPlan): number {
  return ({ FREE: 0, PREMIUM: 5, BOOST: 8, STRUCTURE: 8 } as Record<SubscriptionPlan, number>)[plan] ?? 0;
}

function planFromPriceId(priceId: string): SubscriptionPlan {
  if (priceId === process.env.STRIPE_PRICE_PREMIUM) return "PREMIUM";
  if (priceId === process.env.STRIPE_PRICE_BOOST) return "BOOST";
  if (priceId === process.env.STRIPE_PRICE_STRUCTURE_BASE) return "STRUCTURE";
  return "FREE";
}

// Plan à partir de l'ensemble des prix d'un abonnement (structure = base + usage metered)
function planFromSubscription(sub: Stripe.Subscription): SubscriptionPlan {
  const priceIds = sub.items.data.map((i) => i.price?.id).filter(Boolean) as string[];
  if (process.env.STRIPE_PRICE_STRUCTURE_BASE && priceIds.includes(process.env.STRIPE_PRICE_STRUCTURE_BASE)) return "STRUCTURE";
  return priceIds[0] ? planFromPriceId(priceIds[0]) : "FREE";
}

async function applySubscription(
  profileId: string,
  plan: SubscriptionPlan,
  stripeIds?: { customerId?: string | null; subscriptionId?: string | null }
) {
  const profile = await prisma.profile.findUnique({ where: { id: profileId } });
  if (!profile) return;

  const newScore = profile.isFounding ? 10 : planScore(plan);

  await prisma.profile.update({
    where: { id: profileId },
    data: {
      subscriptionPlan: plan,
      isPaid: plan !== "FREE",
      desirabilityScore: newScore,
      ...(stripeIds?.customerId !== undefined ? { stripeCustomerId: stripeIds.customerId } : {}),
      ...(stripeIds?.subscriptionId !== undefined ? { stripeSubscriptionId: stripeIds.subscriptionId } : {}),
    },
  });
}

async function fulfilTraining(session: Stripe.Checkout.Session) {
  if (session.metadata?.kind !== "MOODLE_TRAINING" || session.payment_status !== "paid") return;

  const userId = session.metadata.userId;
  const courseKey = session.metadata.courseKey;
  if (!userId || courseKey !== "PREVENTION") throw new Error("Métadonnées formation Stripe invalides");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: { select: { name: true } } },
  });
  if (!user) throw new Error(`Compte Soignect introuvable pour la session ${session.id}`);

  const paymentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id ?? null;
  const purchase = await prisma.trainingPurchase.upsert({
    where: { stripeSessionId: session.id },
    create: {
      userId,
      courseKey,
      stripeSessionId: session.id,
      stripePaymentId: paymentId,
      amountTotal: session.amount_total,
      currency: session.currency,
      status: "PAID",
    },
    update: {
      stripePaymentId: paymentId,
      amountTotal: session.amount_total,
      currency: session.currency,
    },
  });
  if (purchase.status === "ENROLLED") return;

  try {
    const enrolled = await enrolInPreventionCourse({
      email: user.email,
      fullName: session.customer_details?.name ?? user.profile?.name,
    });
    await prisma.trainingPurchase.update({
      where: { id: purchase.id },
      data: {
        ...enrolled,
        status: "ENROLLED",
        enrolledAt: new Date(),
        lastError: null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur Moodle inconnue";
    await prisma.trainingPurchase.update({
      where: { id: purchase.id },
      data: { status: "ENROLLMENT_FAILED", lastError: message.slice(0, 1000) },
    });
    // Réponse 500 : Stripe rejouera le webhook. L'upsert ci-dessus garantit l'idempotence.
    throw error;
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe non configuré" }, { status: 503 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Signature manquante" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const profileId = sub.metadata?.profileId;
      if (!profileId) break;
      const plan = planFromSubscription(sub);
      if (sub.status === "active" || sub.status === "trialing") {
        await applySubscription(profileId, plan, {
          customerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null,
          subscriptionId: sub.id,
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const profileId = sub.metadata?.profileId;
      if (profileId) await applySubscription(profileId, "FREE", { subscriptionId: null });
      break;
    }

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.kind === "MOODLE_TRAINING") {
        await fulfilTraining(session);
        break;
      }
      const profileId = session.metadata?.profileId;
      const plan = (session.metadata?.plan ?? "FREE") as SubscriptionPlan;
      if (profileId && session.mode === "subscription") {
        await applySubscription(profileId, plan, {
          customerId: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
          subscriptionId: typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null,
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
