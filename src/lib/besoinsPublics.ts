import type { Profession } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NATURES_BESOIN, ETIQUETTE_PROPOSITION, auteurAffiche, etiquetteBesoin } from "@/lib/besoinTerritoire";
import { archiverBesoinsEchus } from "@/lib/besoinTerritoireServeur";
import { PROFESSION_LABELS } from "@/lib/professions";
import { headers } from "next/headers";
import { logTraceEvent } from "@/lib/trace";
import { estRobot } from "@/lib/traceLanding";

// Besoins du territoire montrés sur les pages publiques (24/10) : pages métier (par profession et
// territoire) et page d'une structure (/p). Mêmes règles que dans le fil : publiés et non échus,
// nom de la structure seulement avec son accord. Aucune donnée sur une personne.

export interface BesoinPublic {
  id: string; etiquette: string; profession: string; commune: string; specialite: string | null; nature: string;
  texte: string; proposition: string | null; etiquetteProposition: string;
}

export async function besoinsPublics(filtre: { profession?: Profession; codesInsee?: string[]; clientId?: string; max?: number; lieu: string }): Promise<BesoinPublic[]> {
  await archiverBesoinsEchus();
  const besoins = await prisma.besoinTerritoire.findMany({
    where: {
      statut: "PUBLIE", expireLe: { gt: new Date() },
      ...(filtre.profession ? { profession: filtre.profession } : {}),
      ...(filtre.codesInsee ? { codeInsee: { in: filtre.codesInsee } } : {}),
      ...(filtre.clientId ? { clientId: filtre.clientId } : {}),
    },
    orderBy: { publieLe: "desc" }, take: filtre.max ?? 6,
    include: { client: { select: { nom: true, type: true, page: { select: { accord: true, demo: true } } } } },
  });
  // Mesure (24/10) : un affichage par besoin montré, hors robots, sans identifiant de personne.
  if (besoins.length > 0 && !estRobot((await headers()).get("user-agent"))) {
    for (const b of besoins) {
      logTraceEvent({ eventType: "BESOIN_VUE", profession: b.profession, commune: b.commune, metadata: { besoinId: b.id, clientId: b.clientId, lieu: filtre.lieu } });
    }
  }
  return besoins.map((b) => ({
    id: b.id,
    etiquette: etiquetteBesoin(auteurAffiche(b.client, b.client.page?.accord === "OUI" && !b.client.page?.demo)),
    profession: PROFESSION_LABELS[b.profession], commune: b.commune, specialite: b.specialite, nature: NATURES_BESOIN[b.nature],
    texte: b.texte, proposition: b.proposition, etiquetteProposition: ETIQUETTE_PROPOSITION,
  }));
}
