// Annonce en 4 champs (section 369) : titre et accroche déduits, et reconnus pour être recomposés
// quand les dates changent — sans jamais toucher un texte écrit par le cabinet. Lancer : npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { titreAuto, accrocheAuto, estAccrocheAuto, estTitreAutoDate } from "../annonceRapide";

const remplacement = {
  type: "Remplacement", commune: "Le Gosier", debut: "2027-08-02", fin: "2027-08-20",
  argent: "Rétrocession de 70 % pour le remplaçant", logement: true, vehicule: true,
};

test("titre et accroche ne disent que ce qui a été saisi", () => {
  assert.equal(titreAuto(remplacement), "Remplacement à Le Gosier · 02/08 → 20/08");
  assert.equal(
    accrocheAuto(remplacement),
    "Remplacement à Le Gosier du 02/08/2027 au 20/08/2027. Rétrocession de 70 % pour le remplaçant. Logement proposé, véhicule mis à disposition.",
  );
  assert.equal(accrocheAuto({ type: "Assistanat", commune: "Sainte-Anne", debut: "2027-09-01", minMonths: "12" }),
    "Assistanat à Sainte-Anne à partir du 01/09/2027. Durée minimale : 12 mois.");
  assert.equal(titreAuto({ type: "Remplacement", commune: "" }), "Remplacement");
});

test("une accroche déduite est reconnue, quelle que soit sa composition", () => {
  assert.ok(estAccrocheAuto(accrocheAuto(remplacement), "Remplacement"));
  assert.ok(estAccrocheAuto(accrocheAuto({ type: "Remplacement", commune: "Le Gosier" }), "Remplacement"));
  assert.ok(estAccrocheAuto(accrocheAuto({ type: "Assistanat", commune: "Sainte-Anne", debut: "2027-09-01", minMonths: "12",
    argent: "Redevance de 25 % versée au cabinet, plafonnée à 1500 € par mois" }), "Assistanat"));
});

test("un texte écrit par le cabinet n'est jamais pris pour une accroche déduite", () => {
  assert.equal(estAccrocheAuto("Remplacement à Sainte-Anne, cabinet calme.", "Remplacement"), false);
  assert.equal(estAccrocheAuto("Remplacement à Sainte-Anne. Cabinet calme, patientèle variée.", "Remplacement"), false);
  assert.equal(estAccrocheAuto("Cabinet calme au Gosier, patientèle variée.", "Remplacement"), false);
  // Même forme, autre type : l'accroche d'un remplacement n'est pas celle d'un assistanat.
  assert.equal(estAccrocheAuto(accrocheAuto(remplacement), "Assistanat"), false);
});

test("seul un titre daté est recomposé", () => {
  assert.ok(estTitreAutoDate(titreAuto(remplacement), "Remplacement"));
  assert.ok(estTitreAutoDate(titreAuto({ type: "Assistanat", commune: "Sainte-Anne", debut: "2027-09-01" }), "Assistanat"));
  assert.equal(estTitreAutoDate("Remplacement à Le Gosier", "Remplacement"), false);
  assert.equal(estTitreAutoDate("Remplacement été 2027", "Remplacement"), false);
});
