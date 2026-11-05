// Ce que j'ai écarté de mon fil (04/11, ROADMAP « Annuler un pass »).
//
// Le bouton « Annuler ce choix » existe depuis le 01/09 (section 218), sur la fiche d'une annonce
// passée. Mais on n'atteignait cette fiche que par le bandeau des cinq dernières annonces
// consultées ou par un lien reçu : un pass d'il y a quelques jours ne se rattrapait plus. Cette
// liste est le chemin qui manquait — dans les deux sens : annonces passées par un candidat,
// candidats passés (ou déclinés depuis « Vous attendent ») par un recruteur.
//
// Seulement ce qui est encore OUVERT : remettre dans le fil une annonce échue ou pourvue ne la
// ferait pas réapparaître. Mêmes filtres de camp et de profession que « Vos choix » (/api/tray).

import { prisma } from "@/lib/prisma";
import { SwipeDirection } from "@prisma/client";
import { offreOuverteLe } from "@/lib/feedFilters";
import { swipeExploitable } from "@/lib/camp";
import { memeMarche } from "@/lib/professions";
import { libelleTypePoste } from "@/lib/libellesPoste";
import { periodePoste } from "@/lib/datesPoste";

export interface LigneEcartee {
  missionId: string;
  nom: string;
  titre: string;
  typePoste: string;
  periode: string | null;
  lieu: string | null;
  ecarteLe: string;
}

/** Au plus autant de lignes : au-delà, personne ne cherche plus un geste à défaire. */
const PLAFOND = 100;

export async function annoncesEcartees(profileId: string): Promise<LigneEcartee[]> {
  const moi = await prisma.profile.findUnique({ where: { id: profileId }, select: { type: true, profession: true } });
  if (!moi) return [];
  const swipes = await prisma.swipe.findMany({
    where: { swiperId: profileId, direction: SwipeDirection.LEFT, swipedMission: offreOuverteLe(new Date()) },
    orderBy: { createdAt: "desc" },
    take: PLAFOND,
    select: {
      createdAt: true,
      swipedMission: {
        select: {
          id: true, title: true, missionType: true, natureSalariat: true, startDate: true, endDate: true, location: true,
          profile: { select: { name: true, type: true, titulaireKind: true, profession: true } },
        },
      },
    },
  });
  return swipes
    .filter((s) => swipeExploitable(moi.type, s.swipedMission.profile.type) && memeMarche(moi.profession, s.swipedMission.profile.profession))
    .map(({ createdAt, swipedMission: m }) => ({
      missionId: m.id,
      nom: m.profile.name ?? "Sans nom",
      titre: m.title,
      typePoste: libelleTypePoste(m.missionType, m.profile, m.natureSalariat),
      periode: periodePoste(m.startDate, m.endDate),
      lieu: m.location,
      ecarteLe: createdAt.toISOString(),
    }));
}
