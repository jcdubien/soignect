# SOIGNECT — PLAN DE PASSATION & SPRINTS
> Créé le 21/07/2026. Document de référence pour la délégation :
> **Sonnet = gestion de projet** (suivi, priorisation, rédaction des prompts, documentation)
> **Opus (Claude Code) = implémentation** (code, migrations, vérifications en prod)
> **Jean-Charles = décisions produit + tests terrain + actions manuelles**

---

## PROTOCOLE DE TRAVAIL (le pattern à respecter)

```
1. Jean-Charles remonte un constat (capture, observation, idée)
2. Sonnet qualifie : BUG BLOQUANT / BUG NON BLOQUANT / FEATURE
   → Bloquant : prompt immédiat
   → Non bloquant : documenté dans PRODUCT_SPEC, ajouté au sprint concerné
   → Feature : PARKING Phase 3 par défaut (règle du gel, voir ci-dessous)
3. Sonnet rédige le prompt (format établi : CONTEXTE / FIX-FEATURE /
   NE PAS TOUCHER / build+commit+push) en référençant les sections du spec
4. Opus exécute, rapporte AVANT de coder si investigation demandée
5. Jean-Charles vérifie en conditions réelles (mobile pour candidat,
   desktop pour titulaire)
6. Sonnet documente (section numérotée dans PRODUCT_SPEC.md, statut
   dans ROADMAP.md)

RÈGLES NON NÉGOCIABLES pour Sonnet :
- Tout ajout de type/enum/acteur → checklist chaîne complète :
  inscription → feed → matching → contrat → notifications → partage
  (leçon des bugs critiques §152 et §161)
- Ne jamais laisser Opus deviner des données locales (mapping
  communes, règles métier kiné) — toujours faire valider par JC
- Toute décision produit ambiguë → question fermée à JC, pas
  d'interprétation
- Un point marqué "à tester par JC" est relancé À CHAQUE session
  tant qu'il n'est pas confirmé fait

RÈGLE DU GEL (active jusqu'à la fin du Sprint 5) :
Aucune nouvelle feature n'entre dans un sprint en cours. Toute idée
va en Phase 3, même excellente. Seuls les bugs passent.
```

---

## 🔴 SPRINT 0 — PORTE DE LA BÊTA (à finir AVANT diffusion WhatsApp large)
**Durée cible : 2-3 jours. Rien d'autre ne passe avant.**

### 0.1 — Actions Jean-Charles (aucun code)
- [ ] **Test end-to-end rattachement assistant↔poste** (~15 min, en retard
      depuis le 18/07) : inscrire un assistant test → matcher → signer
      contrat assistanat → vérifier poste rattaché dans Planning cabinet
      ET bannière côté assistant → tester "Faire remplacer mon absence"
- [ ] Vérifier le fix du bug "Publier mes disponibilités" une fois livré (0.2)
- [ ] Soumettre sitemap.xml à Google Search Console + Rich Results Test
- [ ] Dépôt INPI "Soignect" (recherche d'antériorité gratuite d'abord,
      puis 190€ classe 42 + 40€ classe 35) + réserver soignect.fr

### 0.2 — Prompts Opus (bugs bloquants, déjà rédigés dans PROMPTS_EN_ATTENTE.md)
- [ ] 🔴 Bouton "Publier mes disponibilités" grisé + timeline vide (§168+169
      — même prompt, cause racine commune suspectée : validation zones)
- [ ] 🟠 Badges candidatures ⏳/🤝 inopérants au clic (§164, régression 60b63de)

### 0.3 — Prompts Opus (sécurité pré-inconnus, à rédiger par Sonnet)
- [ ] Rate limiting sur les appels DeepSeek (protection facture — plafond
      par utilisateur/jour + plafond global/jour, valeurs à proposer par Opus)
- [ ] Audit systématique des permissions : pour chaque route API, vérifier
      que l'utilisateur ne peut lire/modifier QUE ses propres données
      (une faille déjà trouvée par accident §153 — audit lecture seule,
      rapport avant tout fix)
- [ ] Sentry (ou équivalent gratuit) branché sur l'app + un lien
      "Signaler un problème" visible dans l'app (mailto ou formulaire simple)

### CRITÈRE DE SORTIE DU SPRINT 0
```
Les 3 cases 0.1 principales cochées + 0.2 vérifiés en réel + 0.3 livrés
→ DIFFUSION WHATSAPP LARGE. C'est un événement, pas une option.
```

---

## 🟢 SPRINT 1 — BÊTA OUVERTE, ÉCOUTE ACTIVE (semaine du 27/07)
**Objectif : laisser les 30+ testeurs générer le vrai backlog. Gel de features actif.**

