# SOIGNECT — PLAN DE PASSATION & SPRINTS
> Refonte complète du 29/07/2026 — remplace la version précédente.
> **Sonnet = gestion de projet** (suivi, priorisation, rédaction des prompts, documentation)
> **Opus (Claude Code) = implémentation** (code, migrations, vérifications en prod)
> **Jean-Charles = décisions produit + tests terrain + actions manuelles**

---

## POURQUOI CETTE REFONTE

```
Deux événements ont rendu l'ancien plan obsolète :
1. Une conversation Claude.ai ANTÉRIEURE a été retrouvée (29/07) — 
   elle contient les fondations d'origine du projet (ambition 
   nationale, système de notation avec contrainte déontologique, 
   module Cession, grille tarifaire complète, 3 leviers de lancement) 
   qui n'étaient plus dans le champ de vision courant.
2. Une dizaine de prompts s'étaient accumulés sans structure claire 
   de séquencement, avec un risque réel de "se perdre dans la 
   direction" (mot de Jean-Charles).

Ce document repart d'un état des lieux complet et propose un 
séquencement réaliste, sprint par sprint, sans rien perdre de ce qui 
est en attente.
```

---

## PROTOCOLE DE TRAVAIL (inchangé, rappel)

```
1. Jean-Charles remonte un constat → Sonnet qualifie (bug bloquant / 
   bug non bloquant / feature) → prompt rédigé → Opus exécute et 
   rapporte avant de coder si investigation demandée → Jean-Charles 
   vérifie en conditions réelles → Sonnet documente

RÈGLES NON NÉGOCIABLES :
- Tout ajout de type/enum/acteur → checklist chaîne complète 
  (inscription → feed → matching → contrat → notifications → partage)
- Toute nouvelle colonne DB texte → limite alignée avec le plafond 
  Zod/formulaire (leçon Sentry NEXTJS-3/5)
- Toute migration Prisma → application MANUELLE en prod signalée
- Ne jamais laisser Opus deviner des données locales ou juridiques — 
  toujours faire valider par Jean-Charles
- 🆕 Toute feature touchant à la notation/évaluation entre profils → 
  vérifier la conformité déontologique (article R.4321-99) AVANT 
  construction, pas après

RÈGLE DU GEL : reste active par défaut. Elle a déjà été levée 
consciemment pour les 8 features de différenciation (Sprint 3 
ci-dessous) et pour la refonte texte libre — ce sont des exceptions 
tracées, pas une suspension générale de la règle.
```

---

## 🔴 SPRINT 0.5 — URGENCES (à traiter avant tout le reste)

```
Rien d'autre n'avance tant que ces 3 points ne sont pas clos.
```

- [ ] **Vérification déontologique du système de notation** — prompt déjà rédigé et remis à Jean-Charles (29/07). Risque professionnel réel si un champ de commentaire libre existe côté notation du candidat et qu'il est déjà en usage réel.
- [ ] **Bug Sentry prod — suppression Mission échoue si Swipes existants** (contrainte FK `Swipe_swipedMissionId_fkey`) — prompt prêt dans PROMPTS_EN_ATTENTE.md (B8)
- [ ] **Connexion/emails cassés pour jcdubien@gmail.com** — prompt critique rédigé le 29/07, statut de résolution à confirmer. Si toujours en panne : reste la priorité absolue devant tout le reste, y compris la vérification déontologique.

---

## 🟡 SPRINT 1 — FINIR CE QUI EST EN COURS

```
Objectif : clore les chantiers déjà entamés avant d'en ouvrir de 
nouveaux. Ordre recommandé ci-dessous, mais Jean-Charles pilote 
selon ce qui est déjà en session avec Opus.
```

