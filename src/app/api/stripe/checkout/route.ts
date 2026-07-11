import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  plan: z.enum(["PREMIUM", "BOOST", "STRUCTURE"]),
});

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe non configuré" }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.profileId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { id: session.user.profileId },
    include: { user: { select: { email: true } } },
  });

  if (!profile || profile.type !== "TITULAIRE") {
    return NextResponse.json({ error: "Réservé aux cabinets" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { plan } = parsed.data;

  // Structure privée = abonnement de base 89€ + prix à l'usage 20€/contrat (metered, section 7).
  // Distinction Cabinet/Structure : proxy isEmployeur (aucun champ dédié — signalé à l'utilisateur).
  let lineItems: { price: string; quantity?: number }[];
  if (plan === "STRUCTURE") {
    if (!profile.isEmployeur) {
      return NextResponse.json({ error: "Réservé aux structures privées" }, { status: 403 });
    }
    const base = process.env.STRIPE_PRICE_STRUCTURE_BASE;
    const usage = process.env.STRIPE_PRICE_STRUCTURE_USAGE;
    if (!base || !usage) {
      return NextResponse.json({ error: "Prix Stripe Structure manquants (base/usage)" }, { status: 503 });
    }
    // Le prix metered ne prend PAS de quantity dans les line_items
    lineItems = [{ price: base, quantity: 1 }, { price: usage }];
  } else {
    const priceId = plan === "PREMIUM" ? process.env.STRIPE_PRICE_PREMIUM : process.env.STRIPE_PRICE_BOOST;
    if (!priceId) {
      return NextResponse.json({ error: `Prix Stripe manquant pour le plan ${plan}` }, { status: 503 });
    }
    lineItems = [{ price: priceId, quantity: 1 }];
  }

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: profile.user.email,
    line_items: lineItems,
    metadata: { profileId: profile.id, plan },
    subscription_data: {
      metadata: { profileId: profile.id, plan },
    },
    success_url: `${baseUrl}/dashboard/billing?success=1`,
    cancel_url: `${baseUrl}/premium?cancelled=1`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
