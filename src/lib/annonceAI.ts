// Assistance IA à la saisie d'annonce (refonte texte-libre). SERVEUR UNIQUEMENT — appelle
// DeepSeek. Trois usages distincts, chacun déclenché par une action explicite de l'utilisateur :
//   1. extractAnnonceFields  — extrait les champs structurés + l'accroche de carte (ZÉRO invention)
//   2. proposeAnnonceTitle    — propose un titre court et accrocheur
//   3. redactionHelp          — étoffe le texte à partir des annonces passées de l'utilisateur
//   4. optimizeAnnonce        — 1 à 3 ajouts concrets manquants, adaptés au rôle
// Le rate-limiting (checkDeepSeekBudget/recordDeepSeekCall) est géré par la route API appelante.
// Toute fonction renvoie null en cas d'échec réseau/parse → dégradation gracieuse côté UI.

import { z } from "zod";
import { COMMUNES_GUADELOUPE, ZONE_ORDER, ZONE_LABELS, type ZoneGeo } from "@/lib/communes";

// TROIS rôles, pas deux (section 195). « cabinet » couvrait indistinctement le cabinet libéral
// et l'établissement employeur : le modèle recevait donc « tu aides un cabinet de
// kinésithérapie » pour une offre de CDI hospitalier, et se voyait demander de suggérer en
// priorité un CHIFFRE D'AFFAIRES et un TAUX DE RÉTROCESSION — deux notions sans objet pour un
// salarié, et deux champs que le formulaire employeur ne propose plus.
export type AnnonceRole = "cabinet" | "candidat" | "employeur";

// Un employeur PUBLIE une offre, comme un cabinet : les champs extraits sont les mêmes.
// Seul le vocabulaire des consignes change.
export const publieUneOffre = (r: AnnonceRole) => r === "cabinet" || r === "employeur";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

