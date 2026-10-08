import { prisma } from "@/lib/prisma";
import { SwipeDirection, ProfileType } from "@prisma/client";
import { offreOuverteLe } from "@/lib/feedFilters";
import { adresseEnvoyable, EVENT_RELANCE } from "@/lib/relancePublication";
import { sendInteretEnSouffranceEmail } from "@/lib/email";

// ── DES CABINETS ATTENDENT DES DATES, ET PERSONNE NE LE SAIT (section 290) ───────────────────
//
// La feuille de saisie de la section 288 n'atteint que ceux qui REVIENNENT sur le fil. Mesuré le
// 08/10 : huit personnes ont un intérêt posé sur une annonce ENCORE ouverte sans avoir jamais
// rien publié. La plus ancienne date du 23 août ; leur dernière activité remonte de 11 à 33
// jours. Six semaines de silence suffisent à établir qu'elles ne reviendront pas d'elles-mêmes.
//
// POURQUOI CE N'EST PAS LE MÊME COURRIER QUE LA SECTION 229. Celui-là s'adresse à qui n'a jamais
// rien publié, point. Celui-ci s'adresse à qui a DÉJÀ FAIT LE GESTE : il ne demande pas de
// s'intéresser au produit, il dit qu'un geste précis est resté sans effet et combien de personnes
// attendent au bout. Le marqueur est donc distinct — mais la fenêtre de sept jours regarde LES
// DEUX, pour qu'une personne ne reçoive pas les deux courriers dans la même semaine.

/** Marqueur de déduplication, écrit UNE FOIS PAR DESTINATAIRE, et uniquement par un envoi réel.
 *  Même motif que `EVENT_RELANCE` (section 229) : un TraceEvent plutôt qu'une colonne. */
export const EVENT_SOUFFRANCE = "INTERET_SOUFFRANCE_RAPPEL";

/** Fenêtre de silence entre deux courriers Soignect de cette famille, quel que soit lequel. */
export const FENETRE_SILENCE_JOURS = 7;

/**
 * Cette adresse est-elle une sous-adresse d'un autre compte de la base ?
 *
 * `jcdubien+test@gmail.com` est le compte d'essai que l'exploitant s'est créé : sa base,
 * `jcdubien@gmail.com`, a son propre compte. Lui écrire reviendrait à envoyer un vrai courrier de
 * campagne dans sa propre boîte, et surtout à gonfler d'une unité un nombre qu'il valide avant
 * l'envoi.
 *
 * RÈGLE GÉNÉRALE, PAS UNE ADRESSE EN DUR. Mettre un email personnel dans le dépôt le figerait et
 * ne couvrirait que ce cas-là ; la règle « sous-adresse dont la base existe déjà » décrit ce
 * qu'EST un compte d'essai et vaudra pour le suivant. Vérifié le 08/10 : un seul compte de toute
 * la base y répond, et c'est bien celui-là.
 *
 * Une sous-adresse dont la base n'a PAS de compte reste un destinataire normal — quelqu'un peut
 * parfaitement s'inscrire avec un alias sans avoir d'autre compte ici.
 */
function estSousAdresseDUnAutreCompte(email: string, toutesLesAdresses: Set<string>): boolean {
  const m = email.toLowerCase().match(/^([^+@]+)\+[^@]*@(.+)$/);
  return m ? toutesLesAdresses.has(`${m[1]}@${m[2]}`) : false;
}

export interface CibleSouffrance {
  profileId: string;
  userId: string;
  email: string;
  optIn: boolean;
  prenom: string | null;
  nom: string | null;
  type: string;
  /** Nombre de CABINETS distincts, pas d'annonces. C'est le nombre que la feuille d'arrivée
   *  affiche (« 3 cabinets attendent vos dates ») : l'email et l'écran doivent dire le même. */
  nbCabinets: number;
  nbAnnonces: number;
  premierInteret: Date;
  derniereActivite: Date;
  dernierEmail: Date | null;
}

