// Assistance IA à la saisie d'annonce (refonte texte-libre). SERVEUR UNIQUEMENT — appelle
// DeepSeek. Trois usages distincts, chacun déclenché par une action explicite de l'utilisateur :
//   1. extractAnnonceFields  — extrait les champs structurés du texte (ZÉRO invention)
//   2. proposeAnnonceTitle    — propose un titre court et accrocheur
//   3. redactionHelp          — étoffe le texte à partir des annonces passées de l'utilisateur
//   4. optimizeAnnonce        — 1 à 3 ajouts concrets manquants, adaptés au rôle
// Le rate-limiting (checkDeepSeekBudget/recordDeepSeekCall) est géré par la route API appelante.
// Toute fonction renvoie null en cas d'échec réseau/parse → dégradation gracieuse côté UI.

import { z } from "zod";
import { COMMUNES_GUADELOUPE, ZONE_ORDER, ZONE_LABELS, type ZoneGeo } from "@/lib/communes";

export type AnnonceRole = "cabinet" | "candidat";

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

// ── 1. Extraction stricte ────────────────────────────────────────────────────────

// Résultat d'extraction : uniquement les champs RÉELLEMENT présents dans le texte. Tout champ
// absent est omis (jamais inventé). Les dates sont en yyyy-mm-dd. `repartition`/`methode` sont
// des tags d'affichage (non persistés en colonne).
export interface ExtractedFields {
  missionType?: "REMPLACEMENT" | "ASSISTANAT" | "COLLABORATION";
  startDate?: string; // yyyy-mm-dd
  endDate?: string;   // yyyy-mm-dd
  minMonths?: number;
  commune?: string;
  retrocessionRate?: number; // 0-100
  caMensuelEstime?: number;
  logementPropose?: boolean;
  vehiculePropose?: boolean;
  demiJourneesLibres?: number; // 0-10
  repartition?: string; // ex. « cabinet + domicile » — tag affichage
  methode?: string;     // ex. « Mézières, sport » — tag affichage
  // ── Candidat (disponibilité) : géo en macro-zones + besoins (sémantique « recherche ») ──
  zones?: string[];            // macro-zones souhaitées (ZoneGeo)
  rechercheLogement?: boolean; // le candidat cherche un logement
  rechercheVehicule?: boolean; // le candidat a besoin d'un véhicule
  ouvertSalariat?: boolean;    // ouvert aux postes salariés
}

// Schéma de la réponse brute du modèle : chaque champ = { value, evidence } | null.
const fieldWithEvidence = z
  .object({ value: z.unknown().nullable().optional(), evidence: z.string().nullable().optional() })
  .nullable()
  .optional();
const rawExtractionSchema = z.object({
  missionType: fieldWithEvidence,
  startDate: fieldWithEvidence,
  endDate: fieldWithEvidence,
  minMonths: fieldWithEvidence,
  commune: fieldWithEvidence,
  retrocessionRate: fieldWithEvidence,
  caMensuelEstime: fieldWithEvidence,
  logementPropose: fieldWithEvidence,
  vehiculePropose: fieldWithEvidence,
  demiJourneesLibres: fieldWithEvidence,
  repartition: fieldWithEvidence,
  methode: fieldWithEvidence,
  zones: fieldWithEvidence,
  rechercheLogement: fieldWithEvidence,
  rechercheVehicule: fieldWithEvidence,
  ouvertSalariat: fieldWithEvidence,
});

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Rapproche une commune extraite du référentiel (tolérant casse/accents), sinon rejette.
function matchCommune(raw: string): string | undefined {
  const n = norm(raw);
  return COMMUNES_GUADELOUPE.find((c) => norm(c) === n || norm(c).includes(n) || n.includes(norm(c)));
}

