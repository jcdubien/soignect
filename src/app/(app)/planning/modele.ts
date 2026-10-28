import { jourLocalUtc } from "@/lib/jourLocal";
import { notPast } from "@/lib/dates";

export interface MatchInfo {
  id: string;
  status?: string | null; // EN_ATTENTE | CONFIRME | DECLINE | EXPIRE — seul CONFIRME couvre le poste
  profileA?: { id: string; name: string | null; type: string } | null;
  profileB?: { id: string; name: string | null; type: string } | null;
  missionA?: { title: string; startDate: Date | null; endDate: Date | null } | null;
  missionB?: { title: string; startDate: Date | null; endDate: Date | null } | null;
}

export interface MissionData {
  id: string;
  /** Version du lien de partage (section 249) — change à chaque modification. */
  updatedAt: Date | string;
  title: string;
  startDate: Date | string | null;
  endDate: Date | string | null;
  isActive: boolean;
  missionType: string;
  briqueStatus: string;
  statusUpdatedAt: Date | string | null;
  statusNote: string | null;
  // Suivi humain (section 200) — null = rien de noté.
  suiviStatut?: string | null;
  matchedName?: string | null;        // nom du successeur matché (section 1c/6)
  departureDate?: Date | string | null; // date de départ prévue — fin effective (section 6)
  matchesA: MatchInfo[];
  matchesB: MatchInfo[];
}

export interface PostData {
  id: string;
  label: string;
  postType: string;
  noticeMonths: number;
  isActive: boolean;
  missions: MissionData[];
  // Siège du détenteur du compte (section 188) : rendu comme un poste ordinaire, mais présence
  // implicite (voir computeOwnerSeatGaps) et non supprimable.
  isOwnerSeat?: boolean;
  // Compte ASSISTANT rattaché à ce poste (section 153) — null si géré uniquement par le titulaire.
  linkedUserId?: string | null;
  linkedUser?: { id: string; email: string; profile: { name: string | null } | null } | null;
  // Note de suivi du poste (section 200) — porte le suivi des zones NON COUVERTES, qui
  // n'existent comme aucun objet en base.
  suiviNote?: string | null;
}

export interface UnlinkedMission {
  id: string;
  /** Version du lien de partage (section 249) — change à chaque modification. */
  updatedAt: Date | string;
  title: string;
  startDate: Date | string | null;
  endDate: Date | string | null;
  missionType: string;
  // Nature déclarée d'un poste salarié (section 262) : un CDI d'établissement ne se lit pas
  // « Collaboration ».
  natureSalariat?: string | null;
  briqueStatus: string;
  // Chargé plutôt que supposé : la requête serveur filtre déjà `isActive: true`, mais le
  // prédicat de péremption le teste — une valeur déduite d'un `where` lointain est une
  // supposition qui survit mal à un changement de requête.
  isActive: boolean;
}

export type Zoom = "month" | "quarter" | "year" | "triennial";

export const ZOOM_DAYS: Record<Zoom, number> = { month: 30, quarter: 91, year: 365, triennial: 730 };

export const ZOOM_LABELS: Record<Zoom, string> = { month: "Mois", quarter: "Trimestre", year: "Année", triennial: "2 ans" };

export const TRACK_HEIGHT = 44;

export const LABEL_WIDTH  = 140;

// ── Sous-lignes (« lanes ») ───────────────────────────────────────────────────
// Deux périodes qui se chevauchent occupaient la même bande, sans z-index : celle peinte en
// second recouvrait l'autre INTÉGRALEMENT. Mesuré en production — une brique de remplacement
// de 47 px disparaissait sous une annonce ouverte de 1280 px, même ligne, même hauteur ; seul
// l'arbre d'accessibilité en gardait la trace. Un titulaire pouvait donc ignorer qu'une période
// était déjà couverte, ou en recrutement, parce qu'elle était cachée derrière autre chose.
//
// On répartit désormais les briques qui se chevauchent sur des sous-lignes distinctes, et la
// ligne du poste grandit d'autant. Aucune brique ne peut plus être invisible.
export const LANE_HEIGHT = 20; // pas de croissance de la piste par sous-ligne supplémentaire

