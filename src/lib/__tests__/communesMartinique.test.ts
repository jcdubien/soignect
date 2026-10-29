// Référentiel Martinique (section 376) : 34 communes, chacune avec sa zone et son code INSEE, aucun
// libellé partagé avec la Guadeloupe, et la Guadeloupe inchangée. Lancer : npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COMMUNES_GUADELOUPE, COMMUNES_MARTINIQUE, COMMUNE_ZONE, ZONE_ORDER, ZONES_MARTINIQUE,
  inseeOfCommune, zoneOfCommune, territoireDeCommune, territoireDeZone,
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
