import { Role } from "@prisma/client";

// Qui a le droit de quoi (section 232).
//
// LE PROBLÈME QUE CE FICHIER RÉSOUT. Le rôle `ADMIN` est « tout ou rien » : il ouvre 13 écrans et
// 20 routes — liste et suppression de comptes, changement de rôle, envoi d'emails de masse,
// barème brut des scores, édition de l'annonce de n'importe qui. Le donner à un partenaire
// externe pour qu'il ajuste des priorités de commune serait hors de proportion.
//
// PAS UN « ADMIN DIMINUÉ ». `PARTENAIRE_TERRITORIAL` n'est pas un sous-ensemble d'ADMIN gardé par
// des exceptions : c'est un rôle distinct, dont l'unique écran vit HORS de `/admin`.
//
// POURQUOI HORS DE /admin, ET PAS UNE GARDE ASSOUPLIE. `/admin/layout.tsx` protège les 13 écrans
// d'un seul contrôle. Y admettre le partenaire aurait obligé à ajouter une garde sur chacun des
// 12 autres — et surtout, **tout écran admin créé ensuite aurait été ouvert par défaut**. Le
// défaut doit rester « refusé » : le partenaire a son propre segment, et `/admin` ne bouge pas.

/** Accès complet à l'administration. Inchangé. */
export function estAdmin(role: string | null | undefined): boolean {
  return role === Role.ADMIN;
}

/** Accès à l'espace territorial : des AGRÉGATS, et la possibilité de remonter une demande.
 *  AUCUN réglage (section 233) — le partenaire signale un besoin, l'administrateur tranche. */
export function peutVoirEspaceTerritoire(role: string | null | undefined): boolean {
  return role === Role.ADMIN || role === Role.PARTENAIRE_TERRITORIAL;
}

/** Peut déposer une demande de priorisation. Même périmètre que ci-dessus : c'est la SEULE
 *  écriture ouverte à ce rôle, et elle ne touche à rien de ce que le feed lit. */
export function peutRemonterDemande(role: string | null | undefined): boolean {
  return role === Role.ADMIN || role === Role.PARTENAIRE_TERRITORIAL;
}

/** Libellé lisible, pour l'écran d'administration des comptes. */
export const LIBELLE_ROLE: Record<Role, string> = {
  [Role.USER]: "Utilisateur",
  [Role.ADMIN]: "Administrateur",
  [Role.PARTENAIRE_TERRITORIAL]: "Partenaire territorial",
};
