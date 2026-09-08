import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BriqueStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

// GET /api/missions/textes-precedents — le TEXTE des annonces passées du lecteur (section 243).
//
// ── LA GARANTIE EST DANS LE `select`, PAS DANS L'INTERFACE ────────────────────────────────────
//
// La consigne est de ne reprendre que le texte libre, jamais les champs structurés : une annonce
// de l'an dernier porte des dates périmées, une commune, un taux de rétrocession. Les recopier en
// silence dans un nouveau formulaire produirait une annonce fausse que personne n'aurait relue.
//
// Cette route ne renvoie donc PAS ces champs. Pas « l'écran ne les affiche pas » : ils ne sortent
// pas de la base. Une discipline d'affichage se perd au premier refactor ; un `select` qui ne les
// contient pas rend l'erreur impossible à commettre. Même principe que `stripMissionProfiles`.
//
// `title` fait exception et sort — mais pour IDENTIFIER l'annonce dans la liste de choix, jamais
// pour être recopié. C'est l'écran qui décide de ne pas l'appliquer, et lui seul le peut :
// sans titre, on ne saurait pas quel texte on reprend.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.profileId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Annonce en cours d'édition : la proposer reviendrait à offrir de recopier son propre texte
  // sur lui-même.
  const exclure = new URL(req.url).searchParams.get("exclure");

  const annonces = await prisma.mission.findMany({
    where: {
      profileId: session.user.profileId as string,
      // ACTIVES OU NON, délibérément : une annonce close est justement celle dont on veut
      // reprendre le texte pour la republier. C'est le cas d'usage principal.
      //
      // En revanche on écarte ce qui n'est pas une annonce : une absence (« Congés ») et un
      // marqueur de calendrier privé n'ont pas de texte à reprendre, et les proposer ferait
      // passer un blocage d'agenda pour une publication passée.
      isSelfPresence: false,
      briqueStatus: { not: BriqueStatus.INDISPONIBLE },
      ...(exclure ? { id: { not: exclure } } : {}),
      // Au moins un texte à reprendre — proposer une ligne vide n'aiderait personne.
      OR: [
        { rawText: { not: null } },
        { bioTinder: { not: null } },
        { pitch: { not: null } },
      ],
    },
    select: {
      id: true,
      title: true,       // pour choisir, jamais pour recopier
      createdAt: true,   // pour situer dans le temps — « Publiée le 12 mars »
      rawText: true,     // texte libre long (parcours cabinet)
      bioTinder: true,   // accroche de la carte
      pitch: true,       // accroche des annonces antérieures à bioTinder
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return NextResponse.json(
    annonces
      .map((a) => ({
        id: a.id,
        titre: a.title,
        creeeLe: a.createdAt,
        rawText: a.rawText ?? "",
        // Même repli que le chargement en édition : `pitch` sert les annonces d'avant `bioTinder`.
        accroche: a.bioTinder ?? a.pitch ?? "",
      }))
      // Un texte fait uniquement d'espaces ne vaut pas mieux qu'une absence de texte.
      .filter((a) => a.rawText.trim() || a.accroche.trim()),
  );
}
