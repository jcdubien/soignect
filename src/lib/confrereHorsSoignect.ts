import { randomBytes } from "crypto";
import { hash } from "bcryptjs";
import type { MissionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appBaseUrl } from "@/lib/appUrl";
import { logTraceEventAttendu } from "@/lib/trace";
import { modesRedevanceAutorises, normaliserRetrocession } from "@/lib/retrocession";
import type { RetrocessionMode } from "@prisma/client";

// Confrère trouvé HORS Soignect, ajouté « à la volée » (24/10) — un titulaire a déjà convenu d'un
// remplacement ou d'un assistanat en dehors de la plateforme et veut s'en servir pour le contrat.
//
// Ce que fait la création, en UNE transaction :
//   · un compte au nom du confrère, SANS mot de passe utilisable et SANS consentement : il ne peut
//     ni se connecter ni être compté comme inscrit tant qu'il n'a pas activé le compte lui-même
//     (lien d'activation, où il choisit son mot de passe et accepte les conditions) ;
//   · une annonce du titulaire déjà pourvue (briqueStatus OCCUPE ou CONFIRME : jamais dans le fil,
//     visible dans son Planning) ;
//   · une mise en relation confirmée entre les deux — la page contrat existante fonctionne alors
//     telle quelle (clauses, brouillon, signatures, PDF).
// Aucun email n'est envoyé : le titulaire partage lui-même le lien d'activation.
// Un email déjà inscrit est refusé : on ne rattache rien à un compte existant sans son titulaire.

/** Durée de validité du lien d'activation — les premiers cas visent une arrivée en janvier. */
export const ACTIVATION_JOURS = 90;

export const LIMITES_CONFRERE = { prenom: 60, nom: 60, rpps: 20, numeroOrdre: 30, adresse: 200 } as const;

export interface ConfrereSaisi {
  prenom: string;
  nom: string;
  /** Facultatif : sans lui, le confrère saisit son email à l'activation. */
  email?: string | null;
  missionType: MissionType;
  startDate: Date;
  endDate: Date | null;
  minMonths: number | null;
  retrocessionRate: number;
  /** Mode de la redevance (section 296) — assistanat/collaboration libéral hors infirmier ;
   *  ramené à POURCENTAGE ailleurs. */
  retrocessionMode?: RetrocessionMode | null;
  retrocessionFixeEuros?: number | null;
  retrocessionPlafondEuros?: number | null;
  location: string;
  rpps?: string | null;
  numeroOrdre?: string | null;
  adresse?: string | null;
}

/** Email provisoire quand le titulaire n'a pas saisi celui du confrère (24/10, « juste un lien ») :
 *  le confrère donne le sien à l'activation. Domaine réservé `.local` — jamais une boîte réelle, et
 *  distinct du `.invalid` des comptes d'essai (purgés). Aucun email n'est envoyé à ces comptes
 *  (emailOptIn false jusqu'à l'activation). */
export const DOMAINE_EMAIL_ATTENTE = "activation.soignect.local";
export function emailProvisoire(email: string): boolean {
  return email.endsWith(`@${DOMAINE_EMAIL_ATTENTE}`);
}

export function lienActivation(token: string): string {
  return `${appBaseUrl()}/activer/${token}`;
}

const LIBELLE_TYPE: Record<MissionType, string> = {
  REMPLACEMENT: "Remplacement",
  ASSISTANAT: "Assistanat",
  COLLABORATION: "Collaboration",
};

export type ResultatCreation =
  | { ok: true; matchId: string; lien: string }
  | { ok: false; status: number; error: string };

export async function creerConfrereHorsSoignect(titulaireProfileId: string, s: ConfrereSaisi): Promise<ResultatCreation> {
  const titulaire = await prisma.profile.findUnique({ where: { id: titulaireProfileId }, select: { id: true, type: true, titulaireKind: true, profession: true } });
  if (!titulaire || titulaire.type !== "TITULAIRE" || titulaire.titulaireKind === "STRUCTURE") {
    return { ok: false, status: 403, error: "Réservé aux cabinets libéraux." };
  }
  const token = randomBytes(32).toString("hex");
  const email = s.email?.trim() ? s.email.toLowerCase().trim() : `attente-${token.slice(0, 20)}@${DOMAINE_EMAIL_ATTENTE}`;
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return { ok: false, status: 409, error: "Un compte Soignect existe déjà pour cet email : ce confrère peut vous retrouver depuis son compte." };
  }
  // Mot de passe inutilisable : personne ne le connaît, il est remplacé à l'activation.
  const passwordHash = await hash(randomBytes(32).toString("hex"), 12);
  const nomComplet = `${s.prenom.trim()} ${s.nom.trim()}`;
  const remplacement = s.missionType === "REMPLACEMENT";

  const matchId = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        email, passwordHash, emailOptIn: false,
        resetToken: token, resetTokenExpiry: new Date(Date.now() + ACTIVATION_JOURS * 86_400_000),
        profile: {
          create: {
            type: remplacement ? "REMPLACANT" : "ASSISTANT",
            profession: titulaire.profession,
            name: nomComplet,
            rpps: s.rpps?.trim() || null,
            numeroOrdre: s.numeroOrdre?.trim() || null,
            adresse: s.adresse?.trim() || null,
          },
        },
      },
      select: { profile: { select: { id: true } } },
    });
    const mission = await tx.mission.create({
      data: {
        profileId: titulaire.id,
        title: `${LIBELLE_TYPE[s.missionType]} — ${nomComplet}`.slice(0, 100),
        location: s.location,
        missionType: s.missionType,
        startDate: s.startDate,
        endDate: remplacement ? s.endDate : null,
        minMonths: remplacement ? null : s.minMonths,
        retrocessionRate: s.retrocessionRate,
        ...normaliserRetrocession(modesRedevanceAutorises(s.missionType, false, titulaire.profession), s.retrocessionMode, s.retrocessionFixeEuros, s.retrocessionPlafondEuros),
        isActive: true,
        // Déjà pourvue : jamais une offre (EST_UNE_OFFRE exige RECHERCHE), mais présente au Planning.
        briqueStatus: remplacement ? "CONFIRME" : "OCCUPE",
        matchedName: nomComplet.slice(0, 120),
      },
      select: { id: true },
    });
    const m = await tx.match.create({
      data: { profileAId: titulaire.id, profileBId: u.profile!.id, missionAId: mission.id, status: "CONFIRME", horsSoignect: true },
      select: { id: true },
    });
    return m.id;
  });

  // Sans nom ni email : le type et la profession suffisent à compter l'usage.
  await logTraceEventAttendu({ eventType: "CONFRERE_HORS_SOIGNECT", profileId: titulaire.id, profession: titulaire.profession, metadata: { etape: "ajout", missionType: s.missionType } });
  return { ok: true, matchId, lien: lienActivation(token) };
}