export async function extractAnnonceFields(text: string, role: AnnonceRole): Promise<ExtractedFields | null> {
  const source = text.trim();
  if (source.length < 10) return {};

  // Bloc de champs adapté au rôle. Commun aux deux + spécifiques cabinet (offre) / candidat (besoins).
  const commonFields = `  "missionType":       {"value":"REMPLACEMENT|ASSISTANAT|COLLABORATION","evidence":"..."} | null,
  "startDate":         {"value":"yyyy-mm-dd","evidence":"..."} | null,   // début SEULEMENT si jour+mois+année déterminables sans supposition
  "endDate":           {"value":"yyyy-mm-dd","evidence":"..."} | null,
  "minMonths":         {"value":<entier mois>,"evidence":"..."} | null,  // durée minimale (assistanat/collaboration)
  "methode":           {"value":"<ex: Mézières, sport>","evidence":"..."} | null`;
  const cabinetFields = `  "commune":           {"value":"<commune de Guadeloupe>","evidence":"..."} | null,
  "retrocessionRate":  {"value":<entier 0-100>,"evidence":"..."} | null, // % de rétrocession/redevance
  "caMensuelEstime":   {"value":<entier euros/mois>,"evidence":"..."} | null,
  "logementPropose":   {"value":true,"evidence":"..."} | null,           // true UNIQUEMENT si le cabinet PROPOSE un logement
  "vehiculePropose":   {"value":true,"evidence":"..."} | null,           // true UNIQUEMENT si le cabinet MET un véhicule à disposition
  "demiJourneesLibres":{"value":<entier 0-10>,"evidence":"..."} | null,  // demi-journées libres/semaine
  "repartition":       {"value":"<ex: cabinet + domicile>","evidence":"..."} | null`;
  const candidatFields = `  "zones":             {"value":[<une ou plusieurs clés parmi : ${ZONE_ORDER.map((z) => `${z} (${ZONE_LABELS[z]})`).join(", ")}>],"evidence":"..."} | null,
  "rechercheLogement": {"value":true,"evidence":"..."} | null,           // true UNIQUEMENT si le candidat CHERCHE un logement
  "rechercheVehicule": {"value":true,"evidence":"..."} | null,           // true UNIQUEMENT si le candidat a BESOIN d'un véhicule
  "ouvertSalariat":    {"value":true,"evidence":"..."} | null`;          // true si ouvert aux postes salariés (CDD/CDI/vacation)
  const fieldsBlock = role === "cabinet" ? `${commonFields},\n${cabinetFields}` : `${commonFields},\n${candidatFields}`;

  const system = `Tu es un extracteur d'informations pour une plateforme de mise en relation de kinésithérapeutes en Guadeloupe.
On te donne une annonce ${role === "cabinet" ? "de cabinet qui recrute" : "d'un remplaçant/assistant qui se propose"}, rédigée en texte libre.
Tu dois extraire UNIQUEMENT les informations EXPLICITEMENT présentes dans le texte.

RÈGLE ABSOLUE : n'invente JAMAIS une valeur. Si une information n'est pas clairement dans le texte, mets le champ à null.
Un taux de rétrocession ou un chiffre d'affaires inventé finirait dans un contrat : c'est interdit.

Pour CHAQUE champ non nul, tu dois fournir "evidence" = un extrait VERBATIM (copié mot pour mot depuis le texte) qui justifie la valeur. Sans extrait verbatim, mets null.

Réponds en JSON avec cette forme exacte (chaque champ = {"value": ..., "evidence": "extrait verbatim"} ou null) :
{
${fieldsBlock}
}
N'ajoute aucun autre champ, aucun commentaire, aucune explication.`;

  const parsedRaw = await deepseekJSON(system, source, 900);
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

  if (role === "cabinet") {
    const com = accepted(r.commune);
    if (typeof com === "string") { const m = matchCommune(com); if (m) out.commune = m; }

    const rr = acceptedNumber(r.retrocessionRate);
    if (rr !== undefined && rr >= 0 && rr <= 100) out.retrocessionRate = rr;

    const ca = acceptedNumber(r.caMensuelEstime);
    if (ca !== undefined && ca >= 0 && ca <= 1000000) out.caMensuelEstime = ca;

    if (accepted(r.logementPropose) === true) out.logementPropose = true;
    if (accepted(r.vehiculePropose) === true) out.vehiculePropose = true;

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
    if (accepted(r.ouvertSalariat) === true) out.ouvertSalariat = true;
  }

  return out;
}

// ── 2. Titre proposé ──────────────────────────────────────────────────────────────

export async function proposeAnnonceTitle(text: string, role: AnnonceRole): Promise<string | null> {
  const source = text.trim();
  if (source.length < 10) return null;
  const system = `Tu proposes un titre court et accrocheur pour une annonce ${role === "cabinet" ? "de cabinet de kinésithérapie qui recrute" : "d'un kinésithérapeute qui se propose"} en Guadeloupe.
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
  const system = `Tu aides un ${role === "cabinet" ? "cabinet de kinésithérapie" : "kinésithérapeute remplaçant/assistant"} en Guadeloupe à rédiger son annonce en texte libre, chaleureux et concret.
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

export async function optimizeAnnonce(text: string, role: AnnonceRole): Promise<string[] | null> {
  const source = text.trim();
  if (source.length < 10) return [];
  const roleGuidance =
    role === "cabinet"
      ? `Côté cabinet, ce qui rend une annonce attractive et que les meilleures annonces contiennent : logement, véhicule, demi-journées libres, plateau technique/équipement, ambiance d'équipe, chiffre d'affaires estimé, taux de rétrocession, répartition cabinet/domicile.
PRIORITÉ ABSOLUE : si le CHIFFRE D'AFFAIRES ESTIMÉ et/ou le TAUX DE RÉTROCESSION sont absents du texte, propose-les EN PREMIER, avec un argument concret pour le candidat (ex : « Ajoutez votre CA estimé et le taux de rétrocession : le candidat peut se projeter financièrement, et les annonces qui les indiquent reçoivent plus de candidatures. »). Ils restent facultatifs — c'est une incitation, jamais une obligation.`
      : `Côté candidat, ce qui le sécurise et évite les oublis : disponibilités précises (dates), mobilité/zones, méthodes pratiquées, attentes sur le taux, logement/véhicule recherchés, expérience.`;
  const system = `Tu analyses une annonce ${role === "cabinet" ? "de cabinet" : "de candidat"} kiné en Guadeloupe et proposes 1 à 3 AJOUTS concrets et actionnables qui MANQUENT dans le texte. ${roleGuidance}
Ne suggère que ce qui est réellement absent. Sois concret (pas de généralité). Formulation courte, à l'impératif.
Réponds en JSON : {"suggestions":["...","..."]} (0 à 3 éléments).`;
  const parsed = await deepseekJSON(system, source, 300);
  if (parsed === null) return null;
  const safe = z.object({ suggestions: z.array(z.string()) }).safeParse(parsed);
  if (!safe.success) return [];
  return safe.data.suggestions.map((s) => s.trim()).filter(Boolean).slice(0, 3);
}
