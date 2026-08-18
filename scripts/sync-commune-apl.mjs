// Alimentation CommuneAPL ← APL DREES (dataset Opendatasoft 530).
//
// POURQUOI CE SCRIPT EXISTE
// Le schéma Prisma annonçait « Alimenté par scripts/update_apl.py (cron annuel) ». Ce fichier
// n'a jamais existé : les 112 lignes de `CommuneAPL` portent toutes le même updatedAt, trace
// d'un import unique et manuel, et rien n'indique de quelle ANNÉE sont les chiffres. Ce script
// remplace le mécanisme annoncé par un mécanisme réel — et nommant son millésime.
//
// LA SOURCE, ET LE PIÈGE
// Deux jeux homonymes cohabitent chez la DREES :
//   • 530_l-accessibilite-potentielle-localisee-apl                       ← LE BON (professionnels)
//   • accessibilite-potentielle-localisee-apl-aux-structures-medico-...   ← structures médico-sociales PA
// Contre-intuitif : c'est le MAUVAIS qui répond à /records (36 571 enregistrements, champs
// apl_ehpa/apl_ra/apl_sapa). Le bon a `has_records: false` — sa donnée n'est PAS servie en API
// records, elle vit dans des pièces jointes XLSX, une par profession. D'où le téléchargement et
// le parseur XLSX ci-dessous : il n'y a pas d'endpoint tabulaire à interroger à la place.
//
// CE QU'IL N'ÉCRIT JAMAIS
//   • les colonnes boost* — réglages produit saisis à la main en admin, irremplaçables ;
//   • `commune` / `departement` d'une ligne existante — la base suit le vocabulaire de
//     COMMUNE_ZONE (« Grand-Bourg (Marie-Galante) »), la DREES le sien (« Grand-Bourg ») ;
//     les écarts sont RAPPORTÉS, jamais appliqués ;
//   • `aplOrthophoniste` — cette profession n'est pas publiée dans ce jeu (voir PROFESSIONS).
// Il ne supprime aucune ligne : une commune absente de la source est signalée, pas effacée.
//
//   node --env-file=.env.local scripts/sync-commune-apl.mjs            → rapporte, n'écrit rien
//   node --env-file=.env.local scripts/sync-commune-apl.mjs --apply    → applique
//
// Options : --annee=2024 (défaut : millésime le plus récent commun aux 4 fichiers)
//           --departements=971,972,973,974 (défaut) | --departements=tout (France entière)
//           --refresh (re-télécharge en ignorant le cache disque)
//
// Sortie 1 en cas d'écart sans --apply — utilisable comme garde-fou, à l'image de
// scripts/sync-commune-zone.mjs.

import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { PrismaClient } from "@prisma/client";

const DOMAINE = "https://data.drees.solidarites-sante.gouv.fr";
const DATASET = "530_l-accessibilite-potentielle-localisee-apl";
const SOURCE_URL = `${DOMAINE}/explore/dataset/${DATASET}/`;

// Une profession = une pièce jointe + l'INTITULÉ EXACT de sa colonne de valeur.
// L'intitulé est vérifié, pas deviné : si la DREES le renomme, le script s'arrête au lieu de
// prendre la colonne voisine. C'est nécessaire pour les médecins, dont le classeur publie
// quatre variantes (tous âges, hors ≥65 ans, hors ≥62, hors ≥60) : seule la première est reprise.
//
// Attention aux UNITÉS, elles ne sont pas homogènes :
//   kiné / infirmier / sage-femme → ETP pour 100 000 habitants standardisés (ordre : 0 à ~500)
//   médecin généraliste           → consultations-visites accessibles par habitant et par an (~0 à 8)
// `aplKine` et `aplMedecin` ne sont donc PAS comparables entre eux. Rien dans le produit ne les
// compare aujourd'hui (CommuneAPL n'est lue que par /admin/apl), mais la note vaut d'être ici.
//
// aplOrthophoniste n'a pas d'entrée : le jeu 530 publie kinés, infirmiers, médecins généralistes,
// sages-femmes et chirurgiens-dentistes — pas les orthophonistes. La colonne restera vide tant
// qu'une autre source n'aura pas été choisie ; ce script n'y touche pas.
const PROFESSIONS = [
  { colonne: "aplKine",      piece: "indicateur_d_apl_aux_kinesitherapeutes_xlsx",     entete: "APL aux kinésithérapeutes" },
  { colonne: "aplInfirmier", piece: "indicateur_d_apl_aux_infirmiers_xlsx",            entete: "APL aux infirmières" },
  { colonne: "aplMedecin",   piece: "indicateur_d_apl_aux_medecins_generalistes_xlsx", entete: "APL aux médecins généralistes" },
  { colonne: "aplSageFemme", piece: "indicateur_d_apl_aux_sages_femmes_xlsx",          entete: "APL aux sages-femmes" },
];

