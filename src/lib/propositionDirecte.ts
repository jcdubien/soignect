import type { MissionType, ProfileType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { COMPTE_CONFRERE_EN_ATTENTE } from "@/lib/compteEnAttente";
import { assistantsRattaches, type ConfrereSaisi } from "@/lib/confrereHorsSoignect";
import { modesRedevanceAutorises, normaliserRetrocession } from "@/lib/retrocession";
import { createNotification } from "@/lib/notifications";
import { sendPropositionDirecteEmail } from "@/lib/email";
import { logTraceEventAttendu } from "@/lib/trace";

// PROPOSITION DIRECTE À UN CONFRÈRE DÉJÀ INSCRIT (25/11).
//
// Constaté le 24/11 : un titulaire ajoute « John Crevon » par le formulaire hors Soignect avec un
// email que John n'utilise pas sur Soignect. Le formulaire crée un SECOND compte ; à l'activation,
// John saisit son email habituel et se voit répondre « un compte existe déjà, connectez-vous » —
// mais connecté, il ne voit rien, la relation est sur l'autre compte. Il a fini par activer le
// doublon. Et il ne pouvait pas non plus candidater : l'annonce créée par ce formulaire est déjà
// pourvue, donc jamais dans le fil.
//
// Ce module ferme ce trou du côté du titulaire, AVANT la création : on cherche le confrère parmi
// les inscrits (email exact, ou prénom + nom quel que soit l'ordre et les accents). S'il existe,
// le titulaire peut lui proposer directement : l'annonce et la mise en relation sont créées sur
// SON compte, et il est prévenu (notification + email) — aucun compte n'est créé.

/** Types de profil à qui un cabinet propose un remplacement, un assistanat ou une collaboration. */
const TYPES_CANDIDATS: ProfileType[] = ["REMPLACANT", "ASSISTANT"];

const LIBELLE_TYPE: Record<MissionType, string> = {
  REMPLACEMENT: "un remplacement",
  ASSISTANAT: "un assistanat",
  COLLABORATION: "une collaboration",
};

function mots(s: string | null | undefined): string[] {
  return (s ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().split(/[^a-z]+/).filter(Boolean);
}

/** Le nom du profil contient-il le prénom ET le nom saisis, dans n'importe quel ordre ? « Crevon
 *  John » et « john crevon » répondent tous deux à John / Crevon. Les noms composés (« Le Mener »)
 *  se comparent mot à mot. */
export function memeNom(nomProfil: string | null | undefined, prenom: string, nom: string): boolean {
  const p = new Set(mots(nomProfil));
  const cherches = [...mots(prenom), ...mots(nom)];
  return cherches.length > 0 && cherches.every((m) => p.has(m));
}

export interface Inscrit {
  profileId: string;
  nom: string;
  photoUrl: string | null;
  type: ProfileType;
  /** Disponibilité publiée la plus proche — aide à reconnaître la bonne personne. */
  dispo: { startDate: string | null; endDate: string | null; minMonths: number | null } | null;
}

/** Confrères inscrits (compte activé, même profession) qui correspondent à la saisie. */
export async function chercherInscrits(
  titulaireProfileId: string,
  q: { prenom: string; nom: string; email?: string | null },
): Promise<Inscrit[]> {
  const titulaire = await prisma.profile.findUnique({ where: { id: titulaireProfileId }, select: { profession: true } });
  if (!titulaire) return [];
  const email = q.email?.trim().toLowerCase() || null;
  // Le volume reste petit (quelques centaines de profils par profession) : le filtre fin sur le
  // nom se fait ici, pour ignorer accents et ordre prénom/nom que SQL `contains` ne sait pas.
  const profils = await prisma.profile.findMany({
    where: {
      id: { not: titulaireProfileId },
      type: { in: TYPES_CANDIDATS },
      profession: titulaire.profession,
      user: { NOT: COMPTE_CONFRERE_EN_ATTENTE },
    },
    select: {
      id: true, name: true, photoUrl: true, type: true, user: { select: { email: true } },
      missions: {
        where: { isActive: true },
        orderBy: { startDate: "asc" },
        take: 1,
        select: { startDate: true, endDate: true, minMonths: true },
      },
    },
  });
  return profils
    .filter((p) => (email && p.user.email.toLowerCase() === email) || memeNom(p.name, q.prenom, q.nom))
    .slice(0, 5)
    .map((p) => ({
      profileId: p.id,
      nom: p.name ?? "",
      photoUrl: p.photoUrl,
      type: p.type,
      dispo: p.missions[0]
        ? { startDate: p.missions[0].startDate?.toISOString() ?? null, endDate: p.missions[0].endDate?.toISOString() ?? null, minMonths: p.missions[0].minMonths }
        : null,
    }));
}

/**
 * Proposition refusée (« Décliner ») ou expirée faute de réponse : l'annonce du titulaire, créée
 * pour CETTE proposition en `EN_ATTENTE`, ne doit pas rester au Planning au nom de quelqu'un qui
 * a dit non. Elle repasse en recherche — exactement ce que fait déjà la suppression d'une
 * relation (api/match DELETE) et ce qu'annonce le message d'expiration (« votre annonce est de
 * nouveau proposée »). Seules les briques `EN_ATTENTE` sont touchées : c'est le seul chemin qui
 * les écrit, une annonce en recherche ou signée n'est jamais modifiée ici.
 */
export async function libererPropositionClose(missionIds: (string | null | undefined)[]): Promise<void> {
  const ids = missionIds.filter((x): x is string => !!x);
  if (ids.length === 0) return;
  await prisma.mission.updateMany({
    where: { id: { in: ids }, briqueStatus: "EN_ATTENTE" },
    data: { briqueStatus: "RECHERCHE", matchedName: null, statusUpdatedAt: new Date() },
  });
}

export type ResultatProposition =
  | { ok: true; matchId: string; nom: string; email: "envoye" | "refuse" | "optout" }
  | { ok: false; status: number; error: string };

type SaisieProposition = Omit<ConfrereSaisi, "prenom" | "nom" | "email" | "rpps" | "numeroOrdre" | "adresse">;

const jour = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });

