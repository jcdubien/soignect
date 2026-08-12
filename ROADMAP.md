# SOIGNECT — ROADMAP

> Tenu par Sonnet (décisions, arbitrages, raisonnement produit).
> PRODUCT_SPEC.md (comportement vérifié du produit) reste sous la
> plume exclusive d'Opus. Ne pas fusionner les deux fichiers.
> Dernière mise à jour : 12/08.

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

**Raisonnement** (06/08, apparition du concurrent MediLoup — large
d'emblée, tous soignants, tout l'Outre-mer dès le lancement) :
l'avantage de Soignect n'est pas la largeur de couverture, c'est la
profondeur métier et réglementaire (contrats CNOMK, vérification
d'identité avant signature, asymétrie de notation R.4321-99,
connaissance fine de l'Avenant 7). Cette profondeur ne se réplique
pas vite pour un concurrent qui vise large day one.

**Conséquence tenue depuis** : toute demande d'ouverture à une
nouvelle profession ou un nouveau territoire est examinée à l'aune
de cette règle — pas d'infrastructure construite pour un besoin qui
n'existe pas encore, sauf coût marginal quasi nul (voir principe de
factorisation).

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

## 🟡 En cours / à finaliser

- **Affirmation invérifiable restante sur Saint-Barth**
  ("conditions de remplacement souvent avantageuses") — repérée par
  Opus le 12/08 comme appartenant à la même famille que le nettoyage
  du 11/08, non traitée faute d'être dans le périmètre de la tâche
  de factorisation. Jean-Charles indique l'avoir déjà demandée par
  un autre canal — statut à reconfirmer au prochain point.
- Réorganisation de PRODUCT_SPEC.md — prompt à envoyer à Opus (lui
  seul écrit ce fichier), pour qu'il confronte chaque section à
  l'état réel du code en réorganisant.

## 🔴 Prêts, en file, pas encore envoyés

1. **Vue liste desktop titulaire** — alternative au swipe, desktop
   titulaire uniquement, classée par score (le score ordonne, ne
   décide jamais)
2. **Investigation transfert de conventionnement 1-pour-1** — le
   module n'existe pas dans le code ; investigation sur un courrier
   assisté avec règle d'auteur spécifique (titulaire signataire si
   le cédant est assistant)
3. **Extension du module de factorisation aux nouvelles portes
   d'entrée** — cabinet, chercheur de poste, MSP/CPTS/territoire,
   hôpitaux/centres/CAMSP. À envoyer une fois la factorisation
   actuelle stabilisée
4. **Investigation "chercheur d'opportunités" multi-préférences
   (v1.1)** — faisabilité d'un profil ouvert à plusieurs types de
   recherche, sans fusionner contrat/rétrocession/scoring qui
   restent distincts par type
5. **Email de réinitialisation non reçu** — compte
   secretaire@cpts-nord-basse-terre.fr, investigation avant fix
6. **Investigation Planning Board vs spec du 10/07** — écart entre
   la spec historique (panneau au clic sur la timeline, limite de 3
   matchs actifs) et l'état réel du code

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
