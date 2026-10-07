/**
 * Rattrapage des vignettes de partage (section 285).
 *
 * Génère et stocke la vignette des annonces qui n'en ont pas encore. Tant qu'une annonce garde
 * `vignetteAt` à null, sa métadonnée pointe vers la route dynamique — le rattrapage ne RÉPARE
 * donc rien de cassé, il fait basculer l'existant vers le chemin économe.
 *
 *   node scripts/rattrapage-vignettes.mjs            # à blanc : compte, n'écrit rien
 *   node scripts/rattrapage-vignettes.mjs --ecrire   # génère et téléverse
 *
 * SÉQUENTIEL, PAS EN PARALLÈLE. Chaque vignette coûte ~1,5 s de CPU et de la mémoire (rendu
 * Satori + ré-encodage sharp). Les lancer toutes ensemble sur une machine de développement
 * épuiserait la mémoire avant de finir, et le gain de temps n'a aucun intérêt pour une opération
 * qu'on fait une fois.
 *
 * REPRENABLE : il ne traite que les annonces sans `vignetteAt`. Interrompu, il reprend où il en
 * était au lancement suivant, sans refaire ce qui est déjà fait.
 */
import fs from "fs";

for (const fichier of [".env.local", ".env"]) {
  if (!fs.existsSync(fichier)) continue;
  for (const ligne of fs.readFileSync(fichier, "utf8").split("\n")) {
    const m = ligne.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
  }
}

const ECRIRE = process.argv.includes("--ecrire");

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

// Même prédicat que le rendu lui-même : seules les annonces EN RECHERCHE ont une image de
// partage. Le réécrire ici le ferait diverger — on reprend donc exactement les trois conditions.
const PROPOSABLE = { isActive: true, briqueStatus: "RECHERCHE", isSelfPresence: false };

const aTraiter = await prisma.mission.findMany({
  where: { ...PROPOSABLE, vignetteAt: null },
  select: { id: true, title: true },
  orderBy: { createdAt: "desc" },
});
const dejaFaites = await prisma.mission.count({ where: { ...PROPOSABLE, vignetteAt: { not: null } } });

console.log(`annonces proposables sans vignette : ${aTraiter.length}`);
console.log(`déjà pourvues                      : ${dejaFaites}`);
console.log(`coût estimé                        : ~${(aTraiter.length * 1.5).toFixed(0)} s de CPU\n`);

if (!ECRIRE) {
  console.log("À BLANC — rien n'a été écrit. Relancer avec --ecrire pour générer.");
  for (const m of aTraiter.slice(0, 10)) console.log(`  · ${m.title.slice(0, 64)}`);
  if (aTraiter.length > 10) console.log(`  … et ${aTraiter.length - 10} autres`);
  await prisma.$disconnect();
  process.exit(0);
}

let generees = 0, sansObjet = 0, echecs = 0;
const t0 = Date.now();
for (const [i, m] of aTraiter.entries()) {
  const r = await fetch(`${process.env.RATTRAPAGE_BASE_URL ?? "http://localhost:3000"}/api/admin/vignette`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-rattrapage-cle": process.env.CRON_SECRET ?? "" },
    body: JSON.stringify({ missionId: m.id }),
  }).then((x) => x.json()).catch((e) => ({ etat: "echec", motif: String(e) }));

  if (r.etat === "generee") { generees++; process.stdout.write("·"); }
  else if (r.etat === "sans_objet") { sansObjet++; process.stdout.write("o"); }
  else { echecs++; console.log(`\n  ❌ ${m.id} : ${r.motif ?? "inconnu"}`); }
  if ((i + 1) % 50 === 0) process.stdout.write(` ${i + 1}\n`);
}

console.log(`\n\ngénérées : ${generees} · sans objet : ${sansObjet} · échecs : ${echecs}`);
console.log(`durée : ${((Date.now() - t0) / 1000).toFixed(0)} s`);
const restantes = await prisma.mission.count({ where: { ...PROPOSABLE, vignetteAt: null } });
console.log(`annonces proposables encore sans vignette : ${restantes}`);
await prisma.$disconnect();
