import { prisma } from "@/lib/prisma";
import type { MotifWhatsapp } from "@/lib/whatsapp";

// Pack WhatsApp de la semaine (23/10) — en attendant l'API WhatsApp Business.
//
// L'administrateur ouvre la page une fois par semaine : chaque ligne est un message à envoyer,
// qu'il ouvre dans WhatsApp (lien `wa.me`, message pré-rempli, modifiable) et envoie lui-même.
// Rien ne part seul. Le jour où l'API Business sera branchée, c'est CETTE liste qui deviendra la
// file d'envoi — les motifs et la règle « qui reçoit quoi » ne changeront pas d'endroit.
//
// QUI EST DANS LE PACK : uniquement les comptes qui ont accepté WhatsApp ET donné un numéro. Le
// numéro ne sort pas d'ici : la page reçoit le nom et le motif, le lien se fabrique au clic
// (/api/admin/whatsapp), pour une seule personne.

export const PACK_JOURS = 7;

export const LIBELLES_MOTIF: Record<MotifWhatsapp, string> = {
  bienvenue: "Nouvelle inscription",
  activite: "Activité en attente",
};

/** Types de notification qui signalent une activité à laquelle la personne peut répondre. */
const NOTIFS_ACTIVITE = ["message", "match", "signature", "interet"];

export type LignePack = {
  userId: string;
  nom: string | null;
  type: string | null;
  motif: MotifWhatsapp;
  /** Pour « activité » : notifications non lues de la période. */
  nonLues: number;
  /** Déjà ouvert dans WhatsApp pendant la période, pour ce motif. */
  ouvertLe: string | null;
};

export async function packWhatsappDeLaSemaine(maintenant = new Date()): Promise<LignePack[]> {
  const depuis = new Date(maintenant.getTime() - PACK_JOURS * 86_400_000);
  const comptes = await prisma.user.findMany({
    where: { whatsappOptIn: true, phone: { not: null }, NOT: { phone: "" } },
    select: {
      id: true, createdAt: true,
      profile: { select: { id: true, name: true, type: true } },
      notifications: { where: { readAt: null, createdAt: { gte: depuis }, type: { in: NOTIFS_ACTIVITE } }, select: { id: true } },
    },
  });
  const profils = comptes.map((c) => c.profile?.id).filter((x): x is string => !!x);
  const ouvertures = profils.length
    ? await prisma.traceEvent.findMany({
        where: { eventType: "WHATSAPP_OUVERT", profileId: { in: profils }, occurredAt: { gte: depuis } },
        select: { profileId: true, occurredAt: true, metadata: true },
        orderBy: { occurredAt: "desc" },
      })
    : [];
  const ouvertPour = (profileId: string | undefined, motif: MotifWhatsapp) => {
    const t = ouvertures.find((o) => o.profileId === profileId && ((o.metadata as { motif?: string } | null)?.motif ?? "activite") === motif);
    return t ? t.occurredAt.toISOString() : null;
  };

  const lignes: LignePack[] = [];
  for (const c of comptes) {
    const base = { userId: c.id, nom: c.profile?.name ?? null, type: c.profile?.type ?? null };
    if (c.createdAt >= depuis) {
      lignes.push({ ...base, motif: "bienvenue", nonLues: 0, ouvertLe: ouvertPour(c.profile?.id, "bienvenue") });
    }
    if (c.notifications.length > 0) {
      lignes.push({ ...base, motif: "activite", nonLues: c.notifications.length, ouvertLe: ouvertPour(c.profile?.id, "activite") });
    }
  }
  // À envoyer d'abord, puis déjà ouverts.
  return lignes.sort((a, b) => Number(!!a.ouvertLe) - Number(!!b.ouvertLe));
}
