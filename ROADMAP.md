# ROADMAP Soignect — Vue chronologique et dépendances

> Document de pilotage, séparé du PRODUCT_SPEC.md. 
>
> ⚠️ NOTE DU 26/07 : PRODUCT_SPEC.md a été reconstruit suite à une 
> perte de fichier locale (incident technique côté outils, pas de 
> perte de code/données réelles — uniquement le document de suivi). 
> Le nouveau PRODUCT_SPEC.md contient un état consolidé du produit 
> (26/07) plutôt que les sections numérotées 1-200 d'origine. CETTE 
> ROADMAP-CI, elle, est restée intacte et fait foi pour tout 
> l'historique chronologique (Phase 0 à aujourd'hui) — à privilégier 
> pour comprendre "comment on en est arrivé là".
>
> Ce document répond à une seule question à chaque instant : 
> **où en est-on, et qu'est-ce qui vient après ?**
>
> Mise à jour : chaque fois qu'un sprint est clos ou qu'une décision est prise, 
> ce fichier doit être régénéré pour refléter l'état réel. Ne pas laisser 
> dériver — c'est le garde-fou contre l'oubli.
>
> Pour la vue opérationnelle court terme (sprints datés, protocole de 
> délégation Sonnet/Opus/Jean-Charles), voir PLAN_PASSATION_SPRINTS.md.

---

## Légende des statuts

| Symbole | Signification |
|---|---|
| ✅ | Fait, vérifié en prod |
| 🟡 | Prêt à envoyer à Claude Code (prompt rédigé) |
| 🟠 | Décision requise avant de pouvoir prompter |
| 🔵 | Décidé, pas encore rédigé en prompt |
| ⚪ | Différé volontairement, hors périmètre actuel |
| 🔒 | Bloqué par une dépendance externe (juridique, autre sprint) |

---

## PHASE 0 — Lancement Kinés Guadeloupe (Palier 0)

### Sprint 0.1 — Fondations produit ✅ FAIT (commit 5b36edc)
```
Mode gratuit (freeAccessMode) · Acquisition Facebook (lien direct, 
page publique) · Synchronisation Timeline↔Annonce · Fix type de 
poste · Simplification préavis/statuts timeline · Raccourci 
disponibilité→mises en relation · Restylage boutons swipe
```
Dépendances : aucune. **Prérequis de tout ce qui suit.**

### Sprint 0.2 — Segmentation Cabinet/Structure ✅ FAIT (commit d25075a)
```
Champ titulaireKind explicite (CABINET/STRUCTURE)
```
Dépendance : Sprint 0.1.

### Sprint 0.3 — Billing individuel + chiffrage Stripe ✅ FAIT (commit 9bd690b)
```
Bascule billing individuelle (contrat signé OU usage soutenu) 
· Chiffrage Stripe 9€/29€ (Cabinet) · Configuration Stripe complète 
(clé secrète, webhook, Price IDs Cabinet + Structures)
```
Dépendance : Sprint 0.2. **Action manuelle Jean-Charles confirmée faite (11-13/07).**

### Sprint 0.4 — Sprint après-midi ✅ FAIT (commit fce5be5)
```
Gate contrat PDF · Photo obligatoire onboarding · Photos secondaires 
· Bottom sheet détaillé · Descriptif commune Wikipédia · CRUD 
annonce complet · Metered billing Structures · Partage Facebook 
· Rappel email 24h
```
Dépendance : Sprint 0.1-0.3.

### Sprint 0.5 — Déblocage déploiement + config finale ✅ FAIT (13/07)
```
Fix cron Hobby (quotidien) · Config Stripe complète vérifiée 
· Webhook opérationnel
```
Dépendance : Sprint 0.4. **Sans ce fix, aucun déploiement ne passait — bloquant historique résolu.**

**→ FIN PHASE 0 : produit en prod, fonctionnel, mode gratuit actif.**

---

## PHASE 1 — Stabilisation pré-bêta (Sprint 2, en cours de préparation)

