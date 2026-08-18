// Vérification du pont COMMUNE_INSEE ↔ CommuneAPL (section 213).
//
// POURQUOI CE SCRIPT NE RESSEMBLE PAS À sync-commune-zone.mjs
// Celui-là DÉRIVE une table d'une constante : la constante gagne, la table est régénérée.
// Ici, les deux côtés sont autoritaires et aucun ne peut réparer l'autre :
//   • `COMMUNE_INSEE` (src/lib/communes.ts) est un fait administratif — les codes INSEE ne
//     s'inventent pas et ne se déduisent pas d'un libellé ;
//   • `CommuneAPL` porte une donnée nationale de la DREES, qu'on n'a pas à réécrire depuis le
//     produit.
// Un désaccord n'est donc PAS à corriger automatiquement : il est à regarder. D'où un script
// qui RAPPORTE et ne propose aucun --apply. Écrire un --apply ici aurait été le vrai danger :
// il aurait fabriqué des lignes APL vides pour faire taire l'alerte.
//
// La constante est lue depuis le VRAI module TypeScript (via jiti), jamais recopiée — même
// règle que sync-commune-zone.mjs, pour la même raison : une copie recrée le problème qu'on ferme.
//
//   npm run db:check-insee   → rapporte, n'écrit rien, sortie 1 si un code est introuvable
//
// Sortie 1 réservée au cas VRAIMENT cassant (un code déclaré qui ne trouve aucune ligne dans
// un département couvert). Les absences connues et documentées (977/978) sont signalées sans
// faire échouer : elles sont un fait, pas une régression.

import jitiPkg from "jiti";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const createJiti = jitiPkg.createJiti ?? jitiPkg;
const racine = process.cwd();
const jiti = createJiti(import.meta.url, {
  alias: { "@": path.join(racine, "src") },
  interopDefault: true,
});

const { COMMUNE_INSEE, COMMUNES_GUADELOUPE } = await jiti.import(
  path.join(racine, "src/lib/communes.ts"),
);

// Départements que `CommuneAPL` couvre réellement. Un code hors de cette liste est attendu
// introuvable — c'est le cas de Saint-Martin (978) et Saint-Barthélemy (977), sortis de la
// Guadeloupe en 2007. Les distinguer évite de crier au loup sur un fait connu.
const DEPARTEMENTS_COUVERTS = ["971", "972", "973", "974"];

const prisma = new PrismaClient();

try {
  const libelles = Object.keys(COMMUNE_INSEE);
  const enBase = new Map(
    (await prisma.communeAPL.findMany({ select: { codeInsee: true, commune: true } }))
      .map((r) => [r.codeInsee, r.commune]),
  );

  console.log(`libellés produit  (COMMUNES_GUADELOUPE) : ${COMMUNES_GUADELOUPE.length}`);
  console.log(`libellés pontés   (COMMUNE_INSEE)       : ${libelles.length}`);
  console.log(`lignes APL en base (CommuneAPL)         : ${enBase.size}\n`);

  // 1. Un libellé du produit sans entrée dans le pont : la jointure sera silencieusement vide.
  //    C'est l'oubli le plus probable — on ajoute une commune au produit, pas au pont.
  const nonPontes = COMMUNES_GUADELOUPE.filter((c) => !(c in COMMUNE_INSEE));

  // 2. Une entrée du pont qui ne correspond à aucun libellé produit : code mort, ou libellé
  //    renommé d'un côté seulement.
  const orphelins = libelles.filter((c) => !COMMUNES_GUADELOUPE.includes(c));

  // 3. Un code déclaré introuvable en base, DANS un département couvert : la vraie casse.
  const introuvables = [];
  // 4. Idem hors département couvert : attendu, documenté, pas une erreur.
  const horsPerimetre = [];

  for (const [libelle, code] of Object.entries(COMMUNE_INSEE)) {
    if (code === null) continue; // « aucune commune INSEE » — volontaire, voir communes.ts
    if (enBase.has(code)) continue;
    (DEPARTEMENTS_COUVERTS.includes(code.slice(0, 3)) ? introuvables : horsPerimetre)
      .push([libelle, code]);
  }

  // 5. Deux libellés pour un même code : légitime (Saint-Martin), mais qui doit rester VU.
  //    Le jour où c'est un copier-coller raté, cette ligne est la seule qui le dira.
  const parCode = {};
  for (const [libelle, code] of Object.entries(COMMUNE_INSEE)) {
    if (code) (parCode[code] ??= []).push(libelle);
  }
  const partages = Object.entries(parCode).filter(([, l]) => l.length > 1);

  for (const c of nonPontes)  console.log(`  ⚠ ${c} — dans le produit, absente du pont`);
  for (const c of orphelins)  console.log(`  ⚠ ${c} — dans le pont, absente du produit`);
  for (const [l, c] of introuvables)  console.log(`  ✗ ${l} → ${c} — INTROUVABLE dans CommuneAPL`);
  for (const [l, c] of horsPerimetre) console.log(`  · ${l} → ${c} — hors périmètre APL (attendu)`);
  for (const [c, l] of partages)      console.log(`  · ${c} partagé par : ${l.join(", ")}`);

  // Le libellé du produit et celui de la DREES DIFFÈRENT sur les communes désambiguïsées :
  // c'est la raison d'être du pont. On l'affiche pour que le lecteur voie le décalage qu'il
  // couvre, au lieu de le croire théorique.
  const decales = Object.entries(COMMUNE_INSEE)
    .filter(([libelle, code]) => code && enBase.has(code) && enBase.get(code) !== libelle)
    .map(([libelle, code]) => `${libelle} ↔ « ${enBase.get(code)} »`);
  if (decales.length) {
    console.log(`\n${decales.length} libellé(s) que seul le pont rapproche :`);
    for (const d of decales) console.log(`  ↔ ${d}`);
  }

  const cassant = nonPontes.length + orphelins.length + introuvables.length;
  if (cassant === 0) {
    console.log("\n✅ pont conforme — tout libellé produit mène à une ligne APL, ou à une absence documentée");
    process.exit(0);
  }
  console.log(`\n⚠️  ${cassant} écart(s) à regarder — aucun n'est réparable automatiquement`);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
