import { NextRequest, NextResponse } from "next/server";
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
//   · DELETE — retirer une priorité que CE client a déclarée.
// Le périmètre, l'abonnement et les priorités tirées de l'APL ne se règlent pas ici.

async function pageDuJeton(jeton: string) {
  const page = await prisma.pageClient.findUnique({
    where: { jetonEdition: jeton },
    include: { client: { select: { id: true, debutLe: true, revueLe: true, clotureLe: true } } },
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
  niveau: z.number().int().min(1).max(3),
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
  // Une seule déclaration par commune et par profession (contrainte d'unicité) : une priorité
  // déjà posée — par l'APL ou par quelqu'un d'autre — ne se double ni ne s'écrase.
  const existe = await prisma.prioriteTerritoriale.findUnique({
    where: { codeInsee_profession: { codeInsee, profession } },
  });
  if (existe) return NextResponse.json({ error: "Cette commune est déjà prioritaire pour cette profession." }, { status: 409 });
  await prisma.prioriteTerritoriale.create({
    data: {
      codeInsee, profession, niveau, origine: "DECLAREE",
      commune: libellesDuCode(codeInsee)[0] ?? codeInsee,
      clientId: page.clientId, saisiParId: editeur.userId, declareLe: new Date(),
      note: `Ajoutée par ${editeur.nom} depuis la page du client.`,
    },
  });
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
  const r = await prisma.prioriteTerritoriale.deleteMany({
    where: { id: id.data.id, clientId: page.clientId, origine: "DECLAREE" },
  });
  if (r.count === 0) return NextResponse.json({ error: "Priorité introuvable ou non retirable." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