- [ ] **Layout desktop deux colonnes** sur /missions/create (point 2 de la série audit — en cours au moment de cette refonte)
- [ ] **Fusion bioTinder + texte à interpréter** (B6) — à faire dans la même session que le layout deux colonnes si possible, même écran
- [ ] Reste de la série audit : **A3** (Dates bloquées mal catégorisées), **A4** (vocabulaire Relations/matches unifié), **A5** (typo + CA/rétro encouragés pas imposés)
- [ ] **B1** — Design carrousel : swipe seul mobile, contrôles textuels sobres desktop
- [ ] **B2** — Bouton Déconnexion serré sur mobile
- [ ] **B3** — Image OG : vérifier le rendu réel sur le débogueur Facebook (Scrape Again) avant de renvoyer, une partie du travail est déjà faite
- [ ] **B4** — Flux d'invitation par email (gros chantier, à isoler dans sa propre session)
- [ ] **B5** — Bug timeline "Assistant 1" (annonce postée depuis un poste rattaché n'apparaît pas)

---

## 🟢 SPRINT 2 — POINTS D'ENTRÉE ADRESSÉS & MESURE

```
Objectif : mesurer avant de généraliser.
```

- [ ] **B7** — Page /venir-en-guadeloupe (remplaçant métropolitain) — déjà rédigée, à envoyer
- [ ] Vérifier que TraceEvent capture bien la source d'inscription pour mesurer la conversion de cette page
- [ ] **Ne pas construire** les 3 autres pages d'entrée (cabinets, assistanat, établissements) avant d'avoir un signal de conversion sur celle-ci
- [ ] Clarifier lequel des deux groupes Facebook est le bon levier (10 000 membres national historique vs "Kinésithérapeutes de Guadeloupe" utilisé récemment) — vérifier si Jean-Charles a un rôle administrateur sur le premier permettant la publication croisée automatique envisagée à l'origine

---

## 🔵 SPRINT 3 — SESSION DE RÉCONCILIATION STRATÉGIQUE

```
Objectif : recoller les fondations retrouvées avec ce qui a été 
construit depuis. Pas de code dans ce sprint — de la décision.
```

- [ ] **Pricing** : reconcilier la grille d'origine (boost 9-29€, premium 39-79€, badge structure 29-49€, CVthèque 99€, partenariats forfait annuel) avec la question ouverte du pricing à la carte façon LeBonCoin. La grille d'origine est probablement déjà la base de réponse à cette question.
- [ ] **Palier 1** : trancher si le seuil de 46 cabinets doit intégrer une condition candidat (15-20 actifs), à la lumière du modèle économique complet retrouvé.
- [ ] **Module Cession & Association** : décider si/quand faire valider par un avis juridique (spec déjà complète, jamais construite) — probablement à réserver pour après la bêta.
- [ ] **Ambition nationale vs phase Guadeloupe** : décider comment/si documenter cette ambition dans les livrables courants, pour qu'une future session (notamment Sonnet sans cette conversation) ne confonde pas le point de départ avec l'objectif final.
- [ ] **Badge "Certifié CPTS"** (piste 5 de différenciation) : rapprocher de la légitimité institutionnelle déjà envisagée à l'origine (SNMKR communication, CPTS porte d'entrée V2) — cohérent, à activer quand la démarche institutionnelle réelle sera prête.

---

## ⚪ SPRINT 4 — LES 8 FEATURES DE DIFFÉRENCIATION (gel déjà levé)

```
Prompts déjà rédigés (24/07), gel levé consciemment. À envoyer 
quand les sprints 0.5-1-2 sont clos, pas avant — éviter de rouvrir 
trop de chantiers en parallèle (leçon de l'audit du 21/07).
```

- [ ] Badge de réactivité cabinet ("Répond sous 48h")
- [ ] "Glassdoor du cabinet" — ⚠️ SUBORDONNÉ au résultat du Sprint 0.5 (vérification déontologique) : ne pas construire ou reconstruire avant d'avoir les faits
- [ ] Calculateur de revenu net estimé
- [ ] Kit remplacement touriste (fiche pratique par zone — contenu à rédiger par Jean-Charles)
- [ ] Indicateur de fiabilité candidat (confiance bidirectionnelle) — même vigilance déontologique que Glassdoor
- [ ] Alerte instantanée de correspondance
- [ ] Communauté des remplaçants Guadeloupe
- [ ] Checklist "Premier remplacement en Guadeloupe" (contenu à rédiger par Jean-Charles)

