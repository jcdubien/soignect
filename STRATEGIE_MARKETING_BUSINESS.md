# SOIGNECT — STRATÉGIE MARKETING & BUSINESS

> Tenu par Sonnet. Décisions de positionnement, d'acquisition et de
> modèle institutionnel — pas de comportement produit vérifiable
> (voir PRODUCT_SPEC.md, tenu par Opus).
> Dernière mise à jour : 12/08.

---

## 0. Finalité à long terme — pourquoi la discipline de factorisation
## compte

Le projet vise, au-delà de la mise en relation kiné-cabinet en
Guadeloupe, une portée **nationale** (séquence DOM-TOM → national →
autres professions, voir ROADMAP.md) et une bascule vers un modèle
**institutionnel et rentable** : construire un serveur MCP et/ou une
base de données interrogeable, à communiquer aux administrations
(ARS, CGSS, CPTS) et aux employeurs, avec deux leviers de
rentabilité distincts — la vente de services (accès, intégration) et
la vente de données elles-mêmes (statistiques territoriales,
tension de recrutement, démographie professionnelle).

**Conséquence directe sur les choix techniques** : chaque décision
de factorisation de cette session (module profession×territoire,
`CommuneAPL`, distinction commune/zone/territoire, principe "une
règle métier doit être une donnée interrogeable, pas de la logique
codée en dur") n'est pas un exercice de propreté de code — c'est la
construction progressive du substrat que cette finalité exige. Un
MCP ne peut exposer que ce qui existe déjà comme donnée structurée ;
une base vendable aux administrations ne peut couvrir que ce qui a
été rendu générique et paramétrable en amont. La discipline "ne pas
construire d'infrastructure pour un besoin qui n'existe pas encore,
sauf coût marginal quasi nul" (ROADMAP.md) reste la bonne méthode —
mais elle doit être lue comme un chemin vers cette finalité, pas
comme un renoncement à elle.

---

## 1. Positionnement face à la concurrence

**MediLoup** — concurrent apparu début août, large d'emblée : tous
soignants, tout l'Outre-mer dès le lancement.

**Réponse retenue (06/08)** : ne pas copier la stratégie de largeur.
L'avantage de Soignect est la profondeur métier et réglementaire
(contrats CNOMK, vérification d'identité, asymétrie de notation
R.4321-99, connaissance fine de l'Avenant 7) — un avantage qui ne se
réplique pas vite pour un concurrent visant large day one. Rester
fidèle à la séquence kinés Guadeloupe → autres professions →
Outre-mer → national (détail dans ROADMAP.md) est la bonne réponse,
pas une accélération sous pression.

---

## 2. Portes d'entrée — architecture d'acquisition

Les pages de propagande sont factorisées sur deux axes (profession ×
territoire, voir ROADMAP.md) et un **troisième axe** ouvert le
12/08 : le public visé. Quatre portes prévues, chacune avec son
registre propre :

| Porte | Registre | Titre |
|---|---|---|
| Chercheur de poste (remplaçant/assistant) | Personnel, "je" | *"Je souhaite organiser mon temps d'activité de kinésithérapeute à {territoire}"* |
| Cabinet | Personnel, recruteur | *"Je recherche un kinésithérapeute pour renforcer mon cabinet à {territoire}"* |
| Hôpitaux/centres/CAMSP | Institutionnel, salarié | *"Nous recrutons un kinésithérapeute pour notre établissement à {territoire}"* |
| MSP/CPTS/territoire | Institutionnel, structurel | *"Structurer l'offre de soins en kinésithérapie sur mon territoire"* |

**Titre personnifié adopté (12/08)** pour la porte "chercheur de
poste" : passage d'une étiquette ("Kinésithérapeutes de
Saint-Martin") à une phrase à la première personne, qui garde la
profession explicite pour la reconnaissance immédiate. Vérifié : la
préposition territoriale (à/en) suit le territoire, pas un gabarit
unique. Compromis SEO assumé — le `<h1>` personnifié décrit une
intention de visiteur plutôt qu'un contenu de recherche classique,
mais `<title>` et méta-description gardent le vocabulaire de
recherche standard, ce qui limite le risque.

**Point d'attention** : la porte MSP/CPTS/territoire n'est pas une
page d'acquisition classique — c'est un pitch B2G/institutionnel qui
s'appuie sur le rôle de Jean-Charles (secrétaire CPTS Nord
Basse-Terre, président SNMKR Guadeloupe) déjà utilisé comme levier
de crédibilité. Elle mérite un contenu propre (argumentaire, pas
juste titre + accroche) — traitée à part une fois la factorisation
technique commune posée, jamais fondue dans le même gabarit que les
trois autres.

**Discipline de contenu réaffirmée (12/08)** : une affirmation
invérifiable ("conditions de remplacement souvent avantageuses",
Saint-Barth) a été repérée dans le module de factorisation,
appartenant à la même famille que le nettoyage du 11/08 qui n'avait
purgé que les bas de page, pas les accroches. Voir ROADMAP.md pour
le suivi. La règle reste : rien sur une page publique n'affirme ce
qui n'a pas été vérifié.

---

## 3. Piste différée — profil "chercheur d'opportunités"
## multi-préférences

Proposition (12/08) : traiter remplaçant/assistant/collaborateur/
salarié potentiel comme une seule catégorie qui précise ses
préférences à la volée, plutôt que de forcer un choix de type dès
l'atterrissage. Bénéfices identifiés : élargir l'assiette
d'acquisition, permettre à terme un pilotage de la mise en avant
selon les besoins déclarés par un territoire (CPTS) ou un plan
payant (cabinet/hôpital/territoire).

**Distinction retenue** : sans risque au niveau de la porte d'entrée
(ne pas forcer le classement immédiat) ; risqué si la catégorie
sous-jacente elle-même fusionne, car elle pilote aujourd'hui le
contrat généré (3 gabarits juridiques distincts), le sens de la
rétrocession (inversé entre remplacement et assistanat/
collaboration), et les poids de scoring.

**Statut** : investigation de faisabilité cadrée, en file d'attente
(voir ROADMAP.md), portant sur où et quand le type se referme
concrètement, et si le pilotage territorial en est un prérequis
direct ou un sujet séparé. Échéance v1.1 proche selon Jean-Charles —
traité comme prioritaire dans la file, sans sauter le cadrage.

**Décision de positionnement tranchée (13/08)** : NE PAS construire
de profils navigables/browsables ni de feed profils-sans-annonce,
même face au constat chiffré que 5 visiteurs sur 9 consultant une
annonce n'ont eux-mêmes aucune annonce active et restent aujourd'hui
invisibles pour le cabinet qui les intéresse. Raisons de fond,
confrontées à la stratégie produit :

- L'architecture entière (contrats CNOMK, sens de la rétrocession,
  audit déontologique, scoring) est engagement-spécifique — câblée
  sur une mission/annonce précise, pas sur une personne. Des profils
  navigables rapprocheraient Soignect d'une CVthèque généraliste, à
  rebours de la différenciation par la profondeur réglementaire
  (section 1).
