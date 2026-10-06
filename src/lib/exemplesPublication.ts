import type { Profession } from "@prisma/client";
import { PROFESSION_LABELS } from "@/lib/professions";

// ── LES EXEMPLES DE PUBLICATION, PAR PROFESSION (section 278) ────────────────────────────────
//
// Sept phrases vivaient codées en dur dans les deux formulaires de publication, toutes kiné :
// « Ex : Kiné diplômé… », « méthodes Mézières et respiratoire », « Je suis un kiné passionné… ».
// Elles s'affichent au moment PRÉCIS où quelqu'un publie. Ouvrir le produit aux infirmiers et aux
// médecins sans les toucher, c'était montrer à une infirmière, comme modèle de ce qu'on attend
// d'elle, une phrase sur la méthode Mézières.
//
// ── CE QUI EST FACTORISÉ, ET CE QUI NE L'EST PAS ────────────────────────────────────────────
//
// La roadmap pose la règle : « factoriser la structure (module, paramétrage), jamais le contenu
// au prix du sens ». Un gabarit unique à trous aurait aplati la seule chose qui rend un exemple
// utile — nommer un geste du métier.
//
// Donc : la STRUCTURE est commune (deux contextes × trois champs), le CONTENU est écrit par
// profession là où je peux l'écrire honnêtement, et retombe sinon sur une forme NEUTRE construite
// depuis le libellé. Cette forme n'est pas un pis-aller déguisé : elle dit vrai, simplement elle
// ne nomme aucune technique. Une profession gagne son exemple propre le jour où quelqu'un qui
// l'exerce le dicte — pas le jour où je devine son vocabulaire.
//
// `Record<Profession, …>` n'est volontairement PAS utilisé ici : la table serait à 14 entrées
// dont 12 identiques au gabarit. C'est `exemplesPour()` qui garantit qu'aucune profession ne
// reste sans exemple, et le repli est explicite plutôt que manquant.

export interface JeuExemples {
  /** Texte libre — le champ que l'IA analyse pour remplir le formulaire. */
  brut: string;
  /** Titre de l'annonce. */
  titre: string;
  /** Accroche d'une phrase, affichée sur la carte. */
  accroche: string;
}

export interface ExemplesPublication {
  /** Mission courte, datée. */
  remplacement: JeuExemples;
  /** Poste durable — assistanat, collaboration, salariat. */
  longTerme: JeuExemples;
}

// Forme neutre : vraie pour n'importe quelle profession, ne nomme aucune technique.
function gabaritNeutre(profession: Profession): ExemplesPublication {
  const metier = PROFESSION_LABELS[profession];
  return {
    remplacement: {
      brut: `Ex : ${metier} diplômé·e, disponible du 1er au 30 septembre sur le Sud Grande-Terre (Sainte-Anne, Le Gosier). Mobile. Je recherche un logement et un véhicule.`,
      titre: "Ex : Disponible juillet-août · Pointe-à-Pitre et alentours",
      accroche: `Je suis ${metier.toLowerCase()}, disponible pour des remplacements courts en Guadeloupe…`,
    },
    longTerme: {
      brut: `Ex : ${metier} diplômé·e, je recherche un poste longue durée sur Grande-Terre à partir de septembre, minimum 12 mois. Je cherche un logement.`,
      titre: "Ex : Recherche poste longue durée · Guadeloupe à partir de septembre",
      accroche: "J'aspire à intégrer une équipe dynamique en Guadeloupe…",
    },
  };
}

// Professions dont le vocabulaire métier est écrit — les seules pour lesquelles je dispose d'un
// contenu vérifiable plutôt que d'une supposition.
const ECRITS: Partial<Record<Profession, ExemplesPublication>> = {
  // Repris mot pour mot des formulaires : c'est le texte qui tournait, pas une réécriture.
  KINESITHERAPEUTE: {
    remplacement: {
      brut: "Ex : Disponible du 1er au 30 septembre sur le Sud Grande-Terre (Sainte-Anne, Le Gosier). Mobile, méthode Mézières et respiratoire. Je recherche un logement et un véhicule.",
      titre: "Ex : Disponible juillet-août · Pointe-à-Pitre et alentours",
      accroche: "Je suis un kiné passionné, disponible pour remplacements courts en Guadeloupe…",
    },
    longTerme: {
      brut: "Ex : Kiné diplômé, je recherche un assistanat longue durée sur Grande-Terre à partir de septembre, minimum 12 mois. Formé en thérapie manuelle et sport. Je cherche un logement.",
      titre: "Ex : Recherche CDI kiné sport · Guadeloupe à partir de septembre",
      accroche: "J'aspire à intégrer un cabinet dynamique en Guadeloupe…",
    },
  },
  INFIRMIER: {
    remplacement: {
      brut: "Ex : Disponible du 1er au 30 septembre sur le Sud Grande-Terre (Sainte-Anne, Le Gosier). Tournées à domicile, pansements complexes, perfusions. Véhiculée. Je recherche un logement.",
      titre: "Ex : Disponible juillet-août · tournée Pointe-à-Pitre et alentours",
      accroche: "Infirmière diplômée d'État, disponible pour des remplacements en libéral…",
    },
    longTerme: {
      brut: "Ex : IDE diplômée, je recherche une collaboration longue durée sur Grande-Terre à partir de septembre, minimum 12 mois. Expérience en HAD et soins palliatifs. Je cherche un logement.",
      titre: "Ex : Recherche collaboration IDE · Guadeloupe à partir de septembre",
      accroche: "J'aspire à rejoindre une tournée stable en Guadeloupe…",
    },
  },
};

/** Les exemples d'une profession — écrits si on les a, forme neutre sinon. Jamais vides. */
export function exemplesPour(profession: Profession): ExemplesPublication {
  return ECRITS[profession] ?? gabaritNeutre(profession);
}

// ── L'ACCROCHE DE PROFIL, À L'INSCRIPTION ────────────────────────────────────────────────────
//
// Huitième phrase kiné, et la plus coûteuse des huit : elle vit à l'écran SUIVANT celui où l'on
// vient de choisir sa profession. Trouvée en parcourant l'inscription avec un compte infirmier —
// « Infirmier·ère » sélectionné à l'étape 1, et l'étape 2 proposait « Kiné passionné de sport ».
//
// Registre DIFFÉRENT de `ExemplesPublication` : ici on se décrit soi, là on décrit un poste ou
// une disponibilité datée. Même discipline en revanche — écrit pour les professions dont je
// tiens le vocabulaire, forme neutre construite depuis le libellé pour les autres.
const ACCROCHE_PROFIL_ECRITE: Partial<Record<Profession, string>> = {
  // Mot pour mot l'existant : aucune régression de formulation pour le marché d'origine.
  KINESITHERAPEUTE: "Kiné passionné de sport, expérience 5 ans, disponible été et Noël, mobile sur toute la Guadeloupe…",
  INFIRMIER: "Infirmière diplômée d'État, 5 ans en libéral, tournées et soins à domicile, véhiculée sur toute la Guadeloupe…",
};

/** Exemple d'accroche pour un CANDIDAT, selon sa profession. Jamais vide. */
export function accrocheProfilExemple(profession: Profession): string {
  return (
    ACCROCHE_PROFIL_ECRITE[profession] ??
    `${PROFESSION_LABELS[profession]}, expérience 5 ans, disponible été et Noël, mobile sur toute la Guadeloupe…`
  );
}
