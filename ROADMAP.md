# SOIGNECT — ROADMAP

> Tenu par Sonnet (décisions, arbitrages, raisonnement produit).
> PRODUCT_SPEC.md (comportement vérifié du produit) reste sous la
> plume exclusive d'Opus. Ne pas fusionner les deux fichiers.
> Dernière mise à jour : 19/08 (B0/B1/B3 poussés en production,
> `main` = `b669afa` ; gating client actif du boost en cours de
> cadrage).

---

## 🎯 Séquence fondatrice

```
DOM-TOM → NATIONAL → AUTRES PROFESSIONS

1. Les kinés d'abord (phase actuelle) — un métier, un territoire
   (Guadeloupe), creusé en profondeur avant d'élargir
2. Ouvrir à d'autres professions
3. Scaler Outre-mer
4. Scaler France entière
```

**Raisonnement concurrentiel** (06/08, apparition du concurrent
MediLoup — large d'emblée, tous soignants, tout l'Outre-mer dès le
lancement) : l'avantage de Soignect n'est pas la largeur de
couverture, c'est la profondeur métier et réglementaire (contrats
CNOMK, vérification d'identité avant signature, asymétrie de
notation R.4321-99, connaissance fine de l'Avenant 7). Cette
profondeur ne se réplique pas vite pour un concurrent qui vise large
day one.

**Finalité de fond** (rappelée le 13/08, voir
STRATEGIE_MARKETING_BUSINESS.md section 0) : cette séquence n'est pas
qu'une défense concurrentielle, c'est le chemin vers une portée
nationale et un modèle institutionnel rentable — serveur MCP et/ou
base de données interrogeable, vendue en services et/ou en données
aux administrations et employeurs. La profondeur avant la largeur
sert les deux objectifs à la fois : elle protège aujourd'hui contre
un concurrent qui va vite et vend mal, et elle construit le substrat
de données structurées que la finalité nationale exige demain.

**Conséquence tenue depuis** : toute demande d'ouverture à une
nouvelle profession ou un nouveau territoire est examinée à l'aune
de cette règle — pas d'infrastructure construite pour un besoin qui
n'existe pas encore, sauf coût marginal quasi nul (voir principe de
factorisation ci-dessous, qui EST la construction progressive de ce
substrat, pas un exercice de propreté de code séparé de la
stratégie).

---

## 🧭 Principe de factorisation

Issu de la cartographie générique/kiné-spécifique (12/08, lecture
seule, détail dans PRODUCT_SPEC.md) :

- Le produit est **générique à ~80%** sans qu'on l'ait cherché
  (modèle de données, moteur de matching, audit déontologique,
  formulaires). Le poids kiné-spécifique est concentré dans un seul
  endroit dense — les gabarits de contrat (~850 lignes de droit) —
  plus une couche de vocabulaire diffuse mais superficielle.
- **Généricité et donnée-exposabilité sont deux axes indépendants.**
  Même le scoring, générique dans son mécanisme, a ses poids en
  constantes TypeScript, pas en base. Seule `CommuneAPL` coche les
  deux cases (multi-profession + en base) et n'est lue par aucune
  logique produit — la brique la plus proche de la vision MCP à long
  terme, encore dormante.
- **Règle appliquée** : factoriser quand le coût est faible et
  documente un raisonnement déjà tenu (`FENETRE_TENSION_GUADELOUPE`
  nommée plutôt que codée en dur, module profession×territoire des
  pages de propagande). Construire une vraie infrastructure de
  données (table `RegionSaison`, poids de scoring en base, ML de
  repondération) reste différé tant qu'aucun second territoire ou
  signal de succès mesurable n'existe réellement.
- **Une factorisation ne doit pas aplatir le sens.** Décision du
  12/08 sur les 3 accroches des pages de propagande : gardées
  distinctes plutôt que coulées dans un gabarit à trous, parce
  qu'elles ne disent pas la même chose (Guadeloupe annonce les 3
  types de poste, les deux autres situent le marché territorial).
  Factoriser la structure (module, paramétrage), jamais le contenu
  au prix du sens.

**Mise à jour (26/08)** — ce principe fondateur du 12/08 reste
valable tel quel, mais ne le relis pas seul : trois développements
depuis l'étendent concrètement.
- L'audit de généricité complet (19-21/08, "Clos et vérifié — 20/08")
  a vérifié ce principe contre tout ce qui a été construit depuis
  (CommuneAPL, PrioriteTerritoriale, module embarquable, mentions du
  feed) — fermé sur tout ce qui a été audité, rien n'ouvre une
  profession, c'est la forme qui a changé.
- Le principe fondateur "le match porte sur des disponibilités,
  jamais sur des profils" (STRATEGIE_MARKETING_BUSINESS.md, en tête
  de fichier) est le pendant architectural de la factorisation — pas
  juste factoriser le code, factoriser la façon dont deux besoins se
  rencontrent.
- Infirmier est acté comme prochaine profession (STRATEGIE §5,
  26/08), avec un vrai danger trouvé pendant l'audit : le contenu
  juridique des contrats n'est PAS encore générique (voir file
  d'attente, item marqué 🚨) — la seule vraie brèche restante dans
  "générique à ~80%".

---

## ✅ Clos et vérifié — session du 11-12/08

- Édition complète des annonces publiées, réutilisation du
  formulaire de création en mode édition (`?editId=`)
- `professionLabel` corrigé et son type renforcé — l'oubli futur ne
  compile plus
- Boutons "Disponibilité/Disponibilités" reformulés par profil
  (remplaçant : Mon calendrier · assistant : Ma recherche · bouton
  mobile central : Publier)
- Audit + refonte complète du vocabulaire du parcours salarié : 3ᵉ
  rôle IA `EMPLOYEUR`, rôle `CABINET` resserré en retour (interdit
  explicite du vocabulaire salarial), champ `remunerationBrute`,
  extraction texte libre corrigée (un chiffre saisi en langage
  naturel était compris puis perdu à la soumission)
- Cartographie générique/kiné-spécifique — référence pour toute
  décision de factorisation future
- Boost saisonnier mai-octobre : conditionnel au besoin du cabinet,
  fenêtre nommée territorialement (`FENETRE_TENSION_GUADELOUPE`),
  tracé et vérifié à l'écran
- Admin mobile : navigation + 4 tableaux tronqués silencieusement
  corrigés
- Section `/admin/diffusion` : liens, partage, fréquentation des 3
  pages de campagne, distinction humains/robots, trace mutualisée
- Images de partage OG + `og:url` étendues à toutes les pages
- Factorisation profession×territoire des pages de propagande,
  titre personnifié par territoire, 3 accroches gardées distinctes

## ✅ Clos depuis — 12/08, suite

- Affirmations invérifiables retirées des pages Saint-Barth ET
  Saint-Martin (833ae41) — Opus a trouvé une deuxième occurrence
  ("avec son propre marché du remplacement") non repérée ici
- Réorganisation complète de PRODUCT_SPEC.md (a1b7550) : 4209→3785
  lignes, 58→43 sections, 3 affirmations contredites par le code
  corrigées (mécanisme d'invitation par email existant mais dit
  absent, faux drapeau Facebook gate une fonctionnalité inexistante,
  emplacement réel d'affinityScore), 15 sections obsolètes retirées
  après vérification individuelle. Nouvelle structure : État vérifié
  → Parcours utilisateur → Briques transverses → Décisions ouvertes
  → Stratégie/fondations → Règles de méthode

- Bloc-note de statut sur la timeline du Planning : 5 statuts +
  note libre, persistant par match/mission, sans jamais toucher au
  statut technique du match (`suiviStatut` séparé de `briqueStatus`).
  "Contrat édité" écarté du choix de statuts (dupliquerait un état
  déjà connu du produit, risque de dérive). Note de zone non
  couverte portée par le poste, pas par la période (évite
  l'orphelinage au décalage de dates). Deux bugs trouvés à l'écran
  en marge (branchement sur le mauvais menu, `BottomSheet` sans
  défilement au-delà de 85vh) — corrigés, scope limité à ce menu.
- **Investigation Planning Board vs spec du 10/07 — répondue.**
  `maxCandidates`/`singleSlot` existent dans le schéma, lus par
  aucune logique : la limite de 3 matchs actifs concurrents décrite
  dans la spec historique n'a jamais été implémentée, seulement
  esquissée en base. Décision en suspens, pas urgente : construire
  réellement cette limite sur ces champs dormants, ou les retirer du
  schéma s'ils ne servent à rien.

- **`PROMPTS_EN_ATTENTE.md`** — Jean-Charles a demandé à Opus de le
  réagréger plutôt que de le retirer d'emblée (ma recommandation
  initiale). Statut à reconfirmer une fois le retour d'Opus connu :
  vérifier qu'il ne fait plus doublon avec la section "🔴 Prêts, en
  file" ci-dessous. C'est ce fichier périmé qui portait la fausse
  action Facebook trouvée par Opus.
- **`PLAN_PASSATION_SPRINTS.md`** (règles de méthode, dont la règle
  7) et **`PRODUCT_SPEC_v1_1_addendum.md`** (jamais replié) — à
  absorber dans PRODUCT_SPEC.md par Opus, pas de mon ressort.
- Opus revérifie contre le code (pas recopié depuis ce fichier) les
  éléments clos ici mais absents de PRODUCT_SPEC.md faute d'accès
  d'écriture à l'époque : cartographie générique/kiné-spécifique,
  professionLabel, remunerationBrute, édition `?editId=`. À son
  rythme, entre deux tâches.

**Correction (13/08)** : "vue liste desktop titulaire" avait été
listée par erreur ci-dessus comme un élément clos, à un moment où
elle ne l'était pas encore — erreur trouvée et signalée par Opus en
absorbant PLAN_PASSATION_SPRINTS.md/l'addendum dans PRODUCT_SPEC.md.
Bonne discipline de sa part de ne pas avoir documenté une
fonctionnalité inexistante juste parce que ROADMAP l'affirmait.
Depuis livrée et vérifiée (6184511, 7e58344) — voir section clos
ci-dessus, plus une référence de file d'attente.

- Vue liste desktop titulaire, alternative au swipe : livrée
  (6184511, 7e58344). Bascule en fin de barre de filtres, masquée
  sous 1024px. Mécanisme d'appariement extrait en
  `enregistrerChoix(mission, direction)`, partagé entre carrousel et
  liste — un seul chemin, pas deux. **Limite connue** : la liste
  trie sur `computeCompatibility` (signal déjà affiché sur la carte),
  pas sur le score d'affinité complet — `/api/feed` ne renvoie aucun
  score par mission, celui-ci n'est calculé qu'au swipe côté serveur.
  Un vrai tri par affinité demanderait que le feed calcule et
  renvoie un score par carte — chantier à part, coût non nul, pas
  engagé. Mention de transparence différenciée entre les deux vues
  (cartes = désirabilité/abonnement/boost saisonnier, liste =
  compatibilité pure) pour rester exacte dans chaque contexte.

- Vue "Mes relances en attente" : livrée (1dcddbd, e73029d). Bande
  repliée sous le bandeau d'alerte du Planning, invisible si rien à
  signaler. Aucune requête ajoutée — dérivée des données déjà
  chargées par `planning/page.tsx`. Trois groupes (À relancer /
  Autres suivis / Notes de poste), clic rouvre le `Panel` existant
  (pas de duplication). Un vrai suivi déjà en base (posé la veille,
  22h02) confirme un usage réel du bloc-note livré le 12/08.
  **Incident de méthode signalé par Opus** : son script de jeu
  d'essai a écrit une note de test sur un poste d'un AUTRE cabinet
  ("Assistant mahault 1"), faute de filtrer par propriétaire. Corrigé
  sans trace ni notification déclenchée, mais retenu comme leçon :
  tout script de test doit être borné explicitement au compte de
  test connu, jamais "un poste au hasard" — risque réel sur un
  produit multi-tenant. **Limite connue** : la bande n'est
  consultable que depuis le Planning, pas d'entrée globale (badge
  nav, écran dédié) — nécessiterait une vraie requête, chantier à
  part si le besoin se confirme.

