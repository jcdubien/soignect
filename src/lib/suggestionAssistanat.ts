import { prisma } from "@/lib/prisma";
import { MissionType, ProfileType, SwipeDirection, TitulaireKind } from "@prisma/client";
import { contratFourniParEmployeur } from "@/lib/contrats/gabaritsSalarie";

// Section 191 — Repérer les remplaçants qui manifestent déjà un intérêt pour le long terme.
//
// LE SIGNAL EST OBSERVÉ, PAS DEVINÉ. On ne cherche pas qui « pourrait vouloir se poser » :
// on regarde qui a DÉJÀ dit oui à des postes d'assistanat ou de collaboration. Sur les données
// réelles, un remplaçant avait swipé à droite sur trois postes long terme en six swipes —
// la moitié de son activité — sans que rien ne le lui renvoie.
//
// L'hypothèse de départ (« repérer ceux qui n'ont jamais consulté d'assistanat ») ne tenait
// pas : le feed ne filtre pas par type de mission, tous les candidats voient déjà ces postes,
// et les deux remplaçants en base en avaient déjà swipé. Le manque n'est pas la découverte,
// c'est que l'intérêt exprimé ne mène nulle part.
export const SEUIL_INTERETS = 2;

export interface SignalAssistanat {
  interets: number;
  // Le seuil compte l'assistanat ET la collaboration, mais le bandeau ne doit nommer que ce qui
  // s'est réellement produit : dire « ou de collaboration » à quelqu'un qui n'a swipé que des
  // assistanats lui décrit une action qu'il n'a pas faite.
  //
  // Même règle pour le salariat : un kiné qui n'a retenu que des CDI d'établissement se voyait
  // parler d'« assistanat ou collaboration ». Un poste est dit salarié s'il est publié comme tel
  // (`estSalariat`) ou par un établissement — ce dernier ne propose jamais de poste libéral.
  avecAssistanat: boolean;
  avecCollaboration: boolean;
  avecSalariat: boolean;
  // Profession salariée seulement (section 304) : les postes retenus sont des CDI, et le bandeau
  // parle de « postes durables », pas d'assistanat.
  salarie: boolean;
}

export async function suggestionAssistanat(profileId: string): Promise<SignalAssistanat | null> {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { type: true, profession: true, suggestionAssistanatVueAt: true },
  });
  // Un assistant n'a rien à découvrir ici, et une suggestion écartée le reste (colonne portée
  // par le Profile, donc d'un appareil à l'autre).
  if (!profile || profile.type !== ProfileType.REMPLACANT) return null;
  if (profile.suggestionAssistanatVueAt) return null;
  const salarie = contratFourniParEmployeur(profile.profession);

  const swipes = await prisma.swipe.findMany({
    where: {
      swiperId: profileId,
      direction: SwipeDirection.RIGHT,
      // Un aide-soignant ne voit que des établissements : leur CDI est rangé en COLLABORATION, et
      // un ancien CDD en ASSISTANAT ne dit pas « poste durable ».
      swipedMission: {
        missionType: {
          in: salarie ? [MissionType.COLLABORATION] : [MissionType.ASSISTANAT, MissionType.COLLABORATION],
        },
      },
    },
    select: {
      swipedMission: {
        select: { missionType: true, estSalariat: true, profile: { select: { titulaireKind: true } } },
      },
    },
  });
  if (swipes.length < SEUIL_INTERETS) return null;
  const estSalarie = (m: (typeof swipes)[number]["swipedMission"]) =>
    m.estSalariat || m.profile.titulaireKind === TitulaireKind.STRUCTURE;
  const liberaux = swipes.map((s) => s.swipedMission).filter((m) => !estSalarie(m));
  return {
    interets: swipes.length,
    avecAssistanat: liberaux.some((m) => m.missionType === MissionType.ASSISTANAT),
    avecCollaboration: liberaux.some((m) => m.missionType === MissionType.COLLABORATION),
    avecSalariat: liberaux.length < swipes.length,
    salarie,
  };
}
