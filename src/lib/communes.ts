// Liste complète des communes de Guadeloupe + collectivités voisines
export const COMMUNES_GUADELOUPE = [
  // Grande-Terre
  "Pointe-à-Pitre",
  "Les Abymes",
  "Baie-Mahault",
  "Le Gosier",
  "Sainte-Anne",
  "Saint-François",
  "Le Moule",
  "Morne-à-l'Eau",
  "Anse-Bertrand",
  "Port-Louis",
  "Petit-Canal",
  // Basse-Terre
  "Basse-Terre",
  "Gourbeyre",
  "Baillif",
  "Saint-Claude",
  "Vieux-Fort",
  "Capesterre-Belle-Eau",
  "Trois-Rivières",
  "Vieux-Habitants",
  "Bouillante",
  "Pointe-Noire",
  "Deshaies",
  "Sainte-Rose",
  "Lamentin",
  "Petit-Bourg",
  "Goyave",
  // Marie-Galante
  "Grand-Bourg (Marie-Galante)",
  "Capesterre-de-Marie-Galante",
  "Saint-Louis (Marie-Galante)",
  // La Désirade
  "La Désirade",
  // Les Saintes
  "Terre-de-Haut (Les Saintes)",
  "Terre-de-Bas (Les Saintes)",
  // Collectivités voisines
  "Marigot (Saint-Martin)",
  "Grand Case (Saint-Martin)",
  "Gustavia (Saint-Barth)",
];

export const SPECIALTIES_KINE = [
  "Orthopédique",
  "Neurologique",
  "Pédiatrique",
  "Respiratoire",
  "Gériatrique",
  "Sportif",
  "Rééducation vestibulaire",
  "Lymphœdème",
  "Obstétrique / Périnéal",
  "Oncologie",
];

// Zonage ARS Guadeloupe 2024 — arrêté n°971-2024 du 31 décembre 2024
// Source : Laurent LEGENDART, DG ARS Guadeloupe, Saint-Martin, Saint-Barthélemy
const ZONE_3_INTERMEDIAIRE = new Set([
  "Bouillante",
  "Pointe-Noire",
  "Capesterre-Belle-Eau",
  "Capesterre-de-Marie-Galante",
  "Grand-Bourg (Marie-Galante)",
  "Saint-Louis (Marie-Galante)",
  "Goyave",
  "Petit-Canal",
  "Anse-Bertrand",
  "Port-Louis",
  "Deshaies",
  "Sainte-Rose",
]);

const ZONE_4_NON_PRIORITAIRE = new Set([
  "Les Abymes",
  "Baie-Mahault",
  "Basse-Terre",
  "Saint-Claude",
  "Le Gosier",
  "Lamentin",
  "Morne-à-l'Eau",
  "Le Moule",
  "Petit-Bourg",
  "Pointe-à-Pitre",
  "Sainte-Anne",
  "La Désirade",
  "Saint-François",
  "Gourbeyre",
  "Terre-de-Bas (Les Saintes)",
  "Terre-de-Haut (Les Saintes)",
  "Trois-Rivières",
  "Vieux-Fort",
  "Baillif",
  "Vieux-Habitants",
]);

export type CommuneZonage = "NON_PRIORITAIRE" | "INTERMEDIAIRE" | null;

export function getCommuneZonage(commune: string): CommuneZonage {
  if (ZONE_3_INTERMEDIAIRE.has(commune)) return "INTERMEDIAIRE";
  if (ZONE_4_NON_PRIORITAIRE.has(commune)) return "NON_PRIORITAIRE";
  return null; // Saint-Martin, Saint-Barth — zonage à vérifier séparément
}

export const ZONAGE_LABELS: Record<string, { label: string; color: string; dot: string }> = {
  INTERMEDIAIRE: {
    label: "Zone intermédiaire",
    color: "bg-amber-100 text-amber-800 border-amber-200",
    dot: "bg-amber-400",
  },
  NON_PRIORITAIRE: {
    label: "Zone non prioritaire",
    color: "bg-gray-100 text-gray-600 border-gray-200",
    dot: "bg-gray-400",
  },
  SOUS_DOTEE: {
    label: "Zone sous-dotée",
    color: "bg-green-100 text-green-800 border-green-200",
    dot: "bg-green-500",
  },
  TRES_SOUS_DOTEE: {
    label: "Zone très sous-dotée",
    color: "bg-emerald-100 text-emerald-900 border-emerald-300",
    dot: "bg-emerald-600",
  },
};
