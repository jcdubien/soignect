// Référentiel Martinique (section 376) : 34 communes, chacune avec sa zone et son code INSEE, aucun
// libellé partagé avec la Guadeloupe, et la Guadeloupe inchangée. Lancer : npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COMMUNES_GUADELOUPE, COMMUNES_MARTINIQUE, COMMUNE_ZONE, ZONE_ORDER, ZONES_MARTINIQUE,
  inseeOfCommune, zoneOfCommune, territoireDeCommune, territoireDeZone,
  libelleZones, territoiresVus, territoireDe,
} from "../communes";

test("34 communes, codes INSEE 97201 à 97234, chacun une seule fois", () => {
  assert.equal(COMMUNES_MARTINIQUE.length, 34);
  const codes = COMMUNES_MARTINIQUE.map((c) => inseeOfCommune(c));
  const attendus = Array.from({ length: 34 }, (_, i) => `972${String(i + 1).padStart(2, "0")}`);
  assert.deepEqual([...codes].sort(), attendus);
});

test("chaque commune de Martinique a une zone de Martinique", () => {
  for (const c of COMMUNES_MARTINIQUE) {
    const z = zoneOfCommune(c);
    assert.ok(z && ZONES_MARTINIQUE.includes(z), c);
    assert.equal(territoireDeCommune(c), "MARTINIQUE", c);
  }
  // CACEM : quatre communes
  assert.deepEqual(COMMUNES_MARTINIQUE.filter((c) => zoneOfCommune(c) === "MARTINIQUE_CENTRE").sort(),
    ["Fort-de-France", "Le Lamentin", "Saint-Joseph", "Schœlcher"]);
});

test("aucun libellé commun aux deux îles ; Sainte-Anne reste celle de la Guadeloupe", () => {
  for (const c of COMMUNES_MARTINIQUE) assert.ok(!COMMUNES_GUADELOUPE.includes(c), c);
  assert.equal(territoireDeCommune("Sainte-Anne"), "GUADELOUPE");
  assert.equal(inseeOfCommune("Sainte-Anne"), "97128");
  assert.equal(inseeOfCommune("Sainte-Anne (Martinique)"), "97226");
  assert.equal(territoireDeCommune("Lamentin"), "GUADELOUPE");
  assert.equal(territoireDeCommune("Commune inconnue"), null);
});

test("la Guadeloupe est inchangée", () => {
  assert.equal(COMMUNES_GUADELOUPE.length, 35);
  assert.equal(ZONE_ORDER.length, 10);
  for (const c of COMMUNES_GUADELOUPE) {
    assert.equal(territoireDeCommune(c), "GUADELOUPE", c);
    assert.ok(ZONE_ORDER.includes(COMMUNE_ZONE[c]), c);
  }
  for (const z of ZONE_ORDER) assert.equal(territoireDeZone(z), "GUADELOUPE");
});

test("« Toute la … » suit le territoire ; un choix partiel nomme les zones", () => {
  assert.equal(libelleZones([...ZONE_ORDER], "GUADELOUPE"), "Toute la Guadeloupe");
  assert.equal(libelleZones([...ZONES_MARTINIQUE], "MARTINIQUE"), "Toute la Martinique");
  assert.equal(libelleZones(["MARTINIQUE_SUD"], "MARTINIQUE"), "Sud (Espace Sud)");
  assert.equal(libelleZones(["SUD_GRANDE_TERRE", "NORD_GRANDE_TERRE"], "GUADELOUPE"), "Sud Grande-Terre, Nord Grande-Terre");
});

test("chacun son île : un compte antérieur ne voit que la Guadeloupe", () => {
  assert.deepEqual(territoiresVus({}), ["GUADELOUPE"]);
  assert.deepEqual(territoiresVus({ territoire: "GUADELOUPE", voirAutreTerritoire: false }), ["GUADELOUPE"]);
  assert.deepEqual(territoiresVus({ territoire: "MARTINIQUE" }), ["MARTINIQUE"]);
  assert.deepEqual(territoiresVus({ territoire: "MARTINIQUE", voirAutreTerritoire: true }), ["MARTINIQUE", "GUADELOUPE"]);
  assert.equal(territoireDe(undefined), "GUADELOUPE");
  assert.equal(territoireDe("METROPOLE"), "GUADELOUPE");
});

test("exemples : inchangés en Guadeloupe, transposés en Martinique", async () => {
  const { exemplesPour, exemplesPourIle, pourIle } = await import("../exemplesPublication");
  assert.deepEqual(exemplesPourIle("KINESITHERAPEUTE", "GUADELOUPE"), exemplesPour("KINESITHERAPEUTE"));
  assert.deepEqual(exemplesPourIle("KINESITHERAPEUTE", undefined), exemplesPour("KINESITHERAPEUTE"));
  const mq = JSON.stringify(exemplesPourIle("KINESITHERAPEUTE", "MARTINIQUE"));
  for (const lieu of ["Guadeloupe", "Grande-Terre", "Gosier", "Pointe-à-Pitre", "Sainte-Anne"]) assert.ok(!mq.includes(lieu), lieu);
  assert.ok(mq.includes("le Sud (Sainte-Luce, Le Diamant)"));
  assert.equal(pourIle("Visible par les cabinets recherchant un remplaçant en Guadeloupe", "MARTINIQUE"),
    "Visible par les cabinets recherchant un remplaçant en Martinique");
  assert.equal(pourIle("Ex : Notre clinique aux Abymes recrute", "MARTINIQUE"), "Ex : Notre clinique au Lamentin recrute");
});