const ENTETE_CODE = "Code commune INSEE";
const ENTETE_NOM = "Commune";

// Périmètre par défaut : les 4 DOM déjà présents en base. Le jeu est national (34 890 communes),
// la table aussi par construction — élargir est une décision produit, pas un effet de bord ;
// d'où le drapeau explicite --departements=tout.
const DEPARTEMENTS_DEFAUT = ["971", "972", "973", "974"];

// ─── arguments ────────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const appliquer = args.includes("--apply");
const forcerTelechargement = args.includes("--refresh");
const optionValeur = (nom) => args.find((a) => a.startsWith(`--${nom}=`))?.split("=").slice(1).join("=");
const anneeDemandee = optionValeur("annee") ? Number(optionValeur("annee")) : null;
const optDepartements = optionValeur("departements");
const departements =
  optDepartements === "tout" ? null
  : optDepartements ? optDepartements.split(",").map((d) => d.trim()).filter(Boolean)
  : DEPARTEMENTS_DEFAUT;

// ─── lecture XLSX sans dépendance ─────────────────────────────────────────────────────────────
// Un .xlsx est une archive ZIP de XML. Le dépôt n'embarque aucun lecteur de classeur et ce
// script est le seul besoin : plutôt qu'ajouter une dépendance à l'application pour un script
// annuel, on ouvre l'archive avec zlib (fourni par Node) et on lit les deux XML utiles.

const entreesZip = (buf) => {
  // Localisation de l'« End of Central Directory » (signature PK\5\6), depuis la fin.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 65558; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("archive XLSX illisible : fin de répertoire central introuvable");
  const nbEntrees = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  if (p === 0xffffffff) throw new Error("archive ZIP64 non gérée par ce lecteur");

  const entrees = new Map();
  for (let n = 0; n < nbEntrees; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("répertoire central ZIP corrompu");
    const methode = buf.readUInt16LE(p + 10);
    const tailleCompressee = buf.readUInt32LE(p + 20);
    const lgNom = buf.readUInt16LE(p + 28);
    const lgExtra = buf.readUInt16LE(p + 30);
    const lgCommentaire = buf.readUInt16LE(p + 32);
    const offsetLocal = buf.readUInt32LE(p + 42);
    const nom = buf.toString("utf8", p + 46, p + 46 + lgNom);
    if (tailleCompressee === 0xffffffff || offsetLocal === 0xffffffff) {
      throw new Error("archive ZIP64 non gérée par ce lecteur");
    }
    entrees.set(nom, { methode, tailleCompressee, offsetLocal });
    p += 46 + lgNom + lgExtra + lgCommentaire;
  }
  return entrees;
};

const lireEntree = (buf, entrees, nom) => {
  const e = entrees.get(nom);
  if (!e) throw new Error(`entrée absente de l'archive XLSX : ${nom}`);
  // Les longueurs de l'en-tête LOCAL peuvent différer de celles du répertoire central : on les relit.
  const lgNom = buf.readUInt16LE(e.offsetLocal + 26);
  const lgExtra = buf.readUInt16LE(e.offsetLocal + 28);
  const debut = e.offsetLocal + 30 + lgNom + lgExtra;
  const donnees = buf.subarray(debut, debut + e.tailleCompressee);
  return e.methode === 0 ? donnees : zlib.inflateRawSync(donnees);
};

const decoderXml = (s) =>
  s.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
   .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
   .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
   .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
   .replace(/&amp;/g, "&");

