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

// ── Martinique (section 376) ────────────────────────────────────────────────────
// Les 34 communes, regroupées par intercommunalité : CACEM au centre, Cap Nord, Espace Sud.
// Découpage proposé par Soignect, **à vérifier par JC** avant toute mise en ligne.
// Libellés : ceux de CommuneAPL (INSEE), sauf « Sainte-Anne (Martinique) » — voir COMMUNE_INSEE.
const COMMUNES_MARTINIQUE_PAR_ZONE = {
  MARTINIQUE_CENTRE: ["Fort-de-France", "Le Lamentin", "Schœlcher", "Saint-Joseph"],
  MARTINIQUE_NORD: [
    "L'Ajoupa-Bouillon", "Basse-Pointe", "Bellefontaine", "Le Carbet", "Case-Pilote",
    "Fonds-Saint-Denis", "Grand'Rivière", "Gros-Morne", "Le Lorrain", "Macouba", "Le Marigot",
    "Le Morne-Rouge", "Le Morne-Vert", "Le Prêcheur", "Le Robert", "Saint-Pierre", "Sainte-Marie",
    "La Trinité",
  ],
  MARTINIQUE_SUD: [
    "Les Anses-d'Arlet", "Le Diamant", "Ducos", "Le François", "Le Marin", "Rivière-Pilote",
    "Rivière-Salée", "Sainte-Anne (Martinique)", "Sainte-Luce", "Saint-Esprit", "Les Trois-Îlets",
    "Le Vauclin",
  ],
} as const;

export const COMMUNES_MARTINIQUE: string[] = Object.values(COMMUNES_MARTINIQUE_PAR_ZONE).flat();

const INSEE_MARTINIQUE: Record<string, string> = {
  "L'Ajoupa-Bouillon": "97201", "Les Anses-d'Arlet": "97202", "Basse-Pointe": "97203",
  "Le Carbet": "97204", "Case-Pilote": "97205", "Le Diamant": "97206", "Ducos": "97207",
  "Fonds-Saint-Denis": "97208", "Fort-de-France": "97209", "Le François": "97210",
  "Grand'Rivière": "97211", "Gros-Morne": "97212", "Le Lamentin": "97213", "Le Lorrain": "97214",
  "Macouba": "97215", "Le Marigot": "97216", "Le Marin": "97217", "Le Morne-Rouge": "97218",
  "Le Prêcheur": "97219", "Rivière-Pilote": "97220", "Rivière-Salée": "97221", "Le Robert": "97222",
  "Saint-Esprit": "97223", "Saint-Joseph": "97224", "Saint-Pierre": "97225",
  "Sainte-Anne (Martinique)": "97226", "Sainte-Luce": "97227", "Sainte-Marie": "97228",
  "Schœlcher": "97229", "La Trinité": "97230", "Les Trois-Îlets": "97231", "Le Vauclin": "97232",
  "Le Morne-Vert": "97233", "Bellefontaine": "97234",
};

// ── Territoires (section 376) ─────────────────────────────────────────────────────
// Le TERRITOIRE est le tableau d'annonces auquel appartient un compte ou une annonce : chacun
// voit d'abord le sien. Distinct de `Profile.region`, qui dit d'où vient la personne (un
// remplaçant de métropole travaille en Guadeloupe). Saint-Martin et Saint-Barthélemy restent
// sur le tableau de la Guadeloupe, comme avant.
export type Territoire = "GUADELOUPE" | "MARTINIQUE";
export const TERRITOIRES: Territoire[] = ["GUADELOUPE", "MARTINIQUE"];
export const LIBELLE_TERRITOIRE: Record<Territoire, string> = { GUADELOUPE: "Guadeloupe", MARTINIQUE: "Martinique" };

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
  | "SAINT_BARTHELEMY"
  | "MARTINIQUE_CENTRE"
  | "MARTINIQUE_NORD"
  | "MARTINIQUE_SUD";

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
// ZONE_ORDER reste la liste de la Guadeloupe (ses lecteurs n'en connaissent pas d'autre).
export const ZONES_MARTINIQUE: ZoneGeo[] = ["MARTINIQUE_CENTRE", "MARTINIQUE_NORD", "MARTINIQUE_SUD"];
export const ZONES_PAR_TERRITOIRE: Record<Territoire, ZoneGeo[]> = { GUADELOUPE: ZONE_ORDER, MARTINIQUE: ZONES_MARTINIQUE };

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
  MARTINIQUE_CENTRE:     "Centre (CACEM)",
  MARTINIQUE_NORD:       "Nord (Cap Nord)",
  MARTINIQUE_SUD:        "Sud (Espace Sud)",
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
  // Martinique — voir ZONES_MARTINIQUE (découpage à vérifier par JC)
  ...Object.fromEntries(
    (Object.entries(COMMUNES_MARTINIQUE_PAR_ZONE) as [ZoneGeo, readonly string[]][]).flatMap(([zone, cs]) => cs.map((c) => [c, zone])),
  ),
};