- Sonnet tient un tableau des retours testeurs : source / constat /
  qualification (bug bloquant, bug mineur, demande) / décision
- Seuls les bugs bloquants donnent lieu à des prompts immédiats
- Requête hebdo TraceEvent (Opus, lecture seule) : inscriptions par type,
  publications, swipes, matches, contrats — chiffres bruts pour JC
- Point hebdomadaire : Sonnet produit une synthèse (ce qui marche,
  ce qui coince, ce que les testeurs demandent le plus)

### 1.b — VOLET ACQUISITION REMPLAÇANTS (en parallèle, dès le Sprint 1)

```
CONTEXTE STRATÉGIQUE : le côté rare de la marketplace est le 
remplaçant (beaucoup de titulaires en recherche, peu de candidats). 
L'acquisition candidats est donc LA priorité marketing, avant toute 
communication large. Principe : ne jamais promouvoir "la plateforme" 
— toujours promouvoir une ANNONCE concrète, la plateforme se 
découvre en arrière-plan.

CANAUX, PAR ORDRE D'EFFORT/IMPACT :

1. TITULAIRES COMME RELAIS (immédiat, coût zéro, le plus puissant)
   Chaque cabinet inscrit a déjà travaillé avec des remplaçants 
   (contacts WhatsApp directs). Leur fournir un message prêt à 
   transférer : "Je suis sur Soignect maintenant, mes prochaines 
   annonces passent par là : [lien]". Un remplaçant invité par un 
   titulaire connu s'inscrit dans la journée.
   → Sonnet : rédiger le message type, relancer JC pour diffusion 
     dans le groupe WhatsApp testeurs.

2. PROSPECTION DIRECTE PHYSIORAMA (artisanal mais suffisant à 
   cette échelle — il faut 15-30 remplaçants pour amorcer)
   Les remplaçants qui publient des disponibilités nationales avec 
   mention DOM-TOM sont identifiables et déjà en recherche active. 
   Approche personnalisée : "j'ai N cabinets à [commune] qui 
   cherchent sur tes dates, avec logement".
   → JC : ~1h/jour de prospection. Sonnet : rédiger 2-3 modèles de 
     premier message personnalisable.

3. POSTS D'ANNONCES DANS LES GROUPES FACEBOOK REMPLAÇANTS
   Mécanisme : publier une VRAIE annonce (jamais de l'auto-promo, 
   supprimée par les modérateurs) dans les groupes nationaux de 
   kinés remplaçants. Le post = l'opportunité concrète ("Remplacement 
   2 mois à Pointe-Noire, logement fourni, à 5 min des spots de 
   plongée 👉 [lien]"). Le lien = la page publique /annonce/[id], 
   avec l'image OG 1200×630 déjà en place (section 157). Le candidat 
   clique → lit → doit créer un compte pour candidater → capté.
   Chaque annonce différente = un nouveau post légitime, semaine 
   après semaine.
   → Sonnet : aider JC à formuler chaque post (accroche + arguments 
     locaux). L'argument logement + cadre antillais est l'aimant 
     unique — "remplacement touriste" comme produit d'appel.

4. DIASPORA — JEUNES KINÉS ANTILLAIS FORMÉS EN MÉTROPOLE
   Associations d'étudiants antillais des villes IFMK (Bordeaux, 
   Toulouse, Paris...). Message affectif "rentre au pays en 
   remplaçant d'abord" + argument réglementaire Avenant 7 (dès 2027, 
   le remplacement devient la porte d'entrée quasi obligée en 
   Guadeloupe — aucune zone sous-dotée = pas d'installation directe 
   conventionnée pour les nouveaux diplômés).
   → Plus long terme (rentrée scolaire), à préparer pendant l'été.

5. SEO PASSIF (déjà livré, section 157)
   Google Jobs capte "remplacement kiné Guadeloupe" en tâche de 
   fond. Prérequis : Search Console soumise (action Sprint 0).

CE QU'ON NE FAIT PAS : pub payante (marché trop petit, le réseau 
est gratuit et plus puissant), communication large avant liquidité 
(un remplaçant qui arrive sur une plateforme vide ne revient jamais).

MÉTRIQUE DE SUIVI (Sonnet, hebdo, via TraceEvent) : nombre de 
remplaçants/assistants inscrits, dont actifs (≥1 disponibilité 
publiée), par canal d'origine si identifiable. Cible d'amorçage : 
15-20 candidats actifs face aux ~46 cabinets du palier 1.
```


---

