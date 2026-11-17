// Dates d'un contrat SIGNÉ, qui priment sur celles de l'annonce (décision de Jean-Charles, 17/11 :
// « respecte toujours les dates du contrat »).
//
// Constaté le 17/11 : l'annonce « 2 kinés remplaçants » couvrait le 21/12 → 16/01, le contrat signé
// avec Mauchant le 04/01 → 16/01. Le Planning posait la brique sur les dates de l'annonce : le
// remplaçant y paraissait en place deux semaines avant son contrat, et ces deux semaines ne
// ressortaient pas comme non couvertes.
//
// Source : `Match.termesContrat`, la chaîne figée à la première signature (lib/contrats/termes),
// lue seulement quand les DEUX parties ont signé — avant, ce n'est pas encore un contrat.
// Une date vide au contrat (« [date à compléter] ») ne remplace rien : l'annonce reste la seule
// indication disponible.

export interface MatchSigne {
  termesContrat?: string | null;
  signatureTitulaireAt?: Date | string | null;
  signatureRemplacantAt?: Date | string | null;
}

function jour(v: string | null): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Dates portées par des termes figés — ce que signent les parties, dès la première signature. */
export function datesDesTermes(termes: string | null | undefined): { debut: Date | null; fin: Date | null } {
  if (!termes) return { debut: null, fin: null };
  const p = new URLSearchParams(termes);
  return { debut: jour(p.get("dateDebut")), fin: jour(p.get("dateFin")) };
}

/**
 * Période couverte par les contrats signés d'une annonce. Une annonce peut en porter plusieurs
 * (« 2 kinés ») : on prend l'enveloppe — début le plus tôt, fin la plus tardive. `null` si aucun
 * contrat signé ne donne de date.
 */
export function periodeDesContratsSignes(matches: MatchSigne[]): { debut: Date | null; fin: Date | null } | null {
  let debut: Date | null = null;
  let fin: Date | null = null;
  for (const m of matches) {
    if (!m.termesContrat || !m.signatureTitulaireAt || !m.signatureRemplacantAt) continue;
    const { debut: d, fin: f } = datesDesTermes(m.termesContrat);
    if (d && (!debut || d < debut)) debut = d;
    if (f && (!fin || f > fin)) fin = f;
  }
  return debut || fin ? { debut, fin } : null;
}

/** L'annonce avec les dates de ses contrats signés à la place des siennes, quand il y en a. */
export function avecDatesDuContrat<T extends { startDate: Date | null; endDate: Date | null }>(
  mission: T,
  matches: MatchSigne[],
): T {
  const p = periodeDesContratsSignes(matches);
  if (!p) return mission;
  return { ...mission, startDate: p.debut ?? mission.startDate, endDate: p.fin ?? mission.endDate };
}
