import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendAdresseCorrigeeEmail } from "@/lib/email";
import { adresseEnvoyable } from "@/lib/relancePublication";

export const dynamic = "force-dynamic";

const EVENT = "ADRESSE_CORRIGEE";

// POST /api/admin/corriger-adresse — corriger une adresse fautive ET prévenir la personne.
//
// POURQUOI UNE ROUTE, POUR UN SEUL COMPTE. `leonie04.cappelaere@gmail.coml` — un « l » de trop —
// rendait un compte injoignable depuis son inscription, et c'était son identifiant de connexion.
// La correction a d'abord été faite à la main, en base. Prévenir la personne, en revanche, ne
// peut pas se faire à la main : un script local qui réimplémenterait l'envoi exécuterait une
// COPIE du code livré, qui finirait par diverger de l'original — ce dépôt paie déjà cette
// facture ailleurs (cf. `api/admin/vignette`).
//
// ET CE NE SERA PAS LE SEUL. La règle de proximité qui a trouvé celui-là (domaine à une ou deux
// lettres d'un domaine connu) en trouvera d'autres : `oultook.fr` était déjà passé par là. Un
// geste qu'on sait devoir refaire mérite un chemin, pas une improvisation.
//
// IDEMPOTENTE. Si l'ancienne adresse n'existe plus et que la nouvelle existe, la correction a
// déjà eu lieu : on ne touche à rien et on se contente de prévenir. C'est exactement le cas de
// ce premier usage.
//
// TROIS GARDES, comme la campagne de la section 290 : ADMIN authentifié, `?appliquer=1`
// explicite, et `VERCEL_ENV === "production"`. Modifier un identifiant de connexion et écrire à
// la personne sont deux actes irréversibles ; ni l'un ni l'autre ne doit pouvoir partir d'un
// poste de développement.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if ((session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const { ancienne, nouvelle, contact } = await req.json().catch(() => ({}));
  if (typeof ancienne !== "string" || typeof nouvelle !== "string" || !adresseEnvoyable(nouvelle)) {
    return NextResponse.json({ error: "`ancienne` et `nouvelle` requises, `nouvelle` valide" }, { status: 400 });
  }
  if (ancienne.toLowerCase() === nouvelle.toLowerCase()) {
    return NextResponse.json({ error: "Les deux adresses sont identiques." }, { status: 400 });
  }

  const avant = await prisma.user.findUnique({ where: { email: ancienne }, select: { id: true } });
  const apres = await prisma.user.findUnique({
    where: { email: nouvelle },
    select: { id: true, profile: { select: { id: true, name: true } } },
  });

  // Collision : deux comptes distincts. On ne fusionne rien et on ne devine rien.
  if (avant && apres && avant.id !== apres.id) {
    return NextResponse.json(
      { error: "L'adresse cible appartient déjà à un autre compte. Correction refusée." },
      { status: 409 },
    );
  }
  const cible = avant ?? apres;
  if (!cible) return NextResponse.json({ error: "Aucun compte avec l'une ou l'autre adresse." }, { status: 404 });

  const dejaCorrigee = !avant && !!apres;
  const appliquer = new URL(req.url).searchParams.get("appliquer") === "1";
  const enProduction = process.env.VERCEL_ENV === "production";

  const adresseContact = typeof contact === "string" && adresseEnvoyable(contact)
    ? contact
    : process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "jcdubien@gmail.com";

  if (!appliquer) {
    return NextResponse.json({
      ok: true, simulation: true, environnement: process.env.VERCEL_ENV ?? "(local)",
      dejaCorrigee, nom: apres?.profile?.name ?? null, contact: adresseContact,
      ferait: dejaCorrigee ? "prévenir seulement" : "corriger puis prévenir",
    });
  }
  if (!enProduction) {
    return NextResponse.json(
      { ok: false, motif: "Refusé hors production : aucune modification, aucun email." },
      { status: 409 },
    );
  }

  if (!dejaCorrigee) {
    await prisma.user.update({ where: { id: cible.id }, data: { email: nouvelle } });
  }

  const resultat = await sendAdresseCorrigeeEmail(nouvelle, {
    firstName: (apres?.profile?.name ?? "").trim().split(/\s+/).pop() || null,
    ancienneAdresse: ancienne,
    nouvelleAdresse: nouvelle,
    contact: adresseContact,
  });

  // La trace suit l'envoi, jamais l'inverse (section 291) : une correction dont la personne
  // n'a pas été prévenue ne doit pas être enregistrée comme notifiée.
  if (resultat === "envoye") {
    await prisma.traceEvent.create({
      data: { eventType: EVENT, profileId: apres?.profile?.id ?? null, metadata: { ancienne, nouvelle } },
    });
  }

  return NextResponse.json({ ok: true, simulation: false, dejaCorrigee, envoi: resultat });
}