## 🟡 SPRINT 2 — CORRECTIFS DE LA VAGUE 1 (semaine du 03/08)
**Contenu défini par les retours du Sprint 1. Pré-alimenté avec les non-bloquants déjà connus :**

- Points 2-3 de §160 si non confirmés (opt-out consultation aligné
  emailOptIn, linkUrl/wording candidat)
- Wording "candidater" page publique dispo candidat (§161)
- Champs éditables in-app clauses contrat (§166 — Opus liste d'abord
  TOUS les placeholders des 3 templates, JC valide, puis implémentation)
- Partage WhatsApp texte pré-rempli (§167 — niveau 1, gratuit)
- Confirmation candidatures : petites frictions remontées par les testeurs

---

## 🟡 SPRINT 3 — CONVERSION & ACTIVATION (semaine du 10/08)
**Objectif : préparer la transition vers le payant (palier 1 : 46 cabinets).**

- Activer enforceContractProfile (/admin/config) une fois les profils
  testeurs complétés — action JC, relancée par Sonnet
- Onboarding affiné selon les frictions observées (données TraceEvent)
- Emails de réactivation (candidat inactif, annonce sans candidature
  après X jours) — cron quotidien existant, contrainte Hobby respectée
- Métriques de conversion : combien de testeurs actifs → combien
  d'annonces → combien de matches → combien de contrats

---

## ⚪ SPRINT 4 — FINITION VISUELLE CANDIDAT (semaine du 17/08)
**Premier sprint où le gel se lève partiellement, si la bêta est stable.**

- §149 : photo Wikipédia illustrative + relief visuel texte annonce
- Design tokens du contraste candidat/titulaire (préparation §142,
  pas encore la refonte) : couleurs, typographie, composants verticaux
- Bulle contextuelle remplaçant (différée de longue date)

---

## ⚪ SPRINT 5 — LA GRANDE VERTICALE (à partir de fin août, si traction)
**Le chantier §142/170/171 : page unique timeline-centrique candidat.**

- Maquettes d'abord (benchmark §170 : Uber driver, Duolingo, Revolut,
  Indeed Flex — vertical, une chose à la fois)
- Prototype sur UN écran (la timeline verticale) avant de généraliser
- Le Planning titulaire ne change PAS (principe §171 :
  desktop-first titulaire / mobile-first candidat)

---

## 🔒 HORS SPRINTS — DÉBLOCAGES EXTERNES (au fil de l'eau)
- Share Dialog Facebook (§139) : dès que JC récupère l'accès Facebook
  Developers → App ID → prompt déjà prêt
- SMS/WhatsApp Business niveau 2-3 (§167) : réévaluer après 1 mois
  de bêta selon l'usage réel
- Templates PDF salariés CDD/CDI (§161) : seulement si les Structures
  le demandent ET après validation juridique
- Phase 4/5/Cession : inchangé, bloqué avis juridique

---

## TABLEAU DE DÉLÉGATION

| Tâche | Qui | Quand |
|---|---|---|
| Qualifier les retours, rédiger les prompts, documenter | **Sonnet** | En continu |
| Relancer JC sur les tests/actions en attente | **Sonnet** | Chaque session |
| Tenir PRODUCT_SPEC.md + ROADMAP.md à jour | **Sonnet** | Après chaque livraison |
| Implémenter, migrer, vérifier en prod | **Opus** | Sur prompt |
| Rapporter avant de coder (investigations) | **Opus** | Systématique |
| Décisions produit, tests terrain, INPI/GSC/admin | **Jean-Charles** | Sprint 0 puis hebdo |
| Synthèse hebdo de la bêta | **Sonnet** | Chaque lundi |
| Messages types + posts d'annonces acquisition (§1.b) | **Sonnet** | Sprint 1, puis au fil des annonces |
| Prospection directe remplaçants (Physiorama, ~1h/jour) | **Jean-Charles** | Sprint 1-2 |

---

## LES 3 CORRECTIONS DE MÉTHODE (résumé de l'audit du 21/07)

1. **Le gel** : la bêta a reculé 4 jours parce que chaque session de test
   générait des features construites le jour même. Le gel force les idées
   vers la Phase 3. Sonnet est gardien de cette règle.
2. **La checklist de chaîne** : les 2 bugs critiques (§152, §161) avaient
   la même cause — un type ajouté sans audit aval. Checklist obligatoire
   dans tout prompt touchant un type/enum/acteur.
3. **La relance systématique** : le test assistant↔poste a été repoussé
   3 jours au profit de tâches plus petites. Sonnet relance tout point
   "à tester par JC" à chaque session, sans exception.
