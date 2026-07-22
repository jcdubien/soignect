import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { BriqueStatus, MissionType, ProfileType, ZoneGeographique } from "@prisma/client";
import { getCommuneZonage } from "@/lib/communes";
import { logTraceEvent } from "@/lib/trace";
import { bioLimitFor } from "@/lib/bio";
import { stripMissionProfiles } from "@/lib/publicProfile";

export const dynamic = "force-dynamic";

const createMissionSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  location: z.string().min(1),
  zones: z.array(z.nativeEnum(ZoneGeographique)).optional(), // macro-zones souhaitées (section 138)
  specialties: z.array(z.string()).default([]),
  startDate: z.preprocess((v) => (v ? new Date(v as string) : null), z.date().optional().nullable()),
  endDate: z.preprocess((v) => (v ? new Date(v as string) : null), z.date().optional().nullable()),
  minMonths: z.number().int().min(1).max(24).optional().nullable(),
  pitch: z.string().max(700).optional().nullable(),
  bioTinder: z.string().max(700).optional().nullable(),
  retrocessionRate: z.number().int().min(0).max(100).optional().nullable(),
  missionType: z.nativeEnum(MissionType).optional(),
  dateFlexibility: z.number().int().min(0).max(4).optional(),
  logementPropose: z.boolean().optional(),   // annonce cabinet : logement proposé (section 120)
  rechercheLogement: z.boolean().optional(), // dispo remplaçant : recherche un logement (→ Profile)
  ouvertSalariat: z.boolean().optional(),    // dispo candidat : ouvert au salariat (→ Profile, section 154)
  briqueStatus: z.nativeEnum(BriqueStatus).optional(),
  cabinetPostId: z.string().optional().nullable(),
});

// GET /api/missions — feed de missions (type opposé, non encore swipées)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.profileId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const myProfile = await prisma.profile.findUnique({
    where: { id: session.user.profileId },
  });
  if (!myProfile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  // Missions déjà swipées par ce profil
  const swipedIds = await prisma.swipe.findMany({
    where: { swiperId: myProfile.id },
    select: { swipedMissionId: true },
  });
  const excludeMissionIds = swipedIds.map((s) => s.swipedMissionId);

  // Types de profils à afficher :
  // REMPLACANT & ASSISTANT voient les missions des TITULAIRES
  // TITULAIRE voit les missions des REMPLACANTS et ASSISTANTS
  const oppositeTypes =
    myProfile.type === ProfileType.TITULAIRE
      ? [ProfileType.REMPLACANT, ProfileType.ASSISTANT]
      : [ProfileType.TITULAIRE];

  const { searchParams } = new URL(req.url);
  const location = searchParams.get("location");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "10"), 50);

  const missions = await prisma.mission.findMany({
    where: {
      isActive: true,
      id: { notIn: excludeMissionIds },
      profile: {
        type: { in: oppositeTypes },
        isActive: true,
        id: { not: myProfile.id },
      },
      ...(location ? { location } : {}),
    },
    include: {
      profile: true,
    },
    orderBy: [
      { profile: { weight: "desc" } },
      { profile: { ratingAvg: "desc" } },
      { createdAt: "desc" },
    ],
    take: limit,
  });

  // Expurge les champs sensibles du profil (audit permissions, section 165) — même politique
  // que /api/feed : identité contractuelle / facturation / classement jamais renvoyées.
  return NextResponse.json(stripMissionProfiles(missions));
}

