# ROADMAP Soignect — Vue chronologique et dépendances

> Document de pilotage, séparé du PRODUCT_SPEC.md. Le spec contient le détail 
> de chaque décision (sections 99-122) ; ce document répond à une seule 
> question à chaque instant : **où en est-on, et qu'est-ce qui vient après ?**
>
> Mise à jour : chaque fois qu'un sprint est clos ou qu'une décision est prise, 
> ce fichier doit être régénéré pour refléter l'état réel. Ne pas laisser 
> dériver — c'est le garde-fou contre l'oubli.

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

### Action requise avant diffusion large au groupe WhatsApp
```
Tester end-to-end le rattachement assistant↔poste (section 153) : 
signer un contrat assistanat de test, vérifier l'apparition du 
poste rattaché dans le Planning, vérifier que le bouton "Faire 
remplacer mon absence" fonctionne. C'est le seul point non vérifié 
en conditions réelles à ce jour.
```

### Sprint 3.x — Méthode de collecte de patterns étendue 🟢 MÉTHODE VALIDÉE
```
Réutiliser la méthode de confrontation offre/demande (sections 
117-118quater du spec) sur les retours réels bêta, en complément 
des données Physiorama — pour affiner encore le score et le 
positionnement une fois de vrais utilisateurs actifs.
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

## Tableau de synthèse — que faire maintenant, dans l'ordre

```
🎉 PHASE 1 TERMINÉE (17/07). 🚧 PHASE 2 (BÊTA) EN COURS ACTIVE 
depuis, avec un volume de corrections/découvertes important — 
attendu et sain pour une vraie bêta.

1. TESTER END-TO-END le rattachement assistant↔poste (section 153) 
   avant diffusion large au groupe WhatsApp — seul point non 
   vérifié en conditions réelles à ce jour (signer un contrat 
   assistanat de test, vérifier l'apparition du poste, vérifier le 
   bouton "Faire remplacer mon absence")
2. Une fois ce test concluant → diffuser largement au groupe 
   WhatsApp beta en confiance, la découverte critique du bug 
   d'inscription Assistant (section 152) est corrigée
3. Continuer à traiter les retours réels au fil de l'eau (pattern 
   déjà bien rodé : capture d'écran → diagnostic → prompt → 
   vérification → documentation)
4. Ne rien engager sur Phase 4/5/Cession avant que Phase 2-3 
   soient largement digérées — toujours le principal risque de 
   dispersion identifié par Jean-Charles lui-même

POINTS EN ATTENTE, NON BLOQUANTS :
- Section 149 (photo Wikipédia illustrative + relief visuel texte 
  annonce) — esthétique, à faire quand il y a un moment calme
- Section 139 (Share Dialog Facebook, App ID) — reporté, attend 
  l'accès de Jean-Charles à Facebook Developers
```
