// Le cabinet fondateur est TOUJOURS en tête du fil (décision de JC, 23/10) — par construction,
// pas par un score égalable. Lancer : npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { getDesirabilityPercent, type DesirabilityProfile } from "../desirability";
import { ordonnerFil, PLAFOND_BOOST, DENSITE_BOOST } from "../boostTerritorial";

type Carte = { id: string; profil: DesirabilityProfile; boost: number };
const profil = (p: Partial<DesirabilityProfile>): DesirabilityProfile => ({
  isFounding: false, desirabilityOverride: null, desirabilityExpiry: null, desirabilityScore: 0, subscriptionPlan: null, institutionalPartner: false, ...p,
});
const carte = (id: string, p: Partial<DesirabilityProfile>, boost = 0): Carte => ({ id, profil: profil(p), boost });
const ordonner = (cartes: Carte[]) =>
  ordonnerFil(cartes, (c) => c.profil.isFounding, (c) => getDesirabilityPercent(c.profil), (c) => c.boost).ordre.map((c) => c.id);

const fondateur = carte("fondateur", { isFounding: true });
const boostCpts = carte("boost+cpts", { subscriptionPlan: "BOOST", institutionalPartner: true });       // 80 + 20 = 100
const premiumCpts = carte("premium+cpts+zone", { subscriptionPlan: "PREMIUM", institutionalPartner: true }, PLAFOND_BOOST); // 70 + 35 = 105

test("les scores permettaient l'égalité et le dépassement (état avant correctif)", () => {
  assert.equal(getDesirabilityPercent(fondateur.profil), 100);
  assert.equal(getDesirabilityPercent(boostCpts.profil), 100);
  assert.ok(getDesirabilityPercent(premiumCpts.profil) + premiumCpts.boost > 100);
});

test("à égalité de score (Boost + CPTS = 100), le fondateur passe devant même lu en dernier", () => {
  assert.deepEqual(ordonner([boostCpts, fondateur]), ["fondateur", "boost+cpts"]);
});

test("Premium + CPTS + boost territorial maximal (105) ne dépasse pas le fondateur", () => {
  assert.deepEqual(ordonner([premiumCpts, boostCpts, fondateur])[0], "fondateur");
});

test("avec la densité 1 sur 3 et plusieurs annonces boostées, le fondateur reste premier", () => {
  const cartes = [
    carte("gratuit-zone-1", {}, PLAFOND_BOOST), carte("gratuit-zone-2", {}, PLAFOND_BOOST), carte("premium", { subscriptionPlan: "PREMIUM" }),
    premiumCpts, boostCpts, carte("gratuit", {}), carte("gratuit-zone-3", {}, PLAFOND_BOOST), fondateur,
  ];
  const ordre = ordonner(cartes);
  assert.equal(ordre[0], "fondateur");
  assert.equal(DENSITE_BOOST, 3);
  // Après le fondateur, l'ordre est celui de la densité, inchangé : il ne dépend pas de sa présence.
  const sansFondateur = ordonner(cartes.filter((c) => c !== fondateur));
  assert.deepEqual(ordre.slice(1), sansFondateur);
});

test("un override administrateur à 100 ne dépasse pas non plus le fondateur", () => {
  const override = carte("override-100", { desirabilityOverride: 100 }, PLAFOND_BOOST);
  assert.deepEqual(ordonner([override, fondateur])[0], "fondateur");
});

test("plusieurs annonces du fondateur : toutes en tête, puis les autres", () => {
  const f2 = carte("fondateur-2", { isFounding: true });
  const ordre = ordonner([boostCpts, fondateur, premiumCpts, f2]);
  assert.deepEqual(ordre.slice(0, 2).sort(), ["fondateur", "fondateur-2"]);
});

test("sans fondateur, l'ordre est exactement celui d'avant (ordonnerAvecDensite)", async () => {
  const { ordonnerAvecDensite } = await import("../boostTerritorial");
  const cartes = [carte("a", {}, PLAFOND_BOOST), carte("b", { subscriptionPlan: "PREMIUM" }), carte("c", {}), premiumCpts, boostCpts];
  const attendu = ordonnerAvecDensite(cartes, (c) => getDesirabilityPercent(c.profil), (c) => c.boost).ordre.map((c) => c.id);
  assert.deepEqual(ordonner(cartes), attendu);
});
