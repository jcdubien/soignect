// WhatsApp — source unique du consentement et des textes pré-remplis (23/10).
//
// Le consentement se demandait seulement dans « Mon compte » (section 292) ; il est aussi proposé
// à l'inscription depuis le 23/10 (arbitrage de JC), avec les MÊMES mots : deux écrans qui
// formulent différemment un consentement finissent par ne plus dire la même chose.
//
// Un lien `wa.me` n'envoie rien : il ouvre WhatsApp chez l'administrateur, message pré-rempli,
// et c'est lui qui appuie sur Envoyer. Les textes ne contiennent aucune donnée d'une autre
// personne : un message WhatsApp se transfère et se capture.

export const CONSENTEMENT_WHATSAPP = {
  libelle: "Me joindre sur WhatsApp",
  // DIRE QUI VERRA LE NUMÉRO, ET NE PAS MENTIR (section 292) : aujourd'hui le bouton est réservé
  // à l'administration. Cette phrase devra changer le jour où cette décision changera.
  detail:
    "Réservé à l’équipe Soignect, pour vous signaler une activité vous concernant. " +
    "Votre numéro n’est montré à aucun autre utilisateur. Décochez à tout moment.",
} as const;

export type MotifWhatsapp = "activite" | "bienvenue";

/** Texte pré-rempli du lien `wa.me` — modifiable dans WhatsApp avant l'envoi. */
export function texteWhatsapp(motif: MotifWhatsapp, base: string): string {
  if (motif === "bienvenue") {
    return `Bonjour, merci pour votre inscription sur Soignect. Je reste joignable ici si vous avez une question. ${base}/annonces`;
  }
  return `Bonjour, vous avez une activité en attente sur Soignect. ${base}/annonces`;
}