### Sprint 2 — Correctifs UI + score différencié ✅ FAIT
```
1. Retrait icônes décoratives connexion
2. Fix photo obligatoire non-bloquante (brèche rétroactive)
3. Fix bouton Supprimer admin
4. Fix espace vide mobile (état vide)
5. Fix espacement carte/boutons swipe
6. Fix "Dernières annonces consultées" → bottom sheet état réel
7. Fix carte illisible (texte dupliqué/photo floue/composant non unifié)
8. Feature tap-vs-drag sur toute la carte (bottom sheet)
9. Fix layout desktop (panneau latéral trays)
10. Score d'affinité différencié + champ logement structuré (section 120, corrigé : 3 profils, logement Remplacement uniquement) + score de désirabilité en pourcentage proportionnel (section 126)
11. BioTinder à taille différenciée par profil — 280 remplaçant / 
    600-700 cabinet (section 123)
```
Dépendance : Phase 0 complète. **Confirmé envoyé et exécuté.**

### Sprint 2.6 — Séparation complète parcours Cabinet/Structure ✅ FAIT (commit 87ebe8f)
```
Page /premium : un compte Structure ne voit QUE l'offre 
établissement (89€+20€/contrat) ; un compte Cabinet ne voit QUE 
Gratuit/Premium/Boost — plus de mélange des deux parcours sur la 
même page. Vérifié visuellement dans les deux configurations 
(Structure et Cabinet) sur le compte de Jean-Charles.
```
Dépendance : Sprint 0.2 (titulaireKind). **Bug découvert en recette, corrigé et vérifié le 15/07.**

### Sprint 2.7 — Masquer carte Gratuit pendant freeAccessMode ✅ FAIT (commit f101759)
```
/premium (cabinet, freeAccessMode ON) : carte Gratuit masquée, 
seulement Premium + Boost affichés en 2 colonnes. Pastille header 
adaptée : "✨ Premium" au lieu de "Gratuit · Premium" (plus de 
mention trompeuse). Bascule automatique via endpoint 
GET /api/platform selon freeAccessMode — réapparaît seul quand le 
flag repasse à false, aucune modif de code nécessaire à ce moment.

Précision : le libellé "Gratuit" dans /compte → Abonnement reste 
volontairement (indicateur d'état factuel du compte, pas une 
comparaison côte à côte marketing) — distinction assumée et validée.
```
Dépendance : Sprint 0.1 (freeAccessMode). **Vérifié en prod le 15/07.**

### Sprint 2.1 — Diagnostic carrousel vide desktop + boutons inopérants ✅ FAIT (17/07)
```
Diagnostic complet : les 3 bugs (carrousel vide, boutons Pass/
Intéressé inopérants, compteur "poste actif" incohérent) étaient 
déjà corrigés dans le code déployé (commits 9ce7853, 57da853, 
acfb942/9b735c9) — la cause racine était un cache navigateur 
obsolète sur les onglets ouverts avant ces déploiements, pas un 
défaut de code. Rechargement à froid effectué → les 3 points 
confirmés résolus par Jean-Charles (17/07).
```
Dépendance : aucune. **CONFIRMÉ RÉSOLU — dernier bloquant de la Phase 1 levé.**

### Sprint 2.8 — Sélection par zone géographique (10 macro-zones) ✅ FAIT (commit 92a9982)
```
Modèle additif (commune + zones, rien supprimé). enum 
ZoneGeographique (10 zones), Mission.zones[] (multi), table 
CommuneZone + 35 communes seedées (mapping figé respecté, La 
Désirade isolée). Composant ZoneSelector (chips multi) branché 
sur missions/create et disponibilites/create. Score géo zone-aware 
(25 pts zone match, 18 pts repli même macro-zone, 6 pts sinon). 
Architecture temps de trajet (section 135) non touchée, feed sans 
filtre géo dur (tri par désirabilité).

Backfill zones sur annonces existantes : ✅ FAIT (commit e793019). 
4 annonces backfillées (Anse-Bertrand→NORD_GRANDE_TERRE, 3× 
Pointe-Noire→NORD_BASSE_TERRE). 1 cas limite signalé et non touché 
(location="Jean-Charles DUBIEN", donnée de test à nettoyer avant 
bêta — pas une vraie commune). 3 annonces sans commune intactes.
```
Dépendance : aucune. **Livré et vérifié en prod.**