/** Les confrères ajoutés par ce titulaire, activés ou non — avec le lien tant qu'il est en attente. */
export async function confreresAjoutes(titulaireProfileId: string) {
  const matches = await prisma.match.findMany({
    where: { profileAId: titulaireProfileId, horsSoignect: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, createdAt: true, signatureTitulaireAt: true, signatureRemplacantAt: true,
      missionA: { select: { missionType: true, startDate: true, endDate: true, minMonths: true } },
      profileB: { select: { name: true, user: { select: { acceptedTermsAt: true, resetToken: true, resetTokenExpiry: true } } } },
    },
  });
  return matches
    .filter((m) => m.profileB.user)
    .map((m) => {
      const u = m.profileB.user!;
      const enAttente = !u.acceptedTermsAt;
      const lienValide = enAttente && u.resetToken && u.resetTokenExpiry && u.resetTokenExpiry > new Date();
      return {
        matchId: m.id,
        nom: m.profileB.name ?? "",
        missionType: m.missionA!.missionType,
        startDate: m.missionA!.startDate?.toISOString() ?? null,
        endDate: m.missionA!.endDate?.toISOString() ?? null,
        minMonths: m.missionA!.minMonths,
        active: !enAttente,
        lien: lienValide ? lienActivation(u.resetToken!) : null,
        signeTitulaire: !!m.signatureTitulaireAt,
        signeConfrere: !!m.signatureRemplacantAt,
      };
    });
}

/** Nouveau lien d'activation pour un confrère encore en attente (l'ancien cesse de fonctionner). */
export async function nouveauLien(titulaireProfileId: string, matchId: string): Promise<string | null> {
  const m = await prisma.match.findUnique({ where: { id: matchId }, select: { profileAId: true, horsSoignect: true, profileB: { select: { userId: true, user: { select: { acceptedTermsAt: true } } } } } });
  if (!m || !m.horsSoignect || m.profileAId !== titulaireProfileId || !m.profileB.user || m.profileB.user.acceptedTermsAt) return null;
  const token = randomBytes(32).toString("hex");
  await prisma.user.update({ where: { id: m.profileB.userId }, data: { resetToken: token, resetTokenExpiry: new Date(Date.now() + ACTIVATION_JOURS * 86_400_000) } });
  return lienActivation(token);
}

/** Ce que voit le confrère sur la page d'activation — rien si le lien est invalide, expiré ou déjà utilisé. */
export async function activationEnAttente(token: string) {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const u = await prisma.user.findFirst({
    where: { resetToken: token, resetTokenExpiry: { gt: new Date() }, acceptedTermsAt: null },
    select: { id: true, email: true, profile: { select: { name: true, matchesB: { where: { horsSoignect: true }, take: 1, orderBy: { createdAt: "asc" }, select: { id: true, profileA: { select: { name: true } }, missionA: { select: { missionType: true } } } } } } },
  });
  const m = u?.profile?.matchesB[0];
  if (!u || !m) return null;
  return { userId: u.id, email: emailProvisoire(u.email) ? null : u.email, nom: u.profile!.name ?? "", titulaire: m.profileA.name ?? "Votre confrère", missionType: m.missionA?.missionType ?? null, matchId: m.id };
}

/** Activation par le confrère lui-même : son email (il peut corriger celui saisi par le titulaire),
 *  son mot de passe, son consentement, ses préférences. */
export async function activerCompte(token: string, emailSaisi: string, password: string, emailOptIn: boolean): Promise<{ email: string; matchId: string } | { erreur: string } | null> {
  const a = await activationEnAttente(token);
  if (!a) return null;
  const email = emailSaisi.toLowerCase().trim();
  if (emailProvisoire(email)) return { erreur: "Saisissez votre adresse email." };
  const autre = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (autre && autre.id !== a.userId) return { erreur: "Un compte Soignect existe déjà pour cet email : connectez-vous avec, ou choisissez une autre adresse." };
  const passwordHash = await hash(password, 12);
  const r = await prisma.user.updateMany({
    // Garde atomique : un second envoi du même lien ne réactive pas.
    where: { id: a.userId, resetToken: token, acceptedTermsAt: null },
    data: { email, passwordHash, acceptedTermsAt: new Date(), emailOptIn, resetToken: null, resetTokenExpiry: null },
  });
  if (r.count !== 1) return null;
  await logTraceEventAttendu({ eventType: "CONFRERE_HORS_SOIGNECT", metadata: { etape: "activation", missionType: a.missionType } });
  return { email, matchId: a.matchId };
}
