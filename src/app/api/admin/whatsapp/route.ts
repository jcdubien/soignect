import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logTraceEvent } from "@/lib/trace";

export const dynamic = "force-dynamic";

// POST /api/admin/whatsapp — prépare l'ouverture d'une conversation WhatsApp (section 292).
//
// POURQUOI LE LIEN SE FABRIQUE ICI, ET PAS DANS LA PAGE. Le numéro ne descend jamais au
// navigateur avec la liste des comptes : `/admin/users` n'en reçoit que le drapeau « joignable ».
// Un numéro rendu dans une page est un numéro dans le cache, dans l'historique, et dans toute
// copie d'écran de cette page. Il ne sort qu'au moment du geste, pour UNE personne, et parce que
// `wa.me` l'exige dans son URL.
//
// LE CONSENTEMENT EST REVÉRIFIÉ ICI. La page peut être vieille de dix minutes ; la personne peut
// avoir décoché entretemps. L'écran propose, le serveur décide.
//
// ADMIN SEULEMENT, ET CE N'EST PAS UNE ÉTAPE VERS « BIENTÔT LES CABINETS ». Mesuré le 08/10 :
// 35 % des conversations contiennent déjà un numéro, et aucune ne suit un contrat signé — la
// relation quitte la plateforme AVANT qu'elle ne serve à rien. Donner ce bouton aux cabinets
// institutionnaliserait exactement cette sortie, en plus de livrer le numéro du candidat (un
// lien `wa.me` ouvre la conversation chez l'expéditeur, numéro en clair).
export async function POST(req: Request) {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== "ADMIN") {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const { userId } = await req.json().catch(() => ({ userId: null }));
  if (typeof userId !== "string" || !userId) {
    return NextResponse.json({ error: "userId requis" }, { status: 400 });
  }

  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { phone: true, whatsappOptIn: true, profile: { select: { id: true } } },
  });
  if (!u?.whatsappOptIn || !u.phone) {
    return NextResponse.json({ error: "Cette personne n'a pas autorisé WhatsApp." }, { status: 409 });
  }

  // `wa.me` veut le numéro sans « + » ni séparateur.
  const numero = u.phone.replace(/[^\d]/g, "");
  const base = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "https://www.soignect.fr";

  // AUCUNE DONNÉE DE L'AUTRE PARTIE DANS CE TEXTE : ni nom de cabinet, ni titre d'annonce, ni
  // dates. Un message WhatsApp se transfère, se capture, se lit par-dessus l'épaule. Le contenu
  // reste derrière la connexion ; le lien ne fait que ramener.
  const texte = `Bonjour, vous avez une activité en attente sur Soignect. ${base}/annonces`;
  const lien = `https://wa.me/${numero}?text=${encodeURIComponent(texte)}`;

  // CE QU'ON JOURNALISE : qu'un canal a été ouvert, par qui, vers qui. Ni le numéro, ni le
  // texte. Et c'est bien une OUVERTURE, pas un envoi : personne ici ne sait si le message a été
  // expédié une fois WhatsApp ouvert — la trace ne doit donc rien affirmer de plus.
  logTraceEvent({
    eventType: "WHATSAPP_OUVERT",
    profileId: u.profile?.id ?? null,
    metadata: { parProfileId: (session?.user as { profileId?: string })?.profileId ?? null },
  });

  return NextResponse.json({ lien });
}