export async function proposerAInscrit(
  titulaireProfileId: string,
  inscritProfileId: string,
  s: SaisieProposition,
): Promise<ResultatProposition> {
  const titulaire = await prisma.profile.findUnique({
    where: { id: titulaireProfileId },
    select: { id: true, name: true, type: true, titulaireKind: true, profession: true, territoire: true },
  });
  if (!titulaire || titulaire.type !== "TITULAIRE" || titulaire.titulaireKind === "STRUCTURE") {
    return { ok: false, status: 403, error: "Réservé aux cabinets libéraux." };
  }
  // Mêmes conditions que la recherche : on ne propose qu'à quelqu'un que la recherche aurait montré.
  const inscrit = await prisma.profile.findFirst({
    where: {
      id: inscritProfileId,
      type: { in: TYPES_CANDIDATS },
      profession: titulaire.profession,
      user: { NOT: COMPTE_CONFRERE_EN_ATTENTE },
    },
    select: { id: true, name: true, user: { select: { id: true, email: true, emailOptIn: true } } },
  });
  if (!inscrit) return { ok: false, status: 404, error: "Ce confrère n'est pas (ou plus) inscrit sur Soignect." };

  const remplacement = s.missionType === "REMPLACEMENT";
  let remplace: { postId: string; profileId: string; nom: string } | null = null;
  if (s.remplacePostId) {
    if (!remplacement) return { ok: false, status: 400, error: "Seul un remplacement peut concerner un de vos assistants." };
    remplace = (await assistantsRattaches(titulaire.id)).find((a) => a.postId === s.remplacePostId) ?? null;
    if (!remplace) return { ok: false, status: 400, error: "Ce poste n'a pas d'assistant rattaché à votre cabinet." };
  }

  // Double envoi (double clic, ou formulaire renvoyé) : même confrère, même type, même début, et
  // une relation encore vivante — on ne recrée rien.
  const deja = await prisma.match.findFirst({
    where: {
      profileAId: titulaire.id, profileBId: inscrit.id,
      status: { in: ["EN_ATTENTE", "DISCUSSION", "CONFIRME"] },
      missionA: { missionType: s.missionType, startDate: s.startDate },
    },
    select: { id: true },
  });
  if (deja) return { ok: false, status: 409, error: "Vous lui avez déjà proposé ces dates : la mise en relation est en cours." };

  // Sa disponibilité correspondante, s'il en a publié une : la relation s'y rattache, comme après
  // un intérêt réciproque. Sinon la relation reste rattachée à son seul profil (missionB null).
  const dispo = await prisma.mission.findFirst({
    where: {
      profileId: inscrit.id, isActive: true, missionType: s.missionType,
      ...(remplacement && s.endDate
        ? { startDate: { lte: s.endDate }, OR: [{ endDate: null }, { endDate: { gte: s.startDate } }] }
        : {}),
    },
    orderBy: { startDate: "asc" },
    select: { id: true },
  });

  const nom = inscrit.name ?? "Votre confrère";
  const matchId = await prisma.$transaction(async (tx) => {
    const mission = await tx.mission.create({
      data: {
        profileId: titulaire.id,
        territoire: titulaire.territoire,
        // Titre SANS le nom du confrère : si la relation est annulée, l'annonce repasse en
        // recherche (api/match DELETE) et paraît dans le fil — elle doit s'y lire comme une offre.
        title: `${remplacement ? "Remplacement" : s.missionType === "ASSISTANAT" ? "Assistanat" : "Collaboration"} — ${s.location}`.slice(0, 100),
        location: s.location,
        missionType: s.missionType,
        startDate: s.startDate,
        endDate: remplacement ? s.endDate : null,
        minMonths: remplacement ? null : s.minMonths,
        retrocessionRate: s.retrocessionRate,
        ...normaliserRetrocession(modesRedevanceAutorises(s.missionType, false, titulaire.profession), s.retrocessionMode, s.retrocessionFixeEuros, s.retrocessionPlafondEuros),
        isActive: true,
        // Proposée, pas encore acceptée : « En attente » au Planning, jamais une offre du fil
        // (EST_UNE_OFFRE exige RECHERCHE). Passe à CONFIRME à la double signature (relationConclue).
        briqueStatus: "EN_ATTENTE",
        statusUpdatedAt: new Date(),
        matchedName: nom.slice(0, 120),
        cabinetPostId: remplace?.postId ?? null,
        autoPostFacebook: false,
      },
      select: { id: true },
    });
    const m = await tx.match.create({
      data: {
        profileAId: titulaire.id, profileBId: inscrit.id,
        missionAId: mission.id, missionBId: dispo?.id ?? null,
        remplaceProfileId: remplace?.profileId ?? null,
      },
      select: { id: true },
    });
    return m.id;
  });

  await logTraceEventAttendu({
    eventType: "MATCH_CREATED", matchId, profileId: titulaire.id, commune: s.location,
    missionType: s.missionType, profession: titulaire.profession,
    metadata: { origine: "proposition_directe", surSaDispo: !!dispo },
  });

  const cabinet = titulaire.name || "Un cabinet";
  const periode = remplacement && s.endDate
    ? `du ${jour(s.startDate)} au ${jour(s.endDate)}`
    : `à partir du ${jour(s.startDate)}${s.minMonths ? ` (${s.minMonths} mois minimum)` : ""}`;
  const quoi = `${LIBELLE_TYPE[s.missionType]} à ${s.location} ${periode}`;
  await createNotification({
    userId: inscrit.user.id, type: "match",
    message: `${cabinet} vous propose ${quoi}.`,
    linkUrl: `/match/${matchId}`,
  });
  if (remplace) {
    const u = await prisma.profile.findUnique({ where: { id: remplace.profileId }, select: { userId: true } });
    await createNotification({ userId: u?.userId, type: "signature", message: `Votre remplacement par ${nom} : le contrat est à relire et à signer, en tant que remplacé.`, linkUrl: `/match/${matchId}/contrat` });
  }
  const email = await sendPropositionDirecteEmail(inscrit.user.email, {
    cabinetName: titulaire.name, objet: LIBELLE_TYPE[s.missionType], quoi, matchId, optIn: inscrit.user.emailOptIn,
  });
  return { ok: true, matchId, nom, email };
}
