import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Compte de confrère hors Soignect PAS ENCORE ACTIVÉ (section 373) — règle écrite ici seulement.
//
// Ce compte est créé par le cabinet (lib/confrereHorsSoignect) ; le confrère l'active lui-même par
// son lien, où il choisit son mot de passe et accepte les conditions. Ce lien porte le même jeton
// que la réinitialisation de mot de passe (User.resetToken). Deux conséquences, fermées ici :
//   • le lien d'activation ouvert sur /reset-password posait un mot de passe SANS acceptation des
//     conditions, et le compte devenait utilisable ;
//   • « Mot de passe oublié » sur son email remplaçait le jeton : le lien partagé par le cabinet
//     cessait de fonctionner, sans que personne ne sache pourquoi.
//
// ÉTROIT À DESSEIN : « pas de date d'acceptation » ne suffit pas. Des comptes ordinaires anciens
// n'en ont pas (3 sur 123 le 28/10) ; les bloquer couperait leur accès. Il faut AUSSI être la
// partie invitée d'une mise en relation hors Soignect.
export const COMPTE_CONFRERE_EN_ATTENTE: Prisma.UserWhereInput = {
  acceptedTermsAt: null,
  profile: { matchesB: { some: { horsSoignect: true } } },
};

export const MESSAGE_COMPTE_EN_ATTENTE =
  "Ce compte n'est pas encore activé. Ouvrez le lien d'activation que le cabinet vous a transmis : vous y choisirez votre mot de passe.";

export async function estCompteConfrereEnAttente(userId: string): Promise<boolean> {
  return (await prisma.user.count({ where: { id: userId, ...COMPTE_CONFRERE_EN_ATTENTE } })) > 0;
}