- Invitation à créer un compte quand aucun n'existe pour l'email
  saisi : livrée (19ac848, fdc98f7 + correctif menu). Bouton branché
  sur `/api/cabinet-posts/[id]/invite`, déjà entièrement construit
  côté serveur (token, expiration 7j, email nommant cabinet et
  poste, lecture `?inviteToken=` à l'inscription) — seule
  l'interface manquait, même motif que `statusNote`. Écran de
  confirmation respecte la règle 7 (dit "se fera à la finalisation",
  pas "fait"). Trouvaille en cours de route : le point d'entrée
  direct sur la ligne d'un poste (hors panneau latéral déclenché par
  l'alerte) n'existait pas non plus — ajouté. Invitation réelle
  envoyée et confirmée en base (PENDING, expire 20/08).
  **Réserve de méthode, vérifiée et close** : confirmé — commit
  exact `c063718` (le rapport initial le confondait avec `fdc98f7`,
  commit de documentation), build réellement propre avant le push
  (l'omission était dans le compte rendu, pas dans la vérification).
  Opus a lui-même relié l'incident à celui du poste d'un autre
  cabinet la veille — même famille : action non revue exécutée dans
  la foulée de sa propre écriture. Trois engagements enregistrés de
  son côté : s'arrêter après un correctif découvert en cours de
  route et attendre feu vert avant de s'en servir pour une action
  irréversible, nommer systématiquement les hash exacts, mentionner
  explicitement le build même quand tout va bien.

- Email "consultation d'annonce" : corrigé, mais pas comme prévu
  (032a112). Le lien direct vers la fiche du remplaçant EXISTE déjà
  et fonctionne quand le visiteur a publié une recherche
  (`/annonce/<id>`, "Voir sa recherche →") — la capture d'écran
  montrait le cas de REPLI, pas un lien cassé. Mesuré en base : 9
  visiteurs distincts, 5 sans aucune annonce active — le repli est
  le cas MAJORITAIRE, pas marginal. Cause structurelle : aucune page
  de profil n'existe dans le produit, seule page publique = une
  annonce ; sans publication, la personne n'apparaît nulle part (ni
  feed, ni swipe). Ce qui a été corrigé : le texte de repli, qui
  promettait un accès inexistant ("Voir mes annonces" menait en
  réalité au Planning, pas à une liste) — remplacé par une
  explication honnête + libellé de bouton corrigé selon le
  destinataire. Décision de fond tranchée le 13/08 : voir item 5 de
  la file et STRATEGIE_MARKETING_BUSINESS.md §3 — pas de profils
  navigables, piste retenue : geste de consentement "signaler mon
  intérêt".

- **Bug de rattachement assistant** (`assistantPost.ts`) — livré
  (6545fc9). La garde accepte désormais REMPLACANT et ASSISTANT aux
  deux endroits (attache l.53-55, détache l.116). Vérifié par
  matrice contre la base réelle : REMPLACANT rattaché, ASSISTANT
  sans régression, TITULAIRE refusé. Le plus ancien défaut
  fonctionnel du produit est fermé. **Erreur d'état corrigée le
  13/08** : ce fichier le donnait encore comme "prompt envoyé,
  rapport pas encore reçu" — repérée par Opus en lisant ROADMAP.

- **"Qui s'intéresse à mon annonce" : livré (e916282).** Build vert
  avant push. Confirmé : `CARD_CONSULTED` vient de
  `/api/missions/[id]/card`, identité fiable (401 sans session).
  Aucun second signal construit — le geste existait déjà (swipe
  "Intéressé"), seule la lisibilité manquait des deux côtés. Côté
  visiteur sans recherche publiée : "Intéressé" devient "Signaler
  mon intérêt", avec la portée exacte énoncée ("ce cabinet verra
  votre nom... et uniquement celle-ci"). Côté cabinet : bande
  repliée au-dessus du carrousel montrant les personnes intéressées
  mais inatteignables (2 des 8 swipes RIGHT mesurés), avec message
  clair sur ce qui n'est pas encore possible. **Point ouvert, pas
  tranché** : le badge "N candidatures en attente" reste ambigu —
  compte ensemble les personnes atteignables et inatteignables, la
  bande corrige l'effet pas la cause. Choix d'affichage à trancher
  si souhaité (distinguer les deux dans le badge lui-même), pas
  urgent.

- **Contrainte d'unicité Match : migrée (6cc5254).** Remplace
  `@@unique([profileAId, profileBId])` par un index d'expression
  `UNIQUE (COALESCE(missionAId, profileAId), COALESCE(missionBId,
  profileBId))` — 1 objet à maintenir plutôt que 3 (arbitrage
  retenu face à `@@unique` + index partiels), ferme le trou NULL
  identifié par l'investigation (Postgres traite chaque NULL comme
  distinct). Non déclarable dans Prisma — commentaire laissé à
  l'emplacement de l'ancien `@@unique` pour qu'un futur lecteur ne
  croie pas la table sans contrainte. Garde applicatif (`api/swipe`)
  réécrit pour vérifier la paire de missions plutôt que la paire de
  personnes. Ouvre la possibilité de deux relations sur des missions
  différentes entre les mêmes personnes — comportement inchangé
  aujourd'hui (le feed filtre déjà toute mission engagée). Deux
  endroits qui raisonnent encore "par personne"
  (`detachAssistantPostForMatch`, calcul `enRelation`) documentés
  dans PRODUCT_SPEC.md plutôt que corrigés à l'aveugle — à revoir
  le jour où ce cas existera réellement. **Vérifiée par l'échec le
  13/08 (72cf766)** : 3 insertions réelles, base restaurée à 0.
  Relation sur annonce A créée, seconde relation mêmes personnes/
  autre annonce créée (confirme le déblocage), doublon sur la même
  paire de missions refusé (P2002). Le test utilisait un profil
  sans aucune mission (`missionBId = NULL` des deux côtés) —
  scénario exact que le COALESCE devait fermer, confirmé.

- **Repli silencieux `?? REMPLACEMENT` du contrat : fermé et
  vérifié (13/08).** Remplacé par un refus explicite ("impossible
  de générer le contrat : aucune annonce n'est rattachée..."),
  confirmé inatteignable aujourd'hui avant modification (aucun
  match existant n'en dépendait). Refus vérifié en conditions
  réelles — a fallu franchir deux gardes antérieurs (signature,
  identité contractuelle complète) pour l'atteindre, confirmant que
  la chaîne de génération de contrat est protégée à plusieurs
  niveaux. **Incident de méthode pendant la vérification** : coupure
  de la connexion locale d'Opus (pas de la production — l'app
  continuait de servir les annonces normalement) a retardé le
  nettoyage d'un match de test "confirmé" entre le compte de
  Jean-Charles et son propre compte de test Julien MORISOT (pas un
  tiers — confirmé le 13/08). Base restaurée à 0 mise en relation
  une fois la connexion rétablie. **Leçon retenue, généralise celle
  d'hier** : ne pas créer de données de test sans un chemin de
  retrait garanti — la fiche d'un match sans mission n'offrait
  aucun bouton d'annulation, le seul chemin de nettoyage dépendait
  d'un accès qui venait de tomber.

