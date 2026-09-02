import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MatchStatus } from "@prisma/client";
import { campDe, typePourCamp } from "@/lib/camp";
import { z } from "zod";

// Changement de CAMP d'un profil, en self-service (section 222).
//
// POURQUOI UNE ROUTE DÉDIÉE, ET PAS UN CHAMP DE PLUS DANS PATCH /api/profiles/[id].
// Changer de type n'est pas éditer un champ : c'est une bascule à effets de bord, qui doit
// pouvoir REFUSER. La route générique met à jour ce qu'on lui donne et répond 200 ; y glisser
// `type` aurait fait passer une opération conditionnelle pour une écriture ordinaire, et le
// refus n'aurait eu nulle part où s'exprimer.
//
// POURQUOI DEUX CAMPS ET NON TROIS TYPES. La vision actée le 26/08 fait fusionner REMPLACANT et
// ASSISTANT en une seule catégorie « chercheur ». On n'expose donc pas trois options égales : le
// produit ne propose que Titulaire ↔ Chercheur de poste. La fusion elle-même n'est pas faite ici.

// Un match apparie un titulaire ET un candidat. Ces statuts sont ceux d'une relation VIVANTE :
// après bascule, les deux côtés seraient du même camp, et un contrat généré dessus serait faux.
const RELATIONS_VIVANTES = [MatchStatus.EN_ATTENTE, MatchStatus.DISCUSSION, MatchStatus.CONFIRME];

const bodySchema = z.object({ camp: z.enum(["TITULAIRE", "CHERCHEUR"]) });

async function chargerProfil(id: string) {
  return prisma.profile.findUnique({
    where: { id },
    select: { id: true, userId: true, type: true, name: true },
  });
}

/** Ce que la bascule ferait — calculé une seule fois, servi à l'écran ET revérifié à l'écriture. */
async function impact(profileId: string) {
  const [annoncesActives, postes, relations] = await Promise.all([
    prisma.mission.count({ where: { profileId, isActive: true } }),
    prisma.cabinetPost.count({ where: { cabinetId: profileId } }),
    prisma.match.findMany({
      where: {
        OR: [{ profileAId: profileId }, { profileBId: profileId }],
        status: { in: RELATIONS_VIVANTES },
      },
      select: {
        id: true,
        profileA: { select: { id: true, name: true } },
        profileB: { select: { id: true, name: true } },
      },
    }),
  ]);
  return {
    annoncesADesactiver: annoncesActives,
    postesConserves: postes,
    relationsBloquantes: relations.map((r) => ({
      id: r.id,
      avec: (r.profileA.id === profileId ? r.profileB.name : r.profileA.name) ?? "Profil sans nom",
    })),
  };
}

// GET — prévisualisation. L'écran doit pouvoir annoncer les conséquences AVANT de demander
// confirmation ; les deviner côté client aurait dupliqué la règle et l'aurait laissée diverger.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;

  const profil = await chargerProfil(id);
  if (!profil) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (profil.userId !== session.user.id) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const campActuel = campDe(profil.type);
  return NextResponse.json({
    campActuel,
    campCible: campActuel === "TITULAIRE" ? "CHERCHEUR" : "TITULAIRE",
    ...(await impact(id)),
  });
}

// POST — bascule effective.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;

  const profil = await chargerProfil(id);
  if (!profil) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  // Un ADMIN n'est PAS autorisé ici : changer le camp de quelqu'un d'autre depuis son propre
  // écran de compte n'a pas de sens, et le geste d'administration reste un geste explicite,
  // fait ailleurs et sciemment (c'est ce qui a été fait à la main pour Marion le 21/08).
  if (profil.userId !== session.user.id) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Camp invalide" }, { status: 400 });

  const campActuel = campDe(profil.type);
  if (parsed.data.camp === campActuel) {
    return NextResponse.json({ error: "Vous êtes déjà dans ce camp." }, { status: 400 });
  }

  // REVÉRIFICATION À L'ÉCRITURE, et pas seulement à l'affichage : entre la prévisualisation et la
  // confirmation, une mise en relation a pu naître. Se fier au GET reviendrait à laisser l'écran
  // décider d'une règle métier.
  const etat = await impact(id);
  if (etat.relationsBloquantes.length > 0) {
    return NextResponse.json(
      {
        error:
          "Des mises en relation sont en cours sur ce profil. Un contrat apparie un titulaire et " +
          "un candidat : finalisez-les ou annulez-les avant de changer de camp.",
        relations: etat.relationsBloquantes,
      },
      { status: 409 },
    );
  }

  // CHERCHEUR est stocké REMPLACANT. Un profil ASSISTANT qui part vers TITULAIRE puis revient
  // reviendra donc en REMPLACANT : la distinction n'est pas mémorisée. C'est assumé — les deux
  // catégories doivent fusionner (décision du 26/08) — mais ce n'est PAS silencieux : l'écran
  // l'annonce avant de demander confirmation.
  const nouveauType = typePourCamp(parsed.data.camp);

  // Transaction : le type et la mise en sommeil des annonces forment un seul fait. Basculer sans
  // désactiver laisserait en ligne des annonces dont le SENS vient de changer — une offre de
  // poste devenue offre de disponibilité, publiée dans le feed d'en face.
  await prisma.$transaction([
    prisma.profile.update({ where: { id }, data: { type: nouveauType } }),
    // DÉSACTIVÉES, JAMAIS SUPPRIMÉES (décision du 01/09). Les CabinetPost sont conservés intacts :
    // ils n'ont plus d'écran côté chercheur, mais un retour vers Titulaire les retrouve tels quels.
    prisma.mission.updateMany({ where: { profileId: id, isActive: true }, data: { isActive: false } }),
  ]);

  return NextResponse.json({
    camp: parsed.data.camp,
    type: nouveauType,
    annoncesDesactivees: etat.annoncesADesactiver,
    postesConserves: etat.postesConserves,
  });
}
