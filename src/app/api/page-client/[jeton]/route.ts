import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Profession } from "@prisma/client";
import { z } from "zod";
import { libellesDuCode, relationActive } from "@/lib/pageClient";

export const dynamic = "force-dynamic";

// Réglages d'une page client par son LIEN D'ÉDITION (20/10). Le jeton est la seule
// authentification : il se transmet au client comme un mot de passe, et se régénère depuis
// /admin/pages s'il a circulé. Ce qu'il permet est volontairement étroit :
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

const reglages = z.object({
  messageAccueil: z.string().trim().max(700).nullable(),
  contact: z.string().trim().max(200).nullable(),
  professions: z.array(z.nativeEnum(Profession)),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ jeton: string }> }) {
  const page = await pageDuJeton((await params).jeton);
  if (!page) return NextResponse.json({ error: "Lien inconnu ou page inactive." }, { status: 404 });
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
  const parsed = ajout.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Priorité invalide." }, { status: 400 });
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
      clientId: page.clientId, saisiParId: page.creeParId, declareLe: new Date(),
      note: "Ajoutée par le client depuis sa page.",
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ jeton: string }> }) {
  const page = await pageDuJeton((await params).jeton);
  if (!page) return NextResponse.json({ error: "Lien inconnu ou page inactive." }, { status: 404 });
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