export const LANE_GAP    = 2;

export const LANE_PAD    = 4;  // marge haute/basse, équivalente au `top-1 bottom-1` d'origine

export const MOBILE_TRACK_HEIGHT = 56; // piste d'une carte mobile à une seule sous-ligne

// ── INCLUSION ≠ CHEVAUCHEMENT (section 264) ──────────────────────────────────────────────────
//
// La première version ouvrait une sous-ligne dès que deux intervalles se touchaient. Mesuré le
// 24/09 sur la base entière : 4 postes portaient une sous-ligne, et les 4 étaient des INCLUSIONS
// STRICTES — une annonce de trois semaines logée dans une occupation ouverte. Aucun croisement
// partiel n'existait nulle part.
//
// Or une inclusion n'a jamais eu besoin d'une seconde bande. La brique de fond reste lisible DES
// DEUX CÔTÉS de celle qui se loge dedans ; c'est même ce que le titulaire décrit quand il dit
// qu'un remplaçant « comble un trou » plutôt qu'il ne chevauche quelqu'un. Ce qui exige vraiment
// deux bandes, c'est le CROISEMENT PARTIEL — un tuilage de succession, un double engagement —
// où aucune des deux ne peut se dessiner sur l'autre sans lui manger une extrémité.
//
// `margeVisible` (dans l'unité des bornes) est la garde : si la brique intérieure couvre son
// hôte sur toute sa longueur, l'hôte disparaîtrait — on retombe alors sur deux sous-lignes,
// parce que c'est exactement le défaut d'invisibilité décrit plus haut.
//
// ── CE QU'ON N'A PAS FAIT, ET POURQUOI ───────────────────────────────────────────────────────
//
// Une règle SÉMANTIQUE était envisagée en plus : peindre le « fait » (CONFIRME) au fond et
// l'« intention » (RECHERCHE) par-dessus. Confrontée aux données, elle se retourne — sur le poste
// « JP », c'est l'annonce ouverte qui CONTIENT l'occupation de Camille : la peindre par-dessus
// masquerait Camille intégralement. La géométrie désigne déjà le bon fond partout (le contenant),
// sans avoir à deviner ce qu'un statut veut dire. On s'en tient donc à elle.
export function assignLanes<T>(
  items: T[], start: (x: T) => number, end: (x: T) => number, margeVisible = 0,
): { lanes: Map<T, number>; count: number } {
  // Contenants d'abord : à début égal, le plus long passe devant, sinon il chercherait un hôte
  // dans une brique qu'il contient.
  const ordonnes = [...items].sort((a, b) => start(a) - start(b) || end(b) - end(a));
  const finDeLane: number[] = [];
  const placees: { it: T; lane: number }[] = [];
  const lanes = new Map<T, number>();
  for (const it of ordonnes) {
    // 1. Entièrement contenue dans une brique déjà posée → elle se loge dans SA bande, à
    //    condition qu'il reste de l'hôte à voir d'un côté au moins.
    const hote = placees.find(
      (p) =>
        start(p.it) <= start(it) && end(it) <= end(p.it) &&
        (start(it) - start(p.it) >= margeVisible || end(p.it) - end(it) >= margeVisible),
    );
    if (hote) { lanes.set(it, hote.lane); placees.push({ it, lane: hote.lane }); continue; }
    // 2. Sinon, placement glouton : la première sous-ligne libre à sa date de début.
    let l = finDeLane.findIndex((fin) => fin <= start(it));
    if (l === -1) { l = finDeLane.length; finDeLane.push(end(it)); }
    else finDeLane[l] = end(it);
    lanes.set(it, l);
    placees.push({ it, lane: l });
  }
  return { lanes, count: Math.max(finDeLane.length, 1) };
}