- **Module Soignect embarquable, v1 : livré (13/08).**
  `/embed/territoire/nord-basse-terre`, iframe-ready (520px conseillé
  pour 5 postes), 3 mécanismes existants réutilisés (rendu sans
  chrome, absence de middleware, absence de X-Frame-Options —
  vérifiée par curl). Filtre d'annonces partagé avec la page de
  campagne (bénéfice croisé : `/remplacement-kine-guadeloupe`
  l'utilise maintenant aussi). Bug trouvé et corrigé : fond de
  l'app débordait hors du contenu dans une iframe plus haute que
  prévu, colorant le site hôte — fond rendu transparent. CTA hors
  iframe (`target="_blank"`). Page non indexée, trafic tracé
  (`embed-nord-basse-terre`, visible `/admin/diffusion`). v2
  (indicateur de tension) volontairement non construite —
  l'investigation commune/zone (voir section clos ci-dessus) a
  confirmé que `CommuneAPL` porte la bonne donnée mais reste non
  alimentée (script d'alimentation absent, aucun millésime) ; v2
  attend cette alimentation, pas un diagnostic supplémentaire.
  Périmètre géographique `NORD_BASSE_TERRE` (Pointe-Noire, Deshaies,
  Sainte-Rose, Lamentin) confirmé correct par Jean-Charles le 13/08.
  **Confirmé le 13/08** : périmètre géographique validé par
  Jean-Charles. **Exigence ajoutée le 13/08** : le module ne doit
  pas rester architecturalement enfermé dans le kiné — dès que le
  produit évolue vers d'autres professions (séquence fondatrice,
  pas d'accélération), le module doit pouvoir afficher les postes
  d'une CPTS toutes professions confondues sans reconstruction. À
  vérifier maintenant : le filtre `filtreAnnoncesVivantes` et les
  libellés/titre/méta de la page ne doivent rien supposer de
  "kiné" en dur. Rejoint directement l'exigence de généricité déjà
  posée sur le module de factorisation profession×territoire×porte,
  livré depuis (voir section clos ci-dessus) — traité en parallèle :
  prompt d'investigation + correctif envoyé le 13/08, rapport pas
  encore reçu.

## ✅ Clos depuis — 13/08, investigation commune ↔ zone

- **Investigation correspondance commune ↔ zone : répondue le
  13/08.** Champs confirmés : `Mission.location` (commune,
  proposeur), `Mission.zones` (`ZoneGeographique[]`, chercheur),
  `Profile.region` (territoire, pas une zone) — les deux premiers
  vivent sur `Mission`, distinction d'usage, pas de schéma.
  Correspondance déjà résolue dans `deepseek.ts` (`scoreGeo`,
  25/25/18/12/6 pts selon la qualité du match géo, poids réel 30/100
  en remplacement, 25/100 en long terme après renormalisation) via
  `zoneOfCommune()` lisant `COMMUNE_ZONE` (35 entrées codées en dur).
  Logique délibérée : flexibilité côté candidat uniquement, le
  cabinet a une commune fixe — jamais de comparaison zone↔zone.
  **Duplication silencieuse trouvée** : une table Prisma
  `CommuneZone` (35 lignes) existe déjà, strictement identique à
  `COMMUNE_ZONE` (comparée entrée par entrée), mais lue par aucun
  code — deux sources d'accord par chance, sans garantie de le
  rester. **Correctif livré, voir plus bas dans cette même
  section** : génération
  automatique depuis `COMMUNE_ZONE`, source unique. `CommuneAPL`
  confirmée porter la couche 2 (donnée APL brute nationale) —
  nationale par nature, réutilisable pour toute commune de France
  une fois alimentée, ses 3 manques (script d'alimentation,
  millésime, `boost*` mélangeant réglage et donnée externe)
  inchangés. Zonage réglementaire (couche 3,
  `ZONE_3_INTERMEDIAIRE`/`ZONE_4_NON_PRIORITAIRE`) confirmé
  proprement séparé de la couche produit — même mot "zone", deux
  choses différentes, piège de vocabulaire pas de conception. Rien
  ne bloque l'extension du module embarquable aux nouvelles portes
  (`filtreAnnoncesVivantes` gère déjà commune-ou-zone). Écran admin
  "Données APL" : rien à y changer pour cette investigation.

- **CommuneZone généré depuis COMMUNE_ZONE : livré (7e5f501).**
  Convention maison réutilisée (`scripts/backfill-owner-seat.mjs`
  comme modèle, `.mjs` idempotent, mode simulation) plutôt qu'un
  `prisma db seed` inventé. `npm run db:check-zones` (rapporte,
  n'écrit rien, sortie 1 sur écart) et `npm run db:sync-zones`
  (régénère). Point critique respecté : le script lit `COMMUNE_ZONE`
  via `jiti` depuis le vrai module TypeScript, jamais une copie —
  recopier la constante aurait recréé la duplication qu'on ferme.
  Régénération par upsert, jamais TRUNCATE+INSERT — table jamais
  vide. **Vérifié en cassant la table de 3 façons** (commune
  reclassée, commune fantôme ajoutée, commune supprimée) — les 3
  détectées et corrigées, table revenue à ses 35 lignes exactes.
  Commentaire de schéma documente le vrai piège : une édition
  manuelle en base n'aurait aucun effet sur le matching (`scoreGeo`
  lit la constante) puis serait effacée à la régénération —
  confusion silencieuse si non documentée. `scoreGeo`/`zoneOfCommune`
  inchangés, scoring toujours synchrone. **CI/pre-commit non
  construit** — projet sans CI ni hooks existants, disproportionné
  d'en bâtir un pour cette seule vérification ; le script est prêt
  (sortie 1 sur divergence) pour le jour où l'un des deux existe.
  **Décision différée, pas bloquante** : la vérification nécessite
  `DATABASE_URL` — l'exposer dans une CI GitHub n'est pas anodin, un
  hook pre-commit local serait plus sobre. À trancher quand CI/hooks
  existeront réellement dans le projet.

- **4 pages persona (portes d'entrée) : livré (eda2558, f98e80a,
  05f5038), avec une réserve.** Module de 3 axes composables
  {profession × territoire × porte} — chaque axe déclare seulement
  ce qui varie avec lui (profession = vocabulaire, territoire =
  nom/préposition, porte = phrases composant les deux). Ajouter une
  porte = une entrée, pas une multiplication. 220 lignes pour 3
  dimensions. URLs : `/recrutement-kine-guadeloupe` (cabinet),
  `/emploi-kine-guadeloupe` (établissement),
  `/territoire-kine-guadeloupe` (MSP/CPTS) — motif cohérent avec
  `/remplacement-kine-guadeloupe` existant, réutilisé tel quel sans
  réécriture (vérifié inchangé caractère près). Porte territoire
  volontairement hors gabarit : une CPTS ne cherche pas de poste,
  page dédiée (répartition par zone en direct via `COMMUNE_ZONE`,
  argumentaire en 3 points) plutôt qu'un fil d'annonces qui aurait
  répondu à côté — même trace/admin/partage, mise en page
  différente. `/admin/diffusion` désormais DÉRIVÉ du module
  (PORTES × TERRITOIRES) plutôt que recopié à la main — ferme le
  risque récurrent de pages découvertes après coup (Saint-Martin/
  Saint-Barth). **Bug trouvé via inspection des traces en base, pas
  par le build** : `Profession.court` ("kiné" accentué) générait des
  URLs fausses (`/emploi-kiné-guadeloupe` au lieu de
  `/emploi-kine-guadeloupe`) — les pages répondaient quand même
  (les deux formes compilent), donc rien de visible, mais le lien
  admin "Ouvrir ↗" aurait 404, canoniques fausses, clés de trace
  divergentes. Corrigé : profession porte maintenant un slug
  déclaré, pas translittéré. **⚠️ Réserve non close** : l'écran
  `/admin/diffusion` lui-même n'a pas été vu (extension Chrome
  déconnectée en cours de vérification) — le module sous-jacent est
  vérifié, pas ce rendu précis. En attente que Jean-Charles relance
  l'extension. **`Zonage MK_2024.pdf` : identité NON confirmée** —
  tentative de lecture le 13/08 sans texte extractible du PDF,
  affirmation écartée le 17/08 faute de preuve, pas à traiter comme
  acquise malgré une reformulation ultérieure erronée qui l'affichait
  "confirmée". `.gitignore` corrigé pour le nommer explicitement
  plutôt que `*.pdf` (évite qu'une future vraie source soit
  silencieusement ignorée), `docs/sources/` proposé comme
  emplacement pour le versionner à côté du code qu'il justifie une
  fois son identité réellement établie — même motif que
  `COMMUNE_ZONE`/`CommuneZone` : une donnée transcrite en dur doit
  pouvoir être tracée jusqu'à sa source.
  Versionnement effectif pas encore confirmé.

- **Affirmation fausse "zones prioritaires" : livrée (f229c27).**
  Trouvée en vérifiant le rapport de l'agent de scoping CPTS : le
  texte de transparence affiché aux cabinets affirmait une
  priorisation territoriale qui n'existe pas dans `desirability.ts`
  — vue par de vrais utilisateurs en production depuis `979ccd8`,
  documentée à tort comme vérifiée dans `PRODUCT_SPEC.md:1824`.
  Mention retirée du composant et de la spec. En local, pas poussé.
  Sera à réintroduire correctement une fois B1 (voir item 1
  ci-dessous) vérifié et poussé — pas dans le même geste.

- **Fuite de profession dans le feed : livrée (924e329).**
  `filtreAnnoncesVivantes` prend désormais la profession en
  paramètre obligatoire, sans valeur par défaut (un défaut aurait
  refermé la fuite aujourd'hui et l'aurait rouverte en silence à la
  première page oubliée). Les 4 appelants la déclarent, `/api/feed`
  borne le lecteur à sa propre profession, le module embarquable la
  porte en config plutôt qu'un titre en dur — satisfait au passage
  l'exigence du 13/08 (ajouter une profession = une entrée, pas une
  reconstruction). Mesuré avant/après : 19 annonces vivantes dans
  les deux cas, rien perdu. En local, pas poussé.

## ✅ Clos et vérifié — 20/08, chemin complet CPTS

- **Relation CPTS Nord Basse-Terre ouverte + première déclaration
  réelle : vérifié à l'écran de bout en bout, par Jean-Charles
  lui-même à l'écran (pas Opus via Prisma).** `/admin/priorites` vu
  pour la première fois — formulaires clairs, texte d'aide qui
  répond directement à la question "comment vérifier que la fonction
  est toujours exercée" (date de revue explicitement dite "pas
  preuve", jamais déguisée en vérification automatique). Déclaration
  Deshaies/Kinésithérapeute/niveau 2 (+6 pts) enregistrée, "Agit ?
  oui" confirmé, "1 agissante sur 1".
  Deux détails mineurs signalés, pas urgents : compteur
  "Déclarations" du tableau des relations resté à 0 malgré la
  déclaration existante (probable défaut de rafraîchissement) ;
  décalage d'un jour entre date saisie et date affichée (fuseau
  horaire probable à la création).
- **B2 livré et poussé (20/08)** — la mention nomme désormais la
  CPTS Nord Basse-Terre, adossée à la vraie déclaration sur
  Deshaies. Reste honnêtement silencieuse tant qu'aucune annonce
  n'existe sur Deshaies/Sainte-Rose/Lamentin. Règle d'écriture
  documentée dans PRODUCT_SPEC.md : une institution → on la nomme ;
  plusieurs, aucune, en-tête absent ou JSON illisible → formule sans
  auteur. **État réel documenté avec la bonne nuance** : "relation
  active, déclaration active, 0 annonce créditée, mention muette" —
  le levier est actif ET sans effet, pas inerte, distinction
  importante. **Réserve honnête conservée** : la phrase nommée n'a
  jamais été vue rendue à l'écran, faute d'annonce à Deshaies — la
  chaîne complète est vérifiée (déclaration lue, gating appliqué,
  en-tête encodé, formule choisie), pas le rendu final lui-même.
  PRODUCT_SPEC.md entièrement à jour (`c084dc8..685e384`), 3 des 4
  passages corrigeaient des affirmations devenues fausses depuis la
  veille — mesure du cabinet fondateur mise à jour (5/10 vs 6/11 le
  18/08) sans réécrire l'ancienne, une note datée du 20 ajoutée à
  côté. **Le vrai point bloquant restant n'est pas technique** — dit
  explicitement par Opus : *"la démo ne montrera un déplacement que
  le jour où un cabinet publiera à Deshaies, Sainte-Rose ou
  Lamentin — c'est du recrutement d'annonceur, pas du code."*
  Chantier B0→B2 + gating + correctifs entièrement fermé côté
  ingénierie ; il reste à Jean-Charles de faire publier une annonce
  réelle sur l'une de ces 3 communes avant l'appel CPTS.

- **Trois déclarations testées, deux retenues (21/08) — mention
  honnête active, zéro effet visible sur l'ordre.** Chronologie
  complète : Sainte-Rose déclarée sur la prémisse d'une annonce
  ("Succession poste Marion") qui a disparu entre-temps (supprimée
  volontairement par Jean-Charles, confirmé — pas un bug). **Bonne
  discipline d'Opus** : a distingué "la déclaration est vraie"
  (Sainte-Rose fait partie du territoire CPTS, manque de kinés,
  indépendamment des annonces) de "l'argument qui l'a motivée ne
  tient plus" — a proposé de la retirer plutôt que d'imposer son
  propre jugement, argumenté pour la garder si demandé. **Décision
  de Jean-Charles : gardée.** Pointe-Noire ensuite déclarée à la
  demande explicite de Jean-Charles — pour la première fois, la
  mention de transparence affichée aux candidats est authentiquement
  vraie, adossée à une relation client réelle. Mais **risque
  d'image identifié et confirmé** : les 5 annonces créditées à
  Pointe-Noire sont toutes du cabinet fondateur (déjà en tête à 100,
  passent à 106, aucun changement de rang) — exactement le piège
  identifié dès le choix initial de Deshaies/Sainte-Rose plutôt que
  Pointe-Noire, revenu par la déclaration ultérieure. Un observateur
  pourrait légitimement se demander si la CPTS avantage le cabinet
  du vendeur — faux dans les faits, mais rien à l'écran ne le
  précise. **Décision finale de Jean-Charles : Pointe-Noire
  retirée.** État stable : Deshaies + Sainte-Rose déclarées (niveau
  2, hypothèse d'Opus non validée par la CPTS, modifiable en un
  clic), 0 annonce créditée sur les deux — mention honnête, mais
  muette à l'écran tant qu'aucune annonce non-fondatrice n'existe
  sur le territoire. **La seule piste restante pour rendre la démo
  démonstrative** : le contact Sainte-Rose identifié via Facebook
  (secteur La Boucan), message prêt, jamais confirmé envoyé — ou
  trouver un autre vrai cabinet non-fondateur sur Deshaies/
  Sainte-Rose/Lamentin. **Piste notée pour plus tard** : si la CPTS
  hiérarchise réellement son territoire (ex. Deshaies plus tendue
  que Sainte-Rose), des niveaux différenciés par commune rendraient
  le levier capable de trancher entre communes déclarées — pas
  juste "actif ou pas".
  **Clôture confirmée (21/08, `39b5e5a`)** : Pointe-Noire retirée,
  tableau vérifié — 2 déclarations actives (Deshaies, Sainte-Rose),
  0 créditée, mention muette, exactement l'état d'avant l'ajout.
  Opus a conservé dans PRODUCT_SPEC.md les 3 faits mesurés pendant
  la brève activation de Pointe-Noire plutôt que de les effacer avec
  l'état — apprentissage retenu même si la donnée a changé : (1) la
  mention nommée a été vue à l'écran pour la première fois,
  authentiquement vraie — lève la réserve du 20/08 ; (2) l'ordre n'a
  pas bougé, `937c884` reproduit à l'identique 4 jours plus tard sur
  une vraie déclaration cette fois ; (3) reformulation retenue —
  "pas un défaut du levier, le levier qui rend visible un conflit
  d'intérêt préexistant". **Point noté, pas corrigé sans raison** :
  "Agit ? oui" s'affiche même à 0 annonce créditée — pas faux (la
  colonne dit "en vigueur", pas "change quelque chose aujourd'hui"),
  signalé pour vigilance future, non corrigé faute d'un vrai cas de
  confusion observé.

