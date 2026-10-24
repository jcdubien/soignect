// « Recommandation Soignect » (23/10) — encart de la page de gestion d'une structure.
//
// SOURCE UNIQUE des règles, de leur ordre, de leurs textes et de la mention fixe. PUR : aucune
// lecture de base, aucun modèle de langage. La page lui passe ce qu'elle a déjà chargé
// (périmètre, paliers APL, priorités) ; il rend une liste de propositions.
//
// CE QUE C'EST : une PROPOSITION, calculée de la même façon pour toutes les structures. Elle
// préremplit un formulaire existant de la page ; l'éditeur confirme, et c'est le chemin habituel
// (contrôles, journal en ajout seul) qui enregistre. Rien n'est appliqué d'ici.
//
// CE QUE CE N'EST PAS : un zonage officiel (fixé par l'ARS), ni un constat. Les paliers sont une
// convention Soignect (premier quart → 2, deuxième quart → 1 ; lib/aplPalier), à faire relire.
// Sans donnée publique pour une profession : « données insuffisantes », et aucune proposition.

import type { PalierApl } from "@/lib/aplPalier";
import { libelleAcces } from "@/lib/aplPalier";
import { justificationRequise } from "@/lib/boostTerritorial";
import { densiteDe, type Densite, type DonneesEffectifs } from "@/lib/indicateursTerritoire";

export const MENTION_RECOMMANDATION = "Indicatif. Calculé à partir de données publiques. Ce n'est pas un zonage officiel.";

/** Échéance de revue proche : en deçà de ce nombre de jours, l'encart le rappelle. */
export const REVUE_PROCHE_JOURS = 30;

export type RegleRecommandation =
  | "PRIORITE_ECHUE"        // R4 — l'échéance déclarée est passée
  | "RELEVER"               // R2 — niveau sous le palier APL, sans justification
  | "ABAISSER"              // R3 — niveau au-dessus du palier APL (≥ 1), sans justification
  | "RETIRER_SANS_APL"      // R3 bis — case ajoutée, APL dans la moyenne, sans justification
  | "COMMUNE_NON_REGLEE"    // R1 — palier APL ≥ 1, aucune priorité sur la case
  | "PREPARER_BESOIN"       // R5 — palier 2, aucun besoin en cours sur la case (une par profession)
  | "PERIMETRE_SANS_PRATICIEN" // R8 — profession sans APL, aucun praticien recensé sur tout le périmètre
  | "DONNEES_INSUFFISANTES" // R6 — profession affichée sans aucune APL : rien à proposer
  | "REVUE_PROCHE";         // R7 — échéance de la relation dans moins de 30 jours

/** Ordre d'affichage : ce qui est faux d'abord, puis ce qui manque, puis l'information. */
export const ORDRE_REGLES: RegleRecommandation[] = [
  "PRIORITE_ECHUE", "RELEVER", "ABAISSER", "RETIRER_SANS_APL", "COMMUNE_NON_REGLEE", "PREPARER_BESOIN", "PERIMETRE_SANS_PRATICIEN", "DONNEES_INSUFFISANTES", "REVUE_PROCHE",
];

export type ActionRecommandation =
  | { type: "ajouter"; codeInsee: string; profession: string; niveau: number }
  | { type: "regler"; prioriteId: string; niveau: number }
  | { type: "retirer"; prioriteId: string }
  | { type: "preparerBesoin"; codeInsee: string; profession: string }
  | null;

export interface Recommandation {
  regle: RegleRecommandation;
  codeInsee: string | null;
  commune: string | null;
  profession: string | null;
  /** Palier APL courant de la case, quand il existe — montré dans « Voir le calcul ». */
  palier: PalierApl | null;
  niveauActuel: number | null;
  action: ActionRecommandation;
  /** DONNEES_INSUFFISANTES : toutes les professions concernées, en une seule proposition. */
  professionsSansDonnees?: string[];
  /** Effectifs recensés (Annuaire Santé) : de la commune pour une case, du périmètre pour R8. */
  densite?: Densite | null;
  /** COMMUNE_NON_REGLEE quand l'offre a déjà toutes ses cases : on le DIT, sans action ni
   *  invitation à changer d'offre (une recommandation n'est pas un argument de vente). */
  plafond?: number;
}