// ── HAUTEUR : UNE SEULE FORMULE (section 264) ────────────────────────────────────────────────
//
// Avant, deux cas disjoints : à une sous-ligne la brique faisait 36 px (44 − marges), à deux
// elle tombait d'un coup à 20 px pour une piste de 50. Une ligne partagée perdait donc 44 % de
// sa hauteur pendant que sa voisine gardait la sienne — c'est la « dissociation de hauteur »
// signalée le 17/09, deux captures à l'appui.
//
// Désormais la piste GRANDIT d'une sous-ligne (22 px) et les bandes se partagent l'espace à
// parts égales. À une sous-ligne la formule redonne exactement 36 px : rien ne bouge pour les
// plannings sans chevauchement, ce qui est le cas de tous après la règle d'inclusion ci-dessus.
export const LANE_PITCH = LANE_HEIGHT + LANE_GAP;

export function trackHeightFor(laneCount: number): number {
  return TRACK_HEIGHT + Math.max(0, laneCount - 1) * LANE_PITCH;
}

export function laneStyle(lane: number, laneCount: number, trackHeight: number): { top: number; height: number } {
  const n = Math.max(1, laneCount);
  const utile = trackHeight - LANE_PAD * 2 - (n - 1) * LANE_GAP;
  const hauteur = utile / n;
  return { top: LANE_PAD + lane * (hauteur + LANE_GAP), height: hauteur };
}

// Plage large pour montrer l'historique réel des postes (occupation antérieure, section 56)
export const RANGE_START = new Date();
RANGE_START.setMonth(RANGE_START.getMonth() - 18);
RANGE_START.setDate(1);
RANGE_START.setHours(0, 0, 0, 0);

export const RANGE_END = new Date(RANGE_START);
RANGE_END.setMonth(RANGE_END.getMonth() + 36);

export const TOTAL_DAYS = Math.ceil((RANGE_END.getTime() - RANGE_START.getTime()) / 86400000);

// ── Status styles ──────────────────────────────────────────────────────────────

// Palette section 46 — tokens couleur appliqués aux statuts désignés.
// Texte sombre sur corail (#3D1508) et ambre (#3D2A08) : contraste AA vérifié.
export const BRIQUE_STATUS: Record<string, { bg: string; text: string; label: string }> = {
  PRESENT:          { bg: "bg-[var(--bleu-marine)]",   text: "text-white",       label: "Présent" },
  ABSENT_CONGE:     { bg: "bg-gray-400",               text: "text-white",       label: "Congé" },
  ABSENT_MALADIE:   { bg: "bg-gray-500",               text: "text-white",       label: "Arrêt maladie" },
  ABSENT_FORMATION: { bg: "bg-gray-300",               text: "text-gray-700",    label: "Formation" },
  OCCUPE:           { bg: "bg-[var(--bleu-marine)]",   text: "text-white",       label: "Occupé" },
  PREAVIS:          { bg: "bg-[var(--ambre)]",         text: "text-[#3D2A08]",   label: "Préavis" },
  RECHERCHE:        { bg: "bg-[var(--ambre)]",         text: "text-[#3D2A08]",   label: "Recrutement" },
  NON_COUVERT:      { bg: "bg-[var(--corail-signal)]", text: "text-[#3D1508]",   label: "Non couvert" },
  FERME:            { bg: "bg-gray-700",               text: "text-white",       label: "Fermé" },
  CONFIRME:         { bg: "bg-[var(--vert-palme)]",    text: "text-white",       label: "Confirmé" },
  // Même teinte, autre LUMINOSITÉ (section 297) : un remplaçant posé sur la période d'un
  // occupant confirmé. Fond clair + liseré 2 px du vert plein — l'écart survit au niveau de gris
  // (4,2:1 entre les deux fonds) et le liseré le porte aussi pour qui ne distingue pas les verts.
  // Texte #1F4A35 sur #DCEDE3 : 8,3:1. État DÉRIVÉ, voir getEffectiveStatus.
  REMPLACANT_EN_PLACE: { bg: "bg-[var(--vert-palme-clair)] border-2 border-[var(--vert-palme)]", text: "text-[var(--vert-palme-fonce)]", label: "Remplaçant en place" },
  EN_ATTENTE:       { bg: "bg-[var(--ambre)]",         text: "text-[#3D2A08]",   label: "En attente" },
  ANNULE:           { bg: "bg-gray-300",               text: "text-gray-600",    label: "Annulé" },
};

