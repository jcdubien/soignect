export interface ContractParty {
  name: string;
  profession: string;
  location: string;
  // Identité contractuelle (section 150) — injectée dans le PDF (remplace les placeholders).
  rpps?: string | null;
  numeroOrdre?: string | null;
  adresse?: string | null;
  siret?: string | null;
  isStructure?: boolean; // structure employeuse → SIRET au lieu de RPPS/Ordre

  /** Valeur d'enum `Profession`, en plus du libellé affiché ci-dessus. Sert à choisir le
   *  VOCABULAIRE de l'ordre concerné (« N° Ordre » chez le CNOMK, « n° ordinal » chez le CNOI).
   *  Optionnel : absent, l'affichage retombe sur la forme générique, jamais sur une invention. */
  professionEnum?: string | null;

  /** Remplaçant infirmier NON INSTALLÉ (variante « titulaire d'une autorisation ») — le modèle
   *  du CNOI exige que le contrat porte le numéro et la date de l'autorisation délivrée par le
   *  conseil de l'Ordre, ainsi que la CPAM qui l'a autorisé. Aucune de ces trois données
   *  n'existe sur `Profile` : elles sont SAISIES À LA GÉNÉRATION du contrat (décision du 27/08),
   *  et non déclarées à l'inscription — un champ qu'on ne remplit qu'une fois tous les trente-six
   *  du mois devient un levier dormant, et le produit en compte déjà quatre. */
  autorisationNumero?: string | null;
  autorisationDate?: string | null;
  cpamRattachement?: string | null;
}

// Images de signature (data URL base64) — apposées en bas du contrat (section 61).
// "titulaire" = partie qui recrute/propose ; "remplacant" = partie qui candidate.
export interface SignatureImages {
  signatureTitulaireImg?: string | null;
  signatureRemplacantImg?: string | null;
  // Aperçu/brouillon (section 137) — ajoute un filigrane « DOCUMENT NON OFFICIEL »
  // et bloque toute confusion avec le contrat officiel signé. Téléchargeable avant
  // les deux signatures ; le PDF officiel (sans filigrane) reste réservé au bothSigned.
  draft?: boolean;
}

// Clauses négociables saisies dans le formulaire de contrat (section 164) — remplacent les
// placeholders figés [virement bancaire / …], [délai], [modalités à préciser] des templates.
// Éditables tant que le contrat n'est pas signé des deux côtés (même verrou que les autres
// champs négociables : rayon / durée / taux / période d'essai, section 137).
export interface NegotiableClauses {
  modePaiement: string;       // "Virement bancaire" | "Chèque" | "Espèces" | "Autre"
  delaiPaiementJours: number; // délai de paiement de la rétrocession/redevance (jours)
  modalitesLocaux: string;    // modalités de répartition des charges locaux/matériel (texte libre)
}

// Phrase injectée après « versé(e) par … » selon le mode de paiement choisi.
export function paymentMethodPhrase(mode: string): string {
  switch (mode) {
    case "Chèque":  return "chèque";
    case "Espèces": return "espèces";
    case "Autre":   return "un autre moyen convenu entre les parties";
    case "Virement bancaire":
    default:        return "virement bancaire";
  }
}

// Modalités locaux : valeur saisie, ou repli neutre non bloquant si le champ est laissé vide.
export function localModalities(value: string): string {
  const v = value.trim();
  return v.length > 0 ? v : "à convenir entre les parties";
}

/** Remplacement infirmier — variante « remplaçant titulaire d'une autorisation d'exercice »
 *  (modèle CNOI du 15/11/2023). Distincte de `ContractDataRemplacement` (CNOMK) : la
 *  rétrocession y va dans l'AUTRE SENS. Chez le kiné, le remplaçant reverse un pourcentage au
 *  remplacé ; ici c'est le REMPLACÉ qui reverse au remplaçant, parce que c'est lui qui
 *  encaisse — le remplaçant n'étant pas installé, il facture avec sa CPS « remplaçant » et les
 *  honoraires transitent par le remplacé. Réutiliser `retrocessionPct` aurait inversé le sens
 *  d'un pourcentage sur un document signé.
 *
 *  Deux délais distincts, tels que le modèle les sépare : paiement direct par l'assuré, et
 *  tiers payant. Les fondre en un seul aurait simplifié le type au prix du contrat. */