export interface MotifExclusion {
  nom: string | null;
  motif: string;
}

/**
 * Qui a un intérêt en souffrance, et qui en est écarté.
 *
 * Renvoie les deux listes : un envoi de masse doit pouvoir être relu sur ce qu'il NE fait pas
 * autant que sur ce qu'il fait.
 */
export async function ciblesInteretEnSouffrance(): Promise<{
  cibles: CibleSouffrance[];
  exclus: MotifExclusion[];
}> {
  // MÊME PRÉDICAT QUE LA FEUILLE ET QUE LE RATTRAPAGE (section 289). Le nombre annoncé dans le
  // courrier, celui affiché à l'arrivée sur le fil, et la liste des cabinets réellement notifiés
  // à la publication désignent ainsi les mêmes annonces — par construction, pas par relecture.
  const interets = await prisma.swipe.findMany({
    where: {
      direction: SwipeDirection.RIGHT,
      swiper: { type: { not: ProfileType.TITULAIRE } },
      swipedMission: offreOuverteLe(new Date()),
    },
    select: {
      swiperId: true,
      swipedMissionId: true,
      createdAt: true,
      swipedMission: { select: { profileId: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  if (interets.length === 0) return { cibles: [], exclus: [] };

  const parCandidat = new Map<
    string,
    { annonces: Set<string>; cabinets: Set<string>; premier: Date; dernier: Date }
  >();
  for (const s of interets) {
    let e = parCandidat.get(s.swiperId);
    if (!e) {
      e = { annonces: new Set(), cabinets: new Set(), premier: s.createdAt, dernier: s.createdAt };
      parCandidat.set(s.swiperId, e);
    }
    e.annonces.add(s.swipedMissionId);
    e.cabinets.add(s.swipedMission.profileId);
    if (s.createdAt > e.dernier) e.dernier = s.createdAt;
  }

  const ids = Array.from(parCandidat.keys());
  const profils = await prisma.profile.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, name: true, type: true, updatedAt: true,
      missions: { where: { isActive: true }, take: 1, select: { id: true } },
      user: { select: { id: true, email: true, emailOptIn: true } },
    },
  });

  // Les DEUX marqueurs, pas seulement le nôtre : la fenêtre de silence protège la personne, pas
  // la campagne. Qui vient de recevoir le courrier de la section 229 ne doit pas recevoir
  // celui-ci dans la foulée.
  const traces = await prisma.traceEvent.findMany({
    where: { eventType: { in: [EVENT_SOUFFRANCE, EVENT_RELANCE] }, profileId: { in: ids } },
    select: { profileId: true, eventType: true, occurredAt: true },
  });
  const dernierEmail = new Map<string, Date>();
  const dejaTraite = new Set<string>();
  for (const t of traces) {
    if (!t.profileId) continue;
    if (t.eventType === EVENT_SOUFFRANCE) dejaTraite.add(t.profileId);
    const d = dernierEmail.get(t.profileId);
    if (!d || t.occurredAt > d) dernierEmail.set(t.profileId, t.occurredAt);
  }

  // Toutes les adresses de la base, pour reconnaître les sous-adresses (voir ci-dessus). Une
  // seule requête, en lecture seule, sur une colonne.
  const toutesLesAdresses = new Set(
    (await prisma.user.findMany({ select: { email: true } })).map((u) => u.email.toLowerCase()),
  );

  const maintenant = Date.now();
  const cibles: CibleSouffrance[] = [];
  const exclus: MotifExclusion[] = [];

  for (const pr of profils) {
    const e = parCandidat.get(pr.id)!;
    const email = pr.user?.email ?? "";

    // Une publication, même postérieure au geste, clôt le sujet : la personne apparaît dans un
    // fil, et le rattrapage a déjà fait partir ses signaux.
    if (pr.missions.length > 0) { exclus.push({ nom: pr.name, motif: "a publié depuis" }); continue; }
    if (!pr.user?.email)        { exclus.push({ nom: pr.name, motif: "aucune adresse" }); continue; }
    if (!pr.user.emailOptIn)    { exclus.push({ nom: pr.name, motif: "notifications email coupées" }); continue; }
    // Une adresse qu'on ne peut pas écrire n'est pas un échec d'envoi : on ne tente rien, et on
    // ne la marque pas non plus — rien n'a été fait pour cette personne.
    if (!adresseEnvoyable(email)) { exclus.push({ nom: pr.name, motif: `adresse non envoyable (${email})` }); continue; }
    if (dejaTraite.has(pr.id))  { exclus.push({ nom: pr.name, motif: "déjà destinataire de ce courrier" }); continue; }
    if (estSousAdresseDUnAutreCompte(email, toutesLesAdresses)) {
      exclus.push({ nom: pr.name, motif: "compte d'essai (sous-adresse d'un compte existant)" });
      continue;
    }

    const prec = dernierEmail.get(pr.id);
    if (prec) {
      const jours = Math.floor((maintenant - prec.getTime()) / 86_400_000);
      if (jours < FENETRE_SILENCE_JOURS) {
        exclus.push({ nom: pr.name, motif: `courrier Soignect il y a ${jours} jour(s)` });
        continue;
      }
    }

    const premier = (pr.name ?? "").trim().split(/\s+/)[0] || null;
    cibles.push({
      profileId: pr.id,
      userId: pr.user.id,
      email,
      optIn: pr.user.emailOptIn,
      // `null` plutôt qu'un mot inventé : l'email bascule alors sur « Bonjour, », qui n'est
      // jamais faux. Un prénom deviné sur un nom en « Nom, Prénom » le serait.
      prenom: (pr.name ?? "").includes(",") ? null : premier,
      nom: pr.name,
      type: pr.type,
      nbCabinets: e.cabinets.size,
      nbAnnonces: e.annonces.size,
      premierInteret: e.premier,
      derniereActivite: new Date(Math.max(e.dernier.getTime(), pr.updatedAt.getTime())),
      dernierEmail: prec ?? null,
    });
  }

  cibles.sort((a, b) => b.nbCabinets - a.nbCabinets);
  return { cibles, exclus };
}

export interface ResultatSouffrance {
  examines: number;
  envoyes: number;
  echecs: number;
}

/**
 * Envoie le courrier et pose le marqueur.
 *
 * LE MARQUEUR N'EST ÉCRIT QU'APRÈS UN ENVOI RÉEL, ET SEULEMENT EN PRODUCTION. La garde
 * `VERCEL_ENV` vit dans la ROUTE, pas ici : cette fonction ne s'exécute jamais en simulation
 * (l'appelant ne l'appelle pas du tout), de sorte qu'il n'existe aucun chemin où elle écrirait
 * sans avoir envoyé.
 *
 * DIFFÉRENCE ASSUMÉE AVEC LA SECTION 229, qui marque même les destinataires injoignables pour
 * que son cron quotidien ne les reprenne pas à vie. Ici il n'y a pas de cron : c'est une
 * campagne ponctuelle, déclenchée à la main. Marquer un envoi qui n'a pas eu lieu ferait perdre
 * la personne définitivement, pour épargner une répétition qui ne se produira pas toute seule.
 */
export async function envoyerInteretEnSouffrance(
  cibles: CibleSouffrance[],
): Promise<ResultatSouffrance> {
  const r: ResultatSouffrance = { examines: cibles.length, envoyes: 0, echecs: 0 };
  for (const c of cibles) {
    try {
      await sendInteretEnSouffranceEmail(c.email, {
        firstName: c.prenom,
        nbCabinets: c.nbCabinets,
        optIn: c.optIn,
      });
      await prisma.traceEvent.create({
        data: { eventType: EVENT_SOUFFRANCE, profileId: c.profileId },
      });
      r.envoyes++;
    } catch (e) {
      console.error(`[souffrance] envoi échoué pour ${c.profileId}:`, e);
      r.echecs++;
    }
  }
  return r;
}
