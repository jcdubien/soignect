// Mise en avant payante des postes salariés (étape 6, 04/11) — SOURCE UNIQUE des règles.
//
// Décisions de JC (04/11) :
//   · ACHETEUR : les établissements seuls (compte TITULAIRE de genre STRUCTURE — cliniques,
//     hôpitaux, centres). Une CPTS ou une MSP n'embauche pas et a déjà le boost territorial ; les
//     praticiens sont gratuits depuis le 27/10.
//   · EFFET : la même remontée que le boost territorial — un bonus plafonné à PLAFOND_BOOST, le
//     MAXIMUM des deux et jamais la somme, au plus une carte remontée par fenêtre de densité —
//     et une mention visible sur la carte. Rien de caché : le fil dit déjà pourquoi son ordre est
//     ce qu'il est, il le dit aussi de celle-ci.
//   · DURÉE : 30 jours ; s'arrête d'elle-même, et plus tôt si le poste est pourvu ou retiré (le
//     fil ne sert que les offres ouvertes).
//   · ACTIVATION : par l'administrateur, derrière un interrupteur ÉTEINT par défaut
//     (PlatformConfig.miseEnAvantPosteSalarie). Vente en ligne fermée (tarifsPartenaire) : la
//     facture se fait hors Soignect. Éteint, une mise en avant enregistrée n'a aucun effet.

import { PLAFOND_BOOST } from "@/lib/boostTerritorial";

export const DUREE_MISE_EN_AVANT_JOURS = 30;

/** Points d'ordre d'un poste mis en avant — le plafond du boost, ni plus ni moins. */
export const POINTS_MISE_EN_AVANT = PLAFOND_BOOST;

export const LIBELLE_MIS_EN_AVANT = "Mis en avant";

/** Mention sous l'étiquette : la mise en avant est payée, et par qui. */
export function mentionPosteMisEnAvant(etablissement: string | null | undefined): string {
  return etablissement ? `Mise en avant payée par ${etablissement}` : "Mise en avant payée par l'établissement";
}

/** Le poste peut-il être mis en avant ? Établissements seuls. */
export function posteEligible(profile: { type: string; titulaireKind?: string | null }): boolean {
  return profile.type === "TITULAIRE" && profile.titulaireKind === "STRUCTURE";
}

/** Prédicat Prisma d'une mise en avant en cours à l'instant `t`. */
export function enCoursLe(t: Date) {
  return { debut: { lte: t }, fin: { gt: t }, retireeLe: null };
}

/** Une nouvelle période commence à la fin de celle en cours (prolongation), sinon maintenant. */
export function periodeSuivante(maintenant: Date, finEnCours: Date | null): { debut: Date; fin: Date } {
  const debut = finEnCours && finEnCours > maintenant ? finEnCours : maintenant;
  return { debut, fin: new Date(debut.getTime() + DUREE_MISE_EN_AVANT_JOURS * 86_400_000) };
}
