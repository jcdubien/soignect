// Reprise de données — siège du titulaire (section 188).
//
// Crée, pour chaque profil TITULAIRE, son propre poste de planning (isOwnerSeat), puis y
// rattache ses absences existantes (missions isSelfPresence). Après ce script, la ligne du
// titulaire est un CabinetPost comme les autres et n'a plus besoin du flag isSelfPresence.
//
// IDEMPOTENT : rejouable sans effet de bord — un siège déjà présent n'est pas recréé, une
// absence déjà rattachée n'est pas retouchée.
//
//   node scripts/backfill-owner-seat.mjs            → simulation, n'écrit rien
//   node scripts/backfill-owner-seat.mjs --apply    → applique
//
// À exécuter APRÈS la migration 20260731120000_cabinet_post_owner_seat et AVANT le
// déploiement de la phase 2 (qui suppose le siège présent).

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function retry(fn, label) {
  let last;
  for (let i = 0; i < 6; i++) {
    try { return await fn(); }
    catch (e) { last = e; await new Promise((r) => setTimeout(r, 2500)); }
  }
  throw new Error(`${label} : ${(last?.message ?? "").split("\n")[0]}`);
}

async function main() {
  console.log(APPLY ? "MODE APPLIQUÉ — écriture en base\n" : "SIMULATION — aucune écriture (ajouter --apply)\n");

  const titulaires = await retry(
    () => prisma.profile.findMany({
      where: { type: "TITULAIRE" },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
    "lecture des profils",
  );

  let seatsCrees = 0, absencesRattachees = 0;

  for (const p of titulaires) {
    const nom = p.name ?? "Titulaire";

    let seat = await retry(
      () => prisma.cabinetPost.findFirst({ where: { cabinetId: p.id, isOwnerSeat: true }, select: { id: true } }),
      "lecture du siège",
    );

    if (!seat) {
      console.log(`  + siège à créer pour « ${nom} »`);
      if (APPLY) {
        seat = await retry(
          () => prisma.cabinetPost.create({
            data: {
              cabinetId: p.id,
              label: nom,
              postType: "TITULAIRE",
              isOwnerSeat: true,
              // Pas de préavis ni d'alerte auto sur son propre siège : le titulaire sait
              // quand il s'absente, il n'a pas à être relancé sur sa propre présence.
              noticeMonths: 0,
              autoAlert: false,
            },
            select: { id: true },
          }),
          "création du siège",
        );
      }
      seatsCrees++;
    } else {
      console.log(`  = siège déjà présent pour « ${nom} »`);
    }

    // Rattachement des absences non encore rattachées.
    const absences = await retry(
      () => prisma.mission.findMany({
        where: { profileId: p.id, isSelfPresence: true, cabinetPostId: null },
        select: { id: true, title: true, startDate: true, endDate: true },
      }),
      "lecture des absences",
    );

    for (const a of absences) {
      const periode = `${a.startDate?.toISOString().slice(0, 10) ?? "?"} → ${a.endDate?.toISOString().slice(0, 10) ?? "?"}`;
      console.log(`      ↳ « ${a.title} » ${periode}`);
      if (APPLY && seat) {
        await retry(
          () => prisma.mission.update({ where: { id: a.id }, data: { cabinetPostId: seat.id } }),
          "rattachement de l'absence",
        );
      }
      absencesRattachees++;
    }
  }

  console.log(
    `\n${titulaires.length} titulaire(s) · ${seatsCrees} siège(s) ${APPLY ? "créé(s)" : "à créer"} · ` +
    `${absencesRattachees} absence(s) ${APPLY ? "rattachée(s)" : "à rattacher"}`,
  );
  if (!APPLY) console.log("Relancer avec --apply pour écrire.");
}

main()
  .catch((e) => { console.error("ÉCHEC :", e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