- **Saga "Cabinet Dubien" à Pointe-Noire — investiguée, résolue,
  option B de la démo refermée.** Une annonce non-fondatrice était
  brièvement apparue à Pointe-Noire sous un profil "Cabinet Dubien".
  **Root-cause précise** : l'invitation envoyée à Marion le 13/08
  09:16 a expiré le 20/08 09:16 ; elle s'est inscrite le 20/08 14:13,
  4h57 trop tard. Le code a fait exactement ce qui était écrit — pas
  un dérapage. **Vrai défaut produit trouvé, pas isolé à Marion** :
  la route de lookup d'invitation calcule et renvoie un motif précis
  (expirée/utilisée/poste supprimé), mais `register/page.tsx`
  l'ignore et affiche un formulaire vierge sans aucune mention du
  cabinet visé. Résultat : Marion a cru s'inscrire normalement et
  est devenue titulaire de son propre cabinet. **Toute invitation
  ouverte après 7 jours produira le même résultat** — pas un
  incident isolé, un vrai gap UX à corriger. Pas encore prompté.
  **Confirmé : pas un fantôme, une vraie tierce personne**
  (marionth3@gmail.com) avec de vraies données — traité comme tel à
  chaque étape, rien touché sans consentement explicite.
  **Rattachement effectué avec l'accord de Marion** ("elle veut être
  rattachée à mon cabinet") : type TITULAIRE→ASSISTANT, rattachée au
  poste "Marion" (celui que visait l'invitation à l'origine).
  Contrainte trouvée en chemin : `/api/cabinet-posts/[id]/link`
  n'accepte que ASSISTANT alors que le flux d'invitation automatique
  accepte ASSISTANT+REMPLACANT depuis le 03/08 — incohérence entre
  les deux chemins, signalée mais pas corrigée (hors scope du jour,
  même famille que l'incident du contrat du 23/07). **Suppression
  formelle demandée et exécutée** : ses 2 missions et son
  `CabinetPost` "Cabinet Dubien" supprimés, dépendances vérifiées à
  zéro avant (aucun swipe/match la concernant), sauvegarde complète
  écrite avant suppression. **⚠️ Sauvegarde dans un scratchpad
  éphémère de session — à déplacer vers un emplacement durable avant
  la fin de la session Claude Code, sinon la suppression cesse
  d'être réversible.** Non touché, par choix délibéré : son nom
  d'affichage reste "Cabinet Dubien" (pas à renommer sans son
  accord), l'invitation reste PENDING/expirée (trace honnête de
  l'incident, pas effacée). **Conséquence directe pour la démo** :
  Pointe-Noire revient à 5/5 annonces toutes du cabinet fondateur —
  l'option B n'existe plus. Aucune commune de Nord Basse-Terre ne
  porte plus d'annonce non-fondatrice. **Chemin CPTS reparti à zéro**
  — reste uniquement la piste Sainte-Rose (contact Facebook, jamais
  confirmé) ou trouver un autre vrai cabinet non-fondateur sur
  Deshaies/Sainte-Rose/Lamentin.
- **Incident signalé, non traité par choix de Jean-Charles** : un
  compte a été créé au nom d'une personne réelle sans son
  consentement, pour publier son annonce en son nom. Risques
  identifiés (usurpation d'identité, RGPD, contradiction directe
  avec le modèle de vérification d'identité que Soignect construit
  par ailleurs) — recommandation de retrait donnée, déclinée. À
  reprendre si Jean-Charles souhaite un jour un chemin conforme
  (mécanisme de revendication par la vraie personne, déjà esquissé
  dans le cahier des charges Facebook écarté).

- **Mélange barre de tête entre sessions : CONFIRMÉ RÉSOLU (en
  production).** Fausse alerte de fuite de données — les données
  servies par `planning/page.tsx` étaient toujours correctes, c'est
  uniquement le nom affiché dans la barre de tête (composant de
  layout séparé) qui restait périmé après un changement de compte
  sur le même appareil. Cause corrigée : PAS le JWT figé au sign-in
  comme d'abord supposé — réfuté (le corps affichait déjà les bons
  postes avec la même session) ; la vraie cause est un cache de
  routeur. Croire à tort au JWT aurait mené à le rafraîchir à chaque
  requête — un correctif qui ne corrige rien et coûte une lecture
  base en plus par page. Portée générale (tout poste où deux
  personnes se succèdent). Corrigé par rechargement dur plutôt que
  `router.refresh()`, délibérément — pas de discipline à respecter à
  chaque futur point d'entrée. 4 occurrences trouvées et corrigées
  au total (barre de tête initiale, `register/page.tsx`,
  `CompteForm.tsx` suppression de compte, plus une recherche
  systématique demandée pour le reste).

- **Scalabilité à plusieurs CPTS : livrée (20/08).** Registre
  extrait dans `src/lib/embedTerritoire.ts`, consommé à la fois par
  `/admin/priorites` et par le module embarquable — une seule
  source, pas deux listes qui pourraient diverger. Vérifié :
  chemin et clé de trace dérivés identiques au caractère près aux
  valeurs codées en dur précédentes — l'historique de fréquentation
  Nord Basse-Terre n'est pas coupé en deux par le refactor.
  **Trouvaille rendue explicite** : le module embarquable ne dépend
  d'aucune relation client — il liste des annonces publiques sans
  priorité territoriale, une CPTS sans relation ouverte peut avoir
  son iframe quand même. Déjà vrai avant, jamais documenté ; l'est
  maintenant dans la spec et dans le commentaire du champ
  concerné. Deux mécanismes distincts confirmés : le widget
  (gratuit, découverte) et `PrioriteTerritoriale` (payant/PoC,
  priorisation). Aucune zone ni CPTS supplémentaire ouverte — une
  seule instance reste déclarée, cohérent avec la discipline de ne
  pas construire pour un besoin hypothétique : la forme change
  (scalable), pas ce que le produit sert aujourd'hui.

- **`register/page.tsx` + `/admin/apl` (colonnes 3/5) : livrés
  (20/08).** Bandeau explicatif sur `/admin/apl` **conservé** (les
  curseurs ne pilotent plus l'ordre, priorité déclarée dans
  `/admin/priorites`, valeurs visibles issues de l'import DREES du
  28/06 sans saisie humaine — "conservées, pas maintenues").
  **4ᵉ occurrence du défaut de barre de tête corrigée** :
  `CompteForm.tsx:169` (`handleDeleteAccount`), même correctif que
  les autres occurrences (rechargement dur). Prompt envoyé le 20/08,
  demande aussi une recherche systématique d'autres occurrences du
  même motif plutôt qu'un correctif isolé. Rapport pas encore reçu.

- **Pages persona filtrées par audience : livré et vérifié en
  production (`f8d75fc..320cbec`).** Discriminant réel :
  `Profile.type`, pas `missionType` — un cabinet cherchant un
  remplaçant et un remplaçant cherchant un cabinet portent tous deux
  `REMPLACEMENT` en `missionType`, filtrer par là aurait menti sur
  le sens. EMPLOYEUR = TITULAIRE (cabinet + structure), CANDIDAT =
  REMPLACANT + ASSISTANT confondus — chaque camp voit l'intégralité
  du pool d'en face, multi-préférences préservé. Mesuré : 20
  annonces → 13 employeur + 7 candidat, disjoint et exhaustif.
  Vérifié en production sur les 3 pages (0 tag croisé). **Trouvaille
  non demandée** : la porte territoire (CPTS) était aussi affectée —
  pas une liste mélangée, mais un chiffre qui contredisait sa propre
  légende ("combien de postes cherchent preneur" comptait les deux
  camps) — corrigée en EMPLOYEUR. Camp déclaré explicitement par
  chaque porte plutôt que déduit — une future porte devra trancher
  consciemment. Paramètre obligatoire sans défaut, cohérent avec le
  même choix fait pour la profession le 17/08. **Ajout non demandé,
  confirmé gardé** : `isSelfPresence: false` — exclut les
  déclarations d'absence des pages publiques, cohérent avec le feed
  qui les exclut déjà. Longueur de liste : 8.

- **Mention "kinés" en dur + `PrioritesClient.tsx` recopié : déjà
  corrigés depuis le 19/08 (`a7d4de8`), confirmé le 21/08 avec
  preuve à l'appui.** Feed : `useMemo` rend "votre profession"
  plutôt qu'un mot décliné — vrai pour toute profession future sans
  retouche, dérivé de `chargerPrioritesTerritoriales` qui ne
  remonte que les déclarations de la profession du lecteur.
  `PrioritesClient.tsx` : dérive `Object.values(Profession)` +
  `libelleProfession()`, ne recopie plus rien. **Détail de
  conception à retenir** : `libelleProfession` rend la valeur brute
  de l'enum quand aucun vocabulaire n'est déclaré, plutôt que de
  fabriquer un libellé par translittération — rend un manque de
  vocabulaire *visible* au lieu de le masquer silencieusement, même
  principe que partout ailleurs cette session appliqué à un détail
  d'UI. Aucun commit nécessaire (déjà sur `origin/main`, pas de
  commit vide).

- **3 dernières mentions "kiné" en dur corrigées (`320cbec..875639a`)
  — chantier de généricité profession ENTIÈREMENT CLOS.**
  `missions/create/page.tsx` (×3, placeholders), `premium/
  page.tsx:169`, `layout.tsx:19`. **Arbitrage notable** : "praticien"
  choisi plutôt qu'une vraie interpolation de profession dans
  `missions/create`/`premium` — ces composants client tirent leur
  session de `useSession`, qui ne porte pas `Profile.profession`
  (seulement `profileType`/`isEmployeur`/`profileId`). Câbler la
  vraie profession aurait exigé soit de l'ajouter au JWT
  (rouvrirait exactement le motif de bug fermé cette semaine avec la
  barre de tête périmée), soit une requête supplémentaire pour un
  simple placeholder — coût supérieur au bénéfice ici. **Deux bonus
  trouvés en chemin** : la page premium se contredisait déjà elle-
  même (branche établissement "soignants", branche cabinet
  "kinésithérapeutes") — corrigée en nommant le camp visé plutôt
  qu'un métier, plus précis que l'original, pas seulement plus
  générique. La méta-description globale reste délibérément
  kiné-spécifique dans son contenu (honnête, le produit ne sert
  qu'une profession aujourd'hui) mais sa source est désormais
  interpolée depuis le registre plutôt qu'écrite en dur — suit
  automatiquement le jour où une 2ᵉ profession s'ouvre. **État du
  chantier généricité, dans son ensemble** : fermé sur tout ce qui a
  été audité — `CommuneAPL`, script DREES, `PrioriteTerritoriale`,
  bonus territorial, ponts géographiques, module embarquable,
  mention du feed, `PrioritesClient.tsx`, ces 3 derniers écrans.
  Rien de tout ça n'ouvre une profession — c'est la forme du code
  qui a changé, prête pour le jour où une 2ᵉ profession sera
  réellement servie.

