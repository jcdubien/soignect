import { prisma } from "@/lib/prisma";
import { BriqueStatus } from "@prisma/client";
import { publicationPour, cibleVisibilitePour } from "@/lib/camp";
import { sendRelancePublicationEmail } from "@/lib/email";

// Relance des inscrits qui n'ont jamais rien publié (section 229).
//
// POURQUOI ELLE EXISTE. Aucun des correctifs de la semaine ne rattrape quelqu'un qui s'inscrit,
// ne publie rien, et ne revient jamais : l'email de bienvenue ne parle qu'au premier jour, et
// l'avertissement de la pile de cartes ne parle qu'à ceux qui reviennent sur le fil. Mesuré le
// 03/09 — 14 candidats sur 19 n'ont jamais publié, et cette population totalise ZÉRO mise en
// relation.

/** Délai après inscription avant la relance. Assez pour ne pas doubler l'email de bienvenue,
 *  assez court pour arriver pendant que l'intention est encore là — la publication médiane se
 *  fait 10 minutes après l'inscription, ou jamais. */
export const DELAI_RELANCE_MS = 2 * 24 * 60 * 60 * 1000;

/** Marqueur de déduplication. Un TraceEvent plutôt qu'une colonne : le dépôt utilise déjà ce
 *  motif pour compter sans migration (budget DeepSeek), et il sert ici aux DEUX chemins — le
 *  cron et la campagne ponctuelle — ce qui garantit qu'une personne relancée par l'un ne peut
 *  pas l'être par l'autre. */
export const EVENT_RELANCE = "RELANCE_PUBLICATION";

/** Ce que le feed montre RÉELLEMENT (api/feed) : une mission active et non « Dates bloquées ».
 *  Une absence de cabinet compte donc comme publication — elle apparaît bel et bien dans le fil
 *  des candidats, et c'est même la période à pourvoir (section 188). */
const PUBLICATION_VISIBLE = {
  isActive: true,
  briqueStatus: { not: BriqueStatus.INDISPONIBLE },
};

export interface CibleRelance {
  userId: string;
  profileId: string;
  email: string;
  emailOptIn: boolean;
  prenom: string;
  type: string;
  nom: string | null;
  joursDepuisInscription: number;
}

/**
 * Une adresse sans « @ » ne peut pas recevoir : la base en contient une (`marmushfares`).
 * On ne tente pas l'envoi — mais on la marquera quand même comme traitée, sinon le cron la
 * reprendrait tous les jours à vie.
 */
export function adresseEnvoyable(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Inscrits sans aucune publication visible, jamais relancés.
 *
 * @param plusVieuxQue  ne retenir que les comptes créés AVANT cette date. Le cron y passe
 *                      `now - DELAI_RELANCE_MS` ; la campagne ponctuelle passe `now`, donc tout
 *                      l'existant.
 */
export async function inscritsSansPublication(plusVieuxQue: Date): Promise<CibleRelance[]> {
  const users = await prisma.user.findMany({
    where: {
      createdAt: { lte: plusVieuxQue },
      profile: { is: { missions: { none: PUBLICATION_VISIBLE } } },
    },
    select: {
      id: true, email: true, emailOptIn: true, createdAt: true,
      profile: { select: { id: true, name: true, type: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Déjà relancés → écartés. Requête séparée plutôt qu'une jointure : `TraceEvent.profileId` est
  // une simple colonne, sans relation Prisma vers `Profile`.
  const dejaRelances = new Set(
    (await prisma.traceEvent.findMany({
      where: { eventType: EVENT_RELANCE },
      select: { profileId: true },
    })).map((e) => e.profileId),
  );

  return users
    .filter((u) => u.profile && !dejaRelances.has(u.profile.id))
    .map((u) => ({
      userId: u.id,
      email: u.email,
      emailOptIn: u.emailOptIn,
      prenom: (u.profile!.name ?? "").trim().split(" ")[0] || "à vous",
      type: u.profile!.type,
      nom: u.profile!.name,
      joursDepuisInscription: Math.floor((Date.now() - u.createdAt.getTime()) / 86_400_000),
      profileId: u.profile!.id,
    }));
}

export interface ResultatRelance {
  examines: number;
  envoyes: number;
  ignoresOptOut: number;
  ignoresAdresseInvalide: number;
}

/**
 * Envoie la relance et marque CHAQUE cible comme traitée — y compris celles qu'on n'a pas pu
 * joindre. Marquer un échec définitif évite de le réessayer indéfiniment ; c'est la règle du cron
 * des messages, appliquée ici pour la même raison.
 */
export async function envoyerRelances(
  cibles: CibleRelance[],
  opts: { simulation: boolean },
): Promise<ResultatRelance> {
  const r: ResultatRelance = { examines: cibles.length, envoyes: 0, ignoresOptOut: 0, ignoresAdresseInvalide: 0 };

  for (const c of cibles) {
    const joignable = adresseEnvoyable(c.email);
    if (!c.emailOptIn) r.ignoresOptOut++;
    else if (!joignable) r.ignoresAdresseInvalide++;
    else r.envoyes++;

    if (opts.simulation) continue;

    if (c.emailOptIn && joignable) {
      await sendRelancePublicationEmail(c.email, {
        firstName: c.prenom,
        cibleLabel: cibleVisibilitePour(c.type),
        optIn: c.emailOptIn,
        joursDepuisInscription: c.joursDepuisInscription,
        publication: publicationPour(c.type),
      });
    }
    await prisma.traceEvent.create({
      data: { eventType: EVENT_RELANCE, profileId: c.profileId },
    });
  }
  return r;
}
