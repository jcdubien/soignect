# SOIGNECT — STRATÉGIE MARKETING & BUSINESS

> Tenu par Sonnet. Décisions de positionnement, d'acquisition et de
> modèle institutionnel — pas de comportement produit vérifiable
> (voir PRODUCT_SPEC.md, tenu par Opus).
> Dernière mise à jour : 12/08.

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

---

## 4. Modèle institutionnel à deux produits

- **Soignect Territoire** — CPTS/MSP
- **Soignect Observatoire** — ARS/CGSS, une fois assez de données
  accumulées via `TraceEvent`

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
