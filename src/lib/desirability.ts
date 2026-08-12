// Désirabilité — mise en avant COMMERCIALE d'une annonce (section 126).
//
// Elle ne dit rien de l'accord entre deux personnes : c'est le statut de l'annonceur
// (abonnement, cabinet fondateur, partenaire institutionnel, arbitrage admin). À ce titre elle
// n'entre PAS dans le score de compatibilité — un nombre présenté comme une compatibilité doit
// n'affirmer que ce qu'il mesure. Elle détermine l'ORDRE D'AFFICHAGE du feed, ce qui est une
// pratique légitime dès lors qu'elle est énoncée en clair aux utilisateurs (voir le feed).

export interface DesirabilityProfile {
  isFounding: boolean;
  desirabilityOverride: number | null;
  desirabilityExpiry: Date | null;
  desirabilityScore: number;
  subscriptionPlan?: string | null;
  institutionalPartner?: boolean | null;
}

// Désirabilité effective en POURCENTAGE 0-100.
export function getDesirabilityPercent(profile: DesirabilityProfile, now: Date = new Date()): number {
  // Cabinet fondateur (JCD) = 100 % fixe.
  if (profile.isFounding) return 100;
  // Override admin = priorité absolue (0-100 %), tant que non expiré.
  if (profile.desirabilityOverride !== null) {
    const expired = profile.desirabilityExpiry && profile.desirabilityExpiry <= now;
    if (!expired) return Math.min(Math.max(profile.desirabilityOverride, 0), 100);
  }
  // Sinon dérivé du plan (automatique) : Premium 50, Boost 80, Structure 50, Gratuit 0.
  // Un desirabilityScore stocké (boost admin ponctuel) prime s'il est supérieur.
  const byPlan =
    profile.subscriptionPlan === "BOOST" ? 80 :
    (profile.subscriptionPlan === "PREMIUM" || profile.subscriptionPlan === "STRUCTURE") ? 50 : 0;
  const cpts = profile.institutionalPartner ? 20 : 0; // partenaire CPTS (section 23) — +20 %
  return Math.min(Math.max(byPlan, profile.desirabilityScore ?? 0) + cpts, 100);
}


// ── Bonus saisonnier mai-octobre (section 197) ──────────────────────────────────────────────
//
// Le vivier de candidats est plus mince sur mai-octobre que sur le reste de l'année — c'est une
// observation terrain de Jean-Charles, pas une mesure : avec six disponibilités en base, aucun
// chiffre ne la confirmerait ni ne l'infirmerait. Le boost compense cette rareté dans l'ORDRE
// D'AFFICHAGE, jamais dans le score de compatibilité, qui continue de ne mesurer que l'accord
// entre deux personnes.
//
// TROIS ARBITRAGES, tranchés ici et modifiables en un endroit :
//
// 1. CONDITIONNEL, pas absolu. Le bonus ne s'applique QUE si le besoin du cabinet recoupe lui
//    aussi la fenêtre. Sinon un cabinet qui recrute pour décembre verrait remonter en tête des
//    candidats d'août : le score dirait « dates éloignées », mais trop tard, l'ordre l'aurait
//    déjà mis en avant. Le feed n'est filtré sur les dates que si une annonce cible est
//    sélectionnée ET porte deux dates — sans ce garde, la moitié des cas passait sans filtre.
//
// 2. UNE PÉRIODE SANS DATES COMPTE COMME DANS LA FENÊTRE. C'est le point le moins évident, et
//    il a changé d'avis en voyant les données : la moitié des disponibilités n'ont AUCUNE date,
//    et ce sont toutes des postes long terme (assistanat, collaboration). Les exclure aurait
//    systématiquement classé les remplacements datés devant les recherches d'assistanat — dans
//    un produit dont le déséquilibre déclaré est justement le manque d'assistants. « Disponible
//    sans date » veut dire « disponible quand vous voulez », donc aussi en mai-octobre :
//    l'exclusion aurait été un artefact du modèle de données, pas une différence réelle.
//
// 3. DOSAGE 30. Dans le feed cabinet, la désirabilité vaut 0 pour tous les candidats — ils ne
//    sont jamais facturés. Ce bonus y est donc le SEUL signal de classement, et non un facteur
//    parmi d'autres : sa valeur exacte compte moins que son existence. 30 le place sous le
//    palier Premium (50), pour qu'une offre payante reste devant si elle voit le jour.
export const BONUS_SAISONNIER = 30;

// ── La fenêtre est une propriété du TERRITOIRE, pas du métier ni de la saison en général ─────
//
// Observation de Jean-Charles (12/08) : ce creux n'a rien de propre à la kinésithérapie. Il
// tient au fait que l'activité suive une saison touristique — territoires insulaires, stations
// balnéaires, stations de montagne. En Guadeloupe le pic de demande est l'été austral ; dans
// une station de ski ce serait décembre-mars, soit exactement l'inverse.
//
// La fenêtre est donc NOMMÉE plutôt que laissée en nombres nus dans la boucle. Elle n'est pas
// paramétrable pour autant : il n'existe aujourd'hui qu'un territoire actif, et rendre la règle
// configurable pour un cas qui n'existe pas serait de l'architecture à vide.
//
// LE JOUR OÙ UNE DEUXIÈME RÉGION AURA DES UTILISATEURS : l'enum Region existe déjà (8 valeurs),
// et le produit a un précédent de table indexée par région (TERRITORY dans commune-summary).
// C'est cette constante-ci qu'il faudra remplacer par une donnée, pas la logique autour.
const MAI = 4, OCTOBRE = 9; // getUTCMonth() est indexé à zéro
const FENETRE_TENSION_GUADELOUPE = { premierMois: MAI, dernierMois: OCTOBRE };

export interface Periode { startDate?: Date | string | null; endDate?: Date | string | null }

const toDate = (v: Date | string | null | undefined): Date | null => {
  if (!v) return null;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d;
};

// Vrai si la période touche au moins un mois de la fenêtre de tension du territoire. On parcourt les mois plutôt
// que de comparer des dates : une période peut enjamber le 31 décembre, et un test sur les
// bornes seules manquerait une période longue qui traverse la fenêtre sans y commencer.
export function toucheFenetreTension(p: Periode): boolean {
  const debut = toDate(p.startDate);
  if (!debut) return true; // sans date = disponible quand on veut, donc aussi en mai-octobre
  const fin = toDate(p.endDate) ?? debut;
  const cur = new Date(Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth(), 1));
  for (let i = 0; i < 24 && cur <= fin; i++) {
    const m = cur.getUTCMonth();
    if (m >= FENETRE_TENSION_GUADELOUPE.premierMois && m <= FENETRE_TENSION_GUADELOUPE.dernierMois) return true;
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return false;
}

// `besoin` = période visée par le cabinet qui regarde. Null quand elle est inconnue (aucune
// annonce cible sélectionnée) : on n'applique alors AUCUN bonus, faute de savoir s'il est
// pertinent. Mieux vaut un feed non boosté qu'un feed boosté à tort.
export function bonusSaisonnier(candidat: Periode, besoin: Periode | null): number {
  if (!besoin) return 0;
  return toucheFenetreTension(besoin) && toucheFenetreTension(candidat) ? BONUS_SAISONNIER : 0;
}
