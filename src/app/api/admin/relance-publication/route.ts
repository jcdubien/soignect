import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { inscritsSansPublication, envoyerRelances } from "@/lib/relancePublication";

export const dynamic = "force-dynamic";

// Campagne PONCTUELLE de rattrapage (section 229) — les inscrits déjà en base qui n'ont jamais
// rien publié, quel que soit leur ancienneté.
//
// POURQUOI UNE ROUTE ET PAS UN SCRIPT. Un script local envoie depuis un poste, sans trace ni
// garde de rôle. Ici l'appel est authentifié, réservé à un ADMIN, et surtout il partage le MÊME
// marqueur de déduplication que le cron : une personne rattrapée par la campagne ne peut pas
// être relancée ensuite par le job quotidien, et inversement.
//
// LA RÉEXÉCUTER EST INOFFENSIF. Chaque cible est marquée à l'envoi ; un second appel ne trouve
// plus personne. C'est ce qui rend acceptable de laisser cet endpoint en place — il ne peut pas
// servir à envoyer deux fois.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if ((session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  // Par DÉFAUT on simule. Un envoi de masse ne doit pas pouvoir partir d'un appel abrégé : il
  // faut le demander explicitement avec `?envoyer=1`.
  const envoyer = new URL(req.url).searchParams.get("envoyer") === "1";

  const cibles = await inscritsSansPublication(new Date());
  const r = await envoyerRelances(cibles, { simulation: !envoyer });

  return NextResponse.json({
    ok: true,
    simulation: !envoyer,
    ...r,
    // Détail nominatif : cette campagne s'adresse à de vraies personnes, on doit pouvoir
    // vérifier QUI avant et après, pas seulement combien.
    cibles: cibles.map((c) => ({ nom: c.nom, type: c.type, email: c.email, jours: c.joursDepuisInscription })),
  });
}
