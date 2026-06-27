import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) return NextResponse.json({ error: "Signature manquante" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const profileId = session.metadata?.profileId;

    if (profileId) {
      const paidUntil = new Date();
      paidUntil.setDate(paidUntil.getDate() + 30); // 30 jours de boost

      await prisma.profile.update({
        where: { id: profileId },
        data: {
          isPaid: true,
          paidUntil,
          weight: 2.0,
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}
