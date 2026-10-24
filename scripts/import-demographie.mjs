// Démographie et effectifs de santé par commune (23/10) — Guadeloupe, Saint-Martin,
// Saint-Barthélemy. Alimente `DemographieCommune` et `EffectifPraticiens`, lus par les
// indicateurs du diagnostic (src/lib/indicateursTerritoire.ts).
//
// LES SOURCES (publiques, Licence Ouverte)
//   • Population : API Découpage administratif (geo.api.gouv.fr, Etalab). Son dépôt
//     (github.com/etalab/decoupage-administratif) cite comme source les « populations légales »
//     de l'INSEE, page des populations de référence 2023 (au 1er janvier 2023, en vigueur au
//     1er janvier 2026). Le millésime n'est pas renvoyé par l'API : il est noté ici, à vérifier à
//     chaque import.
//   • Praticiens : ANS, Annuaire Santé — extraction en libre accès « personne-activité »
//     (data.gouv.fr, mise à jour quotidienne). Fichier d'environ 800 Mo, LU EN FLUX : rien n'est
//     écrit sur le disque, et seules les lignes des communes 971 / 977 / 978 sont regardées.
//
// CE QUI EST CONSERVÉ : des TOTAUX par commune et profession. L'identifiant RPPS ne sert qu'à
// compter une personne une seule fois quand elle a plusieurs lieux d'exercice ; il ne quitte pas
// la mémoire du script. Aucun nom, aucune coordonnée.
//
// CE QUI N'EST PAS COUVERT
//   • Aide-soignant : profession absente de l'Annuaire Santé — effectif inconnu.
//   • Gynécologie : seule la gynécologie MÉDICALE est comptée (SM19, CEX22, SM51), pas la
//     gynécologie-obstétrique (SM20), conformément au libellé « gynécologues médicaux ».
//   • Un praticien est compté dans chaque commune où il a une activité déclarée : la somme des
//     communes peut dépasser l'effectif du territoire.
//   • Anciens codes de Saint-Barthélemy (97123) et Saint-Martin (97127) : regroupés sous 97701 et
//     97801.
//
//   node --env-file=.env.local scripts/import-demographie.mjs            → rapporte, n'écrit rien
//   node --env-file=.env.local scripts/import-demographie.mjs --apply    → remplace les données

import { PrismaClient } from "@prisma/client";
import readline from "node:readline";
import { Readable } from "node:stream";

const appliquer = process.argv.includes("--apply");

const SOURCE_POPULATION = "INSEE, populations de référence 2023 (via geo.api.gouv.fr, Etalab)";
const MILLESIME_POPULATION = 2023;
const SOURCE_PRATICIENS = "ANS, Annuaire Santé — extraction en libre accès « personne-activité »";
const JEU_ANNUAIRE = "https://www.data.gouv.fr/api/1/datasets/?q=annuaire%20sant%C3%A9%20extractions%20libre%20acc%C3%A8s%20RPPS&page_size=5";

const ANCIENS_CODES = { "97123": "97701", "97127": "97801" };

// Code profession RPPS → profession Soignect. Les médecins se répartissent par savoir-faire.
const PAR_PROFESSION = {
  "70": "KINESITHERAPEUTE", "60": "INFIRMIER", "50": "SAGE_FEMME", "40": "DENTISTE",
  "91": "ORTHOPHONISTE", "92": "ORTHOPTISTE",
};
const PAR_SPECIALITE = {
  SM53: "MEDECIN_GENERALISTE", SM26: "MEDECIN_GENERALISTE", SM54: "MEDECIN_GENERALISTE",
  SM04: "MEDECIN_CARDIOLOGIE", SM15: "MEDECIN_DERMATOLOGIE",
  SM16: "MEDECIN_ENDOCRINOLOGIE", SM62: "MEDECIN_ENDOCRINOLOGIE",
  SM19: "MEDECIN_GYNECOLOGIE", CEX22: "MEDECIN_GYNECOLOGIE", SM51: "MEDECIN_GYNECOLOGIE",
  SM38: "MEDECIN_OPHTALMOLOGIE", SM34: "MEDECIN_ORL", SM39: "MEDECIN_ORL",
  SM40: "MEDECIN_PEDIATRIE", SM42: "MEDECIN_PSYCHIATRIE", SM92: "MEDECIN_PSYCHIATRIE",
  SM48: "MEDECIN_RHUMATOLOGIE",
};
const LIBERAL = "Lib,indép,artis,com";

