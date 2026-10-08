import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ciblesInteretEnSouffrance, envoyerInteretEnSouffrance } from "@/lib/interetEnSouffrance";

export const dynamic = "force-dynamic";

// POST /api/admin/interet-en-souffrance — campagne PONCTUELLE (section 290).
//
// Elle s'adresse aux personnes dont un « Intéressé » porte sur une annonce ENCORE ouverte et qui
// n'ont jamais rien publié : leur geste est en base, le signal est différé, et personne des deux
// côtés ne peut agir. La feuille de la section 288 ne les atteint que si elles reviennent — ce
// que onze à trente-trois jours de silence rendent improbable.
//
// TROIS GARDES, DANS CET ORDRE :
//
//   1. ADMIN authentifié. Même règle que la campagne de la section 229.
//   2. `?envoyer=1` explicite. Par défaut on SIMULE : un envoi de masse ne doit pas pouvoir
//      partir d'un appel abrégé ou d'un clic de curiosité.
//   3. `VERCEL_ENV === "production"`. C'est la garde demandée, et elle est vérifiable : la
//      variable est posée par la plateforme, jamais par le dépôt. Sur un poste de développement
//      elle est absente — l'envoi est donc refusé AVANT toute écriture, et aucun marqueur ne peut
//      être posé depuis un local. Sans elle, un `npm run dev` pointé sur la base de production
//      aurait suffi à consommer la campagne pour de vrai, et le marqueur aurait interdit de la
//      rejouer.
//
// LA RÉEXÉCUTER EST INOFFENSIF : chaque destinataire est marqué à l'envoi, et le marqueur
// l'écarte définitivement de cette campagne.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if ((session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const envoyerDemande = new URL(req.url).searchParams.get("envoyer") === "1";
  const enProduction = process.env.VERCEL_ENV === "production";
  const { cibles, exclus } = await ciblesInteretEnSouffrance();

  // Le refus est EXPLICITE, pas un repli silencieux en simulation : quelqu'un qui demande un
  // envoi doit savoir qu'il n'a pas eu lieu, et pourquoi.
  if (envoyerDemande && !enProduction) {
    return NextResponse.json(
      {
        ok: false,
        envoye: false,
        motif:
          "Envoi refusé hors production (VERCEL_ENV absent ou différent de « production »). " +
          "Aucun email envoyé, aucun marqueur écrit.",
        aurait_ete_envoye: cibles.length,
      },
      { status: 409 },
    );
  }

  const resultat = envoyerDemande ? await envoyerInteretEnSouffrance(cibles) : null;

  return NextResponse.json({
    ok: true,
    simulation: !envoyerDemande,
    environnement: process.env.VERCEL_ENV ?? "(local)",
    ...(resultat ?? { examines: cibles.length, envoyes: 0, refuses: 0, echecs: 0 }),
    // Détail nominatif, comme la campagne de la 229 : on doit pouvoir vérifier QUI avant et
    // après, pas seulement combien.
    cibles: cibles.map((c) => ({
      nom: c.nom,
      email: c.email,
      type: c.type,
      cabinets: c.nbCabinets,
      annonces: c.nbAnnonces,
      premierInteret: c.premierInteret,
      derniereActivite: c.derniereActivite,
      dernierEmail: c.dernierEmail,
    })),
    exclus,
  });
}