const lireChainesPartagees = (xml) => {
  const chaines = [];
  for (const si of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    // Une <si> peut être découpée en plusieurs <t> (texte enrichi) : on les recolle.
    let texte = "";
    for (const t of si[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) texte += decoderXml(t[1]);
    chaines.push(texte);
  }
  return chaines;
};

const numeroColonne = (ref) => {
  let n = 0;
  for (const c of ref.replace(/\d+/g, "")) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
};

const lireLignes = (xml, chaines) => {
  const lignes = [];
  for (const ligne of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cellules = [];
    for (const c of ligne[1].matchAll(/<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const corps = c[2] ?? "";
      const ref = attrs.match(/\br="([A-Z]+)\d+"/)?.[1];
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const brut = corps.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let valeur = null;
      if (type === "s") valeur = brut != null ? chaines[Number(brut)] ?? null : null;
      else if (type === "inlineStr") {
        let texte = "";
        for (const t of corps.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) texte += decoderXml(t[1]);
        valeur = texte || null;
      } else if (brut != null) valeur = decoderXml(brut);
      if (ref != null && valeur != null) cellules[numeroColonne(ref)] = valeur;
    }
    lignes.push(cellules);
  }
  return lignes;
};

const ouvrirClasseur = (buf) => {
  const entrees = entreesZip(buf);
  const chaines = entrees.has("xl/sharedStrings.xml")
    ? lireChainesPartagees(lireEntree(buf, entrees, "xl/sharedStrings.xml").toString("utf8"))
    : [];
  const rels = new Map();
  for (const r of lireEntree(buf, entrees, "xl/_rels/workbook.xml.rels").toString("utf8")
    .matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    rels.set(r[1], r[2].replace(/^\/?xl\//, "").replace(/^\.\//, ""));
  }
  const feuilles = new Map();
  for (const f of lireEntree(buf, entrees, "xl/workbook.xml").toString("utf8")
    .matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    feuilles.set(decoderXml(f[1]), `xl/${rels.get(f[2])}`);
  }
  return {
    feuilles: [...feuilles.keys()],
    lignes: (nom) => lireLignes(lireEntree(buf, entrees, feuilles.get(nom)).toString("utf8"), chaines),
  };
};

// ─── téléchargement (avec cache disque) ───────────────────────────────────────────────────────
const dossierCache = path.join(os.tmpdir(), "soignect-apl-drees");

const telecharger = async (piece) => {
  const url = `${DOMAINE}/api/explore/v2.1/catalog/datasets/${DATASET}/attachments/${piece}`;
  const local = path.join(dossierCache, `${piece}.xlsx`);
  if (!forcerTelechargement && fs.existsSync(local)) {
    const tete = await fetch(url, { method: "HEAD" });
    const attendu = Number(tete.headers.get("content-length") ?? 0);
    if (attendu > 0 && fs.statSync(local).size === attendu) {
      console.log(`  ${piece} — cache (${(attendu / 1e6).toFixed(1)} Mo)`);
      return fs.readFileSync(local);
    }
  }
  const rep = await fetch(url);
  if (!rep.ok) throw new Error(`téléchargement ${piece} : HTTP ${rep.status}`);
  const buf = Buffer.from(await rep.arrayBuffer());
  fs.mkdirSync(dossierCache, { recursive: true });
  fs.writeFileSync(local, buf);
  console.log(`  ${piece} — téléchargé (${(buf.length / 1e6).toFixed(1)} Mo)`);
  return buf;
};

// Vérifie qu'on interroge le bon jeu : le dataset des structures médico-sociales pour personnes
// âgées porte presque le même titre. Deux marqueurs suffisent à les distinguer, et ils sont
// contrôlés à chaque exécution plutôt que supposés une fois pour toutes.
const verifierDataset = async () => {
  const rep = await fetch(`${DOMAINE}/api/explore/v2.1/catalog/datasets/${DATASET}`);
  if (!rep.ok) throw new Error(`métadonnées du dataset : HTTP ${rep.status}`);
  const meta = (await rep.json()).metas?.default ?? {};
  const titre = meta.title ?? "";
  if (/m[ée]dico-social|personnes\s+[âa]g[ée]es/i.test(titre)) {
    throw new Error(`mauvais jeu de données : « ${titre} » (structures médico-sociales PA)`);
  }
  if (!/professionnels\s+de\s+sant[ée]/i.test(titre)) {
    throw new Error(`titre inattendu, jeu peut-être remplacé : « ${titre} »`);
  }
  console.log(`source : ${titre}`);
  console.log(`         ${SOURCE_URL} — ${meta.license ?? "licence non déclarée"}, publication ${meta.update_frequency ?? "?"}`);
  return meta;
};

const arrondir = (v) => (v == null ? null : Math.round(v * 1000) / 1000);

// ─── programme ────────────────────────────────────────────────────────────────────────────────
const prisma = new PrismaClient();
try {
  const meta = await verifierDataset();

  console.log("\ntéléchargement des pièces jointes (une par profession) :");
  const classeurs = new Map();
  for (const p of PROFESSIONS) classeurs.set(p.colonne, ouvrirClasseur(await telecharger(p.piece)));

  // Millésime : les feuilles sont nommées « APL 2024 ». On retient le plus récent PRÉSENT DANS
  // LES QUATRE fichiers, pour qu'une ligne ne mélange jamais deux années selon la profession.
  const anneesParFichier = [...classeurs.values()].map(
    (c) => new Set(c.feuilles.map((f) => f.match(/^APL\s+(\d{4})$/)?.[1]).filter(Boolean).map(Number)),
  );
  const communes0 = [...anneesParFichier[0]];
  const anneesCommunes = communes0.filter((a) => anneesParFichier.every((s) => s.has(a))).sort((a, b) => b - a);
  if (anneesCommunes.length === 0) throw new Error("aucun millésime commun aux quatre fichiers");
  const annee = anneeDemandee ?? anneesCommunes[0];
  if (!anneesCommunes.includes(annee)) {
    throw new Error(`millésime ${annee} indisponible — disponibles : ${anneesCommunes.join(", ")}`);
  }
  console.log(`\nmillésimes disponibles : ${anneesCommunes.join(", ")} — retenu : ${annee}`);

  // Lecture des quatre feuilles du millésime retenu.
  const source = new Map(); // codeInsee → { commune, departement, apl* }
  for (const p of PROFESSIONS) {
    const lignes = classeurs.get(p.colonne).lignes(`APL ${annee}`);
    const iEntete = lignes.findIndex((l) => l.some((c) => c?.trim() === ENTETE_CODE));
    if (iEntete < 0) throw new Error(`${p.piece} : colonne « ${ENTETE_CODE} » introuvable`);
    const entete = lignes[iEntete].map((c) => c?.trim() ?? "");
    const iCode = entete.indexOf(ENTETE_CODE);
    const iNom = entete.indexOf(ENTETE_NOM);
    const iVal = entete.indexOf(p.entete);
    if (iVal < 0) {
      throw new Error(
        `${p.piece} : colonne « ${p.entete} » introuvable — la DREES a renommé ses colonnes, ` +
        `intitulés vus : ${entete.filter(Boolean).join(" | ")}`,
      );
    }
    let lues = 0;
    for (const l of lignes.slice(iEntete + 1)) {
      const code = l[iCode]?.trim();
      if (!code || !/^\d[\dAB]\d{3}$/.test(code)) continue; // ignore unités et lignes de note
      const dep = code.startsWith("97") ? code.slice(0, 3) : code.slice(0, 2);
      if (departements && !departements.includes(dep)) continue;
      const valeur = l[iVal] != null && l[iVal] !== "" ? Number(l[iVal]) : null;
      const ligne = source.get(code) ?? { commune: l[iNom]?.trim() ?? "", departement: dep };
      ligne[p.colonne] = Number.isFinite(valeur) ? arrondir(valeur) : null;
      source.set(code, ligne);
      lues++;
    }
    console.log(`  ${p.colonne.padEnd(13)} ← « ${p.entete} » : ${lues} communes`);
  }
  console.log(`source : ${source.size} communes (périmètre ${departements ? departements.join("/") : "France entière"})`);

  // Le millésime n'est stocké que si la migration l'a introduit — le script reste utilisable
  // avant comme après, et ne prétend jamais avoir daté ce qu'il n'a pas pu dater.
  const colonnesTable = new Set(
    (await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'CommuneAPL'
    `).map((r) => r.column_name),
  );
  const millesimeStockable = ["aplAnnee", "aplSource", "aplImportedAt"].every((c) => colonnesTable.has(c));
  if (!millesimeStockable) {
    console.log("\n⚠️  colonnes de millésime absentes (aplAnnee/aplSource/aplImportedAt) :");
    console.log("    la migration prisma/migrations-manuelles/2026-08-apl-millesime.sql n'a pas été jouée.");
    console.log("    Les valeurs seront écrites SANS millésime — donc indistinguables de l'import de 2026.");
  }

  const champsLus = ["id", "codeInsee", "commune", "departement", ...PROFESSIONS.map((p) => p.colonne)];
  const enBase = new Map(
    (await prisma.communeAPL.findMany({
      select: Object.fromEntries([
        ...champsLus.map((c) => [c, true]),
        ...(millesimeStockable ? [["aplAnnee", true], ["aplSource", true]] : []),
      ]),
    })).map((r) => [r.codeInsee, r]),
  );
  console.log(`base   : ${enBase.size} lignes`);

  // ─── comparaison ────────────────────────────────────────────────────────────────────────────
  const aCreer = [];
  const aMettreAJour = [];
  const nomsDivergents = [];
  const mouvements = Object.fromEntries(PROFESSIONS.map((p) => [p.colonne, { hausse: 0, baisse: 0, inchange: 0, vide: 0 }]));

  for (const [code, s] of source) {
    const b = enBase.get(code);
    if (!b) { aCreer.push([code, s]); continue; }
    const changements = [];
    for (const p of PROFESSIONS) {
      const avant = arrondir(b[p.colonne]);
      const apres = s[p.colonne] ?? null;
      const m = mouvements[p.colonne];
      if (apres == null) { m.vide++; continue; }
      if (avant == null) { m.hausse++; changements.push([p.colonne, avant, apres]); continue; }
      if (Math.abs(avant - apres) < 1e-6) { m.inchange++; continue; }
      (apres > avant ? m.hausse++ : m.baisse++);
      changements.push([p.colonne, avant, apres]);
    }
    const millesimeAChanger = millesimeStockable && b.aplAnnee !== annee;
    if (b.commune !== s.commune) nomsDivergents.push([code, b.commune, s.commune]);
    if (changements.length > 0 || millesimeAChanger) aMettreAJour.push([code, b, s, changements]);
  }
  const absentesDeLaSource = [...enBase.keys()].filter((c) => !source.has(c));

  // ─── rapport ────────────────────────────────────────────────────────────────────────────────
  console.log(`\n── mouvements par profession (millésime ${annee} vs base) ──`);
  for (const p of PROFESSIONS) {
    const m = mouvements[p.colonne];
    console.log(
      `  ${p.colonne.padEnd(13)} hausse ${String(m.hausse).padStart(4)} · baisse ${String(m.baisse).padStart(4)}` +
      ` · inchangé ${String(m.inchange).padStart(4)} · sans valeur source ${m.vide}`,
    );
  }
  if (aCreer.length > 0) {
    console.log(`\n── ${aCreer.length} commune(s) à créer ──`);
    for (const [code, s] of aCreer.slice(0, 20)) console.log(`  + ${code} ${s.commune}`);
    if (aCreer.length > 20) console.log(`  … et ${aCreer.length - 20} autres`);
  }
  if (absentesDeLaSource.length > 0) {
    console.log(`\n── ${absentesDeLaSource.length} ligne(s) en base absentes de la source — NON supprimées ──`);
    for (const c of absentesDeLaSource.slice(0, 20)) console.log(`  ? ${c} ${enBase.get(c).commune}`);
  }
  if (nomsDivergents.length > 0) {
    console.log(`\n── ${nomsDivergents.length} libellé(s) divergents — NON écrasés (la base suit COMMUNE_ZONE) ──`);
    for (const [c, a, b] of nomsDivergents.slice(0, 20)) console.log(`  ≠ ${c} base « ${a} » · DREES « ${b} »`);
  }

  const ecarts = aCreer.length + aMettreAJour.length;
  if (ecarts === 0) {
    console.log(`\n✅ base conforme au millésime ${annee} — rien à faire`);
    process.exit(0);
  }
  console.log(`\n${aMettreAJour.length} ligne(s) à mettre à jour, ${aCreer.length} à créer.`);
  console.log("Les colonnes boost*, aplOrthophoniste, commune et departement ne sont pas touchées.");

  if (!appliquer) {
    console.log("\n⚠️  simulation — rien n'a été écrit. Relancer avec --apply pour appliquer.");
    process.exit(1);
  }

  // ─── écriture ───────────────────────────────────────────────────────────────────────────────
  // Upsert ligne à ligne, jamais TRUNCATE + INSERT : la table ne passe à aucun moment par un
  // état vide ou partiel, et chaque `update` ne nomme que les colonnes issues de la DREES —
  // c'est ce qui garantit que les boost* saisis en admin survivent à l'import.
  const millesime = millesimeStockable
    ? { aplAnnee: annee, aplSource: `DREES ${DATASET} — APL ${annee}`, aplImportedAt: new Date() }
    : {};
  let ecrites = 0;
  for (const [code, , s] of aMettreAJour) {
    await prisma.communeAPL.update({
      where: { codeInsee: code },
      data: {
        ...Object.fromEntries(PROFESSIONS.filter((p) => s[p.colonne] != null).map((p) => [p.colonne, s[p.colonne]])),
        ...millesime,
      },
    });
    ecrites++;
  }
  for (const [code, s] of aCreer) {
    await prisma.communeAPL.create({
      data: {
        codeInsee: code,
        commune: s.commune,
        departement: s.departement,
        ...Object.fromEntries(PROFESSIONS.filter((p) => s[p.colonne] != null).map((p) => [p.colonne, s[p.colonne]])),
        ...millesime,
      },
    });
    ecrites++;
  }
  console.log(`\n✅ ${ecrites} ligne(s) écrites — millésime ${annee}${millesimeStockable ? "" : " (NON enregistré : migration manquante)"}`);
  if (meta.modified) console.log(`   jeu source modifié le ${meta.modified}`);
} finally {
  await prisma.$disconnect();
}