export interface PrioriteEntree {
  id: string; codeInsee: string; commune: string; profession: string;
  niveau: number; origine: "APL" | "DECLAREE"; clientId: string;
  justification: string | null; expireLe: string | null;
}

export function recommandationsDuTerritoire(e: {
  clientId: string;
  demo: boolean;
  communes: { code: string; libelle: string }[];
  /** Professions affichées par la page ; vide = toutes. */
  professionsPage: string[];
  paliers: PalierApl[];
  priorites: PrioriteEntree[];
  revueLe: string;
  /** Cases prioritaires permises par l'offre (null = sans plafond) et cases déjà tenues. */
  cases: { max: number | null; tenues: number };
  /** Besoins du territoire (23/10) : cases ayant déjà un besoin en cours (brouillon, à valider,
   *  publié — toutes structures) et besoins actifs de CETTE structure face au plafond. */
  besoins?: { casesOccupees: string[]; actifs: number; max: number };
  /** Populations et effectifs de santé (23/10) — absents : les règles s'en passent. */
  effectifs?: DonneesEffectifs;
  maintenant?: Date;
}): Recommandation[] {
  const maintenant = e.maintenant ?? new Date();
  const recos: Recommandation[] = [];
  const palierDe = (code: string, prof: string) => e.paliers.find((p) => p.codeInsee === code && p.profession === prof) ?? null;
  const nomDe = (code: string) => e.communes.find((c) => c.code === code)?.libelle ?? code;
  // Une page de démonstration ne se règle pas (l'API répond 409) : on informe, sans action.
  const agir = <T extends ActionRecommandation>(a: T): T | null => (e.demo ? null : a);

  // Cases tenues par CETTE structure.
  for (const p of e.priorites.filter((x) => x.clientId === e.clientId)) {
    const palier = palierDe(p.codeInsee, p.profession);
    const base = { codeInsee: p.codeInsee, commune: p.commune, profession: p.profession, palier, niveauActuel: p.niveau };
    if (p.expireLe && new Date(p.expireLe) < maintenant) {
      recos.push({ ...base, regle: "PRIORITE_ECHUE", action: p.origine === "DECLAREE" ? agir({ type: "retirer", prioriteId: p.id }) : null });
      continue;
    }
    if (!palier || p.justification) continue; // sans APL, ou écart déjà justifié : rien à redire
    if (palier.niveau >= 1 && p.niveau < palier.niveau) {
      recos.push({ ...base, regle: "RELEVER", action: agir({ type: "regler", prioriteId: p.id, niveau: palier.niveau }) });
    } else if (palier.niveau >= 1 && p.niveau > palier.niveau && justificationRequise(p.niveau, palier.niveau)) {
      recos.push({ ...base, regle: "ABAISSER", action: agir({ type: "regler", prioriteId: p.id, niveau: palier.niveau }) });
    } else if (palier.niveau === 0 && p.origine === "DECLAREE") {
      recos.push({ ...base, regle: "RETIRER_SANS_APL", action: agir({ type: "retirer", prioriteId: p.id }) });
    }
  }

  // Cases du périmètre sans aucune priorité (quelle que soit la structure qui la tiendrait).
  const plafondAtteint = e.cases.max !== null && e.cases.tenues >= e.cases.max;
  for (const palier of e.paliers) {
    if (palier.niveau < 1) continue;
    if (e.professionsPage.length > 0 && !e.professionsPage.includes(palier.profession)) continue;
    if (e.priorites.some((p) => p.codeInsee === palier.codeInsee && p.profession === palier.profession)) continue;
    recos.push({
      regle: "COMMUNE_NON_REGLEE", codeInsee: palier.codeInsee, commune: nomDe(palier.codeInsee), profession: palier.profession,
      palier, niveauActuel: null,
      ...(plafondAtteint
        ? { action: null, plafond: e.cases.max! }
        : { action: agir({ type: "ajouter", codeInsee: palier.codeInsee, profession: palier.profession, niveau: palier.niveau }) }),
    });
  }

  // R5 — Préparer un besoin du territoire : case du premier quart (palier 2), sans besoin en cours,
  // UNE proposition par profession (la commune la moins bien placée), et rien si la structure a
  // déjà tous ses besoins actifs. Elle ouvre le formulaire prérempli ; rien n'est publié d'ici.
  if (e.besoins && e.besoins.actifs < e.besoins.max) {
    const occupees = new Set(e.besoins.casesOccupees);
    const meilleures = new Map<string, PalierApl>();
    for (const palier of e.paliers) {
      if (palier.niveau !== 2) continue;
      if (e.professionsPage.length > 0 && !e.professionsPage.includes(palier.profession)) continue;
      if (occupees.has(`${palier.codeInsee}:${palier.profession}`)) continue;
      const avant = meilleures.get(palier.profession);
      if (!avant || palier.rang < avant.rang) meilleures.set(palier.profession, palier);
    }
    for (const palier of Array.from(meilleures.values())) {
      recos.push({
        regle: "PREPARER_BESOIN", codeInsee: palier.codeInsee, commune: nomDe(palier.codeInsee), profession: palier.profession,
        palier, niveauActuel: null, action: agir({ type: "preparerBesoin", codeInsee: palier.codeInsee, profession: palier.profession }),
      });
    }
  }

  // R8 — Professions affichées sans APL mais présentes dans l'Annuaire Santé : si AUCUN praticien
  // n'est recensé sur tout le périmètre, on le dit, et on propose un besoin sur la commune la plus
  // peuplée (si la case est libre et le plafond de besoins non atteint). Avec au moins un praticien,
  // rien : l'indicateur seul ne dit pas qu'il en manque.
  const codes = e.communes.map((c) => c.code);
  const sansApl = e.professionsPage.filter((prof) => !e.paliers.some((p) => p.profession === prof));
  const traitees = new Set<string>();
  if (e.effectifs) {
    for (const prof of sansApl) {
      const d = densiteDe(e.effectifs, codes, prof);
      if (!d) continue;
      traitees.add(prof);
      if (d.effectif > 0) continue;
      const peuplee = [...codes].sort((a, b) => (e.effectifs!.population[b] ?? 0) - (e.effectifs!.population[a] ?? 0))[0];
      const libre = e.besoins && e.besoins.actifs < e.besoins.max && !e.besoins.casesOccupees.includes(`${peuplee}:${prof}`);
      recos.push({
        regle: "PERIMETRE_SANS_PRATICIEN", codeInsee: peuplee ?? null, commune: peuplee ? nomDe(peuplee) : null, profession: prof,
        palier: null, niveauActuel: null, densite: d,
        action: libre && peuplee ? agir({ type: "preparerBesoin", codeInsee: peuplee, profession: prof }) : null,
      });
    }
  }

  // Professions affichées sans aucune donnée publique (ni APL, ni effectif) — une seule ligne.
  const sansDonnees = sansApl.filter((prof) => !traitees.has(prof));
  if (sansDonnees.length > 0) {
    recos.push({ regle: "DONNEES_INSUFFISANTES", codeInsee: null, commune: null, profession: null, palier: null, niveauActuel: null, action: null, professionsSansDonnees: sansDonnees });
  }

  const jours = (new Date(e.revueLe).getTime() - maintenant.getTime()) / 86_400_000;
  if (jours >= 0 && jours < REVUE_PROCHE_JOURS) {
    recos.push({ regle: "REVUE_PROCHE", codeInsee: null, commune: null, profession: null, palier: null, niveauActuel: null, action: null });
  }

  // Densité de la commune pour toute proposition qui porte sur une case (affichée dans l'encart).
  if (e.effectifs) {
    for (const r of recos) {
      if (r.densite === undefined && r.codeInsee && r.profession) r.densite = densiteDe(e.effectifs, [r.codeInsee], r.profession);
    }
  }
  return recos.sort((a, b) => ORDRE_REGLES.indexOf(a.regle) - ORDRE_REGLES.indexOf(b.regle));
}

