import type { MissionType, Profession } from "@prisma/client";
import { gabaritsPour } from "@/lib/contrats/gabarits";
import { gabaritsSalariePour, NATURE_PAR_MISSION, type NatureContratTravail } from "@/lib/contrats/gabaritsSalarie";

// Le registre du contrat d'une mise en relation — libéral ou salarié — et les modèles qui
// s'y appliquent (16/10).
//
// ── POURQUOI CE FICHIER ──────────────────────────────────────────────────────────────────────
//
// La question « ce contrat est-il salarié, et Soignect a-t-il un modèle pour lui ? » se posait à
// TROIS endroits, avec trois réponses :
//   · l'écran de contrat (contrat-info) : l'annonce dit si elle est salariée ; la structure ne
//     sert de repli que pour les annonces d'avant le 22/09 (section 294) ;
//   · la génération du PDF : l'annonce, OU la structure — toujours ;
//   · la fiche de mise en relation : la structure seule, l'annonce ignorée — et le bouton
//     « Générer le contrat PDF — Modèle CNOMK » proposé à TOUTE profession libérale, alors
//     que seuls les kinés et les infirmiers ont des modèles. Un orthophoniste se voyait vendre
//     l'abonnement pour un document qui n'existe pas.
// Une seule règle désormais, celle de la section 294 (la plus récente, mesurée).

/** Date à laquelle `Mission.estSalariat` est entré en base (section 294). Avant, seule la nature
 *  du recruteur pouvait dire qu'une annonce était salariée. */
const DEBUT_SALARIAT_EN_BASE = new Date("2026-09-22T00:00:00Z");

export interface MissionDuRegistre {
  missionType: MissionType;
  estSalariat?: boolean | null;
  natureSalariat?: string | null;
  createdAt?: Date | null;
}

/** Le salariat est une propriété de L'ANNONCE (section 294) ; la structure ne sert de repli
 *  que pour une annonce antérieure au 22/09, qui ne pouvait pas le porter. */
export function contratSalarie(
  missionTitulaire: MissionDuRegistre | null | undefined,
  profilTitulaire: { titulaireKind?: string | null },
): boolean {
  if (missionTitulaire?.estSalariat === true) return true;
  const anterieure = !missionTitulaire?.createdAt || missionTitulaire.createdAt < DEBUT_SALARIAT_EN_BASE;
  return anterieure && profilTitulaire.titulaireKind === "STRUCTURE";
}

/** Nature du contrat de travail : celle déclarée à la publication d'abord, sinon la dérivation
 *  par type de poste (`NATURE_PAR_MISSION`). `CDD_TERME` et `CDD_SANS_TERME` sont un même CDD. */
export function natureDuContrat(
  missionTitulaire: MissionDuRegistre | null | undefined,
  missionType: MissionType | null,
): NatureContratTravail {
  if (missionTitulaire?.natureSalariat === "CDI") return "CDI";
  if (missionTitulaire?.natureSalariat?.startsWith("CDD")) return "CDD";
  return missionType ? NATURE_PAR_MISSION[missionType] : "CDD";
}

export interface ModeleDuMatch {
  id: string;
  libelle: string;
  quandLUtiliser: string | null;
  source: string;
  composeSansModele: boolean;
}

/**
 * Les modèles de contrat applicables à une mise en relation. Liste vide = Soignect n'a pas de
 * modèle pour ce cas (profession sans gabarit, nature salariée non écrite, contrat fourni par
 * l'employeur, professions différentes) : le contrat se signe hors Soignect, et la conclusion
 * se déclare (lib/relationConclue).
 */
export function modelesDuMatch(opts: {
  professionTitulaire: Profession;
  professionCandidat: Profession;
  missionType: MissionType | null;
  salarie: boolean;
  nature: NatureContratTravail;
}): ModeleDuMatch[] {
  const { professionTitulaire, professionCandidat, missionType, salarie, nature } = opts;
  if (!missionType || professionTitulaire !== professionCandidat) return [];
  return salarie
    ? gabaritsSalariePour(professionTitulaire, nature).map((g) => ({
        id: g.id, libelle: g.libelle, quandLUtiliser: null,
        source: g.source, composeSansModele: g.composeSansModele ?? false,
      }))
    : gabaritsPour(professionTitulaire, missionType).map((g) => ({
        id: g.id, libelle: g.libelle, quandLUtiliser: g.quandLUtiliser ?? null,
        source: g.source, composeSansModele: false,
      }));
}
