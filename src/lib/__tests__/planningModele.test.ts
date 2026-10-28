// Sous-lignes du Planning (section 264) : une inclusion se loge dans la bande de son hôte, un
// croisement partiel ouvre une seconde bande, et aucune brique ne disparaît. Lancer : npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { assignLanes } from "../../app/(app)/planning/modele";

type B = { id: string; d: number; f: number };
const poser = (bs: B[], marge = 0) => assignLanes(bs, (b) => b.d, (b) => b.f, marge);

test("une annonce logée dans une occupation reste sur la même bande", () => {
  const fond = { id: "occupation", d: 0, f: 100 }, dedans = { id: "annonce", d: 30, f: 50 };
  const r = poser([dedans, fond]);
  assert.equal(r.count, 1);
  assert.equal(r.lanes.get(dedans), r.lanes.get(fond));
});

test("un croisement partiel ouvre une seconde bande", () => {
  const a = { id: "a", d: 0, f: 60 }, b = { id: "b", d: 40, f: 100 };
  const r = poser([a, b]);
  assert.equal(r.count, 2);
  assert.notEqual(r.lanes.get(a), r.lanes.get(b));
});

test("une brique qui recouvrirait son hôte d'un bout à l'autre ne s'y loge pas", () => {
  // Même étendue à la marge près : l'hôte disparaîtrait — deux bandes.
  const fond = { id: "fond", d: 0, f: 100 }, quasi = { id: "quasi", d: 1, f: 99 };
  assert.equal(poser([fond, quasi], 5).count, 2);
  assert.equal(poser([fond, quasi], 0).count, 1);
});

test("des briques successives partagent une seule bande", () => {
  const r = poser([{ id: "1", d: 0, f: 10 }, { id: "2", d: 10, f: 20 }, { id: "3", d: 20, f: 30 }]);
  assert.equal(r.count, 1);
});