export function zoneOfCommune(commune?: string | null): ZoneGeo | null {
  if (!commune) return null;
  return COMMUNE_ZONE[commune] ?? null;
}

// ── Pont commune produit → code INSEE (section 213) ───────────────────────────
//
// POURQUOI IL EXISTE
// `CommuneAPL` est clé par `codeInsee`. `Mission.location` porte un LIBELLÉ, celui de
// `COMMUNES_GUADELOUPE`. Les deux référentiels ne se rencontraient nulle part : `codeInsee`
// n'apparaissait dans aucun fichier hors du schéma et de l'écran /admin/apl. Toute tentative
// de lire la donnée APL ou un besoin territorial depuis une annonce devait donc joindre par
// le nom — et cette jointure échoue, en silence, sur SEPT libellés sur trente-cinq.
//
// LE PIÈGE, en trois formes distinctes :
//   1. Quatre libellés produit sont DÉSAMBIGUÏSÉS et l'INSEE ne l'est pas :
//      « Grand-Bourg (Marie-Galante) » ici, « Grand-Bourg » en base. Idem Saint-Louis,
//      Terre-de-Haut, Terre-de-Bas. Un `WHERE commune = location` les perd toutes les quatre.
//   2. Deux libellés désignent le MÊME territoire : Marigot et Grand Case sont des quartiers
//      de Saint-Martin, qui est une collectivité unique. La correspondance n'est donc PAS
//      injective — deux clés, un code. Une jointure inverse (code → libellé) n'a pas de sens.
//   3. Grand Case n'est pas une commune du tout et n'a aucun code propre. Elle emprunte celui
//      de Saint-Martin, ce qui est le comportement juste, mais qu'il fallait écrire.
//
// LES CODES SONT DÉCLARÉS, PAS DÉRIVÉS — même règle que le `slug` d'URL (14/08) et que
// `Profession.enumBase` (17/08). Aucune normalisation automatique (retirer la parenthèse,
// comparer sans accents) ne survivrait au cas 2, et surtout elle serait invisible.
//
// `null` VEUT DIRE QUELQUE CHOSE : « ce libellé ne correspond à aucune commune INSEE ».
// C'est différent d'une clé absente, qui veut dire « libellé inconnu du produit ». Les deux
// se traitent différemment côté appelant, d'où le type explicite.
//
// ⚠️ UN CODE VALIDE NE GARANTIT PAS UNE LIGNE `CommuneAPL`. La table ne contient que les
// départements 971/972/973/974 : Saint-Martin (978) et Saint-Barthélemy (977) ont quitté la
// Guadeloupe en 2007 et n'y figurent pas. Leurs codes ci-dessous sont exacts et ne trouveront
// pourtant rien. `npm run db:check-insee` mesure cet écart plutôt que de le laisser surprendre.
export const COMMUNE_INSEE: Record<string, string | null> = {
  // Grande-Terre
  "Pointe-à-Pitre":              "97120",
  "Les Abymes":                  "97101",
  "Baie-Mahault":                "97103",
  "Le Gosier":                   "97113",
  "Sainte-Anne":                 "97128",
  "Saint-François":              "97125",
  "Le Moule":                    "97117",
  "Morne-à-l'Eau":               "97116",
  "Anse-Bertrand":               "97102",
  "Port-Louis":                  "97122",
  "Petit-Canal":                 "97119",
  // Basse-Terre
  "Basse-Terre":                 "97105",
  "Gourbeyre":                   "97109",
  "Baillif":                     "97104",
  "Saint-Claude":                "97124",
  "Vieux-Fort":                  "97133",
  "Capesterre-Belle-Eau":        "97107",
  "Trois-Rivières":              "97132",
  "Vieux-Habitants":             "97134",
  "Bouillante":                  "97106",
  "Pointe-Noire":                "97121",
  "Deshaies":                    "97111",
  "Sainte-Rose":                 "97129",
  "Lamentin":                    "97115",
  "Petit-Bourg":                 "97118",
  "Goyave":                      "97114",
  // Marie-Galante — cas 1 : le produit désambiguïse, l'INSEE non.
  "Grand-Bourg (Marie-Galante)": "97112",
  "Capesterre-de-Marie-Galante": "97108",
  "Saint-Louis (Marie-Galante)": "97126",
  // La Désirade
  "La Désirade":                 "97110",
  // Les Saintes — cas 1 également.
  "Terre-de-Haut (Les Saintes)": "97131",
  "Terre-de-Bas (Les Saintes)":  "97130",
  // Saint-Martin — cas 2 et 3 : deux quartiers d'une collectivité unique (code 97801, ex-97127
  // avant la séparation de 2007). Grand Case n'a pas de code propre, elle emprunte le sien.
  "Marigot (Saint-Martin)":      "97801",
  "Grand Case (Saint-Martin)":   "97801",
  // Saint-Barthélemy — collectivité unique (97701, ex-97123). Gustavia en est le chef-lieu.
  "Gustavia (Saint-Barth)":      "97701",
  // Martinique (972) — noms et codes relevés dans CommuneAPL le 28/10, à l'identique, sauf
  // « Sainte-Anne (Martinique) » : la Guadeloupe a aussi sa Sainte-Anne, déjà portée par des
  // annonces sous ce libellé nu. Cas 1 ci-dessus, dans l'autre sens.
  ...INSEE_MARTINIQUE,
};

