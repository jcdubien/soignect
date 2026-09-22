// État d'une mise en relation (section 258).
//
// ── POURQUOI CE FICHIER ──────────────────────────────────────────────────────────────────────
//
// « Le contrat est-il signé des deux côtés ? » n'a pas de colonne en base. La question se dérive
// du `briqueStatus` des deux missions attachées au match — et cette dérivation était écrite TROIS
// fois à l'identique avant d'être extraite ici : dans la route d'annulation, dans le fil « Vos
// choix », et dans la trace. Deux appelants de plus arrivaient avec le bouton d'annulation du
// chat ; c'était le moment de ne pas en faire cinq.
//
// Ce n'est pas une préférence de style. Cette expression commande un REFUS — elle décide si une
// annulation part ou non. Écrite en cinq exemplaires, il aurait suffi qu'une seule oublie l'un
// des deux côtés pour qu'un écran autorise ce qu'un autre interdit, sur le même match.

/** Les deux missions d'un match, telles que toutes les requêtes concernées les chargent déjà. */
interface MatchAvecMissions {
  missionA?: { briqueStatus?: string | null } | null;
  missionB?: { briqueStatus?: string | null } | null;
}

/**
 * Le contrat de ce match est-il confirmé, c'est-à-dire signé des deux côtés ?
 *
 * UN SEUL CÔTÉ SUFFIT À RÉPONDRE OUI, et ce n'est pas une approximation : `CONFIRME` est posé sur
 * les deux missions au même moment, à la signature. Tester les deux en ET aurait rendu le refus
 * dépendant d'une mission éventuellement absente — un match peut n'en porter qu'une.
 */
export function contratConfirme(match: MatchAvecMissions | null | undefined): boolean {
  if (!match) return false;
  return match.missionA?.briqueStatus === "CONFIRME" || match.missionB?.briqueStatus === "CONFIRME";
}