async function populations() {
  const res = await fetch("https://geo.api.gouv.fr/communes?codeDepartement=971&fields=nom,code,population&format=json");
  if (!res.ok) throw new Error(`geo.api : ${res.status}`);
  const communes = await res.json();
  for (const code of ["97701", "97801"]) {
    const r = await fetch(`https://geo.api.gouv.fr/communes/${code}?fields=nom,code,population`);
    if (r.ok) communes.push(await r.json());
  }
  return communes.filter((c) => Number.isInteger(c.population));
}

async function fichierAnnuaire() {
  const d = await (await fetch(JEU_ANNUAIRE)).json();
  for (const ds of d.data) {
    const r = ds.resources.find((x) => x.title === "ps-libreacces-personne-activite.txt");
    if (r) return { url: r.url, date: new Date(r.last_modified ?? r.created_at) };
  }
  throw new Error("Ressource « ps-libreacces-personne-activite.txt » introuvable sur data.gouv.fr");
}

async function effectifs(url) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Annuaire Santé : ${res.status}`);
  const lignes = readline.createInterface({ input: Readable.fromWeb(res.body), crlfDelay: Infinity });
  const tous = new Map(); const liberaux = new Map(); // clé commune|profession → Set d'identifiants
  let n = 0, retenues = 0, entete = true;
  for await (const ligne of lignes) {
    n++;
    if (entete) { entete = false; continue; }
    const v = ligne.split("|");
    if (v.length < 45) continue;
    let commune = v[36];
    if (!/^97[178]/.test(commune)) continue;
    commune = ANCIENS_CODES[commune] ?? commune;
    const profession = v[9] === "10" ? PAR_SPECIALITE[v[15]] : PAR_PROFESSION[v[9]];
    if (!profession) continue;
    retenues++;
    const cle = `${commune}|${profession}`;
    if (!tous.has(cle)) tous.set(cle, new Set());
    tous.get(cle).add(v[1]);
    if (v[18] === LIBERAL) {
      if (!liberaux.has(cle)) liberaux.set(cle, new Set());
      liberaux.get(cle).add(v[1]);
    }
  }
  const lignesAgregees = [...tous.entries()].map(([cle, ids]) => {
    const [codeInsee, profession] = cle.split("|");
    return { codeInsee, profession, effectif: ids.size, effectifLiberal: liberaux.get(cle)?.size ?? 0 };
  });
  return { n, retenues, lignesAgregees };
}

const pops = await populations();
console.log(`Populations : ${pops.length} communes (${SOURCE_POPULATION}).`);
const { url, date } = await fichierAnnuaire();
console.log(`Annuaire Santé : extraction du ${date.toISOString().slice(0, 10)} — lecture en flux…`);
const { n, retenues, lignesAgregees } = await effectifs(url);
console.log(`${n} lignes lues, ${retenues} retenues (971/977/978, professions suivies), ${lignesAgregees.length} totaux commune × profession.`);
const parProfession = {};
for (const l of lignesAgregees) parProfession[l.profession] = (parProfession[l.profession] ?? 0) + l.effectif;
console.log("Effectifs cumulés par profession (une personne compte dans chaque commune d'exercice) :", parProfession);

if (!appliquer) {
  console.log("\n⚠️  simulation — rien n'a été écrit. Relancer avec --apply pour appliquer.");
  process.exit(0);
}

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
await prisma.$transaction(async (tx) => {
  await tx.demographieCommune.deleteMany({});
  await tx.demographieCommune.createMany({
    data: pops.map((c) => ({ codeInsee: c.code, commune: c.nom, population: c.population, source: SOURCE_POPULATION, millesime: MILLESIME_POPULATION })),
  });
  await tx.effectifPraticiens.deleteMany({});
  await tx.effectifPraticiens.createMany({
    data: lignesAgregees.map((l) => ({ ...l, source: SOURCE_PRATICIENS, extraitLe: date })),
  });
}, { timeout: 60_000 });
console.log(`✅ ${pops.length} populations et ${lignesAgregees.length} effectifs écrits.`);
await prisma.$disconnect();
