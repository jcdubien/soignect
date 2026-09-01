# SOIGNECT — STRATÉGIE MARKETING & BUSINESS

> Tenu par Sonnet. Décisions de positionnement, d'acquisition et de
> modèle institutionnel — pas de comportement produit vérifiable
> (voir PRODUCT_SPEC.md, tenu par Opus).
> Dernière mise à jour : 19/08 (audit UI/UX/fonctionnalités, décision
> "anticiper Phase 2 dans toute factorisation").

---

## Audit UI/UX/fonctionnalités du 19/08

Déclenché par une pause délibérée : questionner les décisions
prises jusqu'ici contre les principes cardinaux (factorisation,
scalabilité, UX ultra-simple), plutôt que de continuer à empiler.

### Point de comparaison concurrentiel — App'Ines

App'Ines (national, mobile natif, gratuit et illimité, RPPS comme
authentification) a livré récemment : nouvelle messagerie, **liste
nominative des profils intéressés par une annonce** (convergence
indépendante avec "Qui s'intéresse à mon annonce", livré le 13/08 —
bon signal, un vrai besoin résolu deux fois séparément, pas une
lubie), déclin d'une proposition en 2 clics côté candidat, taux et
délai de réponse affichés sur les profils (signal de confiance
qu'on n'a pas), missions de vacations pour les établissements.
Différence structurelle à interroger : App'Ines est mobile-natif
avec push, Soignect est web pur — choix délibéré (moins
d'infrastructure) ou vrai manque compétitif, pas tranché.

### Fausses bonnes idées identifiées

1. **Complexité géographique possiblement en avance sur l'usage
   réel.** `COMMUNE_ZONE`, `CommuneZone` (généré), `COMMUNE_INSEE`
   (pont), `CommuneAPL` (national), `PrioriteTerritoriale` — cinq
   structures liées à la géographie pour ~30 communes et une
   douzaine d'annonces vivantes. Chaque brique individuellement
   justifiée par une découverte réelle, mais l'ensemble sert
   surtout le pitch CPTS institutionnel, pas la boucle centrale
   candidat↔cabinet. **Décision du 19/08, en réponse** : ne pas
   réduire cette complexité, mais s'assurer qu'elle serve aussi la
   Phase 2 (autres professions), pas seulement le PoC kiné actuel —
   voir ROADMAP.md, audit de généricité profession envoyé.
2. **Scoring difficile à expliquer en une phrase.** Socle par type
   × composante géo × bonus saisonnier × désirabilité × boost
   territorial plafonné sous Premium. Tension avec "UX ultra-simple,
   voire triviale" — chaque composante était individuellement bien
   justifiée, l'empilement ne l'est peut-être plus. Pas encore
   tranché, à requestionner si la liste des bonus continue de
   grossir.
3. **Multi-préférences déjà vrai en base, pas encore dans
   l'onboarding.** Le modèle de données permet déjà à un candidat de
   publier plusieurs types de recherche simultanément (confirmé le
   13/08, cas réel Julien MORISOT), mais l'inscription force encore
   un choix unique. Décalage entre ce qui est voulu aujourd'hui
   ("les chercheurs d'emploi ne devraient faire qu'un") et ce que
   l'écran montre — remonté en priorité dans ROADMAP.md (item 5).

### Ce qui n'est PAS une fausse bonne idée, confirmé par l'audit

- "Signaler mon intérêt"/liste nominative — validé par convergence
  indépendante avec App'Ines
- Les 4 portes de diffusion — factorisation propre du VISITEUR
  (chercheur/cabinet/établissement/CPTS), ne fragmente pas le
  candidat lui-même
- Le bloc-note de suivi — résout un usage réel observé, pas une
  anticipation

### Principe "plusieurs clients, un seul produit" — vérifié, tenu

Le moteur de scoring, les gabarits de contrat, le filtre d'annonces
sont tous paramétrés par type/profession/territoire plutôt que
dupliqués par client. Point de vigilance permanent : la complexité
CPTS-spécifique (B0-B4) ne doit pas fuiter dans l'expérience
candidat/cabinet de base — pas de fuite constatée à ce jour, à
revérifier si le pilotage territorial (B3/B4) continue de grossir.

### QUI / QUOI / COMMENT / OÙ — reformulé le 19/08

- **QUI** : kinés (un seul profil, plusieurs types de recherche
  possibles) + cabinets + établissements + CPTS/MSP — Guadeloupe
  aujourd'hui, national à terme
- **QUOI** : mise en relation sur des engagements précis (pas des
  profils), différenciée par la profondeur réglementaire (contrats,
  déontologie, zonage)
- **COMMENT** : consentement actif (swipe), jamais de visibilité
  passive forcée
- **OÙ** : web aujourd'hui — à interroger face à un concurrent
  100% mobile-natif avec push, pas tranché

### Décision retenue : anticiper la Phase 2 dans toute factorisation

Plutôt que de réduire la complexité géographique/scoring identifiée
ci-dessus, la choix retenu est de s'assurer qu'elle serve
délibérément l'ouverture future à d'autres professions — pas
seulement le PoC kiné actuel. Cohérent avec le principe de
factorisation déjà posé (ROADMAP.md) : coût marginal faible
maintenant plutôt que reconstruction complète plus tard. Audit de
généricité profession envoyé le 19/08 sur tout ce qui a été
construit depuis B0 — voir ROADMAP.md.

---

## Principe fondateur (reconfirmé le 26/08) : le match porte sur des
## disponibilités, jamais sur des profils

Décision structurelle maintenue depuis l'origine du produit, jamais
remise en cause malgré tout ce qui a changé : Soignect ne fait
jamais correspondre des *profils* entre eux (une personne contre une
autre), mais des *disponibilités/besoins* précis (une Mission contre
une autre). Un match = un fait vérifiable ("cette disponibilité
chevauche ce besoin"), jamais une compatibilité vague entre deux
personnes.

**Ce que ça a rendu possible, déjà observé concrètement** :
- Multi-préférences sans forcer une catégorie unique — une personne
  peut publier plusieurs disponibilités de types différents
  simultanément (remplacement + assistanat + collaboration), chacune
  matchée indépendamment, sans jamais avoir à choisir "qui elle est"
  au moment de l'inscription
- Cohérence avec la discipline anti-affirmation-fausse défendue toute
  la session (mention "zones prioritaires", badge `isVerified`) —
  ici c'est la structure même du matching qui applique le principe,
  pas juste un texte à corriger à l'écran

**À préserver explicitement lors de l'ouverture d'infirmier et de
chirurgien-dentiste** — ne pas revenir par habitude à un modèle
"profil contre profil" plus classique en construisant pour une
nouvelle profession. C'est un vrai différenciateur produit, pas un
détail d'implémentation à reconstruire à la légère.

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

### Acté le 21/08 — trois points de vérification obligatoires avant
### toute Phase 2

La cartographie du 12/08 avait identifié l'audit déontologique et
les contrats comme la principale concentration de code
kiné-spécifique du produit (~850 lignes). Cette décision formalise
précisément ce qui doit être vérifié comme générique, ou sourcé par
profession, avant d'ouvrir la Phase 2 à une nouvelle profession :

1. **Vérification du parcours d'inscription via Ameli** — le
   mécanisme actuel (probablement RPPS/ADELI) doit être audité pour
   confirmer qu'il ne suppose pas implicitement le format kiné.
   Chaque profession a ses propres règles de vérification auprès de
   l'Assurance Maladie.
2. **Vérification des besoins d'inscription propres à l'Ordre de la
   profession** — chaque profession réglementée a son propre Ordre
   (CNOMK pour les kinés), avec ses propres exigences. La
   cartographie avait déjà confirmé `contractProfile.ts` comme
   générique sur ce point ("n'importe quelle profession réglementée
   a un RPPS et un Ordre") — à revérifier, pas à supposer acquis.
3. **Modèles de contrat par Ordre professionnel** — le point le plus
   lourd. Les gabarits actuels sont tirés des modèles CNOMK,
   spécifiques au kiné dans leur contenu juridique, pas seulement
   leur vocabulaire. Chaque autre Ordre aura ses propres modèles à
   sourcer — le moteur de génération (remplissage de gabarit) reste
   générique, mais le contenu juridique ne l'est structurellement
   pas et ne le sera jamais complètement.

Ces trois points ne se corrigent pas maintenant (aucune 2ᵉ
profession active) — ils sont actés comme prérequis à vérifier
avant toute ouverture réelle, cohérents avec la discipline déjà en
place.

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

**Mise à jour confirmée le 20/08 (article RCI)** — Médiloup n'est
plus un concurrent abstrait : plateforme réelle, deux espaces
(professionnels / établissements), cible large dès le lancement
(hôpitaux, cliniques, EHPAD, maisons de santé, infirmiers, médecins,
éducateurs spécialisés) — confirme le pari du 06/08, aucun signe de
profondeur réglementaire par métier dans leur communication. **Point
d'alerte calendrier** : phase pilote de 2 mois démarrant **en
octobre 2026, en Guadeloupe en premier** — même territoire, même
fenêtre temporelle que le PoC CPTS Nord Basse-Terre. La stratégie de
profondeur reste la bonne réponse, mais la fenêtre pour que la CPTS
voie Soignect avant Médiloup s'est resserrée — le calendrier de la
démo CPTS devient plus pressant, pas juste souhaitable.

**Fonctionnalité notée, pas à copier dans l'urgence** : un mode
dégradé fonctionnant en connectivité réduite (crise/cyclone), pensé
pour les contraintes réelles d'Outre-mer. Différenciateur potentiel
qu'ils construisent et que Soignect n'a pas — à garder en tête pour
plus tard, pas un chantier immédiat.

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

### Principe ferme (20/08) : chaque porte montre l'inverse de son
### visiteur, jamais son propre camp

Trouvé en marge d'une capture d'écran : la liste d'annonces d'une
page persona employeur mélangeait des offres d'autres employeurs
avec des disponibilités candidates — sans intérêt pour un visiteur
qui vient recruter. Principe retenu pour toutes les pages persona,
actuelles et futures :

- **Portes employeur** (cabinet, établissement) → montrent
  uniquement des disponibilités **candidates** (remplaçant +
  assistant confondus, peu importe lequel)
- **Porte chercheur** → montre uniquement des offres **employeur**
  (cabinet + établissement confondus, peu importe lequel)
- Chaque camp voit l'ensemble du pool de l'autre camp, jamais son
  propre camp

Vaut pour toute nouvelle porte/persona à construire — ne pas
redécouvrir cette règle à chaque nouvelle page. Liste limitée à
5-10 éléments par page, jamais exhaustive.
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

**Précision du 26/08 — timeline du chercheur, pas juste
multi-préférences simultanées** : le multi-préférences déjà en
production couvre plusieurs disponibilités simultanées (remplacement
+ assistanat + collaboration en même temps). Ce qui manque encore :
une vraie **vue chronologique** côté chercheur — pouvoir dire "du
remplacement jusqu'en décembre, puis un poste salarié de janvier à
juin, puis une collaboration ensuite" — l'équivalent du Planning déjà
construit côté cabinet (bandes de statut sur une ligne de temps),
mais côté chercheur de poste. **Ne change rien à l'architecture de
matching** — reste disponibilité contre disponibilité, chaque
segment de la timeline restant une Mission distincte avec ses propres
dates. C'est une couche de visualisation/planification en plus, pas
une remise en cause du principe fondateur ci-dessus. Candidat naturel
pour réutiliser le composant Planning déjà existant plutôt qu'en
construire un nouveau. Pas urgent, à cadrer le moment venu.

**Précision UX du 26/08** : les deux interfaces devraient rester
délibérément différentes dans leur forme, pas juste dans leur
contenu — cohérent avec ce qui existe déjà de fait, à rendre
explicite pour la suite plutôt que redécouvert à chaque nouvelle
brique :
- **Chercheur de poste** : défilement vertical, timeline verticale,
  pensé mobile d'abord — exploite les ressources du téléphone
  (déjà le cas pour le swipe stack aujourd'hui)
- **Proposeur de poste** (cabinet/établissement) : disposition plus
  horizontale, logique de tableau de bord — déjà le cas pour le
  Planning existant (bandes horizontales sur une ligne de temps par
  mois)

Cette distinction n'est pas nouvelle dans les faits, mais elle
mérite d'être posée comme principe volontaire plutôt que comme une
différence accidentelle — pour que toute nouvelle brique (dont la
timeline chercheur ci-dessus) la respecte consciemment, y compris
lors de l'ouverture d'infirmier/chirurgien-dentiste.

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

### Principe ferme (19/08) : le boost territorial est activé par
### client, jamais une option ambiante

Le levier territorial (`CommuneAPL.boost*`, `PrioriteTerritoriale`
depuis B3) n'a de sens commercial que s'il est **activé par une
relation client réelle** — CPTS Nord Basse-Terre en PoC gratuit
aujourd'hui, un client payant demain — jamais une fonctionnalité
qui profite par défaut à n'importe quelle commune dès qu'une valeur
existe en base. Sinon le produit distribue gratuitement ce qu'il est
censé vendre. Cohérent avec le mécanisme de gratuité déjà posé
(section CPTS Nord Basse-Terre plus haut) : accès complet, borné
dans le temps à la relation, jamais silencieux.

**Vérification requise, pas encore confirmée** : `PrioriteTerritoriale`
(B3) exige institution/date/administrateur, mais rien ne confirme
qu'elle porte aussi un statut "client actif" distinguant une
déclaration d'un vrai client d'une valeur de test ou d'exploration
admin. Voir ROADMAP.md pour le prompt de vérification.

Le boost saisonnier, une fois nommé territorialement
(`FENETRE_TENSION_GUADELOUPE`, voir ROADMAP.md), devient un argument
de vente potentiel pour ce modèle : Soignect mesure et comprend la
tension saisonnière réelle du territoire, contrairement à un outil
générique.

### Premier client identifié — CPTS Nord Basse-Terre (13/08)

Décision : la CPTS Nord Basse-Terre (dont Jean-Charles est
secrétaire — crédibilité et accès déjà établis, voir mémoire de
session) devient le laboratoire et le premier client de Soignect
Territoire, à titre gratuit — un proof of concept, pas une vente.
Objectif : valider le modèle sur un cas réel et accessible avant
tout démarchage d'une CPTS tierce.

**Conséquence directe sur les priorités techniques** : le calcul
"pas de consommateur réel aujourd'hui" appliqué jusqu'ici à
`CommuneAPL` et au zonage ARS (voir ROADMAP.md, principe de
factorisation et item 6) ne tient plus de la même façon — il existe
désormais un consommateur réel et proche, pas hypothétique. Ne
change pas automatiquement la priorité de construction (rester
séquencé, ne pas se précipiter), mais change la justification : le
jour où on décide de brancher ces données, ce ne sera plus une
anticipation, ce sera pour un client identifié.

**À clarifier avant de prioriser quoi que ce soit pour ce PoC** : ce
que "laboratoire" doit concrètement démontrer à Jean-Charles/la CPTS
— quelles fonctionnalités de Soignect Territoire doivent être
visibles pour ce premier cas d'usage (tableau de bord territorial ?
zonage réel affiché ? autre ?).

**Répondu le 13/08 — pitch commercial concret formulé** : Jean-
Charles doit pouvoir dire à un président de CPTS : *"j'ai un plugin
facilement intégrable à ton site : dis-moi quelles professions
manquent sur quelles communes (CSV ou tableau vivant à remplir), et
on te fait un plugin de recherche adapté à tes besoins, mis en avant
en base nationale, qui te propose les profils et recherches les plus
compatibles."* Quatre briques distinctes derrière cette phrase :

1. **Collecte des besoins** — CSV ou tableau vivant, CPTS déclare
   profession × commune manquante. N'existe pas aujourd'hui ;
   `CommuneAPL.boostKine` est un curseur admin unique, pas une
   déclaration structurée.
2. **Le module embarquable reflète ces besoins** — pas juste les
   postes ouverts (v1 actuelle), mais priorisés selon le besoin
   déclaré.
3. **Mise en avant en base nationale** — le boost devient piloté par
   le besoin déclaré, à l'échelle nationale, pas seulement Guadeloupe
   ni un curseur admin.
4. **Recommandation active de profils compatibles** — pas un feed
   passif consulté, une suggestion poussée à la CPTS. Capacité
   nouvelle, pas une extension d'existant.

**Écart critique à ne pas laisser filer** : les points 1 et 4
fonctionnent pour n'importe quelle profession dans la formulation du
pitch, mais le produit n'en connaît qu'une aujourd'hui (kiné). Si un
président de CPTS répond "il me manque un ophtalmo", le produit ne
peut aujourd'hui rien faire de cette réponse. Deux façons de fermer
l'écart, pas de troisième : soit le pitch est explicitement cadré
"kiné aujourd'hui, élargi bientôt" (honnête, cohérent avec la
séquence fondatrice), soit un v1 volontairement restreint (kiné
seul) est construit avant que Jean-Charles ne fasse cet appel — pour
ne jamais avoir à répondre non à un président de CPTS qui prend le
pitch au mot. Investigation de scoping envoyée le 13/08, voir
ROADMAP.md.

**Distinction à ne pas perdre** : "Jacqueline, présidente de la CPTS
Occitanie du Sud" (section 2, exemple pour cadrer la conception du
module de factorisation) reste un persona fictif illustratif — la
CPTS Nord Basse-Terre est la cible réelle et concrète, différente,
à ne pas confondre dans les prompts ou les pages construites.

### Gratuités négociées, levier de crédibilité institutionnelle (13/08)

Deux accès gratuits accordés, en plus du PoC ci-dessus, tous deux
appuyés sur les rôles institutionnels de Jean-Charles (déjà notés
comme leviers de crédibilité pour l'adoption produit) :

- **CPTS Nord Basse-Terre, en tant qu'entité** — gratuité
  conditionnée explicitement : *tant que Jean-Charles en fait
  partie*. Pas un engagement permanent détaché de sa présence dans
  la structure — à retenir tel quel dans toute communication ou
  configuration, ne pas la traiter comme acquise indéfiniment.
- **Adhérents SNMKR Guadeloupe** — gratuité pour les membres du
  syndicat dont Jean-Charles est président. Périmètre plus large
  que la CPTS (individus, pas une seule entité), à vérifier
  comment l'appartenance au syndicat se constate côté produit
  (déclaratif ? liste fournie par le syndicat ? autre ?).

**Précisé le 13/08 — trois exigences fermes, pas de compromis :**

1. **Usage complet, pas le plan FREE.** Distinct du plan gratuit
   standard (limité à 1 annonce active) — ces bénéficiaires ont
   l'usage plein du produit, sans restriction. Nécessite un
   mécanisme séparé (flag ou plan dédié), pas une réutilisation de
   `SubscriptionPlan.FREE`.
2. **Borné dans le temps à la fonction, pas à la personne.**
   Gratuit jusqu'à la fin de la relation institutionnelle de
   Jean-Charles avec chaque structure (président SNMKR, secrétaire
   CPTS) — pas un avantage permanent. L'expiration doit être liée
   à cette condition, pas à une date fixe arbitraire.
3. **Jamais silencieux — condition non négociable.** Les
   bénéficiaires doivent savoir explicitement que leur accès est
   gratuit *en tant que* membre/adhérent de telle structure, grâce
   au rôle de Jean-Charles. Raison double : ça limite le risque
   d'accusation de conflit d'intérêt (un avantage caché serait bien
   plus suspect qu'un avantage affiché et justifié), et ça
   transforme ces comptes en évangélisateurs du produit à bas coût
   — un bénéficiaire qui sait pourquoi il a un accès gratuit en
   parle plus volontiers qu'un simple utilisateur silencieux.
   Implique un message visible dans le produit (pas juste une
   mention légale enfouie), à formuler avant toute implémentation.

---

## 5. Phase 2 — quelle profession ouvrir en premier, données réelles
## (21/08)

Fichiers Annuaire Santé (ANS) déposés par Jean-Charles, département
971, dédoublonnés par identifiant PP.

**Effectifs réels confirmés** : 3530 infirmiers, 1177 kinés, 646
généralistes (les deux premiers très proches des estimations de
Jean-Charles, le troisième moins précis — 646 réel contre 1000
estimé).

**Divergence structurelle trouvée entre les deux candidates
naturelles** :
- Kinés : 93% libéraux, 7% salariés — quasi exclusivement libéral
- Infirmiers : 65% salariés, 35% libéraux — déjà majoritairement
  salarié

**Limite reconnue** : ce sont des effectifs inscrits, pas des postes
vacants. Ça confirme le terrain (beaucoup d'infirmiers, orientés
salariat) sans prouver la tension sur les postes salariés — cette
preuve demanderait une donnée de vacance côté établissements (type
SAE-DREES), absente de ces fichiers.

**Implication produit, pas juste démographique** : si les infirmiers
penchent naturellement salariat, le type de mission dominant serait
SALARIE — pas REMPLACEMENT/ASSISTANAT/COLLABORATION comme pour le
kiné. Pas juste "le même mécanisme, une nouvelle profession" : la
porte "établissement" deviendrait centrale plutôt que secondaire,
usage différent du produit à anticiper si infirmier est confirmé
comme prochaine profession.

**Décision prise le 21/08 : infirmier, prochaine profession de la
Phase 2.** Légitimité (futur collaborateur infirmier de l'équipe),
séquence REZONE (médecins → kinés → infirmiers), colonne
`CommuneAPL.aplInfirmier` déjà existante, effectif le plus large et
le plus dense (3530) de toutes les professions étudiées. Assumé
explicitement : la bascule vers un usage salariat-dominant (67% du
vivier) est un vrai chantier produit, pas une simple duplication du
mécanisme kiné — SALARIE devra devenir un type de mission central,
pas secondaire. Rien à construire maintenant (aucune 2ᵉ profession
active) — cette décision informe les 3 points de généricité déjà
actés (inscription Ameli/RPPS, audit Ordre, contrats) : l'Ordre
concerné est désormais concrètement l'Ordre National des Infirmiers,
pas une inconnue générique.

### Vue complète toutes professions (971, 21/08) — deux familles
### structurelles

Analyse exhaustive des 11 fichiers déposés, dédoublonnés par
identifiant PP :

| Profession | Effectif | % Libéral | % Salarié |
|---|---|---|---|
| Pédicure-Podologue | 74 | 100% | 3% |
| Ostéopathe | 154 | 99% | 1% |
| Kinésithérapeute | 1039 | 94% | 8% |
| Chirurgien-Dentiste | 322 | 92% | 8% |
| Orthophoniste | 161 | 84% | 22% |
| Ergothérapeute | 88 | 24% | 89% |
| Sage-Femme | 212 | 31% | 74% |
| Psychologue | 300 | 40% | 72% |
| Infirmier | 3530 | 35% | 67% |
| Orthoptiste | 48 | 40% | 65% |
| Pharmacien | 436 | 44% | 56% |
| Médecin généraliste | 646 | — | — |

**Deux familles nettes, avec implication stratégique directe** :
- **Famille "libéral"** (même structure que le kiné actuel :
  Pédicure-Podologue, Ostéopathe, Chirurgien-Dentiste,
  Orthophoniste) — se brancherait presque directement sur le
  mécanisme existant (remplacement/assistanat/collaboration), sans
  avoir à faire porter le produit sur le type SALARIE
- **Famille "salarié"** (Ergothérapeute, Sage-Femme, Psychologue,
  Infirmier, Orthoptiste, Pharmacien) — nécessite que SALARIE
  devienne un type de mission central, pas secondaire

**Arbitrage réel, pas un choix évident** : Chirurgien-Dentiste (322
praticiens, 92% libéral) répliquerait le mécanisme kiné presque tel
quel, mais sans la légitimité humaine (pas de dentiste dans
l'équipe) ni la place dans la séquence REZONE, et sur un effectif
bien plus modeste que l'infirmier (3530). Infirmier reste la
recommandation la plus solide sur le fond, mais avec un vrai coût
produit à anticiper (bascule vers SALARIE central) plutôt qu'une
simple duplication de ce qui existe déjà.

**"Acteur du système de santé caractérisé par un rôle" (449
entrées, 98% salarié)** — catégorie administrative/fonctionnelle du
RPPS, pas une profession clinique réglementée. Hors sujet pour
Soignect, à ignorer dans toute analyse future de ces fichiers.

---

## 6. FragiliKiné (AMK10) — outil métier comme canal d'acquisition

Décision du 21/08 : héberger FragiliKiné (PWA autonome de repérage
de la fragilité, acte AMK10) sur un sous-domaine Soignect, avec
attribution discrète plutôt qu'une publicité intrusive. Canal
distinct de tout ce qui a été envisagé jusqu'ici — pas de la
prospection (écarté pour le mécanisme Facebook), un vrai outil
professionnel gratuit qui attire par son utilité propre.

**Pourquoi ça correspond à la stratégie déjà posée** : renforce le
positionnement profondeur réglementaire face à Médiloup/App'Ines
(un outil directement lié à un acte NGAP précis, pas un gadget) ;
propre sur la confidentialité par construction (aucune donnée
patient transmise, tout côté client) ; cohérent avec le mode
dégradé/hors-ligne qu'App'Ines met en avant comme atout Outre-mer.

**Contenu clinique validé** par Jean-Charles avant diffusion.
Hébergement : migration de Netlify vers Vercel, sous-domaine dédié,
bandeau d'attribution vers Soignect — voir ROADMAP.md pour le prompt
de déploiement.

---

## 7. Points en observation, pas d'action

- Renommage `/remplacement-kine-guadeloupe` → `/kine-guadeloupe` :
  attend 1-2 semaines de données de trafic réelles (redirection 301
  prévue, rend la question sans risque)
- Stratégie d'acquisition testée (06/08) : passage d'un post
  générique Facebook (zéro retour) à des messages personnels ciblés
  (5-10 contacts connus). Résultat de conversion à suivre.
- **Contrainte technique confirmée (21/08)** : aucune API officielle
  ne permet de publier automatiquement dans un Groupe Facebook
  depuis avril 2024 (retirée par Meta pour toute app tierce). Les
  contournements (bots simulant un humain) exposent le compte
  personnel à un risque de restriction — écartés. Solution retenue
  pour diffuser vers le groupe "Kinésithérapeutes de Guadeloupe,
  Saint-Martin, Saint-Barthélemy" : génération automatique du texte
  (3 dernières annonces), publication manuelle par copier-coller.
  Semi-automatisé, pas automatisé — la contrainte plateforme ne
  permet rien de mieux aujourd'hui.

---

## 8. Principe de communication — fonctionnalité + persona + situation

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
