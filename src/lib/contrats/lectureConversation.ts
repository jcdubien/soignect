// Lecture de la conversation avant le contrat (09/11). SERVEUR UNIQUEMENT — appelle DeepSeek.
//
// LE CAS QUI L'A MOTIVÉE. L'annonce disait « 14 décembre », la conversation a abouti au « 4 au
// 16 janvier, pour toutes les deux ». Le contrat se pré-remplit depuis l'annonce : ce qui a été
// convenu par écrit dans Soignect devait être retapé à la main, et un oubli partait au PDF.
//
// CE QUE LA LECTURE FAIT. Elle PROPOSE, l'écran applique sur un geste de la personne — jamais
// d'écriture silencieuse dans un contrat. Chaque proposition porte la phrase de la conversation
// qui la fonde, et cette phrase est revérifiée ici mot pour mot dans les messages : une valeur
// dont la preuve n'existe pas est écartée (même garde-fou que l'extraction d'annonce).
//
// CE QU'ELLE NE FAIT PAS. Elle ne réécrit aucune clause du modèle. Une demande comme « remplacer
// encaissés par réalisés » remonte en POINT À TRAITER, en texte : c'est aux parties d'en décider.

import { deepseekJSON } from "@/lib/annonceAI";

export interface MessageLu { deMoi: boolean; texte: string; date: Date }

export interface TermesActuels {
  missionType: string | null;
  dateDebut: string; // yyyy-mm-dd ou ""
  dateFin: string;
  retrocessionPct: number | null; // null = clause absente de ce contrat
  assiette: "ENCAISSES" | "REALISES" | null; // base de la rétrocession (remplacement kiné)
  redevancePct: number | null;
  delaiPaiementJours: number | null;
}

export type ChampPropose = "dateDebut" | "dateFin" | "retrocessionPct" | "assiette" | "redevancePct" | "delaiPaiementJours";

export interface Proposition {
  champ: ChampPropose;
  valeur: string | number;
  preuve: string; // extrait verbatim de la conversation
}