export interface ContractDataRemplacementInfirmierAutorise extends SignatureImages {
  remplace: ContractParty;
  remplacant: ContractParty;
  startDate: string | null;
  endDate: string | null;
  /** Part des honoraires REVERSÉE PAR LE REMPLACÉ AU REMPLAÇANT (paiement direct). */
  reversementDirectPct: number;
  reversementDirectDelaiMois: number;
  /** Idem pour les actes réglés en tiers payant, que le remplacé continue de percevoir. */
  reversementTiersPayantPct: number;
  reversementTiersPayantDelaiMois: number;
  /** Rayon de non-concurrence — art. R.4312-87 CSP (choix A-2 du 27/08 : rayon, pas communes). */
  rayonKm: number;
  /** Préavis de résiliation d'un commun accord (art. 8.1) et unilatérale (art. 8.2), en jours. */
  preavisCommunAccordJours: number;
  preavisUnilateralJours: number;
  /** Description des locaux et moyens mis à disposition (art. 3), saisie librement. */
  moyensMisADisposition: string;
  generatedAt: string;
}

/** Remplacement infirmier — variante « remplaçant CONFRÈRE DÉJÀ INSTALLÉ » (modèle CNOI
 *  15/11/2023). Le remplaçant a son propre cabinet et sa propre CPS : il facture avec SES
 *  identifiants et verse une redevance au remplacé pour les frais de cabinet — sens identique
 *  à `retrocessionPct` côté kiné, et INVERSE de l'autre variante infirmier. */
export interface ContractDataRemplacementInfirmierConfrere extends SignatureImages {
  remplace: ContractParty;
  remplacant: ContractParty;
  startDate: string | null;
  endDate: string | null;
  /** Redevance versée PAR LE REMPLAÇANT AU REMPLACÉ pour les frais de cabinet (art. 5, option
   *  retenue le 27/08). 0 = option écartée pour ce contrat, la clause ne s'imprime pas. */
  redevancePct: number;
  moyensMisADisposition: string;
  /** Adresse du cabinet propre du remplaçant (art. 3, clause retenue le 27/08 : il peut y
   *  recevoir les patients confiés). Vide = la clause ne s'imprime pas. */
  cabinetRemplacant: string;
  preavisCommunAccordJours: number;
  preavisUnilateralJours: number;
  /** Durée pendant laquelle le remplaçant informe le remplacé de toute sollicitation d'un
   *  patient après le contrat (art. 11). Texte libre : le modèle écrit « pendant une durée de … »
   *  sans imposer d'unité. */
  dureeInformationSollicitation: string;
  generatedAt: string;
}

/** Collaboration libérale infirmier (modèle CNOI 15/11/2023). Sans rapport avec l'assistanat,
 *  qui n'existe pas dans cette profession : le collaborateur développe une patientèle PROPRE,
 *  c'est la définition même du statut (loi 2005-882 art. 18, art. R.4312-88 CSP). */
export interface ContractDataCollaborationInfirmier extends SignatureImages {
  titulaire: ContractParty;
  collaborateur: ContractParty;
  startDate: string | null;
  /** Durée déterminée (choix C-5 du 27/08) : le modèle propose aussi l'indéterminée, écartée. */
  dureeMois: number;
  renouvellementsMax: number;
  dureeMaxMois: number;
  /** Redevance mensuelle en % du chiffre d'affaires (choix C-6). Le modèle admet aussi un
   *  montant fixe en euros — écarté, `redevancePct` suffit et existe déjà côté kiné. */
  redevancePct: number;
  /** Jour du mois suivant avant lequel la redevance doit être versée (art. 7). */
  jourVersementRedevance: number;
  moyensMisADisposition: string;
  /** Modalités de recensement de la patientèle, texte libre (choix C-3 : dispositions libres
   *  plutôt que critères détaillés prédéfinis). Périodicité fixée à trimestrielle. */
  recensementDispositions: string;
  /** Partage des forfaits de prise en charge (art. 6.2) — SÉLECTIONNÉ À LA GÉNÉRATION, décision
   *  du 27/08, et non figé dans le gabarit : les trois modes décrivent des organisations de
   *  cabinet réellement différentes, aucune n'est un défaut raisonnable pour les autres. */
  forfaitPartage: "TOUR_DE_ROLE" | "PARTS_EGALES" | "CHARGE_TRAVAIL";
  /** Renseigné uniquement si `forfaitPartage === "CHARGE_TRAVAIL"`. */
  forfaitRepartition: string;
  forfaitDelaiReversementJours: number;
  periodeEssaiMois: number;
  preavisEssaiJours: number;
  dureeInformationSollicitation: string;
  generatedAt: string;
}

