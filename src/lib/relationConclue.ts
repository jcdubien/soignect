import { prisma } from "@/lib/prisma";
import { BriqueStatus, MatchStatus } from "@prisma/client";
import { attachAssistantPostForMatch } from "@/lib/assistantPost";

// Une mise en relation CONCLUE (16/10, décision de Jean-Charles).
//
// ── LA RÈGLE ─────────────────────────────────────────────────────────────────────────────────
//
// « Une annonce devrait être libre jusqu'à signature. » La signature peut avoir lieu dans
// Soignect (double signature photo du contrat généré) ou en dehors. Les deux chemins mènent ICI,
// et c'est tout l'objet de ce fichier : ce qu'une conclusion change ne s'écrit qu'une fois.
//
// ── POURQUOI UN SECOND CHEMIN ────────────────────────────────────────────────────────────────
//
// La signature dans Soignect n'est pas accessible à tous : le contrat PDF est réservé aux
// abonnés, trois postes salariés sur quatre n'ont pas encore de modèle, et le contrat d'un
// aide-soignant est par nature celui de l'employeur. Mesuré le 16/10 : 1 contrat signé des deux
// côtés dans Soignect, 11 accords passés par l'ancien bouton « Confirmer », qui ne fermait rien.
// Sans second chemin, l'annonce de tous ces recruteurs restait ouverte indéfiniment.
//
// ── CE QU'UNE CONCLUSION CHANGE ──────────────────────────────────────────────────────────────
//
//   · les deux missions du match passent en `CONFIRME` (avec le nom de l'autre partie) :
//     l'annonce sort du fil, de sa page publique, du module CPTS (`EST_UNE_OFFRE` exige
//     `RECHERCHE`), et les dates du candidat sont occupées — la vérification de planning le
//     voit pris (lib/disponibiliteSurPeriode) ;
//   · le match passe en `CONFIRME` ;
//   · un poste d'assistanat est rattaché à l'assistant (section 153).
//
// Ce qui N'en fait PAS partie, et reste à l'appelant : la facturation et la trace du contrat
// signé. Décision du 16/10 : une signature déclarée hors Soignect ne compte pas comme un
// contrat facturé — la déclaration doit rester sans coût pour être faite.

export async function conclureRelation(matchId: string, maintenant: Date = new Date()): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      missionAId: true, missionBId: true,
      profileA: { select: { name: true } },
      profileB: { select: { name: true } },
    },
  });
  if (!match) return;
  // Le poste de A est rempli par B, et inversement (section 1c / 6).
  if (match.missionAId) {
    await prisma.mission.update({
      where: { id: match.missionAId },
      data: { briqueStatus: BriqueStatus.CONFIRME, statusUpdatedAt: maintenant, matchedName: match.profileB?.name ?? null },
    });
  }
  if (match.missionBId) {
    await prisma.mission.update({
      where: { id: match.missionBId },
      data: { briqueStatus: BriqueStatus.CONFIRME, statusUpdatedAt: maintenant, matchedName: match.profileA?.name ?? null },
    });
  }
  await prisma.match.update({ where: { id: matchId }, data: { status: MatchStatus.CONFIRME } });
  // Non bloquant : le helper avale ses erreurs, et ne fait rien hors assistanat.
  await attachAssistantPostForMatch(matchId);
}

/** Le recruteur d'une mise en relation : la partie TITULAIRE — cabinet ou établissement. C'est
 *  le côté qui signe le slot « titulaire » du contrat, et celui dont l'annonce se ferme. */
export function estRecruteur(type: string | null | undefined): boolean {
  return type === "TITULAIRE";
}