export interface LectureConversation {
  propositions: Proposition[];
  points: { texte: string; preuve: string }[];
}

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function lireConversationPourContrat(
  messages: MessageLu[],
  actuels: TermesActuels,
  jeSuisTitulaire: boolean,
): Promise<LectureConversation | null> {
  if (messages.length === 0) return { propositions: [], points: [] };

  // Les 80 derniers messages suffisent : les accords se concluent en fin de fil.
  const fil = messages.slice(-80).map((m) =>
    `[${m.date.toISOString().slice(0, 10)}] ${m.deMoi ? (jeSuisTitulaire ? "CABINET" : "REMPLAÇANT") : (jeSuisTitulaire ? "REMPLAÇANT" : "CABINET")} : ${m.texte}`,
  ).join("\n");

  const champs: string[] = ["dateDebut (yyyy-mm-dd)", "dateFin (yyyy-mm-dd)"];
  if (actuels.retrocessionPct !== null) champs.push("retrocessionPct (entier, % des honoraires reversé AU REMPLAÇANT)");
  if (actuels.assiette !== null) champs.push("assiette (\"ENCAISSES\" = honoraires encaissés pendant le remplacement, \"REALISES\" = honoraires des actes réalisés pendant le remplacement)");
  if (actuels.redevancePct !== null) champs.push("redevancePct (entier, % de redevance versé AU CABINET)");
  if (actuels.delaiPaiementJours !== null) champs.push("delaiPaiementJours (entier, jours)");

  const system = [
    "Tu prépares un contrat entre professionnels de santé libéraux à partir de leur conversation.",
    "Tu relèves UNIQUEMENT ce que les DEUX parties ont convenu explicitement dans la conversation.",
    "Une proposition refusée, remplacée ou restée sans accord n'est PAS retenue : seul compte le dernier état de l'accord.",
    "Exception : une demande de modification de la BASE de la rétrocession (encaissés / réalisés) accueillie favorablement par l'autre partie se renvoie comme proposition « assiette ».",
    "N'invente rien. Si un terme n'a pas été convenu, ne le renvoie pas.",
    `Champs modifiables : ${champs.join(", ")}.`,
    "Pour une date sans année, déduis l'année de la date des messages et des dates actuelles du contrat (une date passée par rapport au message désigne l'année suivante).",
    "Pour chaque valeur, « preuve » est un extrait COPIÉ MOT POUR MOT d'un message (sans le préfixe [date] AUTEUR), 3 à 20 mots.",
    "Relève aussi dans « points » (4 au plus) les demandes de modification du contrat qui ne correspondent à aucun champ (ex. formulation d'une clause, nombre de remplaçants, logement), formulées en une phrase neutre, avec leur preuve.",
    'Réponds en JSON : {"propositions":[{"champ":"...","valeur":...,"preuve":"..."}],"points":[{"texte":"...","preuve":"..."}]}',
  ].join("\n");

  const user = [
    `Type de contrat : ${actuels.missionType ?? "inconnu"}.`,
    `Termes actuels du contrat : début ${actuels.dateDebut || "non renseigné"}, fin ${actuels.dateFin || "non renseignée"}` +
      (actuels.retrocessionPct !== null ? `, rétrocession ${actuels.retrocessionPct} % des honoraires ${actuels.assiette === "REALISES" ? "des actes réalisés" : "encaissés"}` : "") +
      (actuels.redevancePct !== null ? `, redevance ${actuels.redevancePct} %` : "") +
      (actuels.delaiPaiementJours !== null ? `, délai de paiement ${actuels.delaiPaiementJours} jours` : "") + ".",
    "",
    "Conversation :",
    fil,
  ].join("\n");

  const brut = await deepseekJSON(system, user, 900);
  if (!brut || typeof brut !== "object") return null;

  const source = norm(messages.map((m) => m.texte).join("\n"));
  const prouve = (p: unknown) => typeof p === "string" && p.trim().length >= 3 && source.includes(norm(p));

  const propositions: Proposition[] = [];
  const vus = new Set<string>();
  const listeP = Array.isArray((brut as { propositions?: unknown }).propositions) ? (brut as { propositions: unknown[] }).propositions : [];
  for (const x of listeP) {
    if (!x || typeof x !== "object") continue;
    const { champ, valeur, preuve } = x as { champ?: unknown; valeur?: unknown; preuve?: unknown };
    if (typeof champ !== "string" || vus.has(champ) || !prouve(preuve)) continue;
    let v: string | number | null = null;
    if (champ === "dateDebut" || champ === "dateFin") {
      if (typeof valeur === "string" && ISO.test(valeur) && !Number.isNaN(Date.parse(valeur))) v = valeur;
      if (v === (champ === "dateDebut" ? actuels.dateDebut : actuels.dateFin)) v = null;
    } else if (champ === "assiette") {
      if (actuels.assiette === null) continue;
      if ((valeur === "ENCAISSES" || valeur === "REALISES") && valeur !== actuels.assiette) v = valeur;
    } else if (champ === "retrocessionPct" || champ === "redevancePct" || champ === "delaiPaiementJours") {
      if (actuels[champ] === null) continue;
      const n = typeof valeur === "number" ? valeur : Number(valeur);
      const max = champ === "delaiPaiementJours" ? 90 : 100;
      if (Number.isInteger(n) && n >= 0 && n <= max && n !== actuels[champ]) v = n;
    }
    if (v === null) continue;
    vus.add(champ);
    propositions.push({ champ: champ as ChampPropose, valeur: v, preuve: String(preuve).trim() });
  }

  const listePts = Array.isArray((brut as { points?: unknown }).points) ? (brut as { points: unknown[] }).points : [];
  const points = listePts
    .filter((x): x is { texte: string; preuve: string } =>
      !!x && typeof x === "object" && typeof (x as { texte?: unknown }).texte === "string" && prouve((x as { preuve?: unknown }).preuve))
    .slice(0, 4)
    .map((x) => ({ texte: x.texte.trim().slice(0, 240), preuve: x.preuve.trim() }));

  return { propositions, points };
}