### Sprint 2.2 — Décision Stripe Live vs Test ✅ TRANCHÉ
```
DÉCISION FINALE : rester en LIVE pendant la bêta (pas de passage 
en Test — évite la reconfiguration laborieuse des clés/webhook/
Price IDs).

Justification : freeAccessMode étant actif, aucun testeur n'a 
besoin de s'abonner (tout est déjà débloqué gratuitement) — le 
risque de débit accidentel est plus faible qu'initialement estimé. 
Public de bêta connu (réseau SNMKR), pas anonyme.

Plan de validation :
1. Jean-Charles teste lui-même le tunnel avec un vrai paiement 9€
2. Remboursement via dashboard Stripe après validation
3. Surveillance manuelle quotidienne du dashboard Stripe pendant 
   la durée de la bêta (30 testeurs) — remboursement immédiat en 
   cas de clic accidentel d'un testeur
```
Dépendance : aucune. **Décision close, plus bloquant.**

**→ CRITÈRE DE FIN DE PHASE 1 : ✅ ATTEINT (17/07) — Sprint 2 + 2.1 + 2.2 + 2.8 tous clos. LA BÊTA PEUT ÊTRE OUVERTE AUX ~30 TESTEURS SNMKR DÈS MAINTENANT.**

---

## PHASE 2 — Bêta v0 (30 testeurs SNMKR Guadeloupe)

### Sprint 3 — Correctifs et découvertes post-lancement ✅ MAJORITAIREMENT CLOS (17-18/07)
```
Volume important de retours traités en continu pendant le début de 
la bêta, avant même la diffusion large au groupe WhatsApp. Toutes 
les entrées ci-dessous sont fermées sauf mention contraire.

✅ Bouton Facebook diagnostiqué (limite sharer.php, Share Dialog 
   reporté — accès Facebook Developers indisponible côté JC)
✅ Décalage horizontal page Relations mobile (fix html overflow-x)
✅ Zones géo retirées côté cabinet, gardées côté candidat, matching 
   corrigé (commune ∈ zones du candidat)
✅ Menu adaptatif match confirmé, des deux côtés (fiche directe + 
   annulation sécurisée + notification)
✅ Bug suppression disponibilité/annonce (double défaut FK + erreur 
   client avalée)
✅ Champs profil RPPS/adresse/SIRET obligatoires avant contrat 
   (gating en 2 phases via flag, phase avertissement active)
✅ Pastille statut header masquée entièrement pendant freeAccessMode
✅ Compteur "annonces actives" cliquable → liste + édition (desktop 
   + mobile)
✅ Boutons "+ Annonce"/"+ Ajouter" — retirés puis RÉTABLIS en 
   permanence (filet de sécurité, clic timeline peu fiable à l'usage 
   réel malgré les specs)
✅ Recherche géo remplaçant simplifiée : zones uniquement + option 
   "Toute la Guadeloupe", commune retirée du formulaire
🔴 DÉCOUVERTE CRITIQUE — le type ASSISTANT ne pouvait pas s'inscrire 
   (bug bloquant tout le "produit gold" depuis le début, section 152) 
   → corrigé, carte Assistant ajoutée à l'inscription
✅ Audit UX complet parcours candidat (guidage double-geste publier→
   swiper, bio pré-remplie, décision motivée de garder la photo 
   obligatoire)
✅ Rattachement compte ASSISTANT à un poste cabinet (double casquette 
   employeur/employé, section 153) — ⚠️ non testé en conditions 
   réelles, test end-to-end recommandé à Jean-Charles avant diffusion 
   large
✅ Documents légaux (mentions légales, confidentialité, CGU/CGV) 
   intégrés avec consentement horodaté — point critique avant 
   ouverture à des inconnus, traité
⚪ Photo Wikipédia illustrative + mise en valeur visuelle texte 
   annonce (section 149) — non urgent, en attente
```
Dépendance : Phase 1 close, bêta lancée. **Volume de travail largement supérieur à l'estimation initiale — la bêta a immédiatement révélé des problèmes non anticipés par la spec, cohérent avec l'utilité même de faire une bêta.**

### ✅ Test assistant↔poste CONFIRMÉ OK par Jean-Charles (23/07)
```
Le rattachement assistant↔poste (section 153) a été testé de bout 
en bout par Jean-Charles et confirmé fonctionnel — c'était le 
dernier vrai bloquant produit du Sprint 0, en attente depuis le 
18/07. Levé.
```

