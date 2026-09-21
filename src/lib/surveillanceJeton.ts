import { prisma } from "@/lib/prisma";
import { etatJetonPage, seuilFranchi } from "@/lib/facebookPage";
import { sendJetonFacebookEmail } from "@/lib/email";

// Surveillance de l'échéance du jeton Facebook (section 255).
//
// ── POURQUOI CE N'EST PAS UN CRON DÉDIÉ ──────────────────────────────────────────────────────
//
// Le plan Vercel est Hobby : DEUX tâches planifiées au maximum, et les deux sont prises
// (rappels de messages, rappels de publication). Pire, un cron surnuméraire ou infra-journalier
// dans `vercel.json` ne provoque pas une erreur mais **bloque silencieusement tous les builds** —
// la production a déjà gelé pour cette raison, sans le moindre message.
//
// La surveillance se greffe donc sur une tâche existante. C'est une contrainte d'hébergement, pas
// un choix de conception : le jour où le plan change, ceci devient un cron à part sans rien
// modifier d'autre que son point d'appel.
//
// ── UNE ALERTE PAR SEUIL, PAS UNE PAR JOUR ───────────────────────────────────────────────────
//
// Prévenir tous les matins pendant trente jours produirait un message qu'on apprend à ignorer —
// c'est-à-dire exactement le silence qu'on corrige, avec du bruit en plus. Chaque seuil (30, 14,
// 7, 3, 1 jours) ne prévient qu'une fois, et la trace de cet envoi vit dans `TraceEvent`, comme
// la déduplication du signal d'intérêt. Aucune migration n'est nécessaire.
//
// LA TRACE EST ÉCRITE APRÈS L'ENVOI, jamais avant : écrite d'abord, un échec d'email laisserait
// un seuil marqué comme prévenu alors que personne n'a rien reçu — et ce seuil-là ne reviendrait
// plus jamais.

const EVENT = "FB_TOKEN_ALERTE";

export interface ResultatSurveillance {
  configure: boolean;
  valide: boolean | null;
  joursRestants: number | null;
  seuil: number | null;
  /** Ce qui a été fait : rien, alerte envoyée, ou seuil déjà signalé. */
  action: "rien" | "alerte-envoyee" | "deja-alerte" | "sans-destinataire" | "echec-envoi";
  motif: string;
}

/**
 * Vérifie l'échéance et alerte l'exploitant si un seuil vient d'être franchi.
 *
 * NE JETTE JAMAIS : appelée depuis une tâche planifiée dont ce n'est pas l'objet principal. Une
 * surveillance qui tombe ne doit pas emporter les rappels de publication avec elle.
 */
export async function surveillerJetonFacebook(
  opts: { simulation?: boolean } = {},
): Promise<ResultatSurveillance> {
  try {
    const etat = await etatJetonPage();
    if (!etat.configure) {
      return { configure: false, valide: null, joursRestants: null, seuil: null, action: "rien", motif: etat.motif };
    }

    const seuil = seuilFranchi(etat.joursRestants);
    const base = {
      configure: true,
      valide: etat.valide,
      joursRestants: etat.joursRestants,
      seuil,
      motif: etat.motif,
    };
    // Rien à signaler : soit l'échéance est lointaine, soit Graph ne l'a pas donnée. Dans le
    // second cas l'écran Diffusion le dit — on n'invente pas une alerte sur une date inconnue.
    if (seuil === null) return { ...base, action: "rien" };

    const deja = await prisma.traceEvent.findFirst({
      where: { eventType: EVENT, metadata: { path: ["seuil"], equals: seuil } },
      select: { id: true },
    });
    if (deja) return { ...base, action: "deja-alerte" };

    // Destinataire : l'administrateur en base, pas une adresse en dur. Un email écrit dans le
    // code survivrait à un changement de compte sans que personne ne s'en aperçoive.
    const admin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      select: { email: true },
      orderBy: { createdAt: "asc" },
    });
    if (!admin?.email) return { ...base, action: "sans-destinataire" };

    if (opts.simulation) return { ...base, action: "alerte-envoyee" };

    // Laquelle des deux échéances arrive en premier : le geste de renouvellement n'est pas le
    // même, et le message doit nommer le bon.
    const jJeton = etat.expireLe ? new Date(etat.expireLe).getTime() : Infinity;
    const jAcces = etat.accesDonneesExpireLe ? new Date(etat.accesDonneesExpireLe).getTime() : Infinity;
    const nature = jJeton <= jAcces ? "jeton" : "acces-donnees";
    const echeance = new Date(Math.min(jJeton, jAcces)).toLocaleDateString("fr-FR", {
      day: "numeric", month: "long", year: "numeric",
    });

    await sendJetonFacebookEmail(admin.email, {
      joursRestants: etat.joursRestants ?? 0,
      echeance,
      nature,
    });

    await prisma.traceEvent.create({
      data: { eventType: EVENT, metadata: { seuil, joursRestants: etat.joursRestants, nature } },
    });

    return { ...base, action: "alerte-envoyee" };
  } catch (e) {
    return {
      configure: true, valide: null, joursRestants: null, seuil: null,
      action: "echec-envoi", motif: e instanceof Error ? e.message : "erreur",
    };
  }
}