## 🔴 Prêts, en file, pas encore envoyées

🎯. **Changement de type de profil self-service (titulaire ↔
   chercheur)** — prompt prêt le 26/08. Cadré pour ne pas contredire
   la vision de fusion REMPLACANT/ASSISTANT actée le même jour
   (STRATEGIE §principe fondateur) — présente Titulaire↔Chercheur
   comme la distinction principale, pas trois catégories égales et
   définitives. Pas encore envoyé.
⚠️. **Email "annonce consultée" — déclencheur à vérifier
   (consultation passive ou intérêt exprimé ?)** — prompt prêt le
   26/08, pas encore envoyé (Jean-Charles sans accès à Claude Code
   au moment de la demande). Capture d'écran : email envoyé au
   cabinet sur "un remplaçant vient de consulter votre annonce" —
   à vérifier si le déclencheur est `CARD_CONSULTED` (simple vue) ou
   un swipe "Intéressé" (geste actif). Principe clarifié en
   discussion : le principe "pas de profils navigables" protège les
   candidats non publiés d'être vus par les cabinets — il ne
   s'applique pas dans l'autre sens (un candidat consultant une
   annonce publiée par un cabinet est normal et prévu). La vraie
   question reste le seuil de notification : consultation simple
   vs intérêt actif.
⚠️. **Annuler un "pass" sur une annonce, symétrique au retrait
   d'intérêt** — prompt envoyé le 26/08. Capture d'écran confirmant
   l'absence de ce bouton côté "passé" (seul "Fermer" proposé),
   alors qu'il existe côté "intéressé" ("Retirer ce choix"). Rapport
   pas encore reçu.
⚠️. **Image de partage : flou trop fort + ambiguïté employeur/
   candidat sur une annonce individuelle** — prompt envoyé le 26/08.
   Capture d'écran Facebook confirmant les deux problèmes. Même
   principe de distinction déjà établi pour les pages persona
   (STRATEGIE_MARKETING_BUSINESS.md §2), appliqué ici à l'image de
   partage d'une annonce seule. Rapport pas encore reçu.
