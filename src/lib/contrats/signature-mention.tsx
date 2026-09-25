import React from "react";
import { Text } from "@react-pdf/renderer";
import { SIGNATURE_LEGAL_MENTION } from "./types";
import type { Style } from "@react-pdf/types";

// ── LA MENTION eIDAS NE VAUT QUE SI UNE SIGNATURE EST APPOSÉE (section 265) ──────────────────
//
// Les dix gabarits imprimaient « Ce document a été signé électroniquement par apposition d'une
// image de signature manuscrite » SANS CONDITION — y compris quand aucune image n'était fournie.
//
// Dans le parcours nominal, la phrase est vraie : le PDF officiel n'est téléchargeable qu'une
// fois les deux signatures présentes. Mais le produit laisse aussi télécharger un BROUILLON
// (`draft=true`), sans aucune signature, et ce brouillon affirmait quand même avoir été signé.
// Constaté le 24/09 en produisant un contrat destiné à être signé À LA MAIN hors application :
// le document annonçait une signature électronique qui n'aurait jamais lieu.
//
// Un document qui se trompe sur la façon dont il a été signé se trompe sur sa propre valeur
// juridique. Ce n'est pas un détail de rendu : c'est la seule phrase du PDF qui parle du PDF.
//
// ── POURQUOI UN COMPOSANT PARTAGÉ ET PAS DIX CONDITIONS ──────────────────────────────────────
//
// Dix copies d'une même règle finissent par diverger, et ce dépôt a déjà payé quatre fois ce
// prix (sections 236, 237, 238, 246). Ici la divergence se lirait sur un contrat signé : un
// gabarit affirmerait un mode de signature que son voisin nierait, sur des documents opposables.
//
// Le `style` reste au gabarit : les deux familles n'utilisent pas le même (`S.eidas` côté
// libéral, `S.sigMention` côté salarié). Seule la RÈGLE est partagée, pas la mise en forme.
export function MentionSignature({
  signatureTitulaireImg,
  signatureRemplacantImg,
  style,
}: {
  signatureTitulaireImg?: string | null;
  signatureRemplacantImg?: string | null;
  style?: Style | Style[];
}) {
  if (!signatureTitulaireImg && !signatureRemplacantImg) return null;
  return <Text style={style}>{SIGNATURE_LEGAL_MENTION}</Text>;
}