### Sprint 3.y — Consolidation post-audit (156 à 161) ✅ CLOS (20/07)
```
Volume important de sprints entre le 19/07 et le 20/07, en 
continuité directe du Sprint 3 (correctifs post-lancement) :

✅ 156 — Vue centralisée messages (déjà construite, confirmée) + 
   notifications in-app (cloche pleinement fonctionnelle, découverte 
   lors d'un audit — table Notification, panneau, polling 60s)
✅ 157 — SEO : JobPosting JSON-LD (Google Jobs), sitemap.xml 
   dynamique, image de partage OG 1200×630 par annonce — tout 
   vérifié en conditions réelles en prod
✅ 158 — 3 bugs corrigés : photo après cadrage décalée (échelle 
   natif/affiché), postes Planning non cliquables (zone vide sans 
   handler, cause trouvée grâce à une précision de Jean-Charles), 
   suppression de poste manquante sur postes occupés
✅ 159 — Compteur de candidatures (⏳ en attente / 🤝 confirmées) 
   sur le menu "Annonces actives", cliquable vers vue filtrée
✅ 160 — Notification de consultation déclenchée en navigation 
   normale du feed (pas seulement via le tray), déduplication par 
   session (persistant différé, pas nécessaire pour la bêta)
✅ 161 — AUDIT DE SYMÉTRIE CRITIQUE : découverte d'un bug du même 
   ordre que le bug Assistant (section 152) — un contrat CDD/CDI/
   Stage/Vacation (Structure) générait un PDF d'assistanat libéral 
   juridiquement incorrect. Neutralisé (blocage + message clair, 
   pas de template non validé juridiquement). Sprint symétrie 
   candidat associé : partage de disponibilité, compteur de 
   candidatures reçues, wording collaborateur/assistant corrigé — 
   le candidat a désormais la même boîte à outils que le cabinet.

Point non vérifié en conditions réelles, toujours signalé comme 
seul vrai bloquant avant diffusion WhatsApp large : le rattachement 
assistant↔poste end-to-end (section 153/154).
```
Dépendance : Sprint 3 (bêta en cours).


```
Réutiliser la méthode de confrontation offre/demande (sections 
117-118quater du spec) sur les retours réels bêta, en complément 
des données Physiorama — pour affiner encore le score et le 
positionnement une fois de vrais utilisateurs actifs.
```
Dépendance : Sprint 3 (bêta en cours).

---

### Sprint 3.z — Session du 23/07 : vérifications réelles + 10 nouveaux points + réflexions stratégiques

```
✅ Section 177 (bug critique timeline vide) — FAUSSE ALERTE, RÉSOLUE. 
   Vérifiée en conditions réelles (base de données + session live) : 
   la capture avait été prise avant la création de la disponibilité 
   testée. Aucun code cassé.
✅ Sections 172/180 (dates obligatoires, menu rapide timeline) — 
   confirmées solides par cette vérification.
✅ Section 182 — lien direct vers l'annonce du visiteur dans le mail 
   de consultation (au lieu de renvoyer vers ses propres annonces).
✅ Section 139 — Share Dialog Facebook débloqué, App ID obtenu 
   (réutilisation app "Post MK Bot" existante), prompt prêt.

🟡 10 NOUVEAUX PROMPTS EN ATTENTE — compilés dans PROMPTS_DU_JOUR_23_07.md :
   1. Share Dialog Facebook (prêt, App ID inclus)
   2. Bug accroche coupée au bord droit (mobile, Mon compte)
   3. Sentry + bouton "Signaler un problème" (dernier item Sprint 0, 
      statut d'envoi à reconfirmer)
   4. Cycle de vie matches — sortie de liste active au contrat signé 
      des deux côtés (section 184)
   5. Slider redevance trop étroit (20-50% → élargir, cas réels à 10%)
   6. Icône/logo quadrillage (transparence perdue) + accent visuel 
      Guadeloupe léger (palette tropicale + colibri, sans drapeau — 
      section 192)
   7. Espace vide UI entre "Vos mises en relation"/"Vos choix" et 
      le menu du bas (état vide swipe)
   8. Badge "Vérifié RPPS" affiché à tort malgré ANS_API_KEY non 
      configurée (section 193 — problème de confiance potentiel)
   9. Vérifier qu'une annonce/dispo matchée disparaît bien du 
      carrousel de TOUS les autres utilisateurs (section 194)
   10. Menu "Choisir la mission cible" se ferme automatiquement à 
       la sélection, empêche de compléter le formulaire (section 195)

⚪ RÉFLEXIONS STRATÉGIQUES CAPTURÉES, TOUTES DIFFÉRÉES (Phase 3+, 
   aucune ne doit distraire du Sprint 0/bêta en cours) :
   - Section 185 — vision multi-marque (nom variable par profession/
     région), branding Guadeloupe complet différé (accent léger 
     traité séparément, voir point 6 ci-dessus)
   - Section 186 — internationalisation (espagnol/portugais/allemand/
     anglais/roumain) — point légal important : les contrats doivent 
     rester en français (droit français, modèle CNOMK)
   - Section 187 — modèle de paiement à la carte (façon Physiorama/
     LeBonCoin) en complément de l'abonnement mensuel — pas d'urgence, 
     freeAccessMode actif
   - Section 188 — le palier 1 (46 cabinets) devrait-il intégrer un 
     seuil côté remplaçants/assistants (15-20 déjà ciblés Sprint 1) ? 
     Question liée à 187, à trancher ensemble au Sprint 3
   - Section 178/189 — espace d'archivage des contrats dédié dans 
     chaque compte + formulaire "1 pour 1" zones non prioritaires 
     (interlocuteur confirmé : CPAM, pas CDO — correction faite) — 
     nécessite avis juridique avant automatisation
   - Sections 190/191 — bugs UI mineurs (espace vide, slider) déjà 
     inclus dans les 10 prompts ci-dessus

📄 NOUVEAUX LIVRABLES : deux guides utilisateur créés (guide-
   titulaires-structures.md et guide-remplacants-assistants.md) — 
   premiers documents user-facing, distincts du PRODUCT_SPEC 
   technique. À maintenir à jour au même rythme.

⚪ Point non résolu, en attente : badge "🎙️11" repéré dans le header 
   titulaire, non identifié dans la documentation — à clarifier avec 
   Jean-Charles.
```
Dépendance : Sprint 3 (bêta en cours).

