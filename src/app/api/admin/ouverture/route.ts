import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Profession, ProfileType } from "@prisma/client";

export const dynamic = "force-dynamic";

// GET /api/admin/ouverture?profession=INFIRMIER&jours=30 — la courbe d'ouverture d'une
// profession, jour par jour (section 294).
//
// AUCUNE NOUVELLE TRACE. `SIGNUP`, `MISSION_PUBLISHED` et `SWIPE_RIGHT` existent depuis la
// section 86 ; aucune ne porte la profession, mais toutes portent de quoi la retrouver — un
// `profileId` ou un `missionId`. Ajouter la profession dans les métadonnées aurait figé une
// COPIE : un compte qui change de profession dans /compte rendrait la trace fausse, alors que
// la jointure, elle, suit. Le coût est une requête de plus, payée seulement ici.
//
// ON DISTINGUE RECHERCHE ET ANNONCE PAR LE CAMP DU PUBLIEUR, pas par le type de mission : un
// remplaçant et un cabinet publient tous deux des `Mission`, et c'est leur camp qui dit lequel
// cherche et lequel propose.
//
// « PREMIERS SWIPES » = le premier geste de chaque personne, pas le volume. Dix swipes d'une
// seule personne ne disent pas qu'une profession s'est mise en mouvement ; dix personnes ayant
// swipé une fois, si. Le total brut est renvoyé à côté, pour qui veut les deux.
export async function GET(req: NextRequest) {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== "ADMIN") {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const sp = new URL(req.url).searchParams;
  const brut = sp.get("profession") ?? "INFIRMIER";
  if (!(brut in Profession)) {
    return NextResponse.json({ error: `Profession inconnue : ${brut}` }, { status: 400 });
  }
  const profession = brut as Profession;
  const jours = Math.min(Math.max(parseInt(sp.get("jours") ?? "30", 10) || 30, 1), 365);
  const depuis = new Date(Date.now() - jours * 86_400_000);

  const profils = await prisma.profile.findMany({
    where: { profession },
    select: { id: true, type: true, createdAt: true },
  });
  const idsProfil = profils.map((p) => p.id);
  const campParProfil = new Map(profils.map((p) => [p.id, p.type]));

  const missions = await prisma.mission.findMany({
    where: { profile: { profession } },
    select: { id: true, profileId: true },
  });
  const campParMission = new Map(
    missions.map((m) => [m.id, campParProfil.get(m.profileId) ?? null]),
  );

  const traces = await prisma.traceEvent.findMany({
    where: {
      occurredAt: { gte: depuis },
      eventType: { in: ["SIGNUP", "MISSION_PUBLISHED", "SWIPE_RIGHT"] },
      OR: [{ profileId: { in: idsProfil } }, { missionId: { in: missions.map((m) => m.id) } }],
    },
    select: { eventType: true, occurredAt: true, profileId: true, missionId: true },
    orderBy: { occurredAt: "asc" },
  });

  const jour = (d: Date) => d.toISOString().slice(0, 10);
  type Ligne = { comptes: number; recherches: number; annonces: number; premiersSwipes: number; swipes: number };
  const table = new Map<string, Ligne>();
  const ligne = (j: string): Ligne => {
    let l = table.get(j);
    if (!l) { l = { comptes: 0, recherches: 0, annonces: 0, premiersSwipes: 0, swipes: 0 }; table.set(j, l); }
    return l;
  };

  // Qui a déjà swipé avant ce jour-là : le « premier swipe » se compte une fois par personne,
  // sur toute l'histoire du compte et pas seulement sur la fenêtre demandée.
  const dejaSwipe = new Set<string>();
  const premierSwipeConnu = await prisma.swipe.groupBy({
    by: ["swiperId"],
    where: { swiperId: { in: idsProfil } },
    _min: { createdAt: true },
  });
  const premierSwipeParProfil = new Map(
    premierSwipeConnu.map((g) => [g.swiperId, g._min.createdAt]),
  );

  for (const t of traces) {
    const j = jour(t.occurredAt);
    if (t.eventType === "SIGNUP" && t.profileId && campParProfil.has(t.profileId)) {
      ligne(j).comptes++;
    } else if (t.eventType === "MISSION_PUBLISHED" && t.missionId) {
      const camp = campParMission.get(t.missionId);
      if (camp === ProfileType.TITULAIRE) ligne(j).annonces++;
      else if (camp) ligne(j).recherches++;
    } else if (t.eventType === "SWIPE_RIGHT" && t.profileId && campParProfil.has(t.profileId)) {
      ligne(j).swipes++;
      const premier = premierSwipeParProfil.get(t.profileId);
      if (premier && jour(premier) === j && !dejaSwipe.has(t.profileId)) {
        dejaSwipe.add(t.profileId);
        ligne(j).premiersSwipes++;
      }
    }
  }

  const lignes = Array.from(table.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, l]) => ({ date, ...l }));

  return NextResponse.json({
    profession,
    jours,
    // L'état du stock, pour lire la courbe : « 3 comptes créés » ne dit rien sans savoir qu'il
    // y en a 3 en tout, ou 300.
    stock: {
      profils: profils.length,
      candidats: profils.filter((p) => p.type !== ProfileType.TITULAIRE).length,
      cabinets: profils.filter((p) => p.type === ProfileType.TITULAIRE).length,
      publications: missions.length,
    },
    lignes,
  });
}