// Appel bas niveau DeepSeek en mode JSON. Renvoie l'objet parsé, ou null (réseau/parse KO).
async function deepseekJSON(system: string, user: string, maxTokens = 700): Promise<unknown | null> {
  if (!process.env.DEEPSEEK_API_KEY) return null;
  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        "Accept-Encoding": "identity",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// ── Normalisation pour la vérification anti-hallucination ────────────────────────
// On accepte une valeur extraite UNIQUEMENT si son « evidence » (extrait verbatim rendu par
// le modèle) se retrouve réellement dans le texte source. Comparaison insensible à la casse
// et aux accents, espaces normalisés.
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function evidencePresent(evidence: unknown, sourceNorm: string): boolean {
  if (typeof evidence !== "string" || evidence.trim().length < 2) return false;
  return sourceNorm.includes(norm(evidence));
}

// ── Garde-fou anti-invention de l'accroche ───────────────────────────────────────
// L'accroche est le SEUL champ extrait qui n'est pas une copie verbatim : c'est une
// CONDENSATION en une phrase du texte de l'utilisateur. Elle ne peut donc pas passer par le
// contrôle d'evidence. On applique à la place deux règles :
//   1. aucun nombre absent du texte source (un taux ou un CA inventé est interdit) ;
//   2. le vocabulaire porteur de sens vient majoritairement du texte (pas d'argument ajouté).
const ACCROCHE_STOPWORDS = new Set([
  "notre", "votre", "leurs", "nous", "vous", "dans", "avec", "pour", "sans", "chez", "cette",
  "celui", "celle", "entre", "aussi", "toute", "toutes", "tous", "plus", "moins", "tres",
  "bien", "etre", "avoir", "faire", "sommes", "suis", "propose", "proposons", "recherche",
  "recherchons", "cherche", "cherchons", "disponible", "poste", "cabinet", "kinesitherapeute",
  "kine", "guadeloupe",
]);
function accrocheIsFaithful(accroche: string, sourceNorm: string): boolean {
  const a = norm(accroche);
  // 1. Chiffres : tout nombre de l'accroche doit exister tel quel dans le texte.
  const nums = a.match(/\d+/g) ?? [];
  if (nums.some((n) => !sourceNorm.includes(n))) return false;
  // 2. Vocabulaire : ≥ 60 % des mots significatifs présents dans le texte (comparaison par
  //    préfixe pour tolérer les accords/conjugaisons, accents déjà retirés par norm()).
  const words = a.split(/[^a-z0-9]+/).filter((w) => w.length >= 5 && !ACCROCHE_STOPWORDS.has(w));
  if (words.length === 0) return true;
  const known = words.filter((w) => sourceNorm.includes(w.slice(0, w.length - 2))).length;
  return known / words.length >= 0.6;
}

// Nettoie et borne l'accroche : guillemets/points parasites retirés, troncature sur un mot
// entier (jamais au milieu d'un mot) au cap du rôle.
function cleanAccroche(raw: string, limit: number): string {
  let s = raw.replace(/\s+/g, " ").trim().replace(/^["'«»\s]+|["'«»\s]+$/g, "");
  if (s.length > limit) {
    s = s.slice(0, limit);
    const cut = s.lastIndexOf(" ");
    if (cut > limit * 0.6) s = s.slice(0, cut);
    s = s.replace(/[\s,;:]+$/, "");
  }
  return s;
}

// ── 1. Extraction stricte ────────────────────────────────────────────────────────

// Résultat d'extraction : uniquement les champs RÉELLEMENT présents dans le texte. Tout champ
// absent est omis (jamais inventé). Les dates sont en yyyy-mm-dd. `repartition`/`methode` sont
// des tags d'affichage (non persistés en colonne).
export interface ExtractedFields {
  accroche?: string; // phrase de carte de swipe, CONDENSÉE du texte (jamais un ajout créatif)
  missionType?: "REMPLACEMENT" | "ASSISTANAT" | "COLLABORATION";
  startDate?: string; // yyyy-mm-dd
  endDate?: string;   // yyyy-mm-dd
  minMonths?: number;
  commune?: string;
  retrocessionRate?: number; // 0-100
  caMensuelEstime?: number;
  remunerationBrute?: number; // employeur : salaire brut mensuel (section 194)
  logementPropose?: boolean;
  vehiculePropose?: boolean;
  secretairePresente?: boolean; // secrétariat sur place
  exerciceCoordonne?: boolean;  // MSP / centre de santé / ESP
  demiJourneesLibres?: number; // 0-10
  repartition?: string; // ex. « cabinet + domicile » — tag affichage
  methode?: string;     // ex. « Mézières, sport » — tag affichage
  // ── Candidat (disponibilité) : géo en macro-zones + besoins (sémantique « recherche ») ──
  zones?: string[];            // macro-zones souhaitées (ZoneGeo)
  rechercheLogement?: boolean; // le candidat cherche un logement
  rechercheVehicule?: boolean; // le candidat a besoin d'un véhicule
  rechercheSecretariat?: boolean;       // le candidat privilégie un cabinet avec secrétariat
  rechercheExerciceCoordonne?: boolean; // le candidat souhaite exercer en structure coordonnée
  ouvertSalariat?: boolean;    // ouvert aux postes salariés
}

// Schéma de la réponse brute du modèle : chaque champ = { value, evidence } | null.
const fieldWithEvidence = z
  .object({ value: z.unknown().nullable().optional(), evidence: z.string().nullable().optional() })
  .nullable()
  .optional();
const rawExtractionSchema = z.object({
  // Seul champ hors format {value, evidence} : une phrase libre (condensation). On tolère
  // quand même la forme objet, au cas où le modèle applique le gabarit commun.
  accroche: z
    .union([z.string(), z.object({ value: z.string().nullable().optional() })])
    .nullable()
    .optional(),
  missionType: fieldWithEvidence,
  startDate: fieldWithEvidence,
  endDate: fieldWithEvidence,
  minMonths: fieldWithEvidence,
  commune: fieldWithEvidence,
  retrocessionRate: fieldWithEvidence,
  caMensuelEstime: fieldWithEvidence,
  remunerationBrute: fieldWithEvidence,
  logementPropose: fieldWithEvidence,
  vehiculePropose: fieldWithEvidence,
  secretairePresente: fieldWithEvidence,
  exerciceCoordonne: fieldWithEvidence,
  demiJourneesLibres: fieldWithEvidence,
  repartition: fieldWithEvidence,
  methode: fieldWithEvidence,
  zones: fieldWithEvidence,
  rechercheLogement: fieldWithEvidence,
  rechercheVehicule: fieldWithEvidence,
  rechercheSecretariat: fieldWithEvidence,
  rechercheExerciceCoordonne: fieldWithEvidence,
  ouvertSalariat: fieldWithEvidence,
});

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Rapproche une commune extraite du référentiel (tolérant casse/accents), sinon rejette.
function matchCommune(raw: string): string | undefined {
  const n = norm(raw);
  return COMMUNES_GUADELOUPE.find((c) => norm(c) === n || norm(c).includes(n) || n.includes(norm(c)));
}

// `bioLimit` = cap de l'accroche du rôle (700 cabinet / 280 candidat, cf. lib/bio).
export async function extractAnnonceFields(
  text: string,
  role: AnnonceRole,
  bioLimit = 280,
): Promise<ExtractedFields | null> {
  const source = text.trim();
  if (source.length < 10) return {};

  // Cible de longueur de l'accroche : bornée par le cap du rôle, mais on vise court —
  // c'est une phrase de carte de swipe, pas un résumé.
  const accrocheTarget = Math.min(bioLimit, 220);

  // Bloc de champs adapté au rôle. Commun aux deux + spécifiques cabinet (offre) / candidat (besoins).
  const commonFields = `  "missionType":       {"value":"REMPLACEMENT|ASSISTANAT|COLLABORATION","evidence":"..."} | null,
  "startDate":         {"value":"yyyy-mm-dd","evidence":"..."} | null,   // début SEULEMENT si jour+mois+année déterminables sans supposition
  "endDate":           {"value":"yyyy-mm-dd","evidence":"..."} | null,
  "minMonths":         {"value":<entier mois>,"evidence":"..."} | null,  // durée minimale (assistanat/collaboration)
  "methode":           {"value":"<ex: Mézières, sport>","evidence":"..."} | null`;
  // Un EMPLOYEUR verse un salaire : ni retrocession ni chiffre d'affaires. Lui demander un
  // « caMensuelEstime » revenait a ranger sa remuneration dans le champ du liberal — champ que
  // le formulaire employeur n'affiche plus et que la soumission met a null. Le chiffre saisi
  // dans le texte libre etait donc extrait, puis PERDU.
  const employeurFields = `  "commune":           {"value":"<commune de Guadeloupe>","evidence":"..."} | null,
  "remunerationBrute": {"value":<entier euros/mois>,"evidence":"..."} | null, // salaire BRUT mensuel. Un « 2600 € brut » se saisit 2600. Ne JAMAIS remplir retrocessionRate ni caMensuelEstime pour un employeur : un salarie ne retrocede rien et ne realise pas de chiffre d'affaires.
  "demiJourneesLibres":{"value":<entier 0-10>,"evidence":"..."} | null,
  "repartition":       {"value":"<ex: plateau technique + chambres>","evidence":"..."} | null`;
  const cabinetFields = `  "commune":           {"value":"<commune de Guadeloupe>","evidence":"..."} | null,
  "retrocessionRate":  {"value":<entier 0-100>,"evidence":"..."} | null, // CONVENTION IMPÉRATIVE : pour un REMPLACEMENT, la part que le REMPLAÇANT CONSERVE (« 75/25 » → 75) ; pour un ASSISTANAT ou une COLLABORATION, la redevance REVERSÉE AU CABINET (« 75/25 » → 25). C'est ce chiffre qui ira au contrat.
  "caMensuelEstime":   {"value":<entier euros/mois>,"evidence":"..."} | null,
  "logementPropose":   {"value":true,"evidence":"..."} | null,           // true UNIQUEMENT si le cabinet PROPOSE un logement
  "vehiculePropose":   {"value":true,"evidence":"..."} | null,           // true UNIQUEMENT si le cabinet MET un véhicule à disposition
  "secretairePresente":{"value":true,"evidence":"..."} | null,           // true UNIQUEMENT si une SECRÉTAIRE / un secrétariat est présent au cabinet (« secrétariat », « accueil », « télésecrétariat » NON)
  "exerciceCoordonne": {"value":true,"evidence":"..."} | null,           // true UNIQUEMENT si le cabinet exerce en MSP (maison de santé pluriprofessionnelle), centre de santé ou équipe de soins primaires. « pluridisciplinaire » ou « avec des médecins » NE SUFFIT PAS : il faut la structure de coordination nommée
  "demiJourneesLibres":{"value":<entier 0-10>,"evidence":"..."} | null,  // demi-journées libres/semaine
  "repartition":       {"value":"<ex: cabinet + domicile>","evidence":"..."} | null`;
  const candidatFields = `  "zones":             {"value":[<une ou plusieurs clés parmi : ${ZONE_ORDER.map((z) => `${z} (${ZONE_LABELS[z]})`).join(", ")}>],"evidence":"..."} | null,
  "rechercheLogement": {"value":true,"evidence":"..."} | null,           // true UNIQUEMENT si le candidat CHERCHE un logement
  "rechercheVehicule": {"value":true,"evidence":"..."} | null,           // true UNIQUEMENT si le candidat a BESOIN d'un véhicule
  "rechercheSecretariat":{"value":true,"evidence":"..."} | null,         // true UNIQUEMENT si le candidat DEMANDE un cabinet avec secrétariat
  "rechercheExerciceCoordonne":{"value":true,"evidence":"..."} | null,   // true UNIQUEMENT si le candidat SOUHAITE exercer en MSP / centre de santé / structure coordonnée
  "ouvertSalariat":    {"value":true,"evidence":"..."} | null`;          // true si ouvert aux postes salariés (CDD/CDI/vacation)
  const fieldsBlock =
    role === "employeur" ? `${commonFields},\n${employeurFields}`
    : role === "cabinet" ? `${commonFields},\n${cabinetFields}`
    : `${commonFields},\n${candidatFields}`;
  // L'accroche (carte de swipe) est extraite DANS LE MÊME APPEL : l'utilisateur ne saisit plus
  // qu'une seule zone de texte, l'accroche en est une condensation qu'il pourra corriger.
  const accrocheField = `  "accroche": "<une seule phrase, ${accrocheTarget} caractères max>" | null`;

  const system = `Tu es un extracteur d'informations pour une plateforme de mise en relation de kinésithérapeutes en Guadeloupe.
On te donne une annonce ${role === "employeur" ? "d'un établissement de santé qui EMBAUCHE un salarié (vacation, CDD ou CDI)" : role === "cabinet" ? "de cabinet libéral qui recrute" : "d'un remplaçant/assistant qui se propose"}, rédigée en texte libre.
Tu dois extraire UNIQUEMENT les informations EXPLICITEMENT présentes dans le texte.

RÈGLE ABSOLUE : n'invente JAMAIS une valeur. Si une information n'est pas clairement dans le texte, mets le champ à null.
Un taux de rétrocession ou un chiffre d'affaires inventé finirait dans un contrat : c'est interdit.

Pour CHAQUE champ non nul, tu dois fournir "evidence" = un extrait VERBATIM (copié mot pour mot depuis le texte) qui justifie la valeur. Sans extrait verbatim, mets null.

SEULE EXCEPTION — le champ "accroche" : c'est une phrase libre, pas une copie. Tu CONDENSES en UNE phrase courte et percutante ce que la personne a écrit, pour l'afficher sur sa carte d'annonce. Contraintes :
- ${publieUneOffre(role) ? (role === "employeur" ? "écrite du point de vue de l'établissement" : "écrite du point de vue du cabinet") : "écrite à la première personne, du point de vue du candidat"}, ton naturel, sans guillemets ;
- ${accrocheTarget} caractères maximum, une seule phrase ;
- AUCUNE promesse, AUCUN argument, AUCUN chiffre qui ne figure pas déjà dans le texte : tu condenses, tu n'ajoutes rien ;
- si le texte est trop pauvre pour en tirer une phrase, mets null.

Réponds en JSON avec cette forme exacte (chaque champ sauf "accroche" = {"value": ..., "evidence": "extrait verbatim"} ou null) :
{
${accrocheField},
${fieldsBlock}
}
N'ajoute aucun autre champ, aucun commentaire, aucune explication.`;

  const parsedRaw = await deepseekJSON(system, source, 1000);
  if (parsedRaw === null) return null; // échec réseau/parse → l'appelant gère la dégradation
  const safe = rawExtractionSchema.safeParse(parsedRaw);
  if (!safe.success) return {};

  const r = safe.data;
  const srcNorm = norm(source);
  const out: ExtractedFields = {};

  // Helper : renvoie value seulement si evidence est réellement dans le texte source.
  const accepted = (f: { value?: unknown; evidence?: string | null } | null | undefined): unknown => {
    if (!f || f.value === null || f.value === undefined) return undefined;
    if (!evidencePresent(f.evidence, srcNorm)) return undefined;
    return f.value;
  };
  // Pour un nombre : en plus de l'evidence, les chiffres doivent apparaître dans le texte.
  const acceptedNumber = (f: { value?: unknown; evidence?: string | null } | null | undefined): number | undefined => {
    const v = accepted(f);
    const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
    if (!Number.isFinite(n)) return undefined;
    return srcNorm.includes(String(n)) ? n : undefined;
  };

  // Accroche : condensation → contrôlée par accrocheIsFaithful (pas d'evidence possible).
  // Rejetée en silence si elle ajoute un chiffre ou un argument absent du texte ; l'UI
  // retombe alors sur la saisie manuelle, jamais de blocage.
  const rawAcc = typeof r.accroche === "string" ? r.accroche : r.accroche?.value ?? null;
  if (typeof rawAcc === "string") {
    const acc = cleanAccroche(rawAcc, bioLimit);
    if (acc.length >= 20 && accrocheIsFaithful(acc, srcNorm)) out.accroche = acc;
  }

  const mt = accepted(r.missionType);
  if (mt === "REMPLACEMENT" || mt === "ASSISTANAT" || mt === "COLLABORATION") out.missionType = mt;

  const sd = accepted(r.startDate);
  if (typeof sd === "string" && ISO_DATE.test(sd) && !isNaN(Date.parse(sd))) out.startDate = sd;
  const ed = accepted(r.endDate);
  if (typeof ed === "string" && ISO_DATE.test(ed) && !isNaN(Date.parse(ed))) out.endDate = ed;

  const mm = acceptedNumber(r.minMonths);
  if (mm !== undefined && mm >= 1 && mm <= 24) out.minMonths = mm;

  const met = accepted(r.methode);
  if (typeof met === "string" && met.trim()) out.methode = met.trim().slice(0, 120);

  if (publieUneOffre(role)) {
    const com = accepted(r.commune);
    if (typeof com === "string") { const m = matchCommune(com); if (m) out.commune = m; }

    const rr = acceptedNumber(r.retrocessionRate);
    if (rr !== undefined && rr >= 0 && rr <= 100) out.retrocessionRate = rr;

    const ca = acceptedNumber(r.caMensuelEstime);
    if (ca !== undefined && ca >= 0 && ca <= 1000000) out.caMensuelEstime = ca;

    const rb = acceptedNumber(r.remunerationBrute);
    if (rb !== undefined && rb >= 0 && rb <= 1000000) out.remunerationBrute = rb;

    if (accepted(r.logementPropose) === true) out.logementPropose = true;
    if (accepted(r.vehiculePropose) === true) out.vehiculePropose = true;
    if (accepted(r.secretairePresente) === true) out.secretairePresente = true;
    if (accepted(r.exerciceCoordonne) === true) out.exerciceCoordonne = true;

    const dj = acceptedNumber(r.demiJourneesLibres);
    if (dj !== undefined && dj >= 0 && dj <= 10) out.demiJourneesLibres = dj;

    const rep = accepted(r.repartition);
    if (typeof rep === "string" && rep.trim()) out.repartition = rep.trim().slice(0, 120);
  } else {
    // Candidat : géo en macro-zones + besoins (sémantique « recherche »).
    const zf = r.zones;
    if (zf && Array.isArray(zf.value) && evidencePresent(zf.evidence, srcNorm)) {
      const valid = (zf.value as unknown[]).filter(
        (z): z is ZoneGeo => typeof z === "string" && (ZONE_ORDER as string[]).includes(z),
      );
      if (valid.length) out.zones = Array.from(new Set(valid));
    }
    if (accepted(r.rechercheLogement) === true) out.rechercheLogement = true;
    if (accepted(r.rechercheVehicule) === true) out.rechercheVehicule = true;
    if (accepted(r.rechercheSecretariat) === true) out.rechercheSecretariat = true;
    if (accepted(r.rechercheExerciceCoordonne) === true) out.rechercheExerciceCoordonne = true;
    if (accepted(r.ouvertSalariat) === true) out.ouvertSalariat = true;
  }

  return out;
}

// ── 2. Titre proposé ──────────────────────────────────────────────────────────────

export async function proposeAnnonceTitle(text: string, role: AnnonceRole): Promise<string | null> {
  const source = text.trim();
  if (source.length < 10) return null;
  const system = `Tu proposes un titre court et accrocheur pour une annonce ${role === "employeur" ? "d'un établissement de santé qui embauche un kinésithérapeute salarié" : role === "cabinet" ? "de cabinet de kinésithérapie qui recrute" : "d'un kinésithérapeute qui se propose"} en Guadeloupe.
Le titre : localisation + type de poste + une ou deux caractéristiques fortes RÉELLEMENT présentes dans le texte. Max 90 caractères, sans guillemets, sans point final. N'invente rien.
Réponds en JSON : {"title":"..."}.`;
  const parsed = await deepseekJSON(system, source, 60);
  if (parsed === null) return null;
  const safe = z.object({ title: z.string() }).safeParse(parsed);
  if (!safe.success) return null;
  return safe.data.title.trim().replace(/^["'«»\s]+|["'«»\s.]+$/g, "").slice(0, 100) || null;
}

// ── 3. Aide à la rédaction (référence : annonces passées de l'utilisateur) ──────────

export async function redactionHelp(
  text: string,
  role: AnnonceRole,
  pastTexts: string[],
): Promise<string | null> {
  const draft = text.trim();
  const refs = pastTexts.map((t) => t.trim()).filter(Boolean).slice(0, 3);
  const qui =
    role === "employeur" ? "établissement de santé (clinique, EHPAD, centre) en Guadeloupe qui EMBAUCHE un kinésithérapeute SALARIÉ"
    : role === "cabinet" ? "cabinet de kinésithérapie libéral en Guadeloupe"
    : "kinésithérapeute remplaçant/assistant en Guadeloupe";
  // Un employeur ne rétrocède rien et n'a pas de patientèle à partager : le vocabulaire libéral
  // produisait un texte hors sujet sur une offre de CDI.
  const interdits =
    role === "employeur"
      ? `\nVOCABULAIRE : il s'agit d'un CONTRAT DE TRAVAIL, pas d'un exercice libéral. N'emploie jamais « rétrocession », « redevance », « patientèle du cabinet », « collaboration libérale » ni « chiffre d'affaires ». Parle de rémunération, de contrat, d'équipe, de conditions de travail.`
      : "";
  const system = `Tu aides un ${qui} à rédiger son annonce en texte libre, chaleureux et concret.${interdits}
${refs.length ? "Inspire-toi du STYLE et du niveau de détail de ses annonces précédentes ci-dessous, mais n'invente aucun fait nouveau : reprends uniquement les informations du brouillon actuel." : "N'invente aucun fait : reprends uniquement les informations du brouillon."}
Améliore la clarté, le ton et la structure. Garde un texte court (une dizaine de lignes max). Ne rajoute pas d'informations chiffrées (dates, taux, CA) absentes du brouillon.
Réponds en JSON : {"text":"annonce améliorée"}.`;
  const user = `${refs.length ? `Annonces précédentes de cet utilisateur (référence de style) :\n${refs.map((t, i) => `--- Exemple ${i + 1} ---\n${t}`).join("\n\n")}\n\n` : ""}Brouillon actuel à améliorer :\n${draft || "(vide — propose une trame à compléter)"}`;
  const parsed = await deepseekJSON(system, user, 800);
  if (parsed === null) return null;
  const safe = z.object({ text: z.string() }).safeParse(parsed);
  if (!safe.success) return null;
  return safe.data.text.trim() || null;
}

// ── 4. Optimisation (suggestions d'ajouts concrets, adaptées au rôle) ────────────────

// `known` = libellés des informations DÉJÀ renseignées (champs extraits ou saisis côté client).
// Sans cette liste, le modèle suggérait d'ajouter le CA, le véhicule ou l'ambiance alors qu'ils
// figuraient noir sur blanc dans le texte — constaté sur une annonce réelle où les 3 suggestions
// portaient sur des éléments présents.
export async function optimizeAnnonce(
  text: string,
  role: AnnonceRole,
  known: string[] = [],
): Promise<string[] | null> {
  const source = text.trim();
  if (source.length < 10) return [];
  const knownList = known.map((k) => k.trim()).filter(Boolean).slice(0, 20);
  const knownBlock = knownList.length
    ? `\n\nDÉJÀ RENSEIGNÉ — ne suggère JAMAIS d'ajouter ces informations, elles sont acquises :\n${knownList.map((k) => `- ${k}`).join("\n")}`
    : "";
  const roleGuidance =
    role === "employeur"
      ? `Côté établissement employeur, ce qui rend une offre attractive : rémunération brute, type de contrat et durée, temps de travail et horaires, composition de l'équipe, plateau technique, formation continue, logement possible.
NE SUGGÈRE JAMAIS un chiffre d'affaires ni un taux de rétrocession : un salarié ne rétrocède rien et ne réalise pas de chiffre d'affaires. La rémunération est l'information qui pèse le plus.`
      : role === "cabinet"
      ? `Côté cabinet, ce qui rend une annonce attractive et que les meilleures annonces contiennent : logement, véhicule, demi-journées libres, plateau technique/équipement, ambiance d'équipe, chiffre d'affaires estimé, taux de rétrocession, répartition cabinet/domicile.
Le chiffre d'affaires estimé et le taux de rétrocession sont les deux informations qui pèsent le plus : si — ET SEULEMENT SI — ils sont absents à la fois du texte et de la liste « déjà renseigné », propose-les en premier, avec un argument concret pour le candidat. Ils restent facultatifs : c'est une incitation, jamais une obligation.`
      : `Côté candidat, ce qui le sécurise et évite les oublis : disponibilités précises (dates), mobilité/zones, méthodes pratiquées, attentes sur le taux, logement/véhicule recherchés, expérience.`;
  const system = `Tu analyses une annonce ${role === "employeur" ? "d'établissement employeur" : role === "cabinet" ? "de cabinet libéral" : "de candidat"} kiné en Guadeloupe et proposes 1 à 3 AJOUTS concrets et actionnables qui MANQUENT dans le texte. ${roleGuidance}
RÈGLE ABSOLUE : relis le texte avant chaque suggestion. Si l'information y figure — même en abrégé, même en style télégraphique (« clim », « logé », « 75/25 », « ca 8000 »), même formulée négativement (« véhicule non fourni » = l'information EST donnée) — alors elle n'est PAS manquante : ne la suggère pas.
Mieux vaut renvoyer 0 suggestion qu'une suggestion portant sur quelque chose de déjà écrit.
Sois concret (pas de généralité). Formulation courte, à l'impératif.
Réponds en JSON : {"suggestions":["...","..."]} (0 à 3 éléments).${knownBlock}`;
  const parsed = await deepseekJSON(system, source, 300);
  if (parsed === null) return null;
  const safe = z.object({ suggestions: z.array(z.string()) }).safeParse(parsed);
  if (!safe.success) return [];
  return safe.data.suggestions.map((s) => s.trim()).filter(Boolean).slice(0, 3);
}
