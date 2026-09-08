// Période du contrat (section 237, lot 1) — dates de début et de fin du document généré.
//
// CE QUE CE FICHIER REMPLACE. La route de génération dérivait la période SEPT FOIS, une par
// gabarit, en recopiant à chaque branche `missionTitulaire?.startDate ?? missionAutre?.startDate`.
// Sept copies d'une même règle sont sept occasions de diverger — c'est très exactement ce motif
// qui avait fait perdre `name` à la copie manuscrite du `select` d'identité (section 236), et le
// champ réclamé à l'écran devenait alors introuvable. La règle est déclarée ici une fois, et les
// deux routes (génération et informations d'écran) la lisent au même endroit.
//
// POURQUOI LES DATES DEVIENNENT MODIFIABLES. Les deux parties publient chacune leur annonce, avec
// leurs propres dates. Elles ne coïncident presque jamais : sur les six mises en relation
// existantes au 08/09, les six annonçaient des périodes différentes. Le contrat retenait
// silencieusement celle du titulaire — un document juridique dont une partie n'a jamais vu ni
// validé la période. Le remède n'est pas de choisir mieux : c'est de montrer d'où vient la valeur
// et de laisser les parties trancher.
//
// LA MISSION N'EST JAMAIS RÉÉCRITE. Ce qui est saisi ici vaut POUR CE CONTRAT. Une annonce dit ce
// que son auteur cherche ; un contrat dit ce qui a été convenu. Écrire l'un dans l'autre
// modifierait le feed et les correspondances d'un tiers depuis un écran de génération de PDF.

/** Dates telles qu'une annonce les déclare, au format `YYYY-MM-DD` (jour civil, sans heure). */
export interface PeriodeAnnonce {
  debut: string | null;
  fin: string | null;
}

/** D'où provient la valeur retenue par défaut. `null` = aucune des deux annonces ne la porte. */
export type SourcePeriode = "TITULAIRE" | "CANDIDAT" | null;

export interface PeriodeContrat extends PeriodeAnnonce {
  sourceDebut: SourcePeriode;
  sourceFin: SourcePeriode;
  /** Les deux annonces existent et ne disent pas la même chose — l'écran doit le signaler. */
  divergent: boolean;
  titulaire: PeriodeAnnonce;
  candidat: PeriodeAnnonce;
}

/** Jour civil d'une date de base, en UTC. Les dates d'annonce sont stockées à minuit UTC ; les
 *  convertir dans le fuseau local reculerait d'un jour en Guadeloupe (UTC−4). */
export function jourISO(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Valide un jour civil reçu de l'écran et le rend au format attendu par les gabarits
 * (horodatage ISO à minuit UTC, comme `Date.toISOString()` le produisait jusqu'ici).
 *
 * Renvoie `null` pour toute valeur vide, mal formée ou inexistante au calendrier — un 31 février
 * ne doit pas ressortir en 3 mars dans un contrat signé.
 */
export function jourVersHorodatage(jour: string | null | undefined): string | null {
  if (!jour || !FORMAT_JOUR.test(jour)) return null;
  const d = new Date(`${jour}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  // Contrôle de réalité : `new Date("2026-02-31")` ne lève pas, il décale. On refuse le décalage.
  if (d.toISOString().slice(0, 10) !== jour) return null;
  const annee = d.getUTCFullYear();
  if (annee < 2000 || annee > 2100) return null;
  return d.toISOString();
}

/** Ce que porte une mission, réduit aux seules dates. Volontairement structurel : les deux routes
 *  chargent des `select` différents et n'ont pas à partager un type Prisma complet. */
type MissionDates = { startDate?: Date | null; endDate?: Date | null } | null | undefined;

/**
 * Période retenue par défaut, et de quoi l'expliquer à l'écran.
 *
 * La règle de repli est celle d'origine — l'annonce du titulaire d'abord, celle du candidat
 * ensuite — champ par champ : une annonce de cabinet peut porter un début sans fin, et la fin
 * du candidat reste alors la seule information disponible.
 */
export function periodeParDefaut(
  missionTitulaire: MissionDates,
  missionCandidat: MissionDates,
): PeriodeContrat {
  const titulaire: PeriodeAnnonce = {
    debut: jourISO(missionTitulaire?.startDate),
    fin: jourISO(missionTitulaire?.endDate),
  };
  const candidat: PeriodeAnnonce = {
    debut: jourISO(missionCandidat?.startDate),
    fin: jourISO(missionCandidat?.endDate),
  };

  const source = (a: string | null, b: string | null): SourcePeriode =>
    a !== null ? "TITULAIRE" : b !== null ? "CANDIDAT" : null;

  // Divergence : les deux annonces renseignent le même champ avec des valeurs différentes. Une
  // annonce muette ne diverge pas — elle ne dit rien, ce qui n'est pas la même chose que dire
  // autre chose. Cette nuance décide de l'affichage d'un avertissement à l'écran.
  const opposees = (a: string | null, b: string | null) => a !== null && b !== null && a !== b;

  return {
    debut: titulaire.debut ?? candidat.debut,
    fin: titulaire.fin ?? candidat.fin,
    sourceDebut: source(titulaire.debut, candidat.debut),
    sourceFin: source(titulaire.fin, candidat.fin),
    divergent: opposees(titulaire.debut, candidat.debut) || opposees(titulaire.fin, candidat.fin),
    titulaire,
    candidat,
  };
}

/**
 * Période effectivement portée au contrat : ce que l'écran a envoyé, à défaut le repli d'annonce.
 *
 * PARAMÈTRE ABSENT ≠ PARAMÈTRE VIDE. Absent, l'appelant n'a rien à dire sur les dates et le repli
 * s'applique. Vide, il dit explicitement « pas de date » — un remplacement sans terme convenu se
 * saisit ainsi, et le gabarit imprimera « [date à compléter] ». Confondre les deux rendrait
 * impossible d'effacer une date héritée d'une annonce.
 */
export function periodeDemandee(
  sp: URLSearchParams,
  defaut: PeriodeContrat,
): { debut: string | null; fin: string | null } {
  const lire = (cle: string, repli: string | null): string | null => {
    if (!sp.has(cle)) return jourVersHorodatage(repli);
    return jourVersHorodatage(sp.get(cle));
  };
  return {
    debut: lire("dateDebut", defaut.debut),
    fin: lire("dateFin", defaut.fin),
  };
}
