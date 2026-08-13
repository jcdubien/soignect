# SOIGNECT — ROADMAP

> Tenu par Sonnet (décisions, arbitrages, raisonnement produit).
> PRODUCT_SPEC.md (comportement vérifié du produit) reste sous la
> plume exclusive d'Opus. Ne pas fusionner les deux fichiers.
> Dernière mise à jour : 12/08 (source : version committée
> `docs: ROADMAP resserré + fichier stratégie marketing/business`,
> enrichie du rapport Opus sur la réorganisation de PRODUCT_SPEC.md).

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
listée par erreur ci-dessus comme un élément clos — elle ne l'a
jamais été, elle reste l'item 1 de la file ci-dessous, jamais
envoyée. Erreur trouvée et signalée par Opus en absorbant
PLAN_PASSATION_SPRINTS.md/l'addendum dans PRODUCT_SPEC.md : bonne
discipline de sa part de ne pas avoir documenté une fonctionnalité
inexistante juste parce que ROADMAP l'affirmait.

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

1. **Stocker l'id Resend à l'envoi** — `data.id` retourné par
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
2. **Permettre au cabinet de répondre à un swipe entrant sans
   mission de son côté** — partie (b) de l'ancien "Signaler mon
   intérêt", partie (a) livrée le 13/08 (voir section clos). Bute
   sur `Match.missionBId` requis et sur la contrainte d'unicité
   ci-dessous. Investigation déjà envoyée le 13/08, rapport pas
   encore reçu.
3. **Contrainte `@@unique([profileAId, profileBId])` sur Match** —
   une seule relation possible entre deux personnes, tous types
   confondus. Invisible à 0 mise en relation en base aujourd'hui,
   bloquera dès qu'un cabinet et un candidat voudront deux relations
   parallèles (ex. remplacement + assistanat). Migration à trancher
   avant que le volume ne la rende coûteuse à changer, pas urgente
   maintenant.
3. **Investigation transfert de conventionnement 1-pour-1** — le
   module n'existe pas dans le code ; investigation sur un courrier
   assisté avec règle d'auteur spécifique (titulaire signataire si
   le cédant est assistant)
4. **Extension du module de factorisation aux nouvelles portes
   d'entrée** — cabinet, chercheur de poste, MSP/CPTS/territoire,
   hôpitaux/centres/CAMSP. Doit intégrer la distinction commune
   (proposeur) / zone (chercheur) / territoire (page) — voir
   investigation ci-dessous, prérequis avant d'écrire ce prompt
5. **Investigation correspondance commune ↔ zone dans le matching**
   — envoyée le 12/08, conditionne le point 4. Élargie en cours de
   route sur trois couches distinctes à ne pas confondre :
   (1) méthodologie nationale de calcul APL, spécifique au métier de
   kiné (arrêté du 20/03/2024, Légifrance JORFTEXT000049343219),
   (2) donnée APL brute nationale calculée annuellement par la
   DREES par commune et par profession — probablement le niveau
   porté par `CommuneAPL` (aplKine/aplInfirmier/aplMedecin/
   aplSageFemme, cartographie du 12/08, non lue par le produit),
   (3) zonage régional (arrêté ARS Guadeloupe du 31/12/2024, 2
   catégories seulement — intermédiaire/non prioritaire, aucune
   zone sous-dotée aujourd'hui), qui applique des seuils propres à
   la région sur la donnée brute. Seule la couche 3 est spécifique
   à un territoire ; les couches 1 et 2 sont nationales par nature.
   Si `CommuneAPL` porte bien la couche 2, elle est réutilisable
   pour toute commune de France sans travail supplémentaire, sous
   réserve d'être alimentée. Impact potentiel sur l'écran admin
   "Données APL" à évaluer une fois le diagnostic connu.
   **Complément DREES à intégrer si non pris en compte** : si le
   rapport revient sans tenir compte de la distinction des 3 couches
   ci-dessus, la renvoyer avant de considérer le diagnostic final.
   **Confirmé séparément le 13/08** : le pilotage territorial
   (mise en avant selon les besoins déclarés par une CPTS) n'est PAS
   un prérequis du multi-préférences (v. item 6) — sujet distinct,
   qui nécessite d'abord de brancher `CommuneAPL.boostKine`
   (existe, éditable en admin, lu par aucune logique produit
   aujourd'hui). Seul `desirabilityScore` (niveau profil) est
   réellement branché à ce jour.
6. **Investigation "chercheur d'opportunités" multi-préférences
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
7. **Email de réinitialisation non reçu** — compte
   secretaire@cpts-nord-basse-terre.fr, investigation avant fix
8. **Espace "Mes contrats" dans Mon compte** — persistance et
   récupération des contrats édités, dépend d'une investigation
   préalable (contrats persistés ou générés à la volée ?)
9. **Bouton "Reprendre un texte précédent"** — 5ᵉ bouton du
   formulaire d'édition d'annonce, reprend le texte libre d'une
   annonce précédente du même cabinet (texte seul, pas les champs
   structurés — évite de reporter des données obsolètes sans que
   l'utilisateur s'en rende compte)
10. **Lien direct depuis le message anti-doublon vers l'annonce en
    conflit** — le message actuel décrit l'annonce qui bloque une
    publication mais n'offre aucun moyen de l'atteindre, surtout si
    ses dates sont hors de la période affichée sur le Planning.
    Réutiliser `?editId=`
11. **Annonces limitées sur les pages de propagande, classées
    désirabilité + proximité géo du visiteur** — investigation
    d'abord (les pages affichent-elles déjà des annonces en direct
    aujourd'hui ? désirabilité déjà consommée par une logique
    produit ? géoloc IP disponible dans la stack ?), X et formule de
    classement à proposer avant construction. Premier vrai
    consommateur de `desirabilityScore` en dehors de l'admin

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
