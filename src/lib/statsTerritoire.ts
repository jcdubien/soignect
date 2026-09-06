import { prisma } from "@/lib/prisma";
import { BriqueStatus, ProfileType, MatchStatus, Profession } from "@prisma/client";
import { zoneOfCommune } from "@/lib/communes";

// Agrégats de l'écran partenaire territorial (section 233).
//
// RÈGLE DE COMPOSITION : QUE DES AGRÉGATS. Un partenaire institutionnel n'a rien à connaître des
// personnes — ni nom, ni email, ni annonce nominative. Ce fichier ne renvoie donc que des
// comptages par zone et par profession. Ce n'est pas une précaution d'affichage qu'un futur écran
// pourrait contourner : la donnée nominative ne sort jamais d'ici.
//
// Il n'expose pas non plus les RELATIONS institutionnelles (nom du client, dates de revue) : la
// première version de ce rôle les montrait, parce que l'écran de saisie en avait besoin. Le
// partenaire ne saisissant plus rien, elles n'ont plus de raison de sortir.

/** Ce que le feed considère comme publié — même définition qu'ailleurs (section 229). */
const PUBLIE = { isActive: true, briqueStatus: { not: BriqueStatus.INDISPONIBLE } };

export interface StatsTerritoire {
  annoncesActives: number;
  candidatsDisponibles: number;
  misesEnRelation90j: number;
  parZone: { zone: string; annonces: number; candidats: number }[];
  prioritesEnVigueur: { commune: string; profession: Profession; niveau: number }[];
}

export async function statsTerritoire(): Promise<StatsTerritoire> {
  const ilYA90j = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [missions, misesEnRelation90j, priorites] = await Promise.all([
    prisma.mission.findMany({
      where: PUBLIE,
      select: { location: true, profile: { select: { type: true } } },
    }),
    prisma.match.count({
      where: { status: MatchStatus.CONFIRME, createdAt: { gte: ilYA90j } },
    }),
    // Les priorités EN VIGUEUR, sans nommer l'institution qui les a déclarées ni qui les a
    // saisies : le partenaire doit savoir ce qui est déjà priorisé pour ne pas redemander ce
    // qui existe, pas savoir avec qui la plateforme travaille.
    prisma.prioriteTerritoriale.findMany({
      where: {
        OR: [{ expireLe: null }, { expireLe: { gt: new Date() } }],
        client: { clotureLe: null },
      },
      select: { commune: true, profession: true, niveau: true },
      orderBy: [{ profession: "asc" }, { commune: "asc" }],
    }),
  ]);

  const cabinets = missions.filter((m) => m.profile.type === ProfileType.TITULAIRE);
  const candidats = missions.filter((m) => m.profile.type !== ProfileType.TITULAIRE);

  // Regroupement par ZONE et non par commune : une commune isolée peut ne compter qu'une annonce,
  // et un tableau où chaque ligne vaut 1 redevient nominatif pour qui connaît le terrain.
  const parZoneMap = new Map<string, { annonces: number; candidats: number }>();
  const ajouter = (loc: string, cle: "annonces" | "candidats") => {
    const zone = zoneOfCommune(loc) ?? loc ?? "Non précisé";
    const e = parZoneMap.get(zone) ?? { annonces: 0, candidats: 0 };
    e[cle]++;
    parZoneMap.set(zone, e);
  };
  cabinets.forEach((m) => ajouter(m.location, "annonces"));
  candidats.forEach((m) => ajouter(m.location, "candidats"));

  return {
    annoncesActives: cabinets.length,
    candidatsDisponibles: candidats.length,
    misesEnRelation90j,
    parZone: Array.from(parZoneMap.entries())
      .map(([zone, v]) => ({ zone, ...v }))
      .sort((a, b) => b.annonces + b.candidats - (a.annonces + a.candidats)),
    prioritesEnVigueur: priorites,
  };
}
