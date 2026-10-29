// Pages de diffusion factorisées (section 377) : une route, un registre. Les chemins historiques et
// les textes de la Guadeloupe sont inchangés ; la Martinique reçoit le même jeu de pages, sans
// jamais nommer la Guadeloupe. Lancer : npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PAGES_PUBLIEES, PORTES, TERRITOIRES, KINESITHERAPEUTE, INFIRMIER, AIDE_SOIGNANT,
  cheminPage, cleTracePage, pagePublieeDuSlug, lienInscription, metadonneesPage,
} from "../pagesDiffusion";

const chemins = PAGES_PUBLIEES.map((x) => cheminPage(x.porte, x.profession, x.territoire));

test("les 13 chemins historiques sont servis, à l'identique", () => {
  for (const c of [
    "/remplacement-kine-guadeloupe", "/remplacement-kine-saint-martin", "/remplacement-kine-saint-barth",
    "/recrutement-kine-guadeloupe", "/emploi-kine-guadeloupe", "/maison-de-sante-kine-guadeloupe",
    "/territoire-kine-guadeloupe", "/remplacement-infirmier-guadeloupe", "/recrutement-infirmier-guadeloupe",
    "/emploi-infirmier-guadeloupe", "/maison-de-sante-infirmier-guadeloupe", "/poste-aide-soignant-guadeloupe",
    "/emploi-aide-soignant-guadeloupe",
  ]) assert.ok(chemins.includes(c), c);
  assert.equal(new Set(chemins).size, chemins.length, "aucun chemin en double");
});

test("la Martinique reçoit le même jeu de pages que la Guadeloupe", () => {
  const gp = chemins.filter((c) => c.endsWith("-guadeloupe")).map((c) => c.replace(/-guadeloupe$/, ""));
  const mq = chemins.filter((c) => c.endsWith("-martinique")).map((c) => c.replace(/-martinique$/, ""));
  assert.equal(mq.length, 11);
  assert.deepEqual([...mq].sort(), [...gp].sort());
});

test("la route ne sert que le registre", () => {
  assert.equal(pagePublieeDuSlug("emploi-kine-martinique")?.territoire, TERRITOIRES.MARTINIQUE);
  assert.equal(pagePublieeDuSlug("remplacement-kine-saint-barth")?.territoire, TERRITOIRES.SAINT_BARTH);
  assert.equal(pagePublieeDuSlug("territoire-infirmier-guadeloupe"), null);
  assert.equal(pagePublieeDuSlug("annonces"), null);
  assert.equal(pagePublieeDuSlug(""), null);
});

test("périmètre de la Guadeloupe : celui que les pages recopiaient", () => {
  const avant = [
    "Pointe-à-Pitre", "Les Abymes", "Baie-Mahault", "Le Gosier", "Sainte-Anne",
    "Saint-François", "Le Moule", "Morne-à-l'Eau", "Anse-Bertrand", "Port-Louis",
    "Petit-Canal", "Basse-Terre", "Gourbeyre", "Baillif", "Saint-Claude", "Vieux-Fort",
    "Capesterre-Belle-Eau", "Trois-Rivières", "Vieux-Habitants", "Bouillante",
    "Pointe-Noire", "Deshaies", "Sainte-Rose", "Lamentin", "Petit-Bourg", "Goyave",
    "Grand-Bourg (Marie-Galante)", "Capesterre-de-Marie-Galante", "Saint-Louis (Marie-Galante)",
    "La Désirade", "Terre-de-Haut (Les Saintes)", "Terre-de-Bas (Les Saintes)",
  ];
  assert.deepEqual([...TERRITOIRES.GUADELOUPE.perimetre.communes].sort(), [...avant].sort());
  assert.equal(TERRITOIRES.GUADELOUPE.perimetre.zones.length, 8);
  assert.deepEqual(TERRITOIRES.SAINT_MARTIN.perimetre.communes.sort(), ["Grand Case (Saint-Martin)", "Marigot (Saint-Martin)"]);
  assert.deepEqual(TERRITOIRES.SAINT_BARTH.perimetre.communes, ["Gustavia (Saint-Barth)"]);
  assert.equal(TERRITOIRES.MARTINIQUE.perimetre.communes.length, 34);
});