// ── Suivi humain de la relation (section 200) ─────────────────────────────────
// Troisième axe, distinct de BRIQUE_STATUS (état du créneau, qui donne la couleur) et de
// MatchStatus (état technique de la mise en relation). Il ne consigne QUE ce que la
// plateforme ne peut pas observer : un appel, un mail hors produit, une intention.
//
// LA COULEUR DE LA BRIQUE NE CHANGE PAS. Elle appartient déjà à briqueStatus ; y superposer
// un second code chromatique rendrait les deux illisibles. Le suivi s'affiche en pastille.
export const SUIVI: Record<string, { label: string; court: string; dot: string }> = {
  // Libellé seul, clé inchangée : `A_RELANCER` est stocké en base sur les suivis existants, et le
  // renommer demanderait une migration pour un mot que personne ne lit. Ce qui s'affiche, en
  // revanche, ne dit plus « relancer » (16/09) — voir lib/interetSignale.ts pour la règle.
  A_RELANCER:              { label: "À recontacter",         court: "À recontacter", dot: "bg-[var(--corail-signal)]" },
  APPEL_FAIT:              { label: "Appel passé",           court: "Appelé",      dot: "bg-white/90" },
  REPONSE_ATTENDUE:        { label: "En attente de réponse",  court: "En attente",  dot: "bg-white/90" },
  ECHANGE_HORS_PLATEFORME: { label: "Échangé par mail / SMS", court: "Hors produit", dot: "bg-white/90" },
  SANS_SUITE:              { label: "Sans suite",             court: "Sans suite",  dot: "bg-gray-900/40" },
};

export const SUIVI_ORDRE = ["A_RELANCER", "APPEL_FAIT", "REPONSE_ATTENDUE", "ECHANGE_HORS_PLATEFORME", "SANS_SUITE"];

// ── Segment helpers ────────────────────────────────────────────────────────────

// Sur le SIÈGE DU DÉTENTEUR (section 188), la logique s'inverse : sa présence est implicite,
// il ne la déclare pas. Aucune période ne veut donc PAS dire « poste vacant » mais « il est là ».
// Un trou n'existe que dans une absence déclarée à laquelle rien n'a encore été opposé :
//   ABSENT_* → il est parti et rien n'est prévu        → alerte
//   RECHERCHE → une annonce est en ligne               → pas d'alerte (il a agi)
//   FERME     → « je ne cherche personne »             → pas d'alerte (choix explicite)
//   CONFIRME  → quelqu'un couvre                       → pas d'alerte
// Même esprit que les postes ordinaires, où une brique quelconque supprime le trou.
// ── Annonce dont la période est écoulée (section 247, étendu le 13/09) ──────────────────────
//
// UN SEUL ENDROIT POUR LA RÈGLE ET POUR LE TEXTE. La première version ne couvrait que les
// annonces NON rattachées à un poste — or les trois annonces périmées de Jean-Charles sont
// attachées : les briques portaient bien le ⚠️, mais l'explication et les deux issues ne
// s'affichaient nulle part pour elles. Le signalement existait sans jamais dire quoi faire.
//
// Plutôt que de recopier l'encart dans le panneau « Gérer ce poste », il est extrait ici et
// consommé aux deux endroits. Ce dépôt a déjà payé quatre fois le prix d'une règle recopiée
// (sections 236, 237, 238, 246) — un texte d'avertissement dupliqué finirait par diverger, et
// l'un des deux dirait quelque chose que l'autre contredit.
// L'AVERTISSEMENT NE VAUT QUE POUR UNE ANNONCE EN RECRUTEMENT. Première version : la seule date
// de fin suffisait. Constaté à l'écran le 13/09 — les briques « Léa » et « jp » portaient le ⚠️
// alors que ce sont des OCCUPATIONS terminées le 19/08, pas des annonces. Rien n'y est visible
// par les candidats (`isActive: false`), rien à corriger ni à dépublier : ces postes se sont
// simplement libérés. L'avertissement y était faux, et un avertissement faux use les vrais.
//
// Le prédicat reprend celui qui existait déjà plus bas (`isAnnonceActive`) plutôt que d'en
// réinventer un : active ET en recherche.
export function estAnnoncePerimee(m: {
  isActive: boolean; briqueStatus: string;
  endDate: Date | string | null; departureDate?: Date | string | null;
}): boolean {
  if (!m.isActive || m.briqueStatus !== "RECHERCHE") return false;
  const d = toDate(m.departureDate ?? m.endDate);
  if (!d) return false;
  // Même borne que le fil (section 298, lib/jourLocal) : l'encart et la visibilité côté
  // candidats basculent au même instant. `setHours(0)` marquait « écoulée » dès le DERNIER jour,
  // pendant que le fil servait encore l'annonce.
  return d < jourLocalUtc(new Date());
}

