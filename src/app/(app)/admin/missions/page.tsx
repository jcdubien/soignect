import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
import MissionsClient from "./MissionsClient";
import { exigerAdmin } from "@/lib/exigerAdmin";
import { posteEligible } from "@/lib/miseEnAvantPoste";

export default async function AdminMissionsPage() {
  await exigerAdmin();
  const missions = await prisma.mission.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      title: true,
      location: true,
      missionType: true,
      startDate: true,
      endDate: true,
      isActive: true,
      createdAt: true,
      profile: {
        select: {
          id: true,
          name: true,
          type: true,
          titulaireKind: true,
          user: { select: { email: true } },
        },
      },
    },
  });

  // Mise en avant payante (étape 6) : la fin de la dernière période non retirée, pour les postes
  // d'établissement seulement.
  const maintenant = new Date();
  const eligibles = missions.filter((m) => posteEligible(m.profile)).map((m) => m.id);
  const [periodes, cfg] = await Promise.all([
    prisma.miseEnAvantPoste.findMany({
      where: { missionId: { in: eligibles }, retireeLe: null, fin: { gt: maintenant } },
      select: { missionId: true, fin: true },
    }),
    prisma.platformConfig.findFirst({ select: { miseEnAvantPosteSalarie: true } }),
  ]);
  const finParMission = new Map<string, Date>();
  for (const p of periodes) {
    const f = finParMission.get(p.missionId);
    if (!f || p.fin > f) finParMission.set(p.missionId, p.fin);
  }
  const lignes = missions.map((m) => ({
    ...m,
    eligibleMiseEnAvant: eligibles.includes(m.id),
    misEnAvantJusquAu: finParMission.get(m.id)?.toISOString() ?? null,
  }));

  return (
    <MissionsClient
      initialMissions={JSON.parse(JSON.stringify(lignes))}
      miseEnAvantActive={cfg?.miseEnAvantPosteSalarie ?? false}
    />
  );
}
