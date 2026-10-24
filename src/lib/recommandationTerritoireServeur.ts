import { prisma } from "@/lib/prisma";
import { casesTenues } from "@/lib/casesPriorite";
import { limitesDuClient } from "@/lib/tarifsPartenaire";
import { BESOINS_ACTIFS_MAX } from "@/lib/besoinTerritoire";
import { DEPARTEMENT_REFERENCE, pour10k, type DonneesEffectifs } from "@/lib/indicateursTerritoire";

/** Populations et effectifs (tables de totaux publics, quelques centaines de lignes). */
async function chargerEffectifs(): Promise<DonneesEffectifs | undefined> {
  const [pops, effs] = await Promise.all([
    prisma.demographieCommune.findMany({ select: { codeInsee: true, population: true, source: true, millesime: true } }),
    prisma.effectifPraticiens.findMany({ select: { codeInsee: true, profession: true, effectif: true, effectifLiberal: true, source: true, extraitLe: true } }),
  ]);
  if (pops.length === 0 || effs.length === 0) return undefined;
  const population = Object.fromEntries(pops.map((p) => [p.codeInsee, p.population]));
  const parCase = Object.fromEntries(effs.map((e) => [`${e.codeInsee}:${e.profession}`, { effectif: e.effectif, effectifLiberal: e.effectifLiberal }]));
  const couvertes = Array.from(new Set(effs.map((e) => e.profession as string)));
  const popRef = pops.filter((p) => p.codeInsee.startsWith(DEPARTEMENT_REFERENCE)).reduce((s, p) => s + p.population, 0);
  const reference = Object.fromEntries(couvertes.map((prof) => [prof, pour10k(
    effs.filter((e) => e.profession === prof && e.codeInsee.startsWith(DEPARTEMENT_REFERENCE)).reduce((s, e) => s + e.effectif, 0), popRef,
  )]));
  return {
    couvertes, parCase, population, reference,
    source: { praticiens: effs[0].source, extraitLe: effs[0].extraitLe.toISOString(), population: pops[0].source, millesime: pops[0].millesime },
  };
}
import { paliersApl } from "@/lib/aplPalier";
import { libellesDuCode, prioritesDeLaPage } from "@/lib/pageClient";
import { recommandationsDuTerritoire, texteRecommandation, cleRecommandation, type PrioriteEntree, type Recommandation } from "@/lib/recommandationTerritoire";
import { PROFESSION_LABELS, professionPluriel } from "@/lib/professions";
import type { Profession } from "@prisma/client";

// Chargement des recommandations d'une page client (23/10) — partagé par la page de gestion et
// par la route qui trace les clics, pour qu'un clic ne puisse se rapporter qu'à une proposition
// réellement calculée pour cette page.

export interface SourceApl {
  source: string | null; annee: number | null; importeLe: string | null;
  /** Sources des effectifs et populations (23/10), quand ils sont importés. */
  effectifs?: DonneesEffectifs["source"];
}

/** « Vos réglages » : sur les cases que l'APL désigne (palier ≥ 1), combien ont une priorité,
 *  et combien de réglages la structure a écrits elle-même (écart ou ajout justifié). */
/** Proposition prête à afficher : textes remplis ici, côté serveur — le composant n'importe que
 *  des types (lib/aplPalier charge la base). */
export type RecommandationAffichee = Recommandation & { cle: string; phrase: string; parce: string; libelleProfession: string | null };

export interface ResumeReglages { casesApl: number; casesReglees: number; reglagesHumains: number }

