// Mesure de la mise en avant territoriale, par client (point 10, 22/10).
//
// DEUX GARDE-FOUS, arbitrés par JC le 20/10 :
//   1. SEUIL D'AGRÉGATION : aucun chiffre en dessous de 5. En Guadeloupe, « 1 intérêt kiné à
//      Deshaies » désigne une personne. Une case sous le seuil s'affiche « moins de 5 », et il n'y
//      a pas de ligne de total : un total permettrait de retrouver la seule case masquée par
//      soustraction.
//   2. PAS DE LECTURE AVANT PLUSIEURS MOIS : avec les volumes actuels, un écart lu tôt serait du
//      bruit, et le lire pousserait à corriger le réglage sur ce bruit. Les résultats sont
//      verrouillés pour TOUS — client, administrateur — jusqu'à `ouvertureLecture`. Les traces
//      brutes restent en base ; c'est l'écran qui ne les montre pas.
//
// SOURCES (traces, toutes écrites en fire-and-forget) :
//   · FEED_PRIORITE_TERRITORIALE.metadata.parClient[clientId] — annonces de la zone servies dans
//     un fil, et combien le boost a fait passer devant ;
//   · SWIPE_RIGHT.metadata.zone.clientId — intérêts de candidats pour un poste de la zone ;
//   · MATCH_CREATED.metadata.zone.clientId — mises en relation sur un poste de la zone.
// Ces champs existent depuis le 22/10 : rien n'est reconstitué avant (pas de rattrapage).

import { prisma } from "@/lib/prisma";
import { DEBUT_MESURE, DELAI_LECTURE_MOIS, SEUIL_AGREGATION, type LigneMesure } from "@/lib/mesureRegles";

export { DEBUT_MESURE, DELAI_LECTURE_MOIS, SEUIL_AGREGATION, type LigneMesure };

export function ouvertureLecture(client: { debutLe: Date }): Date {
  const depart = client.debutLe > DEBUT_MESURE ? client.debutLe : DEBUT_MESURE;
  const d = new Date(depart);
  d.setUTCMonth(d.getUTCMonth() + DELAI_LECTURE_MOIS);
  return d;
}

/** Un compte sous le seuil devient null (« moins de 5 »). */
export function seuil(n: number): number | null {
  return n >= SEUIL_AGREGATION ? n : null;
}


export type Mesure =
  | { verrouillee: true; ouvertureLe: Date }
  | { verrouillee: false; lignes: LigneMesure[] };

export async function mesureDuClient(
  client: { id: string; debutLe: Date },
  maintenant: Date = new Date(),
): Promise<Mesure> {
  const ouvertureLe = ouvertureLecture(client);
  if (maintenant < ouvertureLe) return { verrouillee: true, ouvertureLe };

  // Intérêts et relations : filtre JSON en base. Le fil : filtré ici (la clé est l'id du client).
  const [fil, interets, relations] = await Promise.all([
    prisma.traceEvent.findMany({
      where: { eventType: "FEED_PRIORITE_TERRITORIALE", occurredAt: { gte: DEBUT_MESURE, lte: maintenant } },
      select: { occurredAt: true, metadata: true },
    }),
    prisma.traceEvent.findMany({
      where: { eventType: "SWIPE_RIGHT", occurredAt: { gte: DEBUT_MESURE, lte: maintenant }, metadata: { path: ["zone", "clientId"], equals: client.id } },
      select: { occurredAt: true },
    }),
    prisma.traceEvent.findMany({
      where: { eventType: "MATCH_CREATED", occurredAt: { gte: DEBUT_MESURE, lte: maintenant }, metadata: { path: ["zone", "clientId"], equals: client.id } },
      select: { occurredAt: true },
    }),
  ]);

  const mois = (d: Date) => d.toISOString().slice(0, 7);
  const brut = new Map<string, { servies: number; remontees: number; interets: number; misesEnRelation: number }>();
  const ligne = (m: string) => {
    if (!brut.has(m)) brut.set(m, { servies: 0, remontees: 0, interets: 0, misesEnRelation: 0 });
    return brut.get(m)!;
  };
  for (const t of fil) {
    const c = (t.metadata as { parClient?: Record<string, { servies?: number; remontees?: number }> } | null)?.parClient?.[client.id];
    if (!c) continue;
    const l = ligne(mois(t.occurredAt));
    l.servies += c.servies ?? 0;
    l.remontees += c.remontees ?? 0;
  }
  for (const t of interets) ligne(mois(t.occurredAt)).interets++;
  for (const t of relations) ligne(mois(t.occurredAt)).misesEnRelation++;

  const lignes = Array.from(brut.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([m, v]) => ({
      mois: m,
      servies: seuil(v.servies), remontees: seuil(v.remontees),
      interets: seuil(v.interets), misesEnRelation: seuil(v.misesEnRelation),
    }));
  return { verrouillee: false, lignes };
}