🚨. **Contrats : le vrai danger de la Phase 2, confirmé et prioritaire
   maintenant qu'infirmier est acté.** Investigation complète (3
   points) rapportée le 21/08. **Point 3, le plus grave** :
   `src/lib/professions.ts` (`PROFESSION_LABELS_CONTRAT`) est déjà
   multi-profession dans le LIBELLÉ (`Record<Profession, string>`,
   exhaustivité imposée par TypeScript, corrige un vieux défaut qui
   mappait des professions absentes de l'enum) — mais PAS dans le
   CONTENU JURIDIQUE. Un contrat pour un infirmier afficherait
   correctement "Profession : Infirmier diplômé d'État"... puis
   enchaînerait sur des articles de loi et une référence à l'Ordre
   qui sont ceux des KINÉS (R.4321-99, R.4321-130, CNOMK). Dans les
   mots d'Opus : *"ce n'est pas une erreur visible, c'est un document
   plausible portant le mauvais droit — plus dangereux qu'un
   plantage."* Point d'insertion identifié : sélectionner sur la
   paire (profession, missionType) plutôt que missionType seul ; le
   moteur de génération (types.ts, party-identity.tsx, watermark.tsx,
   187 lignes) n'a pas besoin de bouger. **Vrai prérequis avant
   d'activer infirmier**, pas une hypothèse Phase 2 abstraite —
   rejoint directement le sourcing des modèles de l'Ordre National
   des Infirmiers déjà identifié comme le point le plus lourd.
   **Point 2 (Ordre)** : confirmé générique jusque dans l'interface
   (libellés neutres N° RPPS/N° Ordre/SIRET, aucune contrainte de
   format supposant le kiné) — mais Opus note honnêtement une nuance
   : cette généricité n'a jamais été testée au-delà de la présence,
   il n'y a rien à casser parce qu'il n'y a rien dedans (validation
   `z.string().max(30)`, pas de vraie logique testée).
   **Chasse au motif "donnée calculée puis jetée"** : verdict final
   2 occurrences confirmées (RPPS/ANS, invitation expirée), PAS une
   habitude du codebase — `sendEmail` d'abord soupçonné comme 3ᵉ
   occurrence, vérifié et écarté (échec journalisé, documenté,
   fire-and-forget délibéré). Bonne discipline de s'être corrigé
   plutôt que de forcer un pattern à exister.
   **Famille différente trouvée à la place, celle-là réelle** :
   "réglable et jamais réglé" — 4 leviers qui existent, s'affichent,
   ne conditionnent rien : `Profile.weight` (lu dans 6 `orderBy`,
   jamais modifié en pratique), `CommuneAPL.boost*` (déjà réglé par
   B0-B3), `maxCandidates`/`singleSlot` (au schéma depuis le 10/07,
   lus par aucune logique), et **`isVerified`** (affiché en badge,
   cochable en admin, ne conditionne rien — un badge "vérifié" sans
   effet réel est un problème de confiance, pas juste du code mort).
   Réserve mineure notée en chemin : `NEXT_PUBLIC_SENTRY_DSN` non
   configurée, les échecs `sendEmail` partent dans les logs Vercel
   plutôt qu'en alerte — pas le motif recherché, juste une variable
   d'environnement manquante.
   **Suite du 26/08 — ASSISTANAT n'existe pas chez les infirmiers,
   confirmé structurellement.** 9 rubriques de l'Ordre National des
   Infirmiers vérifiées exhaustivement, aucune sous ce nom. Raison
   trouvée : l'assistanat kiné n'est pas une catégorie juridique
   nationale — c'est une pratique que le CNOMK a normalisée pour sa
   profession en publiant un contrat-type, EN L'ABSENCE de toute loi
   (contrairement au collaborateur libéral, statut légal réel, loi
   de 2005, toutes professions confondues). Distinction déjà portée
   par `template-collaboration.tsx:99` (patientèle propre ou non).
   **Conséquence produit directe** : ASSISTANAT ne doit pas être
   proposé aux infirmiers à l'activation — pas un modèle à chercher
   ailleurs, un type de mission qui n'existe pas pour cette
   profession. Le formulaire de publication doit refléter ça, pas
   juste échouer à la génération de contrat.
   **La clé (profession, missionType) posée le 26/08 est
   insuffisante, confirmé avec précision.** Le remplacement infirmier
   a DEUX variantes selon que le remplaçant a ou non sa propre
   autorisation d'exercice — nécessite une 3ᵉ dimension ou deux
   entrées distinctes, pas juste un couple. ASSISTANAT absent côté
   infirmier, confirmé une 2ᵉ fois par le texte réel du contrat de
   collaboration infirmier (article 2, "Développement de la
   patientèle propre au collaborateur" — le pivot exact qui
   distingue collaborateur d'assistant).
   **Comparaison structurelle kiné/infirmier (point 2, reçu le
   26/08)** : même socle (objet, durée, lieu, honoraires/rétrocession,
   obligations fiscales/sociales, incessibilité, résiliation,
   non-concurrence, résolution des différends, transmission à
   l'Ordre) — "les deux professions écrivent le même contrat".
   Remplacement : 13 articles kiné vs 19 infirmier. Collaboration :
   23 vs 24. Ce que l'infirmier a en plus : forfaits de prise en
   charge (nomenclature infirmière BSI/dépendance, aucun équivalent
   Soignect aujourd'hui), maternité/paternité, maladie, présentation
   préférentielle. Ce que le kiné a en plus : priorité de succession,
   conditions de rachat de patientèle. **Découverte non anticipée** :
   les clauses marquées négociables côté infirmier (durée, honoraires,
   redevance, résiliation, différends, transmission) ne recouvrent
   PAS les mêmes points que `NegotiableClauses` côté Soignect
   (modePaiement, delaiPaiementJours, modalitesLocaux) — le mécanisme
   de personnalisation lui-même doit être repensé par profession, pas
   seulement le contenu textuel des gabarits.
   **Chiffrage réel (point 3, reçu le 26/08)** : le moteur ne bouge
   pas (types.ts/party-identity.tsx/watermark.tsx, 187 lignes déjà
   génériques). Coût réel : ~800-900 lignes de transcription
   juridique pour 3 gabarits (remplacement ×2, collaboration) — "ce
   qui prend le temps, et ça ne se délègue pas à la légère". Table
   de sélection partielle et variantée à construire. Champs de
   données manquants à ajouter (forfaits, maternité/paternité,
   maladie) — pas du texte, de vrais champs. ASSISTANAT à retirer du
   formulaire pour un infirmier. **Verdict d'Opus** : "le gros du
   travail est la transcription juridique, incompressible — mais
   l'architecture tient, c'est bien ce que l'audit du 26/08 laissait
   espérer."
   **Lot déposé différent de ce qui était demandé** : le salariat
   CDD/CDI manquait (justement ce qu'on voulait), mais 2 documents
   non demandés sont arrivés en bonus — "Cession de fonds libéral"
   et "Exercice en commun avec partage des frais" — le premier
   rejoint directement l'item 2 ci-dessous (transfert de
   conventionnement/cession), déjà repéré par Jean-Charles comme
   source potentiellement réutilisable kiné+infirmier.
   **Salariat CDD/CDI confirmés et vérifiés (26/08)** — 25p/24
   articles (CDI), 22p/21 articles (CDD), couche texte propre,
   émetteur CNOI confirmé, aucune confusion avec des documents kiné.
   **Découverte majeure : le salariat n'est PAS une variante des 3
   gabarits existants, c'est une autre nature de contrat** — droit du
   travail (période d'essai, temps de travail, congés payés,
   protection sociale, indemnité de précarité, rupture), pas droit de
   la santé publique. Aucune notion de rétrocession/redevance (piliers
   des 3 gabarits actuels). **Ce trou touche aussi le kiné
   aujourd'hui** — Soignect gère le salarié via
   `TitulaireKind.STRUCTURE` sans aucun gabarit, quelle que soit la
   profession. Pas une complication infirmier-spécifique, un vrai
   manque pré-existant révélé par cette investigation.
   **Réserve d'usage** : les PDF sont les versions COMMENTÉES du CNOI
   ("vous ne devez pas l'utiliser comme contrat à signer") — bons
   pour comprendre chaque clause, mais le texte contractuel et le
   commentaire doivent être distingués soigneusement au moment de la
   transcription.
   **Décision finale du 26/08** : les 9 PDF (102 Mo au total) restent
   HORS du dépôt Git — trop lourd pour l'historique, disponibles sur
   le disque local uniquement.
   **Phase A — arrêtée avant transcription, bon réflexe d'Opus
   (26/08).** Vérification de faisabilité d'abord : le commentaire
   CNOI est séparable du texte contractuel (marqueur littéral
   "Commentaire :", 19/10/9 blocs selon le document) — réserve levée.
   Alternatives rédactionnelles quantifiées (clauses facultatives,
   "OU" isolés, choix entre crochets) — transcriptibles, mais chaque
   branche est un choix juridique, pas une décision d'implémentation.
   **Vrai blocage trouvé** : la variante de remplacement (confrère
   installé / titulaire d'une autorisation) n'est déterminable par
   AUCUNE donnée existante dans Soignect — l'étendre aurait créé un
   4ᵉ levier "réglable et jamais réglé" (même famille que weight/
   boost*/maxCandidates/isVerified, identifiée quelques heures plus
   tôt). Opus s'est arrêté avant d'écrire ~900 lignes sur une
   hypothèse fausse. **Décisions du 26/08** : (b) la variante se
   choisit au moment de générer le contrat, pas un champ déclaratif
   à l'inscription — évite le levier dormant. Jean-Charles tranchera
   chaque choix juridique clause par clause, PAS Opus seul — aucun
   choix documenté dans le code sans accord explicite préalable.
   **Point 4 (retrait ASSISTANAT) partage le même prérequis que le
   fix du 25/08** : `missions/create` est un composant client, session
   ne porte pas `Profile.profession`. **Résolu (26/08)** : chargement
   serveur en prop retenu (pas de route dédiée) — un `page.tsx`
   serveur qui charge `Profile.profession` et rend le client actuel
   renommé. Raison : une route dédiée créerait un scintillement (l'
   utilisateur verrait ASSISTANAT apparaître puis disparaître), et
   une route de plus est une surface d'authentification en plus pour
   une donnée déjà chargée côté serveur ailleurs.
   **Forme de la clé retenue** : liste déclarative
   (`interface Gabarit[]`, pas une table imbriquée) — naturellement
   partielle, porte le libellé de chaque variante, s'énumère pour
   alimenter le formulaire.
   **8 choix juridiques listés par Opus (26/08), décompte corrigé
   deux fois, tranchés progressivement** :
   - **Correction majeure du 26/08** : le décompte initial était
     sous-estimé partout — détecteur ne voyait que les "OU" isolés
     sur une ligne, ratait ceux en milieu de phrase et les
     "Option :". Balayage exhaustif refait. Réel : 3 choix sur
     l'autorisation (pas 0, pas 1), 5 sur confrère installé (pas 3),
     9 sur collaboration (pas 5). **Bonne discipline confirmée une
     3ᵉ fois** : Opus annonce le décompte corrigé avant de
     transcrire, pas après — aucune ligne écrite sur un mauvais
     compte.
   - **R-1 tranché : A** — "Du ... au ... et selon un planning
     annexé", colle à `startDate`/`endDate`. S'applique aux deux
     variantes de remplacement.
   - **A-1 tranché : A** — carte CPS du Remplaçant (mode de
     facturation, variante autorisation). Question ouverte transmise
     à Opus : s'applique-t-elle aussi à R-3b (même distinction,
     variante confrère installé) ?
   - **A-2 tranché : A** — rayon en km (non-concurrence), colle à
     `rayonKm` déjà dans `ContractDataRemplacement`, déjà utilisé par
     le gabarit kiné pour la clause R.4321-130.
   - **Premier gabarit LIVRÉ (`e6926b6`)** — `template-infirmier-
     remplacement-autorisation.tsx`, 428 lignes, 13 articles,
     transcrit du modèle CNOI du 15/11/2023. Build vert, gabarits
     kiné vérifiés inchangés (diff vide sur les 3). **Trouvaille
     majeure de la transcription** : le sens de la rétrocession
     s'inverse entre kiné et infirmier — chez le CNOMK le remplaçant
     encaisse et reverse au remplacé, ici (remplaçant non installé)
     c'est l'inverse, le remplacé perçoit et reverse. Réutiliser
     `retrocessionPct` aurait inversé un pourcentage sur un document
     signé, sans qu'aucun test ne l'attrape. Type dédié créé
     (`reversementDirectPct`, `reversementTiersPayantPct`) nommé dans
     le sens réel. Validation directe de toute la rigueur du
     processus de transcription clause par clause.
     `LIBELLE_NUMERO_ORDRE` ajouté au registre ("N° Ordre" CNOMK /
     "n° ordinal" CNOI), valeur kiné inchangée — aucun PDF déjà
     généré ne bouge d'un caractère. Les 9 PDF sources exclus par
     `.gitignore` nommé (pas `*.pdf` générique) — `git add .` aurait
     sinon fait entrer 102 Mo dans l'historique malgré la décision
     de les garder hors dépôt.
     **Gabarit encore INERTE, assumé explicitement** : rien ne
     l'appelle — liste `Gabarit[]`, sélection de variante et retrait
     d'ASSISTANAT restent à construire. Documenté dans la spec et le
     commit comme état intermédiaire, pour ne pas devenir un levier
     dormant si la phase s'arrêtait là.
     **Leçon de méthode consignée** : "une méthode de comptage ne
     vaut rien tant qu'elle n'a pas été confrontée au texte
     intégral" — après deux corrections successives (0→3, 3→5,
     5→9), signalées à chaque fois avant transcription plutôt
     qu'après.
     rattachement — saisis à la génération, cohérent avec (b).
   - Écart de vocabulaire trouvé ("n° ordinal" infirmier vs "N°
     d'inscription à l'Ordre" kiné) — à porter par le registre
     (même motif que `PROFESSION_LABELS_CONTRAT`), pas en dur.
   - Clauses marquées `*` confirmées légalement obligatoires
     (article R.4312-73 CSP, non dérogeables) — pendant infirmier des
     "clauses réglementaires" déjà marquées côté kiné.
   - **R-3 se décompose en deux** : R-3a (inclure ou non l'option
     redevance — recoupe `retrocessionPct` déjà au modèle), R-3b
     (même distinction CPS/feuilles pré-identifiées que A-1, mais
     pour la variante confrère installé).
   - **C-4 (forfaits de prise en charge)** : champ sélectionnable
     (liste déroulante) choisi à la génération, pas figé dans le
     gabarit.
   - **C-5 (durée/résiliation)** : durée déterminée retenue (colle à
     `dureeAns`), choix par défaut motivé faute de préférence
     marquée.
   - **Nouveaux, trouvés lors du balayage exhaustif** : C-6 (Article
     7, redevance en % du CA ou en euros fixes — `redevancePct`
     existe déjà, le % s'y branche) ; C-7 (Article 16, résiliation —
     deux préavis à trancher : faute grave, puis déconventionnement/
     sanction ; seule la branche A s'applique puisque C-5 a tranché
     la durée déterminée).
   **Tous les arbitrages tranchés (26/08)** : R-2 (clause "propre
   cabinet" incluse), R-3 (facturation avec identifiants propres +
   option redevance — **⚠️ EN SUSPENS, voir ci-dessous**), C-1
   (clause facultative patients personnels incluse), C-2 (temps
   consacré : selon planning établi en accord), C-3 (individualisation
   avec texte libre, périodicité trimestrielle), C-6 (redevance en %
   du CA), C-7 (sans préavis, faute grave ET déconventionnement/
   sanction).
   **Les 3 gabarits livrés (`fe17d2f`)** : remplacement autorisation
   (13 articles), remplacement confrère installé (13 articles),
   collaboration (21 articles + préambule). Build vert, gabarits kiné
   vérifiés inchangés à chaque étape (diff vide, 3 fois). Registre
   `gabarits.ts` construit — liste déclarative, pas table imbriquée.
   `INFIRMIER: [REMPLACEMENT ×2 variantes, COLLABORATION]` — ASSISTANAT
   confirmé absent (0), comme attendu. Profession portée côté client
   via enveloppe serveur (pas JWT, pas route dédiée) — cohérent avec
   la décision du 26/08. Correspondance besoin→MissionType remontée
   en constante partagée front/back — évite qu'une option masquée en
   front reste acceptée côté serveur.
   **Bon réflexe non demandé** : MEDECIN/SAGE_FEMME/ORTHOPHONISTE
   (sans aucun gabarit) auraient eu un formulaire vide et silencieux
   — corrigé en message explicite ("publication suspendue faute de
   modèle"). Aucun compte concerné aujourd'hui, situation honnête si
   jamais un jour.
   **R-3 revérifié, CONFIRMÉ, et les 3 ajouts livrés (26/08,
   `be65234`).** Opus est retourné au commentaire du CNOI sur
   l'article 5 (écarté pour la transcription, gardé pour comprendre)
   — confirme que l'encaissement au nom du remplacé n'est PAS
   obligatoire ("a la possibilité", "il revient aux cocontractants de
   choisir"), mais que l'option de facturer sous ses propres
   identifiants n'existe que si le remplaçant est lui-même installé
   et conventionné — exactement pourquoi la variante "autorisation"
   n'a même pas ce choix. Le doute de Jean-Charles a fait remonter 3
   ajouts réels, tous transcrits et vérifiés : (1) CPAM informée de
   l'option de facturation (art. 4.2, obligation légale) ; (2)
   assiette de la redevance précisée, frais kilométriques exclus
   (art. 5, sous la clause) — repères de l'Ordre consignés en
   commentaire sans être imposés (partage d'honoraires prohibé par
   R.4312-30 au-delà d'un certain seuil, usage constaté 5-10%,
   montant reste saisi librement) ; (3) clause de répétition d'indus,
   mot pour mot du CNOI, après l'art. 5. Build vert, gabarits kiné
   intacts (diff vide). **Correction trouvée en clôturant** : en-tête
   annonçait "cinq alternatives", n'en détaillait que trois — corrigé,
   le sous-choix feuilles/CPS était sans objet (n'existait que dans
   la branche déjà écartée).
   **Leçon méthodologique retenue** : *"le commentaire n'est pas du
   contrat, mais il dit ce que le contrat suppose"* — écarter le
   commentaire du texte transcrit était juste, l'écarter comme source
   de compréhension aurait été une erreur. À retenir pour toute
   future transcription juridique.
   **LES 3 GABARITS INFIRMIER SONT DÉFINITIFS CÔTÉ CONTENU.**
   **PHASE A COMPLÈTE (`d4ae686`, 27/08).** Route de sélection
   remplacée par une résolution via le registre plutôt qu'un
   `if/else` sur `missionType` — un seul ligne supprimée (l'ancien
   `if`), les 3 appels kiné intacts, jamais retouchés (diff vide à
   chaque étape). **Trois garde-fous, tous en refus explicite (422)**
   :
   - Les deux parties n'exercent pas la même profession → 422.
     **Pas théorique** : `Profile.profession` reste modifiable dans
     `/compte` APRÈS un match — sans ce garde-fou, un contrat kiné
     pouvait se générer entre un kiné et un infirmier après un
     changement de profession en cours de route. Faux, et signé.
   - Aucun gabarit pour la paire (profession × type) → 422.
   - Plusieurs variantes, aucune choisie → 422 + la liste des choix.
     **Pas théorique non plus** : les deux variantes de remplacement
     infirmier sont économiquement opposées (sens de l'argent
     inversé) — prendre la première par défaut aurait inversé le
     sens sur un document réel. Le système refuse plutôt que de
     deviner, cohérent avec la leçon de R-3.
   Le choix remonte à l'écran : `contrat-info` renvoie les modèles
   applicables, le formulaire affiche un sélecteur seulement s'il y a
   un vrai choix (avec "quand l'utiliser" + source réglementaire),
   rien si un seul modèle s'applique, un message si aucun — jamais un
   bouton qui échouerait après coup. Sélecteur de partage des
   forfaits câblé pour la collaboration infirmier.
   **Deux réserves honnêtes, à traiter plus tard** :
   1. Rendu PDF final jamais vérifié visuellement — seulement
      compilation et typage confirmés. Outillage de test ne rend pas
      le TSX hors de l'application ; tenté, échoué, pas forcé.
   2. Champs propres aux variantes (n° autorisation/date/CPAM, etc.)
      pas encore saisissables dans le formulaire — impriment
      `[à compléter]` (comportement normal, jamais un blanc
      silencieux). À faire quand un premier contrat infirmier sera
      réellement préparé.
   **Phase B (salariat) — investigation infirmier complète (27/08),
   4ᵉ échec de comptage honnêtement disclosé, kiné maintenant inclus.**
   Séparation commentaire/contrat réussie après correction (marqueur
   réel "Commentaires :" pluriel + "Commentaires (suite) :", pas le
   singulier de la phase A) — CDI 22% contractuel, CDD 30%, le
   commentaire pèse 3-4× le contrat, rapport très différent de la
   phase A. **4ᵉ échec de comptage** : balayage exhaustif sur 6 formes
   simultanées a quand même manqué le choix le plus structurant du
   CDD (un "ou" en minuscules) — changement de méthode après coup,
   marqueurs structurels plutôt que mots-clés. 6 décisions par contrat
   trouvées et vérifiées individuellement (CDI : employeur personne/
   société, période d'essai facultative, véhicule personnel/employeur
   + usage, non-concurrence installation/exercice, zone rayon/
   communes ; CDD : les mêmes + durée avec/sans terme précis, sans
   équivalent CDI). **Trouvaille sémantique importante** : `rayonKm`
   réapparaît à l'article 11 mais change de nature — clause
   réglementaire de non-installation (R.4312-87) côté libéral, clause
   de non-concurrence de droit du travail négociée/indemnisable ici.
   Même nom, autre sens — ne pas fusionner malgré la ressemblance.
   Structure proposée : `ContractDataSalarie` unique avec discriminant
   sur `duree` (CDI/CDD_TERME/CDD_SANS_TERME) plutôt que deux types
   — même leçon que les variantes de remplacement, un `dureeAns` plat
   ne peut pas représenter un CDD sans terme précis.
   **Réponse à la question ouverte** : le CNOMK publie bien des
   modèles salariés (CDD de remplacement, CDI/CDD activité physique
   adaptée) — le manque touche aussi le kiné, confirmé.
   **Correction majeure au rapport (27/08)** : la recherche web
   initiale avait mal identifié les documents — "CDI/CDD activité
   physique adaptée" concerne un intervenant APA, PAS un kiné, autre
   profession hors périmètre Soignect. `CONTRAT-TYPE-EXERCICE-EN-
   EHPAD` n'est pas un contrat de travail. **Le seul vrai contrat
   salarié kiné est un CDD de remplacement, sans équivalent CDI.**
   Bon réflexe d'arrêt d'Opus : plutôt que de comparer deux objets
   potentiellement de nature différente (le kiné salarie pour
   remplacer temporairement, l'infirmier salarie pour employer), a
   posé la question plutôt que de continuer une heure sur une
   hypothèse fragile — même discipline que pour l'assistanat.
   **Décision revenue (27/08) : Jean-Charles veut finalement UN SEUL
   objet partagé**, après avoir d'abord tranché pour deux gabarits
   distincts. **Accès direct confirmé** : Opus a récupéré les PDF
   CNOMK lui-même (contrats.ordremk.fr, public, 1,7 Mo au total —
   sans commune mesure avec les 102 Mo du CNOI), pas besoin que
   Jean-Charles les dépose.
   **Vérification de compatibilité reçue (27/08) — instinct de
   Jean-Charles confirmé empiriquement, pas juste supposé.** Champs
   partagés confirmés : durée hebdomadaire, non-concurrence
   (durée+zone), indemnité de précarité, congés/absence/préavis/
   rupture — "c'est bien le même contrat de travail, pas deux objets
   étrangers". **4 divergences réelles trouvées** : répartition
   horaire jour par jour (kiné 12 champs / infirmier absent), heures
   complémentaires + plafond (kiné seul), indemnité spéciale de
   non-concurrence (kiné seul), véhicule personnel/employeur
   (infirmier seul). Écarts de texte fixe (secret professionnel, DPC,
   assurance côté infirmier ; absence de contre-lettre côté kiné) ne
   pèsent pas sur la structure de données.
   **🚨 Découverte légale sérieuse** : la répartition horaire n'est
   pas un détail — pour un CDD kiné à temps partiel, le Code du
   travail l'EXIGE, sous peine de requalification en temps complet.
   Un champ optionnel sur un type partagé pourrait laisser générer un
   contrat temps partiel sans elle — document légalement incomplet,
   en silence. Même motif que `rayonKm` (même conteneur, obligation
   différente). **Réponse retenue** : fusionner, mais rendre cette
   contrainte STRUCTURELLE, pas optionnelle — un contrat temps
   partiel ne doit pas pouvoir se générer sans elle.
   **Discriminant à deux axes, bien étayé par le texte source** (pas
   deviné) : `nature` (CDI/CDD_TERME/CDD_SANS_TERME) × `temps`
   (COMPLET/PARTIEL, PARTIEL impose la répartition horaire). Kiné a
   les deux formes de CDD (confirmé par les libellés du modèle
   source) mais pas de CDI ; kiné a aussi 2 articles 5 distincts
   selon temps complet/partiel, absent côté infirmier.
   **Réserve non vérifiée** : l'axe temps côté infirmier (complet/
   partiel) pas encore cherché dans les modèles CNOI.
   **CDI kiné : décision différente de l'assistanat infirmier,
   nature du problème différente.** Contrairement à l'assistanat
   (catégorie juridique inexistante), un CDI kiné est parfaitement
   légal — l'Ordre n'a simplement publié aucun modèle-type pour ce
   cas. **Décision de Jean-Charles (27/08) : le construire quand
   même.**
   **Vérification exhaustive reçue (28/08)** : absence confirmée sur
   23 documents de contrats.ordremk.fr, ses pages de catégorie, et
   recherches internes des deux domaines — pas une recherche unique.
   Les seuls fichiers "CDI" de l'Ordre concernent l'activité physique
   adaptée (employé non-kiné).
   **Les 5 clauses essentielles lues clause par clause (pas par
   numéro d'article) se scindent en 2 groupes** : trois générales,
   transposables au CDI (inscription au tableau, absence de
   contre-lettre, communication à l'Ordre — L.4113-9) ; deux
   spécifiques au remplacement, déclenchées par l'acte même de
   remplacer (R.4321-107 al.3 cessation d'activité du remplacé,
   R.4321-130 non-installation) — sans objet pour un CDI.
   **🚨 Conséquence légale subtile trouvée** : la clause de
   non-concurrence du CDD kiné repose entièrement sur R.4321-130, qui
   disparaît en CDI. Un CDI ne peut porter qu'une clause de
   non-concurrence de droit du travail — laquelle EXIGE une
   contrepartie financière sous peine de nullité. L'indemnité
   spéciale déjà présente dans le CDD (ajout optionnel là-bas)
   devient donc, en CDI, une **condition de validité**, pas un bonus
   — la même clause change de statut juridique selon le contexte.
   **Décisions du 28/08** : (1) périmètre aligné sur la richesse du
   CDI infirmier (secret professionnel, DPC, assurance, résolution
   des différends, protection sociale détaillée — texte fixe
   déontologique déjà vérifié côté infirmier, transposable) ; (2)
   avertissement légal renforcé dans le **PDF signé lui-même**, pas
   seulement en commentaire de code — proposition d'Opus, retenue :
   "c'est le document signé qui compte, pas le fichier source".
   En-tête déjà rédigé par Opus, validé, à utiliser tel quel :
   documente explicitement que ce gabarit est COMPOSÉ (clauses
   déontologiques générales du CDD + droit du travail standard) et
   non transcrit d'un modèle officiel, ce qui n'a pas été repris et
   pourquoi, et recommande une validation par avocat avant tout usage
   réel. Prompt envoyé pour composer, rapport pas encore reçu.
   **Réserve technique levée** : le violet CNOMK est bien récupérable
   dans le flux PDF (rgb(0.439, 0.188, 0.627), 11 occurrences,
   confirmé par le document lui-même comme marqueur de clause
   essentielle). Première extraction sur-collectait (pas de reset sur
   gris/CMJN) — corrigée après vérification, pas rapportée telle
   quelle. Le modèle kiné, contrairement au CNOI, n'a AUCUN bloc de
   commentaire (explications dans un fichier séparé) — déjà pur, rien
   à séparer.
⚠️. **Traçabilité des comptes de test — portée élargie (27/08),
   pas seulement les matchs.** 31 comptes utilisateurs au total, 5
   de test (Jean-Charles) — confirmé le 27/08, périmètre plus large
   que les 3 matchs initialement repérés (2 test/1 réel). **Correction
   d'approche** : marquer le COMPTE comme test plutôt que chaque
   match individuellement — couvre automatiquement toutes ses
   annonces, matchs, swipes en un seul geste, plutôt que de traiter
   chaque objet séparément. Prompt du 21/08 à réviser dans ce sens
   avant envoi. Ajoute aussi un accès aux annonces passées depuis
   `/admin/annonces`. Pas encore renvoyé sous cette forme corrigée.
⚠️. **Hébergement FragiliKiné — cahier des charges complet rédigé
   par Jean-Charles (26/08), remplace le brouillon du 21/08.** Bien
   plus précis : placement du CTA (fin de synthèse uniquement,
   jamais pendant le questionnaire), contrainte explicite de ne pas
   toucher à la logique clinique sans signalement, séparation stricte
   des données (aucune donnée clinique vers Soignect/tiers, cohérent
   avec "sans identification patient" déjà confirmé dans le code),
   hébergement ouvert (Cloudflare Pages si plus simple, sinon
   meilleure intégration avec l'archi actuelle — décision laissée à
   l'investigation d'Opus), discipline audit-d'abord/résumé-avant-
   code. Suggestion ajoutée : réutiliser `lib/traceLanding.ts`
   (mécanisme de trace déjà existant, sans donnée clinique) plutôt
   que d'en inventer un si un suivi de fréquentation est voulu un
   jour — optionnel. Prêt à envoyer tel quel.
⚠️. **Page "3 dernières annonces" avec Partager/Copier** — prompt
   corrigé le 21/08 : réutilise le pattern des pages de propagande
   existantes (ShareActions, opengraph-image, trace) plutôt qu'un
   écran de génération dédié. API de publication automatique vers
   les Groupes Facebook retirée par Meta depuis avril 2024, confirmé
   — semi-automatisé (partage/copie manuels) plutôt qu'automatique.
   Image de partage : logo Soignect, décidé le 21/08 pour éviter de
   mettre en avant arbitrairement le cabinet publié en dernier. Pas
   encore envoyé.
🎯. **Invitation expirée — le formulaire d'inscription ignore le
   motif que la route calcule déjà** — trouvé le 21/08 via
   l'incident Marion. Toute invitation ouverte après 7 jours produit
   le même résultat silencieux (formulaire vierge, aucune mention du
   cabinet visé, la personne s'inscrit en pensant faire une
   inscription normale). Coût faible signalé par Opus — le motif est
   déjà calculé et renvoyé, juste jeté côté client. Pas encore
   prompté.
⚠️. **`/api/cabinet-posts/[id]/link` n'accepte que ASSISTANT, pas
   REMPLACANT** — incohérence avec le flux d'invitation automatique
   qui accepte les deux depuis le 03/08 (`6545fc9`). Trouvé le 21/08
   en marge de l'incident Marion, même famille que l'incident du
   contrat du 23/07. Pas urgent, pas encore prompté.
⚠️. **Audit de cohérence du parcours match — effets de bout en
   bout** — prompt prêt le 20/08, enrichi le 21/08. Vérifie que le
   match produit réellement tout ce qu'il doit (résidus visuels,
   mise à jour Planning, verrouillage des dates, disparition des
   annonces initiales — comportement voulu à clarifier avant tout
   correctif). **Point précis ajouté** : confirmer qu'aucun cœur/
   icône résiduel ne reste affiché sur l'écran vert de confirmation
   de match. Pas urgent, audit de fond plutôt que correctif de démo.
⚠️. **CommuneAPL ne liste que l'outre-mer — choix délibéré ou
   restriction accidentelle ?** — prompt envoyé le 20/08. À vérifier
   avant tout élargissement : le script d'alimentation filtre-t-il
   sur 971/972/973/974 en dur, ou a-t-il juste été lancé avec un
   périmètre restreint sans le documenter. Touche directement la
   séquence DOM-TOM → national. Rapport pas encore reçu.
⚠️. **Suivi accessible depuis la fiche de détail candidat + vérif
   filtrage date/lieu** — prompt envoyé le 20/08. Étend le bloc-note
   de suivi (déjà construit pour le Planning) à un second point
   d'entrée, la modale de compatibilité vue depuis le swipe — sous
   réserve qu'un Match existe déjà à ce stade, à vérifier. Deuxième
   volet : confirmer que les candidats proches-mais-pas-exacts en
   date/lieu restent visibles avec un score dégradé plutôt que
   filtrés (comportement observé sur capture, à confirmer partout).
   Rapport pas encore reçu.
⚠️. **Image de partage manquante sur les 4 pages persona** — prompt
   envoyé le 20/08. Les pages géographiques + annonces individuelles
   ont déjà le mécanisme, les 4 pages persona (construites après)
   ne l'ont pas hérité. Rapport pas encore reçu.
⚠️. **Email de réinitialisation compte CPTS — adresse corrigée,
   cause de fond restée ouverte.** L'adresse en base était fautive
   (faute de frappe à l'inscription), corrigée. **Problème de fond
   signalé par Opus, pas construit sans accord** : une faute de
   frappe à l'inscription est aujourd'hui invisible et coûteuse — le
   compte se crée, l'email de bienvenue part dans le vide, et la
   réinitialisation répond 200 sans rien faire (choix de sécurité
   délibéré de ne pas révéler l'existence d'un compte — bon choix,
   mais qui rend ce cas indétectable côté utilisateur). Une
   confirmation d'adresse à l'inscription fermerait ce trou — un
   vrai chantier, pas un correctif, décision à prendre. Rejoint
   l'item "stocker l'id Resend" déjà en file — même famille de
   problème (aucune visibilité sur si un email atterrit vraiment).
⚠️⚠️. **Audit UI/UX/fonctionnalités du 19/08 + décision "anticiper
   Phase 2 dans toute factorisation"** — voir
   STRATEGIE_MARKETING_BUSINESS.md pour l'audit complet (App'Ines
   comme point de comparaison, fausses bonnes idées identifiées :
   complexité géographique possiblement en avance sur l'usage réel,
   scoring difficile à expliquer en une phrase, multi-préférences
   déjà vrai en base mais pas encore dans l'onboarding). Prompt
   d'audit de généricité profession envoyé le 19/08 sur tout ce qui
   a été construit depuis B0 (CommuneAPL, PrioriteTerritoriale,
   scoring géo, COMMUNE_INSEE/COMMUNE_ZONE) — rapport pas encore
   reçu. Ne construit aucune 2ᵉ profession, audite seulement si le
   code déjà écrit le permettrait à coût faible le moment venu.
   **Correction structurelle du 20/08, plus profonde que l'audit
   initial** : "Médecin" comme catégorie unique de l'enum
   `Profession` est faux — doit se décomposer en spécialités
   (généraliste, gynécologue, pédiatre, etc.), cohérent avec REZONE
   qui distingue déjà les médecins par spécialité. Révèle une
   fragilité plus large : `CommuneAPL` a des colonnes fixes par
   profession (`aplKine`/`aplInfirmier`/`aplMedecin`/`aplSageFemme`)
   — un modèle qui casse si une "profession" doit se décomposer en
   plusieurs. Forme correcte, structurellement : table normalisée
   (commune × profession → valeur) plutôt que colonnes fixes. Pas de
   migration maintenant — zéro médecin réel dans le produit
   aujourd'hui, pas de risque actif contrairement au gating client.
   Chiffrage demandé (voir prompt ci-dessous) pour informer la
   décision le jour où la Phase 2 s'approche des médecins.
⚠️. **Data ameli (macro, générique) + accessibilité réelle de la
   famille REZONE** — prompt envoyé le 19/08, enrichi le même jour.
   Deux sources pour "sur-doté/sous-doté/normal" par territoire :
   Data ameli (Opendatasoft comme la DREES, département/région,
   profession-générique) et REZONE (quartiles à la commune, la
   granularité recherchée). **Correction importante** : REZONE n'est
   PAS kiné-only — `rezonekine.ameli.fr` ET `rezonemed.ameli.fr`
   confirmés, avec un plan de déploiement officiel Assurance Maladie
   suivant la séquence médecins → kinés → infirmiers → sages-femmes
   → orthophonistes, soit la même séquence de professions que la
   Phase 2 visée. Un **"REZONE CPTS"** existe aussi, dédié au
   diagnostic territorial pour les porteurs de projets CPTS —
   directement pertinent pour le pitch CPTS Nord Basse-Terre, à
   explorer comme référence ou point de comparaison. Confirmation
   utile pour `CommuneAPL` : le zonage est bien spécifique par
   profession pour une même commune (une commune peut être classée
   différemment pour médecin/infirmier/kiné) — valide le choix de
   colonnes séparées fait dès le départ, pas de l'anticipation
   gratuite. Reste à vérifier : accessibilité programmatique réelle
   (URL pattern trouvé `rezone.ameli.fr/rezone/cartoMed.html?cc=
   <code_insee>`, à creuser pour une vraie API sous-jacente). Rapport
   pas encore reçu.
0. **Stocker l'id Resend à l'envoi** — `data.id` retourné par
   `resend.emails.send()` est aujourd'hui jeté (`src/lib/email.ts`),
   rendant tout email introuvable a posteriori dans le dashboard
   Resend. Rencontré deux fois cette session (email de
   réinitialisation non reçu du compte CPTS, invitation à Marion
   sans confirmation de réception possible). Coût faible, bénéfice
   durable pour tout email envoyé, pas seulement les cas déjà vus.
   Webhooks Resend (delivered/bounced/complained) plus lourds,
   différés tant que le volume d'incidents réels reste inconnu.
   **Erreur d'état corrigée le 13/08** : classé par erreur sous
   "Clos" alors que rien n'était construit — repéré par Opus.
1. **Permettre au cabinet de répondre à un swipe entrant sans
   mission de son côté** — partie (b) de l'ancien "Signaler mon
   intérêt", partie (a) livrée le 13/08 (voir section clos).
   Diagnostic complet reçu le 13/08 : le schéma ne bloque plus rien
   (`missionAId`/`missionBId` déjà nullable), la contrainte
   d'unicité est réglée (voir section clos). Repli `?? REMPLACEMENT`
   du contrat fermé et vérifié (voir section clos). Ce qui reste :
   la nouvelle route "répondre à un intérêt" (~60 lignes estimées),
   qui doit créer la relation sur l'annonce du cabinet lui-même
   (missionB reste NULL, le type vient de l'annonce existante)
   plutôt que de laisser le cabinet inventer un type que le candidat
   n'a jamais formulé — pas encore prompté.
2. **Investigation transfert de conventionnement 1-pour-1 / cession
   de fonds — enrichi le 26/08, deux sources maintenant identifiées.**
   Module absent du code. Deux sources concrètes trouvées, une par
   profession : côté kiné, le document ZNP (charte d'attribution des
   places vacantes, dès le début de cette session — succession en
   zone non prioritaire, règle d'auteur spécifique si le cédant est
   assistant) ; côté infirmier, "Cession totale ou partielle d'un
   fonds libéral" (Ordre National des Infirmiers, modèles réels
   téléchargeables). **Distinction importante notée par
   Jean-Charles** : le contenu déontologique est spécifique à chaque
   profession, mais la mécanique de cession/transfert de patientèle
   est largement du droit des sociétés général — potentiellement UN
   SEUL module de cession réutilisable pour kiné et infirmier plutôt
   que deux implémentations séparées. **SELARL/SASU (constitution de
   société) identifié comme un besoin distinct**, pas une simple
   variante de mission — structuration juridique, pas un contrat
   remplacement/collaboration/salariat. Nécessite un vrai scoping
   avant tout prompt (quelle forme, quel périmètre, un seul module
   ou deux) — pas encore prompté, priorité modérée (aucun consommateur
   actif, ni kiné ni infirmier n'a ce besoin ouvert aujourd'hui).
3. **Investigation "chercheur d'opportunités" multi-préférences
   (v1.1) — largement répondue le 13/08, pas un chantier à
   construire.** Le multi-préférences existe déjà en production, non
   planifié : `Profile` ne porte aucun type, seul `missionType` par
   disponibilité publiée en porte un — un candidat peut déjà en
   publier plusieurs de types différents (cas réel confirmé : Julien
   MORISOT, profil REMPLACANT, 6 disponibilités couvrant les 3
   types). Feed et scoring fonctionnent déjà par mission, pas par
   personne — poids corrects appliqués automatiquement par paire de
   missions. Ce qui reste, purement cosmétique et non urgent : cases
   à cocher à l'inscription plutôt qu'un choix unique (`ProfileType`
   garde son utilité pour les libellés et la direction du feed, ne
   pas le supprimer). Décision de fond sur les profils navigables
   (voir ci-dessus) inchangée — non liée à ce constat.
4. **Espace "Mes contrats" dans Mon compte** — persistance et
   récupération des contrats édités, dépend d'une investigation
   préalable (contrats persistés ou générés à la volée ?)
5. **Bouton "Reprendre un texte précédent"** — 5ᵉ bouton du
    formulaire d'édition d'annonce, reprend le texte libre d'une
    annonce précédente du même cabinet (texte seul, pas les champs
    structurés — évite de reporter des données obsolètes sans que
    l'utilisateur s'en rende compte)
6. **Lien direct depuis le message anti-doublon vers l'annonce en
    conflit** — le message actuel décrit l'annonce qui bloque une
    publication mais n'offre aucun moyen de l'atteindre, surtout si
    ses dates sont hors de la période affichée sur le Planning.
    Réutiliser `?editId=`
7. **Annonces limitées sur les pages de propagande, classées
    désirabilité + proximité géo du visiteur** — investigation
    d'abord (les pages affichent-elles déjà des annonces en direct
    aujourd'hui ? désirabilité déjà consommée par une logique
    produit ? géoloc IP disponible dans la stack ?), X et formule de
    classement à proposer avant construction. Premier vrai
    consommateur de `desirabilityScore` en dehors de l'admin
8. **Splash screen avec modale de tips aléatoires** — prompt prêt
    le 26/08, tiré du mode d'emploi existant (page d'aide/FAQ déjà
    présente), affichage occasionnel plutôt que systématique. Pas
    encore envoyé.

## ⚪ Décidé, pas d'action requise

- Poids du scoring en base : non, pas de consommateur réel
- Repondération ML des scores : non, prérequis manquants (notation
  post-mission + volume). Alternative : analyse humaine périodique
  via `TraceEvent`
- Scores figés : rescoring ciblé (actifs uniquement), prompt envoyé,
  périmètre à valider avant recalcul
- Nuance rétrocession/salaire fixe côté rôle `CABINET` : resserrée
- bioTinder → accroche : pas maintenant
- Renommage page de diffusion : attend données de trafic réelles

## 📌 Répartition documentation (depuis le 12/08)

- **Sonnet** : ROADMAP.md + fichier stratégie marketing/business —
  décisions, arbitrages, raisonnement. Pas d'accès en écriture au
  dépôt ; Jean-Charles ou Opus committent.
- **Opus** : seul à écrire PRODUCT_SPEC.md — comportement vérifié,
  pas un journal de tâches. Chaque prompt se termine par une
  consigne de mise à jour avant commit.
- Pas de relecture systématique des trois fichiers par Opus (coût
  token trop élevé). Prompts auto-suffisants ; une section précise
  est citée seulement quand une tâche en dépend explicitement.
