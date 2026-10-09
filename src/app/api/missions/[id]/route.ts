import { NextRequest, NextResponse } from "next/server";
import { genererEtStockerVignette, effacerVignette } from "@/lib/vignetteStockage";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACTIVE_MATCH_STATUSES } from "@/lib/feedFilters";
import { z } from "zod";
import { BriqueStatus, MissionType, SuiviStatut, ZonageType, ZoneGeographique } from "@prisma/client";
import { logMatchCancelled } from "@/lib/trace";
import { getCommuneZonage } from "@/lib/communes";

export const dynamic = "force-dynamic";

// GET /api/missions/[id] — données d'une annonce pour l'édition (propriétaire/admin)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const mission = await prisma.mission.findUnique({
    where: { id },
    select: {
      id: true, profileId: true, title: true, location: true, zones: true, specialties: true,
      startDate: true, endDate: true, minMonths: true, pitch: true, bioTinder: true,
      // briqueStatus : le formulaire d'édition doit savoir s'il édite une ABSENCE — publier
      // une annonce dessus la fait passer en RECHERCHE (fusion, section 188).
      briqueStatus: true,
      missionType: true, dateFlexibility: true, cabinetPostId: true,
      logementPropose: true, vehiculePropose: true, secretairePresente: true, exerciceCoordonne: true,
      remunerationBrute: true,
      demiJourneesLibres: true, caMensuelEstime: true,
      retrocessionRate: true, rawText: true,
      retrocessionMode: true, retrocessionFixeEuros: true, retrocessionPlafondEuros: true,
    },
  });
  if (!mission) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (mission.profileId !== session.user.profileId && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }
  return NextResponse.json(mission);
}

