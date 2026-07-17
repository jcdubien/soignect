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

// ── Macro-zones géographiques (section 138) ───────────────────────────────────
// Union locale (pas d'import @prisma/client) pour rester utilisable côté client.
// Les valeurs correspondent 1:1 à l'enum Prisma ZoneGeographique.
export type ZoneGeo =
  | "CENTRE_CAP_EXCELLENCE"
  | "SUD_GRANDE_TERRE"
  | "NORD_GRANDE_TERRE"
  | "SUD_BASSE_TERRE"
  | "NORD_BASSE_TERRE"
  | "MARIE_GALANTE"
  | "LES_SAINTES"
  | "LA_DESIRADE"
  | "SAINT_MARTIN"
  | "SAINT_BARTHELEMY";

// Ordre d'affichage (Centre en tête, îles du Sud/annexes en fin).
export const ZONE_ORDER: ZoneGeo[] = [
  "CENTRE_CAP_EXCELLENCE",
  "SUD_GRANDE_TERRE",
  "NORD_GRANDE_TERRE",
  "SUD_BASSE_TERRE",
  "NORD_BASSE_TERRE",
  "MARIE_GALANTE",
  "LES_SAINTES",
  "LA_DESIRADE",
  "SAINT_MARTIN",
  "SAINT_BARTHELEMY",
];

export const ZONE_LABELS: Record<ZoneGeo, string> = {
  CENTRE_CAP_EXCELLENCE: "Centre / Cap Excellence",
  SUD_GRANDE_TERRE:      "Sud Grande-Terre",
  NORD_GRANDE_TERRE:     "Nord Grande-Terre",
  SUD_BASSE_TERRE:       "Sud Basse-Terre",
  NORD_BASSE_TERRE:      "Nord Basse-Terre",
  MARIE_GALANTE:         "Marie-Galante",
  LES_SAINTES:           "Les Saintes",
  LA_DESIRADE:           "La Désirade",
  SAINT_MARTIN:          "Saint-Martin",
  SAINT_BARTHELEMY:      "Saint-Barthélemy",
};

// Mapping figé commune → zone (section 138). Clés = chaînes EXACTES de
// COMMUNES_GUADELOUPE (suffixes inclus : « (Marie-Galante) », « (Saint-Martin) »…).
export const COMMUNE_ZONE: Record<string, ZoneGeo> = {
  // Centre / Cap Excellence
  "Pointe-à-Pitre":              "CENTRE_CAP_EXCELLENCE",
  "Les Abymes":                  "CENTRE_CAP_EXCELLENCE",
  "Baie-Mahault":                "CENTRE_CAP_EXCELLENCE",
  "Le Gosier":                   "CENTRE_CAP_EXCELLENCE",
  "Petit-Bourg":                 "CENTRE_CAP_EXCELLENCE",
  "Goyave":                      "CENTRE_CAP_EXCELLENCE",
  // Sud Grande-Terre
  "Sainte-Anne":                 "SUD_GRANDE_TERRE",
  "Saint-François":              "SUD_GRANDE_TERRE",
  "Le Moule":                    "SUD_GRANDE_TERRE",
  "Morne-à-l'Eau":               "SUD_GRANDE_TERRE",
  // Nord Grande-Terre
  "Anse-Bertrand":               "NORD_GRANDE_TERRE",
  "Port-Louis":                  "NORD_GRANDE_TERRE",
  "Petit-Canal":                 "NORD_GRANDE_TERRE",
  // Sud Basse-Terre
  "Basse-Terre":                 "SUD_BASSE_TERRE",
  "Gourbeyre":                   "SUD_BASSE_TERRE",
  "Baillif":                     "SUD_BASSE_TERRE",
  "Saint-Claude":                "SUD_BASSE_TERRE",
  "Vieux-Fort":                  "SUD_BASSE_TERRE",
  "Capesterre-Belle-Eau":        "SUD_BASSE_TERRE",
  "Trois-Rivières":              "SUD_BASSE_TERRE",
  "Vieux-Habitants":             "SUD_BASSE_TERRE",
  "Bouillante":                  "SUD_BASSE_TERRE",
  // Nord Basse-Terre
  "Pointe-Noire":                "NORD_BASSE_TERRE",
  "Deshaies":                    "NORD_BASSE_TERRE",
  "Sainte-Rose":                 "NORD_BASSE_TERRE",
  "Lamentin":                    "NORD_BASSE_TERRE",
  // Marie-Galante
  "Grand-Bourg (Marie-Galante)": "MARIE_GALANTE",
  "Capesterre-de-Marie-Galante": "MARIE_GALANTE",
  "Saint-Louis (Marie-Galante)": "MARIE_GALANTE",
  // La Désirade
  "La Désirade":                 "LA_DESIRADE",
  // Les Saintes
  "Terre-de-Haut (Les Saintes)": "LES_SAINTES",
  "Terre-de-Bas (Les Saintes)":  "LES_SAINTES",
  // Saint-Martin
  "Marigot (Saint-Martin)":      "SAINT_MARTIN",
  "Grand Case (Saint-Martin)":   "SAINT_MARTIN",
  // Saint-Barthélemy
  "Gustavia (Saint-Barth)":      "SAINT_BARTHELEMY",
};

export function zoneOfCommune(commune?: string | null): ZoneGeo | null {
  if (!commune) return null;
  return COMMUNE_ZONE[commune] ?? null;
}

// Communes regroupées par zone, pour l'affichage groupé des formulaires.
export const COMMUNES_BY_ZONE: { zone: ZoneGeo; communes: string[] }[] = ZONE_ORDER.map((zone) => ({
  zone,
  communes: COMMUNES_GUADELOUPE.filter((c) => COMMUNE_ZONE[c] === zone),
}));

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