/** Clé stable d'une proposition — sert à l'« Ignorer » côté navigateur et au contrôle des traces. */
export function cleRecommandation(r: Pick<Recommandation, "regle" | "codeInsee" | "profession">): string {
  return `${r.regle}:${r.codeInsee ?? "-"}:${r.profession ?? "-"}`;
}

/** Modèles de phrases — la seule façon dont l'encart s'exprime. `prof` = la profession telle qu'elle
 *  se lit dans la phrase (« les kinésithérapeutes »), déjà formée par l'appelant. */
export function texteRecommandation(r: Recommandation, prof: string): { phrase: string; parce: string } {
  const acces = r.palier ? libelleAcces(r.palier.niveau) : "";
  const rang = r.palier ? `${r.palier.rang}ᵉ sur ${r.palier.sur} communes du département` : "";
  switch (r.regle) {
    case "PRIORITE_ECHUE":
      return { phrase: `Revoir la priorité de ${r.commune} pour ${prof} : son échéance est passée.`, parce: "Une priorité échue n'agit plus sur le fil." };
    case "RELEVER":
      return { phrase: `Relever ${r.commune} au niveau « ${acces} » pour ${prof}.`, parce: `Proposé parce que l'APL (${rang}) correspond à un niveau plus élevé que celui réglé, et qu'aucune justification n'est écrite.` };
    case "ABAISSER":
      return { phrase: `Ramener ${r.commune} au niveau « ${acces} » pour ${prof}, ou justifier l'écart.`, parce: `Proposé parce que le niveau réglé dépasse de plus d'un cran celui de l'APL (${rang}), sans justification.` };
    case "RETIRER_SANS_APL":
      return { phrase: `Retirer la priorité ajoutée sur ${r.commune} pour ${prof}, ou la justifier.`, parce: `Proposé parce que l'APL de la commune est dans la moyenne ou au-dessus (${rang}), et qu'aucune justification n'est écrite.` };
    case "COMMUNE_NON_REGLEE":
      if (r.plafond !== undefined) {
        return { phrase: `${r.commune} n'a pas de priorité pour ${prof}, alors que la commune est au ${rang}.`, parce: `Votre offre compte ${r.plafond} cases prioritaires, toutes utilisées : pour régler cette commune, retirez d'abord une case moins prioritaire.` };
      }
      return { phrase: `Régler ${r.commune} en priorité « ${acces} » pour ${prof}.`, parce: `Proposé parce que la commune est au ${rang} et n'a aucun réglage.` };
    case "PREPARER_BESOIN":
      return { phrase: `Préparer un besoin du territoire pour ${prof} à ${r.commune}.`, parce: `Proposé parce que la commune est au ${rang}, dans le premier quart, et qu'aucun besoin n'y est en cours pour cette profession. Le brouillon est prérempli ; vous le relisez avant toute publication.` };
    case "PERIMETRE_SANS_PRATICIEN":
      return { phrase: `Aucune activité déclarée sur votre territoire pour ${prof}.`, parce: `D'après l'Annuaire Santé, aucun n'a d'activité déclarée dans vos communes (${r.densite?.population.toLocaleString("fr-FR")} habitants)${r.densite?.reference != null ? ` ; en Guadeloupe : ${r.densite.reference.toLocaleString("fr-FR")} en libéral pour 10 000 habitants` : ""}. Les patients peuvent consulter ailleurs : c'est une indication, pas un constat de manque.` };
    case "DONNEES_INSUFFISANTES":
      return { phrase: `Données insuffisantes pour ${prof}.`, parce: "Aucune donnée publique d'accessibilité n'est importée pour ces professions : Soignect ne recommande rien sans chiffre sourcé." };
    case "REVUE_PROCHE":
      return { phrase: "La relation avec Soignect arrive à sa date de revue.", parce: `Moins de ${REVUE_PROCHE_JOURS} jours avant l'échéance : sans reconduction, la page cesse d'agir.` };
  }
}
