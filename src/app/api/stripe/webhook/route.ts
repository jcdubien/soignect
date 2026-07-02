import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { SubscriptionPlan } from "@prisma/client";

export const dynamic = "force-dynamic";

function planScore(plan: SubscriptionPlan): number {
  return ({ FREE: 0, PREMIUM: 5, BOOST: 8 } as Record<SubscriptionPlan, number>)[plan] ?? 0;
}

function planFromPriceId(priceId: string): SubscriptionPlan {
  if (priceId === process.env.STRIPE_PRICE_PREMIUM) return "PREMIUM";
  if (priceId === process.env.STRIPE_PRICE_BOOST) return "BOOST";
  return "FREE";
}

async function applySubscription(profileId: string, plan: SubscriptionPlan) {
  const profile = await prisma.profile.findUnique({ where: { id: profileId } });
  if (!profile) return;

  const newScore = profile.isFounding ? 10 : planScore(plan);

  await prisma.profile.update({
    where: { id: profileId },
    data: { subscriptionPlan: plan, isPaid: plan !== "FREE", desirabilityScore: newScore },
  });
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
      const priceId = sub.items.data[0]?.price?.id;
      const plan = priceId ? planFromPriceId(priceId) : "FREE";
      if (sub.status === "active" || sub.status === "trialing") {
        await applySubscription(profileId, plan);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const profileId = sub.metadata?.profileId;
      if (profileId) await applySubscription(profileId, "FREE");
      break;
    }

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const profileId = session.metadata?.profileId;
      const plan = (session.metadata?.plan ?? "FREE") as SubscriptionPlan;
      if (profileId && session.mode === "subscription") {
        await applySubscription(profileId, plan);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