export async function recommandationsDeLaPage(page: {
  id: string; clientId: string; demo: boolean; communes: string[]; professions: string[];
  client: { nom: string; revueLe: Date };
}): Promise<{ recommandations: RecommandationAffichee[]; source: SourceApl; resume: ResumeReglages }> {
  const [priorites, paliers, ligneSource, client, tenues, besoinsEnCours, effectifs] = await Promise.all([
    page.demo
      ? prioritesDeLaPage(page as Parameters<typeof prioritesDeLaPage>[0], page.client.nom).then((zs) => zs.map((z): PrioriteEntree => ({
          id: `${z.codeInsee}-${z.profession}`, codeInsee: z.codeInsee, commune: z.commune, profession: z.profession,
          niveau: z.niveau, origine: "APL", clientId: page.clientId, justification: null, expireLe: null,
        })))
      : prisma.prioriteTerritoriale.findMany({
          where: { codeInsee: { in: page.communes } },
          select: { id: true, codeInsee: true, commune: true, profession: true, niveau: true, origine: true, clientId: true, justification: true, expireLe: true },
        }).then((ps) => ps.map((p): PrioriteEntree => ({ ...p, expireLe: p.expireLe?.toISOString() ?? null }))),
    paliersApl(page.communes),
    prisma.communeAPL.findFirst({
      where: { codeInsee: { in: page.communes } },
      orderBy: { aplImportedAt: "desc" },
      select: { aplSource: true, aplAnnee: true, aplImportedAt: true },
    }),
    prisma.clientInstitutionnel.findUniqueOrThrow({ where: { id: page.clientId }, select: { type: true, palier: true } }),
    casesTenues(page.clientId),
    prisma.besoinTerritoire.findMany({
      where: { codeInsee: { in: page.communes }, statut: { in: ["BROUILLON", "A_VALIDER", "PUBLIE"] } },
      select: { codeInsee: true, profession: true, clientId: true, statut: true },
    }),
    chargerEffectifs(),
  ]);
  const brutes = recommandationsDuTerritoire({
    clientId: page.clientId, demo: page.demo,
    communes: page.communes.map((c) => ({ code: c, libelle: libellesDuCode(c)[0] ?? c })),
    professionsPage: page.professions, paliers, priorites, revueLe: page.client.revueLe.toISOString(),
    cases: { max: limitesDuClient(client).casesMax, tenues },
    besoins: {
      casesOccupees: besoinsEnCours.map((b) => `${b.codeInsee}:${b.profession}`),
      actifs: besoinsEnCours.filter((b) => b.clientId === page.clientId && b.statut !== "BROUILLON").length,
      max: BESOINS_ACTIFS_MAX,
    },
    effectifs,
  });
  const lib = (p: string) => PROFESSION_LABELS[p as Profession] ?? p;
  const recommandations: RecommandationAffichee[] = brutes.map((r) => {
    const libelleProfession = r.professionsSansDonnees ? r.professionsSansDonnees.map(lib).join(", ") : r.profession ? lib(r.profession) : null;
    // Dans la phrase : « les kinésithérapeutes », « les dermatologues et ophtalmologues ».
    const pluriels = (r.professionsSansDonnees ?? (r.profession ? [r.profession] : [])).map(professionPluriel);
    const dansLaPhrase = pluriels.length === 0 ? "" : `les ${pluriels.length === 1 ? pluriels[0] : `${pluriels.slice(0, -1).join(", ")} et ${pluriels[pluriels.length - 1]}`}`;
    return { ...r, cle: cleRecommandation(r), libelleProfession, ...texteRecommandation(r, dansLaPhrase) };
  });
  // Mêmes professions que celles que la page affiche (vide = toutes), comme la règle R1.
  const casesApl = paliers.filter((p) => p.niveau >= 1 && (page.professions.length === 0 || page.professions.includes(p.profession)));
  const resume: ResumeReglages = {
    casesApl: casesApl.length,
    casesReglees: casesApl.filter((c) => priorites.some((p) => p.codeInsee === c.codeInsee && p.profession === c.profession)).length,
    reglagesHumains: priorites.filter((p) => p.clientId === page.clientId && (p.origine === "DECLAREE" || !!p.justification)).length,
  };
  return {
    recommandations,
    resume,
    source: { source: ligneSource?.aplSource ?? null, annee: ligneSource?.aplAnnee ?? null, importeLe: ligneSource?.aplImportedAt?.toISOString() ?? null, effectifs: effectifs?.source },
  };
}