const updateSchema = z.object({
  title: z.string().min(3).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  location: z.string().optional(),
  zones: z.array(z.nativeEnum(ZoneGeographique)).optional(),
  specialties: z.array(z.string()).optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  minMonths: z.number().int().min(1).max(24).optional().nullable(),
  isActive: z.boolean().optional(),
  // Accroche éditable (section 179) — levier de matching de l'assistant. max large ici ; la
  // limite d'affichage (280 candidat) est portée par l'UI.
  bioTinder: z.string().max(700).optional().nullable(),
  // Édition complète d'annonce (section CRUD) — pitch, type, flexibilité
  pitch: z.string().max(700).optional().nullable(), // aligné POST + colonne (section 186)
  missionType: z.nativeEnum(MissionType).optional(),
  dateFlexibility: z.number().int().min(0).max(4).optional(),
  // Avantages matériels + qualité de vie éditables (aligne logement/véhicule, feature terrain).
  // Passent par ...rest → colonnes Mission. rechercheVehicule reste une préférence du Profile.
  logementPropose: z.boolean().optional(),
  vehiculePropose: z.boolean().optional(),
  secretairePresente: z.boolean().optional(), // secrétariat sur place (section 190)
  exerciceCoordonne: z.boolean().optional(),  // MSP / centre de santé / ESP (section 190)
  demiJourneesLibres: z.number().int().min(0).max(10).optional().nullable(),
  caMensuelEstime: z.number().int().min(0).max(1000000).optional().nullable(),
  remunerationBrute: z.number().int().min(0).max(1000000).optional().nullable(), // section 194
  retrocessionRate: z.number().int().min(0).max(100).optional().nullable(), // (ré)introduit dans le parcours cabinet
  // Modes de rétrocession (section 293). `retrocessionMode` pilote lequel des deux montants a
  // un sens ; la route remet l'autre à null pour qu'un plafond oublié ne finisse pas imprimé.
  retrocessionMode: z.enum(["POURCENTAGE", "FIXE", "PLAFONNEE"]).optional(),
  retrocessionFixeEuros: z.number().int().min(0).max(1000000).optional().nullable(),
  retrocessionPlafondEuros: z.number().int().min(0).max(1000000).optional().nullable(),
  rawText: z.string().max(8000).optional().nullable(),                       // texte libre de l'annonce
  briqueStatus: z.nativeEnum(BriqueStatus).optional(),
  statusNote: z.string().max(200).optional().nullable(),
  statusUpdatedAt: z.string().datetime().optional(),
  // Suivi humain de la brique (section 200). Indépendant de briqueStatus — voir plus bas.
  suiviStatut: z.nativeEnum(SuiviStatut).nullable().optional(),
  departureDate: z.string().datetime().optional().nullable(), // date de départ prévue (section 6)
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const mission = await prisma.mission.findUnique({ where: { id } });
  if (!mission) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  if (mission.profileId !== session.user.profileId && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { briqueStatus, statusNote, statusUpdatedAt, suiviStatut, startDate, endDate, departureDate, ...rest } = parsed.data;

  // ── CE QUI APPARTIENT À LA MISE EN RELATION NE SE RÈGLE PAS ICI (section 276) ───────────
  //
  // Deux gestes du Planning écrivaient à la main sur une période ENGAGÉE :
  //
  //   · « Fermer temporairement » posait `briqueStatus = FERME`, et « Rouvrir » réécrivait
  //     CONFIRME. Or « le contrat est-il signé ? » n'a PAS de colonne : il se dérive de
  //     `briqueStatus === CONFIRME` (lib/matchEtat). Fermer une occupation appariée faisait donc
  //     basculer le contrat signé à FAUX, puis à vrai au retour — sur un document opposable.
  //   · « Mettre fin à cette occupation » écrit `departureDate`. Sur une occupation appariée,
  //     avancer la fin sans prévenir l'autre partie la laisserait découvrir son congé sur un
  //     écran.
  //
  // Les deux relèvent de l'annulation de mise en relation, qui annule le contrat, prévient
  // l'autre partie et resynchronise le poste. On refuse, en nommant le chemin.
  if (briqueStatus !== undefined || departureDate !== undefined) {
    const engagee = await prisma.match.findFirst({
      where: {
        OR: [{ missionAId: id }, { missionBId: id }],
        status: { in: ACTIVE_MATCH_STATUSES },
      },
      select: { id: true },
    });
    if (engagee) {
      return NextResponse.json(
        {
          error:
            "Cette période est engagée dans une mise en relation. Utilisez « Annuler la mise en " +
            "relation » : le contrat sera annulé et l'autre partie prévenue.",
        },
        { status: 409 },
      );
    }
  }

  // Le zonage ARS (section 201) est DÉRIVÉ de la commune — il n'est pas saisi. Il n'était
  // calculé qu'à la CRÉATION : changer la commune d'une annonce laissait l'ancien classement
  // en place. Constaté en production le 12/08 sur une annonce du Gosier portée en
  // INTERMEDIAIRE, alors que Le Gosier est non prioritaire depuis toujours dans le barème —
  // la valeur ne venait pas du calcul, elle avait survécu à une édition de commune.
  // On recalcule dès que la commune bouge : une donnée dérivée qui ne suit pas sa source
  // devient un mensonge silencieux (même famille que Match.aiScore figé).
  const zonageRecalcule =
    rest.location !== undefined && rest.location !== mission.location
      ? { zonage: getCommuneZonage(rest.location) as ZonageType | null }
      : {};

  const updated = await prisma.mission.update({
    where: { id },
    data: {
      ...rest,
      ...zonageRecalcule,
      startDate: startDate ? new Date(startDate) : startDate,
      endDate: endDate ? new Date(endDate) : endDate,
      ...(departureDate !== undefined && { departureDate: departureDate ? new Date(departureDate) : null }),
      ...(briqueStatus !== undefined && {
        briqueStatus,
        statusUpdatedAt: statusUpdatedAt ? new Date(statusUpdatedAt) : new Date(),
      }),
      // statusNote ÉTAIT imbriquée dans le bloc ci-dessus : impossible d'écrire la note sans
      // changer aussi le statut du créneau. C'est la raison mécanique pour laquelle ce champ,
      // pourtant présent en base, validé ici et déjà affiché dans le panneau, n'a jamais reçu
      // une seule valeur (section 200). Elle se met à jour seule désormais.
      ...(statusNote !== undefined && { statusNote }),
      // Le suivi humain porte sa PROPRE date : savoir quand on a appelé n'a rien à voir avec
      // la date du dernier changement de créneau.
      ...(suiviStatut !== undefined && { suiviStatut, suiviUpdatedAt: suiviStatut ? new Date() : null }),
      // MÊME NETTOYAGE QU'À LA CRÉATION (section 293) : seul le montant du mode retenu survit.
      // `...rest` vient de poser les deux ; on écrase ensuite, en se fondant sur le mode
      // effectivement enregistré — celui qu'on vient de recevoir, ou celui déjà en base si le
      // formulaire ne l'a pas renvoyé. Sans cette seconde lecture, modifier le seul montant
      // d'une annonce déjà « fixe » l'aurait fait retomber au pourcentage.
      ...(() => {
        const mode = rest.retrocessionMode ?? mission.retrocessionMode;
        return {
          retrocessionFixeEuros: mode === "FIXE" ? (rest.retrocessionFixeEuros ?? null) : null,
          retrocessionPlafondEuros: mode === "PLAFONNEE" ? (rest.retrocessionPlafondEuros ?? null) : null,
        };
      })(),
    },
  });

  // La vignette porte le titre, les dates, le lieu et le type : une modification la périme.
  // On régénère, et le `?v=` de l'URL publique (horodatage) rend l'ancienne inatteignable
  // plutôt que périmée — les caches sociaux retiennent trop longtemps pour qu'on s'en remette
  // à une expiration (section 285).
  await genererEtStockerVignette(id);

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const mission = await prisma.mission.findUnique({ where: { id } });
  if (!mission) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  // L'assistant rattaché au poste peut RETIRER un remplacement posé sur SON poste. La mission
  // appartient au cabinet, si bien que le garde de propriété le lui refusait : il pouvait créer
  // une demande de couverture sans jamais pouvoir l'annuler (403 constaté en conditions réelles).
  //
  // PORTÉE ASSUMÉE, plus large que « retirer ce que j'ai publié » : le droit couvre AUSSI les
  // annonces publiées par le cabinet sur ce poste. Le modèle ne permet pas de faire autrement —
  // la mission ne porte que profileId (le cabinet) et cabinetPostId, aucun champ ne dit qui l'a
  // créée. Arbitrage retenu : le poste est celui de l'assistant, la couverture concerne son
  // absence, il en dispose. Le restreindre supposerait d'ajouter un champ d'auteur.
  //
  // Restreint au REMPLACEMENT, comme à la publication : il ne touche pas aux postes long terme.
  let assistantDuPoste = false;
  if (mission.cabinetPostId && mission.missionType === MissionType.REMPLACEMENT) {
    const poste = await prisma.cabinetPost.findUnique({
      where: { id: mission.cabinetPostId },
      select: { linkedUserId: true },
    });
    assistantDuPoste = !!poste?.linkedUserId && poste.linkedUserId === session.user.id;
  }

  if (mission.profileId !== session.user.profileId && session.user.role !== "ADMIN" && !assistantDuPoste) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  // ── LE REFUS NE DÉSIGNAIT PAS LE BON CHEMIN (section 276) ────────────────────────────────
  //
  // Il portait sur `briqueStatus === "CONFIRME"` et renvoyait TOUT LE MONDE vers « Annuler la
  // mise en relation ». Or une occupation déclarée à la main — « Occupation externe (hors
  // Soignect) » — est CONFIRME et n'a AUCUN match : mesuré le 01/10, **10 occupations sur 11**
  // étaient dans ce cas. Le produit renvoyait donc vers une action qui, pour elles, n'existe
  // nulle part. Il ne restait qu'à supprimer le poste entier.
  //
  // Le refus reste — supprimer une occupation effacerait qui a tenu le poste. Mais il nomme
  // désormais le chemin qui existe VRAIMENT pour chaque cas.
  if (["CONFIRME", "OCCUPE", "PREAVIS"].includes(mission.briqueStatus)) {
    const engagee = await prisma.match.findFirst({
      where: { OR: [{ missionAId: id }, { missionBId: id }], status: { in: ACTIVE_MATCH_STATUSES } },
      select: { id: true },
    });
    return NextResponse.json(
      {
        error: engagee
          ? "Cette période est liée à une mise en relation. Utilisez « Annuler la mise en relation » pour l'annuler."
          : "Cette période est une occupation. Utilisez « Mettre fin à cette occupation » pour la clore — le poste reste ouvert.",
      },
      { status: 409 }
    );
  }

  // Supprimer l'annonce annule aussi les mises en relation qui en dépendent — c'est une
  // annulation à part entière, jusqu'ici invisible. On les capture AVANT la transaction : après,
  // elles n'existent plus (audit Observatoire).
  const matchsPerdus = await prisma.match.findMany({
    where: { OR: [{ missionAId: id }, { missionBId: id }] },
    include: {
      missionA: { select: { location: true, missionType: true, briqueStatus: true } },
      missionB: { select: { location: true, missionType: true, briqueStatus: true } },
    },
  });
  if (matchsPerdus.length > 0) {
    const parAdmin = session.user.role === "ADMIN" && mission.profileId !== session.user.profileId;
    // Une « annonce » supprimée peut être celle d'un cabinet comme la recherche d'un candidat :
    // l'initiateur se lit sur le propriétaire, pas sur le vocabulaire de la route.
    const proprio = await prisma.profile.findUnique({
      where: { id: mission.profileId },
      select: { type: true },
    });
    for (const m of matchsPerdus) {
      logMatchCancelled(m, {
        origine: "ANNONCE_SUPPRIMEE",
        initiateur: parAdmin ? "ADMIN" : proprio?.type === "TITULAIRE" ? "CABINET" : "CANDIDAT",
      });
    }
  }

  // Nettoyage des dépendances AVANT suppression, sinon les contraintes de clé étrangère
  // (Swipe.swipedMission, Match.missionA/B — sans onDelete cascade) font échouer le delete :
  // on retire les swipes reçus et les mises en relation non confirmées liées à cette annonce
  // (les Message des matchs supprimés partent en cascade au niveau base).
  // La vignette AVANT la suppression : après, `effacerVignette` ne pourrait plus dater quoi que
  // ce soit, et le fichier resterait indéfiniment dans le bucket. Sur la rémanence du CDN, qui
  // survit à l'effacement, voir l'avertissement porté par `effacerVignette` (section 285).
  await effacerVignette(id);

  await prisma.$transaction([
    prisma.swipe.deleteMany({ where: { swipedMissionId: id } }),
    prisma.match.deleteMany({ where: { OR: [{ missionAId: id }, { missionBId: id }] } }),
    prisma.mission.delete({ where: { id } }),
  ]);
  return NextResponse.json({ deleted: true });
}