test("textes de la page historique des kinés de Guadeloupe : inchangés", () => {
  const m = metadonneesPage(PORTES.CHERCHEUR, KINESITHERAPEUTE, TERRITOIRES.GUADELOUPE);
  assert.equal(m.title, "Remplacement, assistanat, collaboration kiné en Guadeloupe | Soignect");
  assert.equal(m.description, "Postes de kinésithérapie en Guadeloupe : remplacements ponctuels, assistanats et collaborations libérales. Annonces de cabinets et kinésithérapeutes disponibles sur toute la Guadeloupe (Grande-Terre, Basse-Terre, Marie-Galante, Les Saintes, La Désirade).");
  assert.equal(m.openGraph.title, "Postes de kiné en Guadeloupe | Soignect");
  assert.equal(m.openGraph.description, "Le job board des kinésithérapeutes de Guadeloupe : remplacement, assistanat, collaboration. Trouvez un cabinet ou un candidat en quelques swipes.");
  assert.equal(PORTES.CHERCHEUR.accroche(KINESITHERAPEUTE, TERRITOIRES.GUADELOUPE), "Soignect est le job board des kinésithérapeutes de Guadeloupe. Une mission de quelques semaines, un assistanat sur la durée ou une collaboration libérale : cabinets et candidats se trouvent en quelques swipes, sans intermédiaire. Gratuit pour qui cherche un poste.");
  const bas = PORTES.CHERCHEUR.basDePage(KINESITHERAPEUTE, TERRITOIRES.GUADELOUPE);
  assert.equal(bas.titre, "Kinésithérapie en Guadeloupe — ce que couvre Soignect");
  assert.equal(bas.paragraphes[0], "Soignect référence les postes de kinésithérapie sur l'ensemble du territoire guadeloupéen — remplacements ponctuels, assistanats et collaborations libérales — sur Grande-Terre, Basse-Terre, Marie-Galante, les Saintes et la Désirade.");
  assert.equal(PORTES.CHERCHEUR.ctaSous(KINESITHERAPEUTE, TERRITOIRES.GUADELOUPE), "Remplacement, assistanat, collaboration : la recherche de poste est gratuite, sans frais ni engagement.");
  assert.equal(PORTES.CABINET.basDePage(KINESITHERAPEUTE, TERRITOIRES.GUADELOUPE).paragraphes[0], "Soignect met en relation les cabinets de Guadeloupe et les kinésithérapeutes en recherche de poste. Vous publiez ce que vous proposez — remplacement, assistanat ou collaboration libérale — et vous voyez qui s'y intéresse. Le contrat suit le modèle CNOMK, pré-rempli depuis votre annonce.");
  assert.equal(PORTES.CANDIDAT_SALARIE.basDePage(AIDE_SOIGNANT, TERRITOIRES.GUADELOUPE).paragraphes[0], "Soignect réunit les offres d'aide-soignant publiées par les EHPAD, SSIAD, cliniques, hôpitaux et SSR de Guadeloupe. Vous publiez votre disponibilité — CDI, CDD ou vacations, vos zones, vos dates — et les employeurs vous contactent. Le contrat de travail est celui de l'employeur. L'inscription est gratuite.");
});

test("aucune page de Martinique ne nomme la Guadeloupe ni ses lieux", () => {
  for (const x of PAGES_PUBLIEES.filter((y) => y.territoire === TERRITOIRES.MARTINIQUE)) {
    const { porte: o, profession: p, territoire: t } = x;
    const textes = [
      o.titre(p, t), o.accroche(p, t), o.metaTitre(p, t), o.metaDescription(p, t), o.ctaSous(p, t),
      o.ogTitre(p, t), o.ogSousTitre(p, t), JSON.stringify(o.basDePage(p, t)), JSON.stringify(metadonneesPage(o, p, t)),
    ].join(" ");
    for (const lieu of ["Guadeloupe", "guadeloup", "Grande-Terre", "Basse-Terre", "Marie-Galante"]) {
      assert.ok(!textes.includes(lieu), `${cleTracePage(o, p, t)} : ${lieu}`);
    }
    assert.ok(textes.includes("Martinique"), cleTracePage(o, p, t));
  }
});

test("l'inscription depuis une page de Martinique coche la Martinique", () => {
  assert.equal(lienInscription(PORTES.CHERCHEUR, KINESITHERAPEUTE, TERRITOIRES.GUADELOUPE),
    "/register?profession=KINESITHERAPEUTE&profileType=REMPLACANT&src=remplacement-kine-guadeloupe");
  assert.equal(lienInscription(PORTES.ETABLISSEMENT, INFIRMIER, TERRITOIRES.MARTINIQUE),
    "/register?profession=INFIRMIER&profileType=TITULAIRE&structure=1&territoire=MARTINIQUE&src=emploi-infirmier-martinique");
  assert.equal(lienInscription(PORTES.CABINET, KINESITHERAPEUTE, TERRITOIRES.SAINT_MARTIN),
    "/register?profession=KINESITHERAPEUTE&src=recrutement-kine-saint-martin");
});