- Le swipe implique un consentement actif sur une opportunité
  précise ; une visibilité permanente exposerait une disponibilité
  implicite non choisie — sujet de confort professionnel réel pour
  quelqu'un en poste qui consulte par simple veille.

**Ce qui reste à explorer, à la place** : un geste de consentement
léger côté visiteur ("signaler mon intérêt" au moment de la
consultation) plutôt qu'une exposition permanente — résout le
problème réel (personnes intéressées invisibles pour le cabinet)
sans construire de base de profils navigables. À intégrer à
l'investigation ci-dessus, pas un chantier séparé.

---

## 4. Modèle institutionnel à deux produits

- **Soignect Territoire** — CPTS/MSP
- **Soignect Observatoire** — ARS/CGSS, une fois assez de données
  accumulées via `TraceEvent`

Ces deux produits sont l'expression commerciale de la finalité
posée en section 0 : vendre des services et/ou de la donnée aux
administrations et employeurs, sur la base d'un substrat de données
interrogeables construit progressivement (voir principe de
factorisation, ROADMAP.md). Rentabilité à deux leviers, pas un seul
— accès/service d'un côté, licence de données de l'autre.

La porte d'entrée MSP/CPTS/territoire (section 2) est le premier
point de contact marketing pour ce modèle — cohérence à maintenir
entre le pitch de la page et l'offre réelle une fois qu'elle existera
commercialement.

Le boost saisonnier, une fois nommé territorialement
(`FENETRE_TENSION_GUADELOUPE`, voir ROADMAP.md), devient un argument
de vente potentiel pour ce modèle : Soignect mesure et comprend la
tension saisonnière réelle du territoire, contrairement à un outil
générique.

---

## 5. Points en observation, pas d'action

- Renommage `/remplacement-kine-guadeloupe` → `/kine-guadeloupe` :
  attend 1-2 semaines de données de trafic réelles (redirection 301
  prévue, rend la question sans risque)
- Stratégie d'acquisition testée (06/08) : passage d'un post
  générique Facebook (zéro retour) à des messages personnels ciblés
  (5-10 contacts connus). Résultat de conversion à suivre.

---

## 6. Principe de communication — fonctionnalité + persona + situation

Retenu le 13/08, suite à une notice publicitaire produite en
exemple : toute communication mettant en avant une fonctionnalité
doit s'appuyer sur un persona fictif et une situation concrète et
typique, pas sur une liste de bénéfices abstraite. Le format qui
fonctionne : nommer la fonctionnalité, puis montrer *qui* l'utilise,
*dans quel contexte précis*, et *ce que ça change* pour cette
personne — plutôt qu'énumérer des avantages génériques ("gain de
temps", "simplicité").

**Règles pour ce format** :
- Un persona par fonctionnalité mise en avant, jamais un persona
  générique pour plusieurs fonctionnalités à la fois — perd en
  crédibilité.
- La fonctionnalité choisie doit être vérifiée en production au
  moment de la rédaction, pas une promesse ou un chantier en cours
  (cohérence avec la règle 7 déjà appliquée à PRODUCT_SPEC.md :
  rien n'affirme ce qui n'a pas été vérifié — vaut aussi pour le
  marketing).
- Personas fictifs, aucun nom ne doit rappeler un utilisateur réel
  de la plateforme.
- Format long (notice, page dédiée) : 2-3 fonctionnalités avec
  persona et situation détaillés. Déclinaisons courtes (réseaux
  sociaux) : 1 fonctionnalité, 1 persona, format resserré — ne pas
  réutiliser le format long tel quel pour un support court.
