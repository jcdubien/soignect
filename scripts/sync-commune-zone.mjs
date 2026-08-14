// Synchronisation CommuneZone ← COMMUNE_ZONE (section 211).
//
// POURQUOI CE SCRIPT EXISTE
// Deux référentiels commune → macro-zone coexistaient, sans rien pour les tenir d'accord :
//   • `COMMUNE_ZONE` (src/lib/communes.ts) — la SOURCE, lue par `zoneOfCommune`, donc par
//     `scoreGeo` : c'est elle qui décide du score de proximité géographique ;
//   • `CommuneZone` (table Prisma) — une matérialisation en base, destinée aux analyses SQL
//     par territoire (Soignect Observatoire), lue par aucun code produit aujourd'hui.
// Ils étaient identiques au 13/08 — par chance, pas par construction. Ce script fait de la
// constante la source unique et autoritaire : la table en est DÉRIVÉE, jamais éditée à la main.
//
// La constante est lue depuis le VRAI module TypeScript (via jiti), pas recopiée : le script
// et `scoreGeo` voient donc forcément la même chose. Une copie aurait recréé le problème.
//
//   node scripts/sync-commune-zone.mjs           → vérifie et rapporte les écarts, n'écrit rien
//   node scripts/sync-commune-zone.mjs --apply   → régénère la table
//
// Sortie 1 en cas de divergence sans --apply : utilisable tel quel comme garde-fou (CI,
// pré-commit) le jour où le projet s'en dote.

import jitiPkg from "jiti";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const createJiti = jitiPkg.createJiti ?? jitiPkg;
const racine = process.cwd();
const jiti = createJiti(import.meta.url, {
  alias: { "@": path.join(racine, "src") },
  interopDefault: true,
});

const { COMMUNE_ZONE } = await jiti.import(path.join(racine, "src/lib/communes.ts"));
const appliquer = process.argv.includes("--apply");
const prisma = new PrismaClient();

try {
  const source = Object.entries(COMMUNE_ZONE);
  const enBase = Object.fromEntries(
    (await prisma.communeZone.findMany()).map((r) => [r.commune, r.zone]),
  );

  const aCreer   = source.filter(([c]) => !(c in enBase));
  const aCorriger = source.filter(([c, z]) => c in enBase && enBase[c] !== z);
  const aRetirer = Object.keys(enBase).filter((c) => !(c in COMMUNE_ZONE));
  const ecarts   = aCreer.length + aCorriger.length + aRetirer.length;

  console.log(`source (COMMUNE_ZONE) : ${source.length} communes`);
  console.log(`table  (CommuneZone)  : ${Object.keys(enBase).length} lignes`);
  for (const [c, z] of aCreer)    console.log(`  + ${c} → ${z}`);
  for (const [c, z] of aCorriger) console.log(`  ~ ${c} : ${enBase[c]} → ${z}`);
  for (const c of aRetirer)       console.log(`  − ${c} (absente de la source)`);

  if (ecarts === 0) {
    console.log("\n✅ table conforme à la source — rien à faire");
    process.exit(0);
  }

  if (!appliquer) {
    console.log(`\n⚠️  ${ecarts} écart(s) — relancer avec --apply pour régénérer`);
    process.exit(1);
  }

  // Régénération : upsert plutôt que TRUNCATE + INSERT, pour ne jamais laisser la table vide,
  // même une fraction de seconde — d'autres lecteurs pourraient apparaître.
  for (const [commune, zone] of source) {
    await prisma.communeZone.upsert({
      where: { commune },
      update: { zone },
      create: { commune, zone },
    });
  }
  if (aRetirer.length > 0) {
    await prisma.communeZone.deleteMany({ where: { commune: { in: aRetirer } } });
  }
  console.log(`\n✅ table régénérée — ${source.length} communes, ${ecarts} écart(s) corrigé(s)`);
} finally {
  await prisma.$disconnect();
}