// ── POSTE DÉJÀ TENU (section 265) ────────────────────────────────────────────────────────────
//
// Trouvé le 24/09 sur le poste « JP » : une annonce d'assistanat ouverte depuis le 07/09 restait
// en ligne alors que Camille tient le poste jusqu'au 18/04/27. Elle avait déjà recueilli 31
// swipes, dont 3 à droite — trois personnes en attente sur un poste qui n'est pas libre.
//
// CE N'EST PAS UN OUBLI DE MÉCANISME, C'EST UN CHEMIN QUI N'EN A PAS. Signer un contrat
// TRANSFORME l'annonce (elle passe en CONFIRME, `match/[matchId]/signature`) et la section 184
// la retire du feed. Mais « Définir l'occupant » crée une brique SÉPARÉE et ne touche à aucune
// annonce en cours : aucun match n'existe, donc rien ne se déclenche. Les deux façons de pourvoir
// un poste ne produisent pas le même état.
//
// ON SIGNALE, ON NE FERME PAS. Le produit ne peut pas savoir si l'annonce est obsolète ou si elle
// cherche le successeur de l'occupant — auquel cas ce sont ses DATES qui sont fausses, pas son
// existence. Fermer d'autorité trancherait à la place du titulaire, et sur trois candidats en
// attente. L'écran nomme le fait et les deux issues, comme pour la période écoulée.
//
// LE REMPLACEMENT EST EXCLU, et c'est le cœur de la règle : un remplaçant se loge PAR DÉFINITION
// dans une occupation en cours. Sans cette exclusion, l'avertissement se déclencherait sur le cas
// nominal — l'annonce de trois semaines sur le siège du titulaire, sous sa propre présence — et
// un avertissement faux use les vrais (leçon du 13/09, juste au-dessus).
export function posteDejaTenu(
  m: MissionData, missionsDuPoste: MissionData[],
): MissionData | null {
  if (!m.isActive || m.briqueStatus !== "RECHERCHE") return null;
  if (m.missionType === "REMPLACEMENT") return null;
  const debut = toDate(m.startDate);
  if (!debut) return null;
  const fin = toDate(m.departureDate) ?? toDate(m.endDate) ?? RANGE_END;
  return (
    missionsDuPoste.find((o) => {
      if (o.id === m.id) return false;
      if (!["CONFIRME", "OCCUPE", "PREAVIS"].includes(o.briqueStatus)) return false;
      const oDebut = toDate(o.startDate);
      if (!oDebut) return false;
      const oFin = toDate(o.departureDate) ?? toDate(o.endDate) ?? RANGE_END;
      return oDebut < fin && debut < oFin;
    }) ?? null
  );
}

