// « Mes contrats » (04/11, ROADMAP « Espace Mes contrats ») — la liste des contrats d'une personne.
//
// UN CONTRAT N'EST PAS UN FICHIER. C'est une mise en relation qui porte au moins une signature :
// les signatures et, depuis le 27/10, les termes figés à la première (`termesContrat`) ; le PDF se
// régénère à chaque téléchargement. Il n'y avait donc rien à « persister » — il manquait l'endroit
// où les retrouver : un contrat signé des deux côtés SORT de /matches (section 183) et ne
// s'atteignait plus que par le Planning.
//
// Périmètre : les relations où je suis partie OU le remplacé désigné, avec au moins une signature.
// Une annulation (section 248) efface les signatures : le contrat annulé quitte la liste.

import { prisma } from "@/lib/prisma";
import { cotesDuMatch, coteDeSignature } from "@/lib/contrats/cotes";
import { libelleTypePoste } from "@/lib/libellesPoste";
import { periodePoste } from "@/lib/datesPoste";

export type EtatContrat = "A_SIGNER" | "ATTENTE_AUTRE" | "SIGNE" | "SUIVI";

export interface LigneContrat {
  matchId: string;
  etat: EtatContrat;
  /** L'autre partie, telle que je la vois. */
  avec: string;
  typePoste: string;
  periode: string | null;
  lieu: string | null;
  /** Date de la dernière signature posée. */
  derniereSignature: string;
  /** Qui doit encore signer, quand ce n'est pas moi. */
  attenduDe: string | null;
}

export const LIBELLES_ETAT: Record<EtatContrat, string> = {
  A_SIGNER: "À signer",
  ATTENTE_AUTRE: "En attente de l'autre signature",
  SIGNE: "Signé des deux côtés",
  SUIVI: "Signature en cours entre le remplacé et le remplaçant",
};

/** Ordre d'affichage : ce qui attend un geste de ma part d'abord. */
const ORDRE: EtatContrat[] = ["A_SIGNER", "ATTENTE_AUTRE", "SUIVI", "SIGNE"];

export async function mesContrats(profileId: string): Promise<LigneContrat[]> {
  const profil = { select: { id: true, name: true, type: true, titulaireKind: true } } as const;
  const mission = { select: { missionType: true, natureSalariat: true, startDate: true, endDate: true, location: true } } as const;
  const matches = await prisma.match.findMany({
    where: {
      AND: [
        { OR: [{ profileAId: profileId }, { profileBId: profileId }, { remplaceProfileId: profileId }] },
        { OR: [{ signatureTitulaireAt: { not: null } }, { signatureRemplacantAt: { not: null } }] },
      ],
    },
    select: {
      id: true, profileAId: true, profileBId: true, remplaceProfileId: true,
      signatureTitulaireAt: true, signatureRemplacantAt: true,
      profileA: profil, profileB: profil, remplace: { select: { name: true } },
      missionA: mission, missionB: mission,
    },
    orderBy: { createdAt: "desc" },
  });

  return matches
    .map((m): LigneContrat => {
      const c = cotesDuMatch(m);
      const poste = c.missionTitulaire ?? c.missionCandidat;
      const cote = coteDeSignature(m, profileId);
      // Celui qui signe côté titulaire : le remplacé désigné, sinon le titulaire du compte.
      const signataireTitulaire = m.remplace?.name ?? c.profilTitulaire.name ?? "le cabinet";
      const candidat = c.profilCandidat.name ?? "le candidat";
      const avec = cote === "remplacant" ? signataireTitulaire : candidat;
      const deux = !!m.signatureTitulaireAt && !!m.signatureRemplacantAt;
      const etat: EtatContrat = deux ? "SIGNE"
        : cote === null ? "SUIVI"
        : (cote === "titulaire" ? m.signatureTitulaireAt : m.signatureRemplacantAt) ? "ATTENTE_AUTRE"
        : "A_SIGNER";
      const attenduDe = deux ? null
        : !m.signatureTitulaireAt ? (cote === "titulaire" ? null : signataireTitulaire)
        : (cote === "remplacant" ? null : candidat);
      const dates = [m.signatureTitulaireAt, m.signatureRemplacantAt].filter((d): d is Date => !!d);
      return {
        matchId: m.id,
        etat,
        avec,
        typePoste: poste ? libelleTypePoste(poste.missionType, c.profilTitulaire, poste.natureSalariat) : "Contrat",
        periode: poste ? periodePoste(poste.startDate, poste.endDate) : null,
        lieu: poste?.location ?? null,
        derniereSignature: new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString(),
        attenduDe,
      };
    })
    .sort((a, b) => ORDRE.indexOf(a.etat) - ORDRE.indexOf(b.etat) || b.derniereSignature.localeCompare(a.derniereSignature));
}
