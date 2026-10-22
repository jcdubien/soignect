import { NextRequest, NextResponse } from "next/server";
import { controlerCase, niveauAplDe, poserCase, reglerCase, retirerCases } from "@/lib/casesPriorite";
import { JUSTIFICATION_MAX, NIVEAU_MAX, erreurReglage } from "@/lib/boostTerritorial";
import { prisma } from "@/lib/prisma";
import { Profession } from "@prisma/client";
import { z } from "zod";
import { editeurConnecte, libellesDuCode, relationActive } from "@/lib/pageClient";

export const dynamic = "force-dynamic";

// Réglages d'une page client (20/10). Le jeton d'édition DÉSIGNE la page ; depuis le 20/10
// (section 314) il n'autorise plus rien seul : chaque modification exige une session sur un
// compte d'éditeur nommé de ce client (`editeurConnecte`), qui en devient l'auteur. Ce qu'un
// éditeur peut faire est volontairement étroit :
//   · PATCH  — message d'accueil, contact, professions montrées ;
//   · POST   — ajouter une priorité DÉCLARÉE sur une commune du périmètre ;
//   · PUT    — régler le niveau d'une case de CE client (point 8 : ±1 autour de l'APL libre,
//              au-delà justification écrite) ;
//   · DELETE — retirer une priorité que CE client a déclarée.
// Chaque geste sur une case est journalisé en ajout seul (`JournalReglage`), au nom de l'éditeur.
// Le périmètre, l'abonnement et les priorités tirées de l'APL ne se règlent pas ici.

async function pageDuJeton(jeton: string) {
  const page = await prisma.pageClient.findUnique({
    where: { jetonEdition: jeton },
    include: { client: { select: { id: true, nom: true, type: true, nature: true, palier: true, debutLe: true, revueLe: true, clotureLe: true } } },
  });
  return page && relationActive(page.client) ? page : null;
}

const nonEditeur = () => NextResponse.json(
  { error: "Consultation seule : connectez-vous avec votre compte éditeur pour modifier." },
  { status: 403 },
);

const reglages = z.object({
  messageAccueil: z.string().trim().max(700).nullable(),
  contact: z.string().trim().max(200).nullable(),
  professions: z.array(z.nativeEnum(Profession)),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ jeton: string }> }) {
  const page = await pageDuJeton((await params).jeton);
  if (!page) return NextResponse.json({ error: "Lien inconnu ou page inactive." }, { status: 404 });
  const editeur = await editeurConnecte(page.clientId);
  if (!editeur) return nonEditeur();
  const parsed = reglages.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Réglages invalides." }, { status: 400 });
  const { messageAccueil, contact, professions } = parsed.data;
  await prisma.pageClient.update({
    where: { id: page.id },
    data: { messageAccueil: messageAccueil || null, contact: contact || null, professions },
  });
  return NextResponse.json({ ok: true });
}

const ajout = z.object({
  codeInsee: z.string(),
  profession: z.nativeEnum(Profession),
  niveau: z.number().int().min(1).max(NIVEAU_MAX),
  justification: z.string().trim().max(JUSTIFICATION_MAX).nullish(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ jeton: string }> }) {
  const page = await pageDuJeton((await params).jeton);
  if (!page) return NextResponse.json({ error: "Lien inconnu ou page inactive." }, { status: 404 });
  const editeur = await editeurConnecte(page.clientId);
  if (!editeur) return nonEditeur();
  const parsed = ajout.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Priorité invalide." }, { status: 400 });
  // Une page de démonstration n'écrit aucune priorité : elle agirait sur le fil réel.
  if (page.demo) return NextResponse.json({ error: "Page de démonstration : l'ajout de priorités s'ouvre avec l'abonnement." }, { status: 409 });
  const { codeInsee, profession, niveau } = parsed.data;
  if (!page.communes.includes(codeInsee)) {
    return NextResponse.json({ error: "Cette commune n'est pas dans votre périmètre." }, { status: 400 });
  }
  const niveauApl = await niveauAplDe(codeInsee, profession);
  const refus = erreurReglage(niveau, niveauApl, parsed.data.justification);
  if (refus) return NextResponse.json({ error: refus, niveauApl }, { status: 400 });
  // Unicité, chevauchement (premier arrivé) et plafond de cases de l'offre : lib/casesPriorite.
  const client = page.client;
  const controle = await controlerCase(client, codeInsee, profession);
  if (!controle.ok) return NextResponse.json({ error: controle.error, conflit: controle.conflit }, { status: 409 });
  await poserCase(controle, client, { id: editeur.userId, nom: editeur.nom }, (db, noteReprise) => db.prioriteTerritoriale.create({
    data: {
      codeInsee, profession, niveau, niveauApl, origine: "DECLAREE",
      justification: parsed.data.justification || null,
      commune: libellesDuCode(codeInsee)[0] ?? codeInsee,
      clientId: page.clientId, saisiParId: editeur.userId, declareLe: new Date(),
      note: `Ajoutée par ${editeur.nom} depuis la page du client.${noteReprise ? ` ${noteReprise}` : ""}`,
    },
  }));
  return NextResponse.json({ ok: true });
}

const reglage = z.object({
  id: z.string(),
  niveau: z.number().int().min(1).max(NIVEAU_MAX),
  justification: z.string().trim().max(JUSTIFICATION_MAX).nullish(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ jeton: string }> }) {
  const page = await pageDuJeton((await params).jeton);
  if (!page) return NextResponse.json({ error: "Lien inconnu ou page inactive." }, { status: 404 });
  const editeur = await editeurConnecte(page.clientId);
  if (!editeur) return nonEditeur();
  const parsed = reglage.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Réglage invalide." }, { status: 400 });
  if (page.demo) return NextResponse.json({ error: "Page de démonstration : les réglages s'ouvrent avec l'abonnement." }, { status: 409 });
  const ligne = await prisma.prioriteTerritoriale.findFirst({ where: { id: parsed.data.id, clientId: page.clientId } });
  if (!ligne) return NextResponse.json({ error: "Case introuvable." }, { status: 404 });
  const { niveau } = parsed.data;
  const justification = parsed.data.justification || null;
  const refus = erreurReglage(niveau, ligne.niveauApl, justification);
  if (refus) return NextResponse.json({ error: refus, niveauApl: ligne.niveauApl }, { status: 400 });
  if (niveau === ligne.niveau && justification === ligne.justification) return NextResponse.json({ ok: true });
  await reglerCase(ligne, page.client, { id: editeur.userId, nom: editeur.nom }, { niveau, justification });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ jeton: string }> }) {
  const page = await pageDuJeton((await params).jeton);
  if (!page) return NextResponse.json({ error: "Lien inconnu ou page inactive." }, { status: 404 });
  const editeur = await editeurConnecte(page.clientId);
  if (!editeur) return nonEditeur();
  const id = z.object({ id: z.string() }).safeParse(await req.json().catch(() => null));
  if (!id.success) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  // Seules les priorités DÉCLARÉES par ce client se retirent : celles que l'APL justifie ne
  // sont pas une opinion, et celles d'un autre client ne le regardent pas.
  const lignes = await prisma.prioriteTerritoriale.findMany({
    where: { id: id.data.id, clientId: page.clientId, origine: "DECLAREE" },
  });
  if (lignes.length === 0) return NextResponse.json({ error: "Priorité introuvable ou non retirable." }, { status: 404 });
  await retirerCases(lignes, page.client, { id: editeur.userId, nom: editeur.nom });
  return NextResponse.json({ ok: true });
}