export function computeOwnerSeatGaps(missions: MissionData[]): { start: Date; end: Date }[] {
  const now = new Date();
  return missions
    .filter((m) => m.briqueStatus.startsWith("ABSENT"))
    .map((m) => ({ start: toDate(m.startDate), end: toDate(m.endDate) ?? RANGE_END }))
    .filter((g): g is { start: Date; end: Date } => g.start !== null && g.end > now)
    .map((g) => ({ start: g.start < now ? now : g.start, end: g.end > RANGE_END ? RANGE_END : g.end }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function computeUncoveredGaps(missions: MissionData[]): { start: Date; end: Date }[] {
  const now = new Date();
  if (now >= RANGE_END) return [];
  const effectiveStart = now > RANGE_START ? now : RANGE_START;
  // endDate null = occupation en durée indéterminée → couvre jusqu'à la fin de la plage
  // La date de départ prévue (section 6) borne la couverture : après elle, la période
  // devient non couverte (donc NON_COUVERT, ou RECRUTEMENT si une annonce la couvre).
  const covered = missions
    .filter(m => toDate(m.startDate))
    .map(m => ({ start: toDate(m.startDate)!, end: toDate(m.departureDate) ?? toDate(m.endDate) ?? RANGE_END }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const gaps: { start: Date; end: Date }[] = [];
  let cursor = effectiveStart;
  for (const seg of covered) {
    if (seg.start > cursor) gaps.push({ start: cursor, end: seg.start < RANGE_END ? seg.start : RANGE_END });
    if (seg.end > cursor) cursor = seg.end;
  }
  if (cursor < RANGE_END) gaps.push({ start: cursor, end: RANGE_END });
  return gaps;
}

// Graduation d'urgence d'une zone non couverte selon la proximité (section 47)
export function daysUntil(d: Date): number {
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

export function uncoveredUrgency(gapStart: Date): { cls: string; urgent: boolean; label: string } {
  const joursAvant = daysUntil(gapStart);
  if (joursAvant <= 30) return { cls: "bg-[var(--corail-signal)]", urgent: true,  label: "Critique — agir maintenant" };
  if (joursAvant <= 90) return { cls: "bg-[var(--orange-vif)]",    urgent: false, label: "À traiter dans les prochaines semaines" };
  return { cls: "bg-[var(--orange-pale)]", urgent: false, label: "À anticiper" };
}

// ── Vue verticale mobile (portrait < 640px) ──────────────────────────────────────
// La fenêtre temporelle dépend du zoom sélectionné (section 91) — sinon le zoom
// n'a aucun effet visible sur mobile. ~10% de passé, le reste pour le futur (section 87).
export function mobileWindow(spanDays: number): { start: Date; end: Date } {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - Math.round(spanDays * 0.1));
  const end = new Date(start); end.setDate(end.getDate() + spanDays);
  return { start, end };
}

export function pctIn(d: Date, start: Date, end: Date): number {
  const span = (end.getTime() - start.getTime()) / 86400000;
  return Math.max(0, Math.min(((d.getTime() - start.getTime()) / 86400000 / span) * 100, 100));
}

export interface MobileBrick {
  key: string;
  // Sous-ligne attribuée (voir assignLanes). undefined = pleine hauteur (fonds, zones non
  // couvertes) : ces éléments ne concurrencent aucune brique, ils la portent.
  lane?: number;
  leftPct: number;
  widthPct: number;
  colorCls: string;   // "bg-... text-..." ou "timeline-hatch text-white"
  urgent?: boolean;
  suiviDot?: string;  // pastille de suivi (section 200) — classe de couleur, ou absente
  label: string;
  title: string;
  onClick: (e: React.MouseEvent) => void;
}

export type Panel =
  | { type: "uncovered"; post: PostData }
  | { type: "covered"; mission: MissionData; post: PostData }
  | { type: "notice"; mission: MissionData; post: PostData }
  | { type: "add_post" }
  | { type: "declare_absence"; suggestedStart: string; suggestedEnd: string }
  | null;

export interface DropdownState {
  mission: MissionData | null; // null = ouverture au niveau du poste (poste vide / label)
  post: PostData;
  isSelf: boolean;
  x: number;
  y: number;
  suggestedStart?: string; // dates de la zone cliquée (préremplissage annonce / occupation)
  suggestedEnd?: string;
}

export interface ConfirmState {
  title: string;
  body: string;
  onConfirm: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

export function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d;
}

export function dayOffset(d: Date): number {
  return Math.floor((d.getTime() - RANGE_START.getTime()) / 86400000);
}

export function fmtDate(d: Date | string | null): string {
  if (!d) return "";
  // timeZone UTC : les dates « jour seul » sont stockées à minuit UTC ; sans ça, un fuseau
  // négatif (Guadeloupe UTC−4) affiche la veille (10 août → « 9 août »). Voir lib/dates.ts.
  return new Date(d as string).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" });
}

export interface MonthLabel { monthShort: string; year: string; isYearStart: boolean; offset: number; index: number }

export function monthLabels(dayWidth: number): MonthLabel[] {
  const labels: MonthLabel[] = [];
  const cur = new Date(RANGE_START);
  cur.setDate(1);
  let index = 0;
  while (cur < RANGE_END) {
    labels.push({
      monthShort: cur.toLocaleDateString("fr-FR", { month: "short" }),
      year: cur.toLocaleDateString("fr-FR", { year: "2-digit" }),
      isYearStart: cur.getMonth() === 0,
      offset: dayOffset(cur) * dayWidth,
      index,
    });
    cur.setMonth(cur.getMonth() + 1);
    index++;
  }
  return labels;
}

// Publication ciblée depuis une zone du planning (section 92) — construit l'URL du
// formulaire d'annonce en reprenant le TYPE du poste et en liant cabinetPostId, pour
// que le futur match s'attribue directement à cette ligne du planning.
export function buildCreateHref(opts: { postType: string; postId: string; postLabel?: string; start: string; end: string; isOwnerSeat?: boolean }): string {
  const needType =
    opts.postType === "ASSISTANT" ? "assistant" :
    opts.postType === "COLLABORATION" ? "collaboration" : "remplacement";
  const params = new URLSearchParams();
  // #2 — ne jamais proposer une date de début passée pour une nouvelle annonce
  // (ex. « successeur » démarrant à la fin d'un poste déjà terminé). Saisie manuelle libre.
  // Poste VIDE : aucune date suggérée n'existe (pas de mission de référence) — on retombe sur
  // aujourd'hui plutôt que de n'envoyer aucun startDate. Sans lui, l'annonce se créait sans
  // date de début et n'apparaissait sur aucune ligne du planning. Valeur toujours modifiable.
  const start = opts.start || new Date().toISOString().slice(0, 10);
  params.set("startDate", notPast(start));
  // Pas d'endDate pour assistant/collaboration (durée = minMonths ; un endDate court
  // ferait échouer la validation 90 jours côté serveur).
  if (opts.end && needType === "remplacement") params.set("endDate", opts.end);
  params.set("needType", needType);
  // Siège du titulaire : un assistant occupe une AUTRE ligne, jamais celle-ci. Depuis ce siège
  // on ne peut donc chercher qu'un remplaçant — recruter un assistant suppose d'abord de créer
  // le poste, puis de poser la demande sur SA ligne. Le formulaire lit ce drapeau pour ne
  // proposer que le remplacement ; le serveur refuse de son côté, l'URL étant modifiable.
  if (opts.isOwnerSeat) params.set("seatOnly", "1");
  if (opts.postId && opts.postId !== "self") params.set("cabinetPostId", opts.postId);
  // Titre suggéré "Succession poste [nom]" (section 92) — éditable par le titulaire
  if (opts.postLabel && opts.postId !== "self") params.set("title", `Succession poste ${opts.postLabel}`);
  return `/missions/create?${params.toString()}`;
}

// Facteur de saut des labels de mois selon le zoom (item 7 — lisibilité en vue condensée)
export function monthSkipFor(zoom: Zoom): number {
  if (zoom === "triennial") return 3; // 1 mois sur 3
  if (zoom === "year") return 2;       // 1 mois sur 2
  return 1;                            // tous les mois
}

// Statut effectif d'une brique : override local en cours d'édition, sinon ce qui est STOCKÉ —
// précisé en « remplaçant en place » quand la brique se loge dans un occupant du même poste.
export function getEffectiveStatus(
  mission: MissionData,
  post: PostData,
  localStatuses: Record<string, string>
): string {
  const local = localStatuses[mission.id];
  if (local) return local;
  const base = statutStocke(mission);
  return base === "CONFIRME" && remplaceUnOccupant(mission, post) ? "REMPLACANT_EN_PLACE" : base;
}

// ── REMPLAÇANT EN PLACE (section 297) ─────────────────────────────────────────────────────────
//
// Sur la ligne de Marion, « Simon » la remplaçait du 26/10 au 06/11 — et sa brique avait le vert
// exact de l'occupation de Marion, sans terme, qui couvre toute la ligne. Vert sur vert.
//
// L'état est DÉRIVÉ de la géométrie, pas du type d'annonce : une occupation déclarée depuis le
// Planning prend le type du POSTE (route presence), si bien qu'un remplaçant sur le poste d'une
// assistante était enregistré « assistanat », et la présence du titulaire sur son propre siège
// « remplacement ». Le type ne dit donc pas qui remplace qui ; l'inclusion, si : une occupation
// confirmée, bornée, posée DANS la période d'une occupation confirmée plus longue du même poste.
// Une couleur code un état, jamais une personne.
export const OCCUPE_CONFIRME = ["CONFIRME", "OCCUPE"];

export function remplaceUnOccupant(mission: MissionData, post: PostData): boolean {
  const debut = toDate(mission.startDate);
  const finPropre = toDate(mission.departureDate) ?? toDate(mission.endDate);
  if (!debut || !finPropre) return false; // sans terme : c'est un occupant, pas un remplaçant
  const duree = finPropre.getTime() - debut.getTime();
  return post.missions.some((o) => {
    if (o.id === mission.id || !OCCUPE_CONFIRME.includes(statutStocke(o))) return false;
    const oDebut = toDate(o.startDate);
    if (!oDebut) return false;
    const oFin = (toDate(o.departureDate) ?? toDate(o.endDate) ?? RANGE_END).getTime();
    return oDebut.getTime() <= debut.getTime() && oFin >= finPropre.getTime() && oFin - oDebut.getTime() > duree;
  });
}

export function statutStocke(mission: MissionData): string {
  const stored = mission.briqueStatus;
  // PREAVIS retiré (section 6) — les anciennes briques s'affichent comme CONFIRME
  if (stored === "PREAVIS") return "CONFIRME";
  // Si le statut a été modifié manuellement (différent du défaut RECHERCHE), on l'utilise
  if (stored !== "RECHERCHE") return stored;

  // AUCUNE DÉRIVATION DEPUIS LES MISES EN RELATION (section 221, 01/09).
  //
  // Le vert « Confirmé » du Planning dit UNE chose : le poste est pourvu. Il se déduisait de
  // `Match.status === "CONFIRME"`, ce qui semblait prudent — un premier correctif avait déjà
  // restreint la règle de « n'importe quelle mise en relation » à « une mise en relation
  // confirmée ». Mais `MatchStatus.CONFIRME` ne veut pas dire « contrat conclu » : le bouton
  // « Confirmer » de la page Relations, posé à côté de « Décliner », le pose à la main et se lit
  // « oui, cette relation m'intéresse ». Constaté le 01/09 : une brique au vert avec les DEUX
  // signatures à `null`.
  //
  // Deux faits distincts vivaient donc sur la même valeur d'enum. Le Planning ne les distingue
  // plus en devinant : il ne lit que ce qui a été ÉCRIT, c'est-à-dire
  //   (a) la signature des deux parties, qui écrit `briqueStatus = CONFIRME` (route signature) ;
  //   (b) la déclaration explicite d'un poste occupé à sa création (route cabinet-posts).
  // Tout le reste reste RECHERCHE : l'annonce recrute encore, et c'est vrai.
  //
  // On ne remplace PAS par un autre signal dérivé (« relation en cours ») : ce serait rouvrir la
  // même confusion sur une autre couleur. Le nombre de relations est déjà affiché à côté.
  return "RECHERCHE";
}

// ── Menu à 3 choix au clic sur un poste (section 55) ─────────────────────────────

export interface UncoveredChoiceState {
  post: PostData;
  suggestedStart: string;
  suggestedEnd: string;
  absenceMissionId?: string; // présent si la zone provient d'une absence déclarée (item 1)
}

export const ABSENCE_OPTIONS = [
  { value: "ABSENT_CONGE",     label: "Congés",        briqueStatus: "ABSENT_CONGE"     },
  { value: "ABSENT_FORMATION", label: "Formation",     briqueStatus: "ABSENT_FORMATION" },
  { value: "ABSENT_MALADIE",   label: "Arrêt maladie", briqueStatus: "ABSENT_MALADIE"   },
  { value: "AUTRE",            label: "Autre",         briqueStatus: "ABSENT_CONGE"     },
];