---

## ⚪ SPRINT 5 — LA GRANDE VERTICALE (vision timeline candidat)

```
Chantier de fond déjà cadré dans les versions précédentes du plan : 
page unique timeline-centrique pour le candidat, benchmark Uber 
driver/Duolingo/Revolut/Indeed Flex, desktop-first titulaire / 
mobile-first candidat comme principe directeur. À reprendre 
seulement si la bêta montre une vraie traction après les sprints 
précédents.
```

---

## 🔒 HORS SPRINTS — DÉBLOCAGES EXTERNES / ACTIONS JEAN-CHARLES

```
1. connection_limit=1 sur DATABASE_URL (Vercel)
2. ANS_API_KEY sur Vercel (vérification RPPS réellement fonctionnelle)
3. ✅ Sentry DSN — fait
4. Config Facebook (App Domains + mode Live) — bloqué sur accès Meta 
   Developers de Jean-Charles
5. Résoudre l'issue Sentry self-test NEXTJS-1 (2 min)
6. INPI "Soignect" + domaine soignect.fr — ⚠️ Jean-Charles a 
   explicitement suspendu la diffusion Facebook en attendant cette 
   protection. Ce n'est plus de l'administratif secondaire, c'est ce 
   qui bloque le lancement de la campagne.
7. Templates PDF salariés CDD/CDI — seulement si les Structures le 
   demandent ET après validation juridique
8. Module Cession & Association — nécessite avis juridique avant 
   toute implémentation (spec déjà prête, voir Sprint 3)
```

---

## TABLEAU DE DÉLÉGATION

| Tâche | Qui | Quand |
|---|---|---|
| Qualifier les retours, rédiger les prompts, documenter | **Sonnet** | En continu |
| Relancer JC sur les tests/actions en attente | **Sonnet** | Chaque session |
| Tenir PRODUCT_SPEC.md + ROADMAP.md à jour | **Sonnet** | Après chaque livraison |
| Implémenter, migrer, vérifier en prod | **Opus** | Sur prompt |
| Rapporter avant de coder (investigations) | **Opus** | Systématique |
| Décisions produit, tests terrain, INPI/GSC/admin | **Jean-Charles** | Sprint 0.5 puis hebdo |
| Rédaction de contenu (kit touristique, checklist premier remplacement) | **Jean-Charles** | Sprint 4 |
| Synthèse hebdo de la bêta | **Sonnet** | Chaque lundi |

---

## LES CORRECTIONS DE MÉTHODE ACCUMULÉES (résumé, toujours valables)

```
1. LE GEL : force les idées vers un sprint plus tard plutôt que de 
   les construire immédiatement. Sonnet en est le gardien.
2. LA CHECKLIST DE CHAÎNE : tout nouveau type/enum/acteur → vérifier 
   inscription → feed → matching → contrat → notifications → partage.
3. LA RELANCE SYSTÉMATIQUE : tout point "à tester/décider par JC" 
   relancé à chaque session tant qu'il n'est pas confirmé.
4. L'ALIGNEMENT VARCHAR/ZOD : toute colonne texte doit avoir une 
   limite DB alignée sur le plafond de validation formulaire.
5. 🆕 LA VÉRIFICATION AVANT RECONSTRUCTION : avant de déclarer un 
   fichier "perdu" ou de reconstruire quoi que ce soit, VÉRIFIER 
   l'état réel de chaque fichier concerné — pas assumer.
6. 🆕 LA VIGILANCE DÉONTOLOGIQUE : toute feature de notation/avis 
   entre profils doit respecter l'asymétrie légale documentée 
   (article R.4321-99) avant construction.
```