// ── Contrat de travail salarié (section 217) — partagé kiné / infirmier ─────────────────────
//
// UN SEUL TYPE POUR LES DEUX PROFESSIONS, décidé le 28/08 après vérification champ par champ
// sur les modèles des deux ordres. Le socle est commun — durée, essai, rémunération, temps de
// travail, congés, protection sociale, non-concurrence, précarité, rupture — parce que c'est du
// DROIT DU TRAVAIL, identique quel que soit l'ordre professionnel. Ce qui diffère se limite à
// quelques champs réellement absents d'un côté ou de l'autre, et non à des champs oubliés.
//
// DEUX AXES INDÉPENDANTS, tous deux portés par des unions discriminées plutôt que par des
// champs optionnels. Un booléen `estPartiel` avec une répartition horaire facultative aurait
// laissé produire un temps partiel sans répartition — or le Code du travail l'exige, et son
// absence rend le contrat requalifiable en temps complet. Le type interdit donc ce cas.
//
// CE QUE CHAQUE PROFESSION EXPOSE — le registre s'en charge, comme pour ASSISTANAT :
//   • kiné      : CDD_TERME, CDD_SANS_TERME  (aucun CDI publié par le CNOMK)
//                 × COMPLET, PARTIEL
//   • infirmier : CDI, CDD_TERME, CDD_SANS_TERME  × COMPLET
//     (l'axe temps côté infirmier n'a PAS été vérifié — supposition, pas constat)

export interface RepartitionJour {
  /** « lundi », « mardi »… — libellé tel qu'il s'imprime. */
  jour: string;
  debut: string;
  fin: string;
}

/** Nature du contrat. Le CDD sans terme précis n'a pas de date de fin : un champ `fin`
 *  optionnel l'aurait laissé vide sans que rien ne le signale. */
export type NatureSalariat =
  | { type: "CDI"; debut: string | null }
  | { type: "CDD_TERME"; debut: string | null; fin: string | null; renouvellementsMax: number }
  | { type: "CDD_SANS_TERME"; debut: string | null; dureeMinimaleMois: number; motif: string };

/** Temps de travail. La répartition et le plafond d'heures complémentaires ne sont exigés qu'au
 *  temps partiel — et y sont OBLIGATOIRES, d'où l'union plutôt que deux champs optionnels. */
export type TempsDeTravail =
  | { type: "COMPLET"; heuresHebdomadaires: number }
  | { type: "PARTIEL"; heuresHebdomadaires: number; repartition: RepartitionJour[]; heuresComplementairesMax: number };

export interface ContractDataSalarie extends SignatureImages {
  employeur: ContractParty;
  salarie: ContractParty;
  nature: NatureSalariat;
  temps: TempsDeTravail;

  /** Ville de l'URSSAF où la déclaration préalable à l'embauche a été déposée. */
  urssafVille: string;
  /** N° de sécurité sociale du salarié — demandé par le modèle CNOMK, pas par le CNOI. */
  numeroSecuriteSociale: string;

  lieuTravail: string;
  /** Absente = la clause de période d'essai n'est pas incluse. Les deux ordres la marquent
   *  explicitement facultative. */
  periodeEssaiMois: number | null;
  remunerationBrutMensuelle: number;

  /** Organismes de rattachement (art. « retraite complémentaire, frais de santé, prévoyance »). */
  caisseRetraite: string;
  regimeFraisSante: string;
  regimePrevoyance: string;

  /** Non-concurrence. En CDI la contrepartie financière n'est PAS facultative : le support
   *  déontologique du remplacement (R.4321-130) disparaît, et le droit du travail frappe de
   *  nullité une clause sans contrepartie. */
  nonConcurrence: {
    dureeMois: number;
    rayonKm: number;
    indemnitePct: number;
    periodicite: "MENSUELLE" | "TRIMESTRIELLE";
  };

  /** CDD uniquement — l'indemnité de fin de contrat n'existe pas en CDI. */
  indemnitePrecaritePct: number | null;
  preavisJours: number;
  generatedAt: string;
}

export interface ContractDataRemplacement extends SignatureImages, NegotiableClauses {
  remplace: ContractParty;
  remplacant: ContractParty;
  startDate: string | null;
  endDate: string | null;
  retrocessionPct: number;
  rayonKm: number;
  periodeEssai: boolean;
  generatedAt: string;
}

export interface ContractDataAssisanat extends SignatureImages, NegotiableClauses {
  titulaire: ContractParty;
  assistant: ContractParty;
  startDate: string | null;
  minMonths: number | null;
  redevancePct: number;
  rayonKm: number;
  dureeAns: number;
  periodeEssai: boolean;
  generatedAt: string;
}

export interface ContractDataCollaboration extends SignatureImages, NegotiableClauses {
  titulaire: ContractParty;
  collaborateur: ContractParty;
  startDate: string | null;
  minMonths: number | null;
  redevancePct: number;
  rayonKm: number;
  dureeAns: number;
  periodeEssai: boolean;
  generatedAt: string;
}

// Mention légale sur la valeur de la signature photo (section 61 — eIDAS)
export const SIGNATURE_LEGAL_MENTION =
  "Ce document a été signé électroniquement par apposition d'une image de signature " +
  "manuscrite. Il ne constitue pas une signature électronique qualifiée au sens du " +
  "règlement eIDAS. Les parties reconnaissent la validité de ce mode de signature " +
  "pour les besoins de ce contrat.";