// POST /api/missions — créer une mission
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.profileId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createMissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { title, description, location, zones, specialties, startDate, endDate, minMonths, pitch, bioTinder, retrocessionRate, missionType, dateFlexibility, logementPropose, rechercheLogement, ouvertSalariat, briqueStatus, cabinetPostId } = parsed.data;

  // Photo de profil obligatoire pour publier une annonce/disponibilité (ferme la brèche
  // rétroactive : un profil créé avant l'onboarding-photo pouvait publier sans photo).
  // On n'exige rien pour les "dates bloquées" (INDISPONIBLE), qui ne sont pas des annonces.
  const effectiveBrique = briqueStatus ?? BriqueStatus.RECHERCHE;
  if (effectiveBrique !== BriqueStatus.INDISPONIBLE) {
    const me = await prisma.profile.findUnique({
      where: { id: session.user.profileId },
      select: { photoUrl: true, type: true },
    });
    if (!me?.photoUrl) {
      return NextResponse.json(
        { error: "Ajoutez une photo de profil avant de publier une annonce.", needsPhoto: true },
        { status: 422 }
      );
    }
    // Limite BioTinder différenciée (section 123) : cabinet 700, remplaçant/assistant 280.
    const bioMax = bioLimitFor(me.type);
    if (bioTinder && bioTinder.length > bioMax) {
      return NextResponse.json(
        { error: `Accroche trop longue (${bioTinder.length}/${bioMax} caractères).` },
        { status: 422 }
      );
    }
  }

  // Validation 90 jours minimum pour les postes longs (section 37.E)
  const effectiveMissionType = missionType ?? MissionType.REMPLACEMENT;

  // Une disponibilité de remplacement « en recherche » DOIT avoir des dates (section 165) :
  // sinon elle est créée en base mais n'apparaît sur AUCUN segment de la timeline (les briques
  // exigent startDate ET endDate). Les « dates bloquées » (INDISPONIBLE) en ont toujours ;
  // l'assistanat/collaboration se place via la durée, pas de dates exigées ici.
  if (
    effectiveBrique === BriqueStatus.RECHERCHE &&
    effectiveMissionType === MissionType.REMPLACEMENT &&
    (!startDate || !endDate)
  ) {
    return NextResponse.json(
      { error: "Renseignez vos dates de disponibilité (du / au) avant de publier." },
      { status: 422 }
    );
  }

  if (effectiveMissionType === MissionType.ASSISTANAT && startDate && endDate) {
    const dureeJours = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000);
    if (dureeJours < 90) {
      return NextResponse.json(
        { error: "Un poste d'assistanat ou CDD/CDI nécessite une durée minimale de 3 mois (90 jours)." },
        { status: 422 }
      );
    }
  }

  // Permissions liées à un poste (section 153, point 4). Par défaut la mission appartient à
  // son auteur (profileId courant). Cas particulier : un ASSISTANT rattaché à un CabinetPost
  // peut publier UN REMPLACEMENT pour couvrir SON absence — la mission appartient alors au
  // CABINET (elle vit dans le Planning du cabinet). Sans cabinetPostId → comportement candidat
  // inchangé (publication de sa propre disponibilité).
  let ownerProfileId = session.user.profileId as string;
  if (cabinetPostId) {
    const post = await prisma.cabinetPost.findUnique({
      where: { id: cabinetPostId },
      select: { cabinetId: true, linkedUserId: true },
    });
    if (!post) {
      return NextResponse.json({ error: "Poste introuvable." }, { status: 404 });
    }
    const isCabinetOwner = post.cabinetId === session.user.profileId;
    const isLinkedAssistant = post.linkedUserId != null && post.linkedUserId === session.user.id;
    if (!isCabinetOwner && !isLinkedAssistant) {
      return NextResponse.json({ error: "Vous n'êtes pas autorisé à publier sur ce poste." }, { status: 403 });
    }
    if (isLinkedAssistant && !isCabinetOwner) {
      // L'assistant rattaché ne peut publier qu'un REMPLACEMENT (couverture de son absence).
      if (effectiveMissionType !== MissionType.REMPLACEMENT) {
        return NextResponse.json(
          { error: "En tant qu'assistant rattaché, vous ne pouvez publier qu'un remplacement pour votre poste." },
          { status: 403 }
        );
      }
      // La mission appartient au cabinet → apparaît dans son Planning, swipeable par les remplaçants.
      ownerProfileId = post.cabinetId;
    }
  }

  // Derive zonage from commune — only meaningful for ASSISTANAT/COLLABORATION
  const rawZonage = getCommuneZonage(location);
  const zonage = rawZonage === "INTERMEDIAIRE"
    ? "INTERMEDIAIRE"
    : rawZonage === "NON_PRIORITAIRE"
    ? "NON_PRIORITAIRE"
    : null;

  const mission = await prisma.mission.create({
    data: {
      profileId: ownerProfileId,
      title,
      description,
      location,
      zones: zones ?? [],
      specialties,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
      minMonths,
      pitch: pitch ?? null,
      bioTinder: bioTinder ?? null,
      retrocessionRate: retrocessionRate ?? null,
      missionType: effectiveMissionType,
      zonage: zonage ? (zonage as import("@prisma/client").ZonageType) : null,
      dateFlexibility: dateFlexibility ?? 0,
      logementPropose: logementPropose ?? false,
      briqueStatus: briqueStatus ?? BriqueStatus.RECHERCHE,
      cabinetPostId: cabinetPostId ?? null,
    },
  });

  // "Je recherche un logement" est une préférence du profil remplaçant (section 120) —
  // portée par le formulaire de disponibilité, persistée sur le Profile. Idem pour
  // "ouvert au salariat" (section 154) — préférence candidat qui pilote le gating salariat.
  if (typeof rechercheLogement === "boolean" || typeof ouvertSalariat === "boolean") {
    await prisma.profile.update({
      where: { id: session.user.profileId },
      data: {
        ...(typeof rechercheLogement === "boolean" ? { rechercheLogement } : {}),
        ...(typeof ouvertSalariat === "boolean" ? { ouvertSalariat } : {}),
      },
    }).catch(() => { /* non bloquant */ });
  }

  // Traçabilité (section 86) — fire-and-forget, ne bloque pas la réponse
  logTraceEvent({
    eventType: "MISSION_PUBLISHED",
    missionId: mission.id,
    commune: mission.location,
    missionType: mission.missionType,
  });

  return NextResponse.json(mission, { status: 201 });
}
