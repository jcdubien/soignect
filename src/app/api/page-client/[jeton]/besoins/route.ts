import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { NatureBesoin, Profession } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { editeurConnecte, libellesDuCode, relationActive } from "@/lib/pageClient";
import { LIMITES_BESOIN } from "@/lib/besoinTerritoire";
import {
  archiverBesoin, archiverBesoinsEchus, creerBesoin, demanderPublication, modifierBesoin, renouvelerBesoin,
} from "@/lib/besoinTerritoireServeur";

export const dynamic = "force-dynamic";

// Besoins du territoire d'une structure (23/10), pilotés depuis sa page de gestion. Le jeton
// d'édition DÉSIGNE la page ; toute écriture exige un éditeur nommé connecté (comme les réglages).
//   · GET   — les besoins de la structure (consultation comprise) ;
//   · POST  — créer un brouillon ;   · PUT — modifier un brouillon ;
//   · PATCH — { id, action: publier | renouveler | archiver }.
// Page de démonstration : lecture seule (409 sur toute écriture).

async function pageDuJeton(jeton: string) {
  const page = await prisma.pageClient.findUnique({
    where: { jetonEdition: jeton },
    select: { id: true, clientId: true, demo: true, communes: true, client: { select: { id: true, nom: true, debutLe: true, revueLe: true, clotureLe: true } } },
  });
  return page && relationActive(page.client) ? page : null;
}

const champs = z.object({
  codeInsee: z.string().max(10),
  profession: z.nativeEnum(Profession),
  specialite: z.string().trim().max(LIMITES_BESOIN.specialiteMax).nullish(),
  nature: z.nativeEnum(NatureBesoin),
  texte: z.string().max(LIMITES_BESOIN.texteMax),
  proposition: z.string().max(LIMITES_BESOIN.propositionMax).nullish(),
});

type Page = NonNullable<Awaited<ReturnType<typeof pageDuJeton>>>;

async function ecrivain(req: NextRequest, params: Promise<{ jeton: string }>) {
  const page = await pageDuJeton((await params).jeton);
  if (!page) return { erreur: NextResponse.json({ error: "Lien inconnu ou page inactive." }, { status: 404 }) };
  const editeur = await editeurConnecte(page.clientId);
  if (!editeur) return { erreur: NextResponse.json({ error: "Consultation seule : connectez-vous avec votre compte éditeur pour modifier." }, { status: 403 }) };
  if (page.demo) return { erreur: NextResponse.json({ error: "Page de démonstration : les besoins s'ouvrent avec l'abonnement." }, { status: 409 }) };
  return { page, auteur: { id: editeur.userId, nom: editeur.nom } };
}

function champsValides(page: Page, body: unknown) {
  const d = champs.safeParse(body);
  if (!d.success) return { erreur: "Champs invalides." };
  if (!page.communes.includes(d.data.codeInsee)) return { erreur: "Cette commune n'est pas dans le périmètre de votre page." };
  return { champs: { ...d.data, commune: libellesDuCode(d.data.codeInsee)[0] ?? d.data.codeInsee } };
}

const repondre = (r: { ok: true; besoin: unknown } | { ok: false; status: number; error: string }, status = 200) =>
  r.ok ? NextResponse.json({ ok: true, besoin: r.besoin }, { status }) : NextResponse.json({ error: r.error }, { status: r.status });

export async function GET(_req: NextRequest, { params }: { params: Promise<{ jeton: string }> }) {
  const page = await pageDuJeton((await params).jeton);
  if (!page) return NextResponse.json({ error: "Lien inconnu ou page inactive." }, { status: 404 });
  await archiverBesoinsEchus();
  const besoins = await prisma.besoinTerritoire.findMany({ where: { clientId: page.clientId }, orderBy: [{ statut: "asc" }, { updatedAt: "desc" }] });
  return NextResponse.json({ besoins });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ jeton: string }> }) {
  const e = await ecrivain(req, params);
  if (e.erreur) return e.erreur;
  const v = champsValides(e.page, await req.json().catch(() => null));
  if (v.erreur) return NextResponse.json({ error: v.erreur }, { status: 400 });
  return repondre(await creerBesoin(e.page.client, v.champs!, e.auteur), 201);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ jeton: string }> }) {
  const e = await ecrivain(req, params);
  if (e.erreur) return e.erreur;
  const body = await req.json().catch(() => null);
  const id = z.object({ id: z.string() }).safeParse(body);
  if (!id.success) return NextResponse.json({ error: "Identifiant manquant." }, { status: 400 });
  const v = champsValides(e.page, body);
  if (v.erreur) return NextResponse.json({ error: v.erreur }, { status: 400 });
  return repondre(await modifierBesoin(e.page.client, id.data.id, v.champs!, e.auteur));
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ jeton: string }> }) {
  const e = await ecrivain(req, params);
  if (e.erreur) return e.erreur;
  const d = z.object({ id: z.string(), action: z.enum(["publier", "renouveler", "archiver"]) }).safeParse(await req.json().catch(() => null));
  if (!d.success) return NextResponse.json({ error: "Action invalide." }, { status: 400 });
  const { id, action } = d.data;
  const r = action === "publier" ? await demanderPublication(e.page.client, id, e.auteur)
    : action === "renouveler" ? await renouvelerBesoin(e.page.client, id, e.auteur)
    : await archiverBesoin(e.page.client, id, e.auteur);
  return repondre(r);
}