---

## PHASE 3 — v1.1 (fondations de fond, post-bêta)

Pas d'ordre strict entre ces items sauf mention contraire — 
priorisation à faire au moment venu selon les retours bêta.

| Item | Statut | Dépendance |
|---|---|---|
| Notation post-mission | ⚪ Différé | Aucune |
| Multi-communes remplaçant | ⚪ Différé | Aucune |
| Éditeur admin CRUD ciblé | ⚪ Différé | Aucune |
| TensionScore territorial | ⚪ Différé | **Bloque le Sprint Phase 5 (Monde B)** |
| Dashboard Observatoire commercial | ⚪ Différé | **Dépend de TensionScore** |
| Vision "portfolio dans la poche" (interface remplaçant) | ⚪ Différé | Aucune, mais gros chantier UX — nécessite un sprint dédié de conception |
| Assistant de rédaction DeepSeek (Boost uniquement) | ⚪ Différé | Base empirique complète (✅ déjà faite) |
| Boost ponctuel payant à la carte | ⚪ Différé | Retours d'usage réels sur pricing actuel |
| Notification prioritaire "premier arrivé" (Boost) | ⚪ Différé, décidé (section 124) | Système de rappel section 112 |
| Export CSV mises en relation (Boost) | ⚪ Différé, décidé (section 124) | Aucune |
| Limite mises en relation Gratuit (3 max) + illimité Premium/Boost | ⚪ Différé, décidé (section 125) | Aucune |
| Favoris (Premium/Boost, pas Gratuit) | ⚪ Différé, décidé (section 125) | Aucune |
| Automatisation refresh APL (API DREES) | 🟢 Faisabilité confirmée | Doit précéder ou accompagner TensionScore |

---

## PHASE 4 — Expansion Phase 1 (1-2 professions pilotes, Monde A)

### Sprint 4.0 — Validation juridique 🔒 BLOQUANT
```
Avis juridique sur le cadre contractuel de la 2e profession 
(sage-femme pressenti, non confirmé) — AUCUN développement avant 
cette étape.
```
Dépendance : Phase 3 idéalement avancée (produit stabilisé sur les kinés).

### Sprint 4.1 — Branding différencié + intégration (après validation)
```
Différenciation profession + région (section 111) — conception 
technique non commencée, dépend du Sprint 4.0.
```
Dépendance : Sprint 4.0 complet.

---

## PHASE 5 — Expansion Monde B (médecins spécialistes, vision long terme)

### Sprint 5.0 — Prérequis data 🔒 BLOQUANT
```
TensionScore opérationnel (Phase 3) + script APL par spécialité 
(sections 29-30 du spec, RPPS/Annuaire Santé) + Dashboard 
Observatoire vendable
```
Dépendance : Phase 3 (TensionScore + Observatoire) complète.