/** Code INSEE d'un libellé de commune produit. `null` si le libellé est inconnu OU s'il ne
 *  correspond à aucune commune INSEE — l'appelant ne peut rien faire d'utile de la nuance,
 *  seul `db:check-insee` la distingue. Un code rendu ici ne garantit PAS une ligne
 *  `CommuneAPL` (voir l'avertissement 977/978 ci-dessus). */
export function inseeOfCommune(commune?: string | null): string | null {
  if (!commune) return null;
  return COMMUNE_INSEE[commune] ?? null;
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

/** Libellé canonique d'une commune saisie (« Petit Bourg », « petit-bourg » → « Petit-Bourg ») :
 *  rapprochement sans casse, accents, tirets ni espaces. Rend la saisie telle quelle si rien ne
 *  correspond — on ne fabrique pas une commune. */
export function libelleCommune(saisie: string): string {
  const cle = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const k = cle(saisie);
  return Object.keys(COMMUNE_INSEE).find((c) => cle(c) === k) ?? saisie.trim();
}

/** Les libellés produit (ceux de `Mission.location`) d'un code INSEE. Plusieurs libellés peuvent
 *  partager un code (Marigot et Grand Case → Saint-Martin) : on les garde tous. */
export function libellesDuCode(code: string): string[] {
  return Object.entries(COMMUNE_INSEE).filter(([, c]) => c === code).map(([l]) => l);
}

// ── Territoire d'une commune ou d'une zone (section 376) ─────────────────────────
export const COMMUNES_PAR_TERRITOIRE: Record<Territoire, string[]> = {
  GUADELOUPE: COMMUNES_GUADELOUPE,
  MARTINIQUE: COMMUNES_MARTINIQUE,
};

/** Territoire d'un libellé de commune produit ; `null` si le libellé est inconnu. */
export function territoireDeCommune(commune?: string | null): Territoire | null {
  if (!commune) return null;
  return TERRITOIRES.find((t) => COMMUNES_PAR_TERRITOIRE[t].includes(commune)) ?? null;
}

export function territoireDeZone(zone: ZoneGeo): Territoire {
  return ZONES_MARTINIQUE.includes(zone) ? "MARTINIQUE" : "GUADELOUPE";
}

/** Lecture tolérante (session, colonne, paramètre) : tout ce qui n'est pas MARTINIQUE est la
 *  Guadeloupe — le défaut de la colonne et de tous les comptes antérieurs. */
export function territoireDe(v?: string | null): Territoire {
  return v === "MARTINIQUE" ? "MARTINIQUE" : "GUADELOUPE";
}

/** Libellé d'affichage d'une liste de zones : « Toute la Guadeloupe » / « Toute la Martinique »
 *  quand toutes les zones du territoire sont cochées (section 148), sinon leurs noms. */
export function libelleZones(zones: ZoneGeo[], territoire: Territoire): string {
  const toutes = ZONES_PAR_TERRITOIRE[territoire];
  return toutes.every((z) => zones.includes(z))
    ? `Toute la ${LIBELLE_TERRITOIRE[territoire]}`
    : zones.map((z) => ZONE_LABELS[z]).join(", ");
}

/** Territoires dont un compte voit les annonces (section 376) : le sien, plus l'autre île s'il a
 *  coché « voir aussi ». Tous les comptes antérieurs : Guadeloupe seule, comme avant. */
export function territoiresVus(p: { territoire?: string | null; voirAutreTerritoire?: boolean | null }): Territoire[] {
  const sien = territoireDe(p.territoire);
  return p.voirAutreTerritoire ? [sien, ...TERRITOIRES.filter((t) => t !== sien)] : [sien];
}
