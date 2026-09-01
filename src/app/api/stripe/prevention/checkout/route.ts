import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { appBaseUrl } from "@/lib/appUrl";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_PREVENTION_TRAINING;
  if (!secretKey || !priceId) {
    return NextResponse.json({ error: "La formation n'est pas encore disponible au paiement" }, { status: 503 });
  }

  const alreadyEnrolled = await prisma.trainingPurchase.findFirst({
    where: { userId: session.user.id, courseKey: "PREVENTION", status: "ENROLLED" },
    select: { id: true },
  });
  if (alreadyEnrolled) {
    return NextResponse.json({ error: "Vous êtes déjà inscrit à cette formation" }, { status: 409 });
  }

  const stripe = new Stripe(secretKey);
  const baseUrl = appBaseUrl();
  try {
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: session.user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        kind: "MOODLE_TRAINING",
        courseKey: "PREVENTION",
        userId: session.user.id,
        profileId: session.user.profileId ?? "",
      },
      payment_intent_data: {
        metadata: { kind: "MOODLE_TRAINING", courseKey: "PREVENTION", userId: session.user.id },
      },
      success_url: `${baseUrl}/formation-prevention?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/formation-prevention?payment=cancelled`,
    });
    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur Stripe inconnue";
    console.error("[stripe/prevention] création Checkout échouée", message);
    return NextResponse.json({ error: `Stripe : ${message}` }, { status: 502 });
  }
}