### Sprint 5.1 — Cadre juridique Ordre des Médecins 🔒 BLOQUANT
```
Avis juridique dédié, distinct de celui de la Phase 4 (cadre 
différent, enjeux différents)
```
Dépendance : peut être mené en parallèle de 5.0.

### Sprint 5.2 — Mécanisme de mise en relation institutionnel
```
Probablement différent du swipe individuel — conception non 
commencée
```
Dépendance : Sprint 5.0 + 5.1.

---

## CHANTIER TRANSVERSE — Cession de patientèle/cabinet/mur

```
Statut : 🔒 bloqué avis juridique, ne rentre dans AUCUNE phase 
numérotée ci-dessus tant que cet avis n'est pas obtenu.

Découverte importante (section 117 du spec) : ce n'est pas un 
module isolé — c'est le prolongement naturel du parcours 
remplacement→assistanat déjà couvert par Soignect. Quand ce 
chantier sera engagé, il devra être conçu comme une EXTENSION 
du parcours existant, pas comme une section neuve isolée.

Prérequis avant tout développement :
1. Avis juridique (cadre légal, terminologie "cession" pas "vente")
2. Décision sur le mécanisme d'anonymisation/confidentialité 
   (partenariat avec structure juridique/comptable à identifier)
3. Conception UX distincte du modèle swipe (annuaire filtrable, 
   pas un carrousel)
```

---

## 🎯 SESSION MARATHON DU 03/08 — quatre fils majeurs entièrement clos, 25 commits

```
Session exceptionnellement longue et productive, largement hors du 
cadre "sprint par sprint" ci-dessus — traitée comme une session 
d'audit et de correction intensive, en parallèle des sprints prévus. 
Détail complet dans PRODUCT_SPEC.md (sections datées 03/08) ; ce qui 
suit est le résumé exécutif.

QUATRE FILS ENTIÈREMENT CLOS :

1. CHAÎNE ASSISTANT — d'inexistante à complète. Le formulaire "Faire 
   remplacer mon absence" était un cul-de-sac total le matin (aucun 
   champ ne se rendait). Le soir : publication fonctionnelle, 
   visibilité de sa propre couverture (carte dédiée), droit de 
   retrait symétrique au droit de publier, garde anti-doublon. 
   Bonus : le garde du rattachement AUTOMATIQUE à la signature 
   (distinct du rattachement manuel) était cassé depuis l'origine — 
   corrigé, avec preuve réelle (12 postes orphelins retrouvés).

2. PARCOURS SALARIÉ/RECRUTEUR — d'aveugle des deux côtés à 
   fonctionnel. Le feed établissement ne voyait jamais aucun 
   candidat (0 candidat sur 8 n'avait activé l'opt-in, et ce 
   réglage n'était modifiable qu'à la création d'une toute nouvelle 
   recherche). Corrigé : réglage accessible depuis "Mon compte", 
   déblocage vérifié par requête réelle avant/après/restauré. CTA 
   Premium trompeur retiré. Restent en Phase 3 : champs économiques 
   incohérents (CA/redevance n'ont pas de sens pour un salarié, 
   rémunération jamais demandée), et l'architecture MissionType 
   (3 types libéraux portant 6 réalités).

3. AUDIT DÉONTOLOGIQUE — enforceContractProfile armé (PDF ET 
   signature — un premier passage n'avait fermé que la génération 
   PDF, la route de signature restait une "porte de service" 
   ouverte). Message proactif à 2 emplacements avant le blocage. 
   0 notation en base à ce jour (sujet système de notation sans 
   urgence). 4 arbitrages documentés et transmis au CDO de 
   Jean-Charles (dont un point sérieux : la commission au contrat du 
   plan Structure touche potentiellement au compérage/partage 
   d'honoraires).

4. UN BUG DE PRODUCTION RÉEL TROUVÉ ET CORRIGÉ — des briques de 
   Planning qui se chevauchent sans z-index se recouvraient 
   totalement. Pas théorique : ça cachait déjà un vrai recrutement 
   actif à un vrai cabinet avant la correction.

🎓 ÉVALUATION UX/UI DE FIN DE SESSION (voir PRODUCT_SPEC.md pour le 
texte complet) : diagnostic de fond au-delà des bugs individuels — 
"l'écran affirme ce qu'il n'a pas vérifié" est le défaut UNIQUE ET 
RÉPÉTÉ derrière 8 correctifs de la journée. Élevé au rang de RÈGLE 
PERMANENTE dans PLAN_PASSATION_SPRINTS.md (correction de méthode 
n°7) : aucun écran n'affirme ce qu'il n'a pas vérifié.

Jugement d'ensemble d'Opus, à retenir : "Pour une bêta, le socle est 
là. Ce que je surveillerais en priorité n'est pas l'esthétique — 
elle est correcte et cohérente — mais la véracité des écrans."
```

