import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { editeurConnecte, relationActive } from "@/lib/pageClient";
import { LIMITES_VITRINE } from "@/lib/vitrineTerritoire";
import {
  PhotoRefusee, ajouterPhotoVitrine, demanderPublicationVitrine, enregistrerVitrine, erreurFichierPhoto,
  masquerVitrine, retirerPhotoVitrine,
} from "@/lib/vitrineTerritoireServeur";

export const dynamic = "force-dynamic";

// Vitrine du territoire d'une structure (02/11), pilotée depuis sa page de gestion. Le jeton
// d'édition DÉSIGNE la page ; toute écriture exige un éditeur nommé connecté (comme les besoins).
//   · PUT    — enregistrer les textes et les légendes ;
//   · PATCH  — { action: publier | masquer } ;
//   · POST   — ajouter une photo (multipart : `file`, `legende`) ;
//   · DELETE — { chemin } retirer une photo.
// Page de démonstration : 409 sur toute écriture.

async function ecrivain(params: Promise<{ jeton: string }>) {
  const page = await prisma.pageClient.findUnique({
    where: { jetonEdition: (await params).jeton },
    select: { clientId: true, demo: true, client: { select: { id: true, nom: true, debutLe: true, revueLe: true, clotureLe: true } } },
  });
  if (!page || !relationActive(page.client)) return { erreur: NextResponse.json({ error: "Lien inconnu ou page inactive." }, { status: 404 }) };
  const editeur = await editeurConnecte(page.clientId);
  if (!editeur) return { erreur: NextResponse.json({ error: "Consultation seule : connectez-vous avec votre compte éditeur pour modifier." }, { status: 403 }) };
  if (page.demo) return { erreur: NextResponse.json({ error: "Page de démonstration : la vitrine s'ouvre avec l'abonnement." }, { status: 409 }) };
  return { client: { id: page.client.id, nom: page.client.nom }, auteur: { id: editeur.userId, nom: editeur.nom } };
}

const repondre = (r: { ok: true; vitrine: unknown } | { ok: false; status: number; error: string }) =>
  r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status });

const rubrique = z.string().max(LIMITES_VITRINE.rubriqueMax).nullish();
const textes = z.object({
  accroche: z.string().max(LIMITES_VITRINE.accrocheMax + 50),
  cadreDeVie: rubrique, offreSoins: rubrique, aidesInstallation: rubrique,
  legendes: z.array(z.string().max(LIMITES_VITRINE.legendeMax + 50)).max(LIMITES_VITRINE.photosMax).nullish(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ jeton: string }> }) {
  const e = await ecrivain(params);
  if (e.erreur) return e.erreur;
  const d = textes.safeParse(await req.json().catch(() => null));
  if (!d.success) return NextResponse.json({ error: "Champs invalides." }, { status: 400 });
  const { legendes, ...contenu } = d.data;
  return repondre(await enregistrerVitrine(e.client, {
    accroche: contenu.accroche, cadreDeVie: contenu.cadreDeVie ?? null, offreSoins: contenu.offreSoins ?? null,
    aidesInstallation: contenu.aidesInstallation ?? null,
  }, legendes ?? null, e.auteur));
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ jeton: string }> }) {
  const e = await ecrivain(params);
  if (e.erreur) return e.erreur;
  const d = z.object({ action: z.enum(["publier", "masquer"]) }).safeParse(await req.json().catch(() => null));
  if (!d.success) return NextResponse.json({ error: "Action invalide." }, { status: 400 });
  return repondre(d.data.action === "publier" ? await demanderPublicationVitrine(e.client, e.auteur) : await masquerVitrine(e.client, e.auteur));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ jeton: string }> }) {
  const e = await ecrivain(params);
  if (e.erreur) return e.erreur;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  const err = erreurFichierPhoto(file);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  const legende = String(form?.get("legende") ?? "");
  try {
    return repondre(await ajouterPhotoVitrine(e.client, Buffer.from(await file.arrayBuffer()), legende, e.auteur));
  } catch (x) {
    if (x instanceof PhotoRefusee) return NextResponse.json({ error: x.message }, { status: 400 });
    console.error("[vitrine] dépôt de photo impossible:", x);
    return NextResponse.json({ error: "Dépôt impossible pour le moment." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ jeton: string }> }) {
  const e = await ecrivain(params);
  if (e.erreur) return e.erreur;
  const d = z.object({ chemin: z.string().max(200) }).safeParse(await req.json().catch(() => null));
  if (!d.success) return NextResponse.json({ error: "Photo manquante." }, { status: 400 });
  return repondre(await retirerPhotoVitrine(e.client, d.data.chemin, e.auteur));
}
