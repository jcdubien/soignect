// Dates d'un poste à l'affichage public (20/10) — une seule règle pour la page client et le
// module embarqué.
//
// L'année s'écrit quand elle n'est pas celle en cours, ou quand le poste commence dans plus de
// six mois : « 22 oct. → 2 nov. » se lit sans ambiguïté en octobre, pas « 3 mai » vu en
// octobre. Dans une période, l'année ne s'écrit qu'une fois, à la fin, si les deux bornes la
// partagent : « 22 oct. → 2 nov. 2027 », « 28 déc. 2026 → 3 janv. 2027 ».
//
// Les dates sont stockées à 00:00 UTC : formatées à l'heure locale (Guadeloupe, UTC−4), elles
// reculeraient d'un jour.

const SIX_MOIS_MS = 182 * 24 * 3600 * 1000;

function fmt(d: Date, annee: boolean): string {
  return d.toLocaleDateString("fr-FR", {
    day: "numeric", month: "short", ...(annee ? { year: "numeric" } : {}), timeZone: "UTC",
  });
}

/** L'année doit-elle s'écrire pour un poste qui commence à `debut` ? */
export function anneeUtile(debut: Date, fin: Date | null = null, maintenant: Date = new Date()): boolean {
  const an = maintenant.getUTCFullYear();
  return debut.getUTCFullYear() !== an
    || (fin !== null && fin.getUTCFullYear() !== an)
    || debut.getTime() - maintenant.getTime() > SIX_MOIS_MS;
}

/** « 22 oct. → 2 nov. », « dès le 30 nov. », « 28 déc. 2026 → 3 janv. 2027 »… — null sans date. */
export function periodePoste(
  debut: Date | null, fin: Date | null, maintenant: Date = new Date(),
): string | null {
  if (!debut) return null;
  const d = new Date(debut);
  const f = fin ? new Date(fin) : null;
  const annee = anneeUtile(d, f, maintenant);
  if (!f) return `dès le ${fmt(d, annee)}`;
  const memeAnnee = d.getUTCFullYear() === f.getUTCFullYear();
  return `${fmt(d, annee && !memeAnnee)} → ${fmt(f, annee)}`;
}