---

## Tableau de synthèse — que faire maintenant, dans l'ordre

```
🎉 MISE À JOUR 03/08 — SPRINT 0 ET UNE GRANDE PARTIE DU SPRINT 1 
TERMINÉS DE FAIT, via une session marathon d'audit/correction 
intensive (25 commits, 4 fils majeurs clos, détail juste au-dessus). 
La déontologie, longtemps signalée "en attente", est CLOSE.

⚠️ POUR LE DÉTAIL OPÉRATIONNEL COURT TERME, PLAN_PASSATION_SPRINTS.md 
FAIT FOI. Ce tableau reste une vue résumée de haut niveau.

PROCHAINES ÉTAPES, PAR NIVEAU DE PRIORITÉ (établies le 03/08) :

TIER 0 — méthode, pas de code, le plus rentable de tous :
La règle d'écriture opposable ("aucun écran n'affirme ce qu'il n'a 
pas vérifié") doit s'appliquer à TOUTE nouvelle feature dès sa 
conception, pas seulement en correction a posteriori.

TIER 1 — statuts à reconfirmer avant tout le reste :
- Bug Sentry suppression Mission (jamais mentionné dans les rapports 
  du 03/08, statut réel inconnu)
- Connexion jcdubien@gmail.com (probablement résolue par la 
  normalisation email du 30/07, jamais confirmée explicitement)
- 2 comptes déjà bloqués par enforceContractProfile avec une annonce 
  en ligne — prévenir directement si l'un est un vrai testeur

TIER 2 — Sprint 1, prompts antérieurs à la session marathon, 
probablement partiellement caducs (vérifier avant renvoi) : layout 
desktop deux colonnes, déconnexion mobile, image OG, invitation 
email poste-assistant, bug timeline Assistant 1

TIER 3 — 3 défauts connus du parcours salarié, non traités : champs 
économiques incohérents, architecture MissionType, bouton sans effet 
sous l'état vide établissement

TIER 4 — NOUVEAU, signalé par l'évaluation UX/UI : le formulaire de 
création d'annonce s'est alourdi au fil des ajouts (texte libre + 4 
boutons IA + repli + 2 colonnes + sélecteur + 8 champs + prérequis) 
— "l'idée d'origine se noie dans son propre outillage". Rejoint la 
demande de simplification déjà posée par Jean-Charles. Mérite une 
vraie session dédiée avant Tier 2.

TIER 5 — Phase 3, sciemment différé (voir détail complet plus haut 
dans ce document et dans PRODUCT_SPEC.md) : pricing à la carte, 
palier 1, multi-marque, i18n, vision MCP/donnée institutionnelle, 
chercheur/pourvoyeur, fluidité du statut dans le temps, module 
Cession, 8 features de différenciation acquisition, badge CPTS.

DÉCISIONS PRODUIT MINEURES TOUJOURS EN ATTENTE :
- Expéditeur email → noreply@soignect.fr (quand domaine vérifié)
- Nommer le visiteur dans le mail de consultation (actuellement anonyme)
- Badge "🎙️11" toujours non identifié
- Rappel post-signature Ordre + champ "autorisation de remplacement" 
  (proposés lors de l'audit déontologique, pas encore pris)

RESTE VALABLE DEPUIS LE 26/07 — actions administratives Jean-Charles :
- connection_limit=1 sur DATABASE_URL (Vercel)
- ANS_API_KEY sur Vercel (vérification RPPS réellement fonctionnelle)
- Config Facebook — possiblement OBSOLÈTE : le bouton Facebook dédié 
  a été retiré (redondant avec le partage natif), à reconfirmer si 
  cette action a encore un sens
- Résoudre l'issue Sentry self-test (NEXTJS-1)
- INPI "Soignect" toujours pas fait — domaine soignect.fr réservé 
  sur OVH (fait). Diffusion Facebook large volontairement suspendue 
  par Jean-Charles en attendant l'INPI.
```

---
