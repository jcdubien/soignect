# SOIGNECT — PRODUCT SPEC (reconstruction du 26/07/2026)

## ⚠️ NOTE DE CONTINUITÉ IMPORTANTE

```
Le fichier PRODUCT_SPEC.md original (sections 1 à ~200, couvrant 
juin à juillet 2026) a été perdu suite à un incident technique côté 
outils de Claude (Sonnet) le 24/07. Le contenu historique détaillé 
existe toujours dans l'historique de la conversation Claude.ai 
d'origine, mais n'a pas été reconstitué mot pour mot ici pour éviter 
d'introduire des erreurs de mémoire.

CE DOCUMENT REPART SUR UNE BASE SAINE : un état consolidé du produit 
tel qu'il est RÉELLEMENT en production aujourd'hui (vérifié via les 
rapports de Claude Code/Opus, pas reconstruit de mémoire), suivi de 
la documentation de chaque nouvelle session à partir de maintenant.

Pour l'historique complet des décisions passées (pourquoi telle 
règle métier, quelles hypothèses testées et rejetées), se référer à 
l'historique de conversation Claude.ai — accessible à Jean-Charles.
```

---

## ÉTAT CONSOLIDÉ DU PRODUIT — 26/07/2026

### Sprint 0 : ✅ TERMINÉ À 100% CÔTÉ TECHNIQUE

Tous les items de sécurité pré-diffusion, bugs bloquants, et 
fondations sont livrés et vérifiés en production.

### Sécurité & infrastructure

```
- Audit permissions API complet : 8/8 failles corrigées, dont 2 
  critiques (fuite de données PII/facturation via routes ouvertes 
  sans authentification)
- Rate-limiting DeepSeek : 200 appels/utilisateur/jour, 3000/jour 
  global, repli neutre si dépassement (jamais de blocage utilisateur)
- Tableau de bord admin /admin/deepseek (fuseau Guadeloupe)
- Sentry en production, capture réellement des erreurs (5 issues 
  détectées et corrigées dès la première semaine — voir bilan ci-dessous)
- Lien "Signaler un problème" câblé dans l'app
```

### Bilan Sentry — 5 premières issues (preuve que le monitoring fonctionne)

| Issue | Nature | Statut |
|---|---|---|
| NEXTJS-1 | Self-test volontaire | Faux positif, à résoudre manuellement |
| NEXTJS-2 | P1017 — connexion pooler DB fermée (/api/notifications) | Corrigé (53d0465) |
| NEXTJS-3 | P2000 — bioTinder trop long à l'inscription | Corrigé + migration prod (1c5f396) |
| NEXTJS-4 | SyntaxError JSON (formulaire annonce) | Corrigé (b3f8a72) |
| NEXTJS-5 | P2000 — pitch trop long (annonce cabinet) | Corrigé + migration prod (b3f8a72) |

**Leçon transverse retenue** : des colonnes DB en VarChar avaient une limite inférieure au plafond réellement autorisé côté formulaire/validation Zod. Balayage complet effectué — toutes les colonnes d'accroche (bioTinder/pitch) alignées à 700 caractères. Point de vigilance permanent : toute nouvelle migration Prisma doit être appliquée **manuellement** en prod (le build Vercel ne fait pas `migrate deploy` automatiquement).

### Cycle de vie des matches (3 états)

```
- Contrat signé des deux côtés -> sort de la liste "Relations" 
  active, reste accessible via la timeline (clic sur la période)
- Fiche /match/[id] autonome avec chat intégré
- Notifications de message renvoient directement vers 
  /match/[id]?chat=1 (ouverture directe de la conversation)
- Une annonce/disponibilité matchée disparaît du feed de TOUS les 
  autres utilisateurs (filtre NO_ACTIVE_MATCH)
```

### Parcours candidat/assistant

```
- Bug "publier disponibilité grisé" + timeline vide -> corrigé 
  (dates obligatoires remplaçant)
- Assistant "sans dates" -> vue dédiée AssistantDispoView, minMonths 
  requis, édition accroche
- Menu rapide timeline : ancrage du tap mobile corrigé, plage 
  éditable, mécanisme de blocage unifié
- État vide du swipe : espace vide sous les cartes corrigé
```

### Contrat

```
- Clauses négociables éditables in-app (mode de paiement, délai, 
  modalités)
- Slider de taux de redevance élargi 10-50% (cas réels sous 20% 
  couverts)
```

### UI/UX & cohérence

```
- Préfixe accroche différencié : "Je propose" (cabinet) vs 
  "Je recherche" (candidat)
- Logo : damier de transparence retiré, vraie transparence
- Accroche : retour à la ligne forcé (bug de coupure au bord corrigé)
- Badges de candidatures en attente/confirmée rendus fiables
- Badge "Vérifié RPPS" : ne s'affiche plus à tort si la vérification 
  échoue réellement
- Email "a consulté votre annonce" -> lien direct vers l'annonce du 
  visiteur
- Menu "Choisir la mission cible" ne ferme plus la fiche prématurément
```

### Facebook — Share Dialog

```
Codé mais DERRIÈRE UN FLAG (NEXT_PUBLIC_FACEBOOK_SHARE_ENABLED), 
inactif tant que la configuration Meta (App Domains, passage en 
mode Live) n'est pas finalisée côté Jean-Charles.
```

---

## ACTIONS JEAN-CHARLES EN ATTENTE (à relancer chaque session)

```
1. connection_limit=1 sur DATABASE_URL (Vercel) — mitigation racine 
   du problème de pooler DB (NEXTJS-2). PAS ENCORE FAIT.
2. ANS_API_KEY sur Vercel — sans ça, la vérification RPPS ne 
   fonctionne pas réellement (juste l'affichage a été corrigé pour 
   ne plus mentir, mais la fonctionnalité reste inactive tant que 
   la clé manque). PAS ENCORE FAIT.
3. Sentry DSN — FAIT, monitoring actif.
4. Facebook — App Domains soignect.vercel.app + basculer l'app en 
   mode Live + variable NEXT_PUBLIC_FACEBOOK_SHARE_ENABLED. Bloqué 
   sur l'accès Meta Developers de Jean-Charles pour l'instant.
5. Résoudre/archiver manuellement l'issue Sentry self-test (NEXTJS-1) 
   dans le dashboard Sentry.
6. Toujours en attente : dépôt INPI "Soignect", réservation du 
   domaine soignect.fr, soumission du sitemap à Google Search Console.
```

---

## DÉCISIONS PRODUIT OUVERTES (non bloquantes)

```
- Expéditeur des emails -> passer à noreply@soignect.fr une fois le 
  domaine vérifié dans Resend
- Faut-il nommer explicitement le visiteur dans le mail de 
  consultation (aujourd'hui anonymisé "Un cabinet/remplaçant") ?
- Redirection post-publication côté remplaçant : rester sur 
  /annonces (nudge réciprocité) ou atterrir sur /disponibilites ?
- Point mineur : l'inscription ne borne pas bioTinder différemment 
  par type de profil côté serveur (280 candidat souhaité vs limite 
  actuelle uniforme) — à trancher si jugé important
```

---

## RÉFÉRENCES DE SECTIONS UTILISÉES DANS LES COMMITS RÉCENTS

```
Ces numéros de section sont ceux utilisés par Claude Code dans ses 
commits/rapports de cette session — à noter pour la cohérence des 
futurs renvois, même s'ils ne correspondent pas exactement à la 
numérotation historique perdue :

§178 — Menu rapide timeline (ancrage tap, plage éditable)
§179 — Assistant sans dates (vue dédiée)
§180 — Mail de consultation (lien direct visiteur)
§183 — 3e état du cycle de vie des matches
§184 — Exclusion du feed pour les missions déjà matchées
§185 — Menu "Choisir la mission cible" + badge RPPS
§186 — Résilience VarChar/Zod (leçon Sentry)
```

---

## PROCHAINE ÉTAPE

```
Sprint 0 est clos côté technique. Il ne reste que les 6 actions 
Jean-Charles listées ci-dessus (2 techniques/config Vercel, 1 
Facebook, 1 Sentry housekeeping, 2 administratif INPI/domaine) 
avant de considérer la porte de la bêta complètement fermée.

Voir PLAN_PASSATION_SPRINTS.md pour le séquençage des sprints 
suivants (Sprint 1 : écoute active bêta + acquisition candidats).
```

---

## RATTACHEMENT POSTE↔ASSISTANT — Clarification vérifiée (26/07)

### Question posée par Jean-Charles

```
Un poste ouvert par un titulaire propose-t-il l'envoi automatique 
d'un email d'invitation à créer un compte (pré-rempli, complété des 
deux côtés), ou faut-il que l'assistant ait déjà un compte créé au 
préalable pour pouvoir le rattacher ?
```

### Réponse vérifiée par Claude Code (lecture seule, code exact)

```
DEUX chemins de rattachement existent, TOUS DEUX exigent que 
l'assistant ait DÉJÀ un compte Soignect de type ASSISTANT :

1. MANUEL (POST /api/cabinet-posts/[id]/link) : le titulaire 
   recherche un compte existant par email. Si l'email ne correspond 
   à aucun compte -> 404 "Aucun compte trouvé pour cet email", 
   AUCUN email n'est envoyé. Si le compte existe mais n'est pas 
   ASSISTANT -> 422. Réservé au titulaire propriétaire du poste.

2. AUTOMATIQUE À LA SIGNATURE (attachAssistantPostForMatch, 
   src/lib/assistantPost.ts) : utilise le userId de l'assistant déjà 
   inscrit qui a matché puis signé un contrat.

CONFIRMÉ : AUCUN mécanisme d'invitation par email n'existe pour un 
non-inscrit. Recherche exhaustive faite (routes cabinet-posts, 10 
fonctions d'email existantes, recherche de tokens/flux de 
pré-inscription) — rien trouvé. C'est un vrai gap fonctionnel, pas 
une confusion de ma part.
```

### Statut

```
✅ DÉCISION (26/07) : Jean-Charles confirme vouloir construire ce 
flux d'invitation par email maintenant. Prompt complet rédigé 
(schéma PosteInvitation, route /invite, email dédié, adaptation du 
flux d'inscription avec inviteToken, rattachement auto à la 
finalisation) — en attente d'envoi à Claude Code.
```

---

## BUG (a verifier) — Annonce postee sur poste "Assistant 1" n'apparait pas sur sa timeline (26/07)

### Constat (capture a l'appui)

```
Jean-Charles a clique sur la timeline du poste "Assistant 1" (Planning 
titulaire, Cabinet des ravines, alerte "sans couverture dans 9 
semaines" visible) pour poster une annonce. Rien n'apparait ensuite 
sur la timeline de ce poste.
```

### Statut

```
🟡 Prompt de verification (pas de conclusion prematuree, lecon de 
la section 177) rédigé, en attente d envoi.
```

---

## BUG — Annonce postee depuis timeline "Assistant 1" (Planning cabinet) n'apparait nulle part

### Constat (26/07, capture a l'appui)

```
Jean-Charles a clique sur la zone timeline du poste "Assistant 1" 
(rattache, Confirme) pour poser une annonce couvrant le trou detecte 
("sans couverture dans 9 semaines"). Rien n'apparait apres creation 
- ambigu si c'est sur la ligne Planning cabinet elle-meme, ou sur la 
page /disponibilites du compte assistant rattache, ou les deux.
```

### Statut

```
🔴 Prompt de diagnostic rédigé, insistant sur la verification en 
conditions reelles (donnees) avant conclusion - en attente d'envoi.
```

---

## CHAMPS MANQUANTS IDENTIFIÉS PAR ANALYSE D'ANNONCES RÉELLES (27/07)

### Méthode

```
Analyse de 5 annonces réelles récentes du groupe Facebook 
"Kinésithérapeutes de Guadeloupe" (+ 1 Mayotte) : Pointe-à-Pitre 
(sept, MDT/McKenzie), Mayotte/Labattoir (congé maternité long), 
Petit-Canal (domicile exclusif, congé maternité), Marie-Galante 
(cabinet 6 kinés), Le Gosier (Natacha, oct-nov).

Objectif : comparer ce que les titulaires annoncent SPONTANÉMENT 
avec ce que le formulaire Soignect capture aujourd'hui.
```

### Constat stratégique transverse

```
Les 5 annonces sont des CABINETS QUI CHERCHENT. Aucun remplaçant ne 
se propose. Même signal que l'étude Physiorama (zéro demande côté 
candidats), sur un canal totalement différent — confirme que le côté 
rare est bien le candidat, et que ces groupes servent à toucher des 
candidats qui LISENT sans poster.
```

### Champs récurrents absents du formulaire actuel

```
1. VÉHICULE MIS À DISPOSITION — 3 annonces sur 5, systématiquement 
   collé au logement : "ma voiture au besoin", "logement et véhicule 
   sécurisés", "logement et voiture à votre disposition". Le modèle 
   a logementPropose mais PAS de véhicule. Pour un métropolitain qui 
   débarque, c'est au même niveau que le logement dans la décision.
   → Champ booléen (+ éventuellement précision), même traitement que 
     logementPropose (bonus dans le score, affichage carte).

2. DEMI-JOURNÉES / JOURS LIBRES PAR SEMAINE — 4 annonces sur 5 : 
   "3 demi-journées de libre", "3 après-midi par semaine pour 
   profiter du lagon", "3,5 jours de travail par semaine", "2 
   demi-journées de libre" (Natacha). Critère de qualité de vie 
   annoncé spontanément par tous, absent du formulaire.
   → Champ numérique simple (nb de demi-journées libres/semaine).

3. CA ESTIMÉ — "CA d'environ 8000e, rétro à 25%" (Mayotte). Les 
   titulaires publient déjà leur CA d'eux-mêmes. Valide fortement le 
   calculateur de revenu net (piste B4) : la donnée d'entrée existe 
   déjà dans la tête des annonceurs, il suffit de la structurer.
   → Champ numérique optionnel (CA mensuel estimé).
```

### Points secondaires relevés

```
- Répartition cabinet/domicile annoncée dans 4 cas sur 5 ("pas de 
  domicile", "exclusivement à domicile", "4 matinées à domicile et 
  3 aprem au cabinet") — recoupe le taux différencié cabinet/domicile 
  déjà noté (§179).
- Méthode/approche demandée : "préférence pour quelqu'un avec une 
  approche active type MDT (McKenzie)" — alors que les spécialités 
  avaient été retirées du score de matching. À reconsidérer : peut-
  être pas dans le score, mais au moins comme information affichée.
- Autres éléments cités spontanément, non prioritaires : équipement/
  plateau technique (m², climatisation, nb de salles), logiciel 
  utilisé (Vega), taille de l'équipe (6 kinés, "toujours 2 kinés au 
  cabinet"), motif du remplacement (congé maternité dans 2 cas sur 5).
- Ton des annonces réelles : chaleureux, emojis, invitation 
  personnelle ("Bienvenue à Marie-Galante", "Caribou Maore"), 
  téléphone direct. L'accroche 700 signes doit encourager ce registre.
```

### Statut

```
🟡 Prompt rédigé pour les 3 champs prioritaires (véhicule, 
demi-journées libres, CA estimé) — en attente d'envoi.
```

---

## REFONTE MAJEURE — Saisie d'annonce en texte libre + assistance IA (27/07)

### Décision produit de Jean-Charles

```
Abandonner la logique "formulaire à multiples cases à cocher" au 
profit d'UN SEUL CHAMP TEXTE + assistance IA. Argument fort : les 
5 annonces réelles analysées (groupe Facebook) sont des textes 
libres où les titulaires mettent spontanément TOUT ce qu'il faut. 
Le formulaire actuel leur demande de désosser leur geste naturel.
```

### Synthèse retenue : extraction plutôt que remplacement pur

```
Ni tout-formulaire, ni tout-texte-libre : l'utilisateur écrit UN 
texte (ou colle son annonce Facebook existante), DeepSeek EXTRAIT 
les champs structurés, l'utilisateur CONFIRME.

Bénéfice majeur d'acquisition : un titulaire qui a déjà rédigé son 
annonce Facebook la colle et son annonce Soignect est faite. 
Friction d'entrée quasi nulle. Différenciateur que personne d'autre 
n'offre.

CHAMPS QUI RESTENT STRUCTURÉS (non négociable) :
- Type de poste (détermine le template de contrat)
- Dates début/fin (sans elles, invisible sur timeline — bug déjà 
  vécu, ne pas régresser)
- Zones géographiques (filtrage du feed)
- Taux de rétrocession (imposé par JC)
- CA mensuel estimé (imposé par JC)
Ces 5 peuvent être PRÉ-REMPLIS par extraction mais doivent exister 
comme données confirmées.

GARDE-FOU ABSOLU : l'IA n'invente jamais une valeur absente du 
texte. Un taux de rétrocession halluciné finirait dans un contrat 
PDF = risque juridique. Champ vide si l'info n'y est pas.
```

### Trois assistances demandées

```
1. TITRE AUTO-PROPOSÉ : localisation + type de poste + 1-2 
   caractéristiques fortes. Proposé, jamais imposé.
2. BOUTON "AIDE À LA RÉDACTION" : s'appuie sur les PROPRES annonces 
   précédentes de l'utilisateur (missions passées) comme référence 
   de style/contenu.
3. BOUTON "OPTIMISER MON ANNONCE" : 1 à 3 suggestions concrètes 
   d'ajouts manquants, ADAPTÉES AU RÔLE — côté cabinet = 
   attractivité (logement, véhicule, demi-journées, plateau, CA) ; 
   côté candidat = sécurisation de sa démarche, ne rien oublier.
```

### Contraintes techniques posées

```
- Réutiliser le rate-limiting DeepSeek existant, dégradation 
  gracieuse si plafond atteint (formulaire manuel jamais bloqué)
- Chaque assistance = appel IA distinct sur action explicite (pas 
  d'appel à chaque frappe : coût + latence)
- Parcours manuel complet conservé en repli
- Appels DeepSeek côté serveur uniquement (règle existante)
- Claude Code doit RAPPORTER son architecture AVANT de coder — 
  c'est une refonte de parcours, pas un ajout de champ
```

### Statut

```
🟡 Prompt rédigé, en attente d'envoi. Note : cette refonte absorbe 
en partie le prompt "3 champs manquants" (véhicule, demi-journées, 
CA) — ces champs deviennent des cibles d'extraction plutôt que des 
cases à cocher supplémentaires. À arbitrer : envoyer les deux 
(champs d'abord, refonte ensuite) ou seulement la refonte.
```

---

## AUDIT PRODUCTION — 27/07 (réalisé en session live, données vérifiées)

### Méthode

```
Audit mené directement dans la session Jean-Charles sur 
soignect.vercel.app (prod), pages /missions/create, /annonces, 
/planning, /matches, /compte. Mesures DOM réelles, pas 
d'appréciation de mémoire.

NON AUDITÉ : parcours candidat en conditions réelles (nécessiterait 
une session candidat ouverte par JC — Claude ne saisit jamais 
d'identifiants) ; rendu mobile réel (l'outil ne redimensionne pas 
fidèlement le viewport).
```

### Ce qui tient debout

```
Tous les parcours en place et fonctionnels. La refonte texte libre 
+ assistance IA est DÉJÀ EN PRODUCTION et bien exécutée :
- Placeholder pédagogique reprenant exactement les champs extraits 
  des vraies annonces Facebook (rétro, CA, logement, voiture, 
  demi-journées)
- 3 boutons présents : Analyser le texte / Aide à la rédaction / 
  Optimiser mon annonce
- Repli manuel conservé ("Vérifier / compléter les champs à la main")
- Préfixe "Je propose…" corrigé côté cabinet
Le /missions/create qui redirigeait vers /login était une course de 
session au chargement, pas un bug — non reproduit.
```

### Findings

```
1. 🔴 INCOHÉRENCE /annonces — "Aucun candidat à afficher pour 
   l'instant" affiché ALORS QUE la section "DERNIÈRES ANNONCES 
   CONSULTÉES" juste au-dessus liste 2 candidats réels ("Je cherche 
   un poste d assistant", "ASSISTANT RECHERCHE UN POSTE", toute la 
   Guadeloupe). Probablement correct logiquement (déjà swipés donc 
   exclus du feed) mais se lit comme un bug — et c'est l'écran où 
   JC vient vérifier si sa campagne a produit quelque chose.

2. 🔴 DESKTOP EN COULOIR — mesure DOM : viewport 1280px, colonne de 
   contenu 430px sur /missions/create. Pattern général de l'app 
   (seul le Planning y échappe, tabulaire par nature). Contredit le 
   principe desktop-first titulaire (côté payant). La proposition 
   deux colonnes de JC n'est pas un confort mais le correctif d'un 
   problème systémique.

3. 🟠 "Dates bloquées" (mission INDISPONIBLE) apparaît dans 
   "Dernières annonces consultées" — erreur de catégorie, une 
   indisponibilité n'est pas une annonce consultable.

4. 🟠 VOCABULAIRE À TROIS TÊTES pour une seule notion : navigation 
   "Relations" / titre de page "Mes mises en relation" / tray "VOS 
   MISES EN RELATION" + "VOS CHOIX" / route /matches. Charge mentale 
   gratuite pour un produit dont la promesse est la simplicité.

5. 🟡 Typographie : "en toute liberté— dates" (espace manquante 
   avant le tiret cadratin) sur /missions/create.

NON-FINDING (vérifié, pas un bug) : la nav "Relations" pointe bien 
vers /matches. Le 404 sur /relations venait d'une URL devinée par 
Claude, pas d'un lien cassé de l'app.

CORRECTION JC (27/07) : CA et rétrocession NON obligatoires — 
conseillés seulement. Cohérent avec le terrain (1 annonce sur 5 
publie son CA). Les rendre bloquants ferait fuir des titulaires. 
À encourager via le bouton "Optimiser mon annonce" plutôt qu'à 
imposer.
```

### Observation notable

```
2 candidats assistants sont maintenant présents en base, alors que 
le 24/07 Claude Code n'en trouvait AUCUN d'actif. Quelque chose a 
bougé — à vérifier si ce sont de vrais utilisateurs (effet de la 
communication de JC) ou des comptes de test.
```

---

## VISION — Multiples points d'entrée adressés par cible (27/07)

### Constat déclencheur

```
Aujourd'hui, tout lien externe (post Facebook, etc.) mène vers 
/login — une porte de service sans argument, sans preuve, sans 
réponse à "pourquoi moi, pourquoi maintenant". Un seul point 
d'entrée pour des cibles aux besoins radicalement différents.
```

### Décision de cadrage

```
DES PORTES DIFFÉRENTES, PAS DES NOMS DIFFÉRENTS. La vision 
multi-marque (section 185, différée) reste hors sujet ici : "Soignect" 
n'est même pas encore déposé à l'INPI, créer plusieurs identités 
maintenant serait une dilution avant l'établissement de la marque 
mère. Une seule marque, plusieurs pages d'entrée adressées, qui 
débouchent toutes sur la même inscription — en PRÉ-SÉLECTIONNANT le 
type de profil (gain d'usage, pas seulement marketing).
```

### Cibles identifiées et leur douleur spécifique

```
- Titulaire Guadeloupe : veut arrêter de galérer à trouver quelqu'un
- Remplaçant local : veut voir ce qui se passe près de chez lui
- Remplaçant métropolitain : ne cherche pas un poste, cherche une 
  aventure sécurisée (logement, véhicule, à quoi ressemble la vie 
  là-bas) — PRIORITÉ, cible la plus rare et la plus différenciante
- Jeune diplômé : l'Avenant 7 ferme l'installation directe en 2027, 
  le remplacement devient sa porte d'entrée obligée, personne ne le 
  lui explique clairement
- Établissement : cherche du salarié, ne se reconnaît dans aucun des 
  discours ci-dessus
```

### Pages envisagées (une seule construite pour l'instant)

```
- /venir-en-guadeloupe (métropolitain) — PRIORITAIRE, en cours
- /assistanat (jeune diplômé, argument réglementaire 2027)
- /cabinets (titulaire)
- /etablissements (salariat)
```

### Bénéfice secondaire

```
Chaque porte devient un point de mesure. TraceEvent déjà en place — 
permet enfin de savoir quel canal produit des inscriptions, ce qui 
est impossible aujourd'hui avec un point d'entrée unique.
```

### Discipline de séquencement

```
Une seule page construite d'abord (métropolitain), mesurée, puis 
généralisation SEULEMENT si conversion prouvée. Rappel du risque 
déjà vécu : lancer plusieurs chantiers d'un coup a fait reculer la 
bêta de 4 jours (audit du 21/07).
```

### Statut

```
✅ Prompt complet rédigé et remis à Jean-Charles pour envoi (27/07). 
Cumulé dans PROMPTS_EN_ATTENTE.md (B7). Contrainte de portée explicite 
dans le prompt : une seule page construite, pas les 3 autres, pas de 
nom de marque distinct.
```

---

## BUG PROD (Sentry) — Suppression Mission echoue si Swipes existants

### Constat (29/07, capture Sentry)

```
PrismaClientKnownRequestError sur prisma.mission.delete() :
Foreign key constraint violated: Swipe_swipedMissionId_fkey

Une Mission ayant recu au moins un Swipe (meme sans match/contrat) 
ne peut pas etre supprimee - contrainte FK. Le garde-fou existant 
(missions liees a un contrat confirme) ne couvre visiblement pas ce 
cas plus courant et plus large : une annonce simplement swipee, sans 
meme avoir matche.

Premiere vraie erreur de prod remontee par Sentry hors du lot deja 
connu (NEXTJS-1 a 5) - preuve continue que le monitoring sert.
```

### Statut

```
🔴 Prompt rédigé, en attente d'envoi. A prioriser vu que ca touche 
une fonctionnalite courante (suppression d'annonce).
```

---

## RECONSTITUTION — Stratégie marketing & différenciation (reconstruite le 29/07, gap identifié post-incident du 24/07)

> Cette section reconstitue le contenu perdu lors de l'incident de 
> fichier. Contrairement au reste du document (état consolidé sans 
> détail historique), ces éléments méritent d'être conservés dans 
> leur substance complète — ce sont des décisions stratégiques 
> réfléchies, pas des faits d'implémentation.

### A. Neuf pistes de différenciation produit (acquisition remplaçants/assistants)

```
Contexte : les remplaçants/assistants ont déjà plethore d'offres 
disponibles (Physiorama, Facebook) — il faut un vrai différenciateur 
produit, pas juste plus de canaux de diffusion.

1. "GLASSDOOR DU CABINET" — avis/notation post-mission entre pairs. 
   Infrastructure déjà partiellement existante (routes 
   /api/recommendations/{cabinet,remplacant}, scores ponctualité/
   qualité soins/accueil/matériel/contrat/ambiance déjà dans le 
   schéma). Transparence avant engagement = argument unique sur ce 
   marché. Prompt de construction déjà rédigé (voir PROMPTS_EN_ATTENTE 
   historique).

2. GARANTIE DE RÉPONSE — badge "Cabinet réactif, répond sous 48h". 
   Traite la frustration du silence après candidature. Incite le bon 
   comportement cabinet.

3. CALCULATEUR DE REVENU NET ESTIMÉ — comparer deux offres sur une 
   base chiffrée (taux rétro + logement inclus ou non). Validé par le 
   terrain : une annonce réelle (Mayotte) publie déjà son CA 
   spontanément ("CA d'environ 8000e, rétro à 25%").

4. "KIT REMPLACEMENT TOURISTE" — fiche pratique par zone (coût de la 
   vie, transport, activités). Réduit l'anxiété du métropolitain qui 
   hésite entre la Guadeloupe et une région plus proche. Travail de 
   CONTENU d'abord, pas seulement de code.

5. BADGE "CERTIFIÉ CPTS" (PAS "recommandé SNMKR" — corrigé le 24/07 : 
   aurait semblé être Jean-Charles se recommandant lui-même, étant 
   président du syndicat). CPTS = structure multi-professionnelle 
   plus neutre. CONDITIONNÉ à un vrai financement/partenariat CPTS 
   réel — pas un badge marketing sans substance. Rejoint le "Soignect 
   Territoire" (produit institutionnel CPTS/MSP, ~99€/mois, identifié 
   très tôt dans le projet). Recommandation : attendre des résultats 
   concrets de bêta avant d'aller demander ce partenariat — argument 
   plus solide qu'une idée sur papier. RETENU dans le plan, PAS 
   construit (seule des 9 pistes non lancée en code).

6. CONFIANCE BIDIRECTIONNELLE — indicateur de fiabilité côté CANDIDAT 
   (taux d'engagements honorés), symétrique à la piste 2. Les cabinets 
   craignent aussi les désistements de dernière minute.

7. ALERTE INSTANTANÉE DE CORRESPONDANCE — notification immédiate 
   quand une nouvelle annonce correspond aux zones/critères d'un 
   candidat, plutôt que d'attendre qu'il consulte le fil.

8. COMMUNAUTÉ DES REMPLAÇANTS GUADELOUPE — espace léger d'échange 
   entre pairs ayant déjà fait une mission ici, indépendant d'un 
   match précis. Transforme Soignect d'un outil transactionnel en 
   communauté avec effet de réseau.

9. CHECKLIST "PREMIER REMPLACEMENT EN GUADELOUPE" — spécificités 
   locales de pratique, démarches administratives. Travail de CONTENU 
   d'abord (rédaction par Jean-Charles).

DÉCISION DU 24/07 : gel levé consciemment pour les pistes 1-4 et 
6-9 (8 features), prompts rédigés pour toutes. Seule la piste 5 
(CPTS) reste en attente d'une vraie démarche institutionnelle.
```

### B. Vision multi-marque (nom variable par profession/région) — DIFFÉRÉE Phase 3+

```
Principe (23/07) : la plateforme reste techniquement unique (même 
backend), mais l'identité visuelle/nom varie selon deux axes :
- AXE PROFESSION : un nom différent par profession ciblée (kinés, 
  futurs médecins) plutôt qu'un seul nom générique pour tout le 
  monde. "Soignect" reste la marque ombrelle/technique.
- AXE RÉGION : branding spécifique Guadeloupe pour le lancement 
  (impression d'initiative locale), puis déclinaisons Martinique/
  Réunion (variations graphiques, même backend central).

Raison d'être : renforcer l'ancrage local perçu, cohérent avec la 
stratégie d'acquisition (crédibilité personnelle de Jean-Charles 
dans son réseau SNMKR/CPTS) — une marque qui "sent" le local 
convertit mieux qu'une plateforme anonyme nationale.

Complexité réelle à anticiper (pas un pur cosmétique) : mécanisme de 
détermination du branding à afficher (sous-domaine, paramètre URL, 
détection région), cohérence dans emails/PDF/OG, protection INPI des 
noms secondaires, cohérence de navigation entre régions/verticales.

STATUT (27/07) : chantier de fond hors scope de la bêta en cours, 
nécessite une vraie session de conception avant tout développement. 
DISTINCT de l'accent visuel léger Guadeloupe (palette tropicale + 
colibri, sans drapeau — celui-là a été construit, voir plus bas 
dans l'historique récent) et DISTINCT des pages d'entrée multiples 
adressées par cible (construites en partie, voir section dédiée) — 
ces deux derniers points sont des solutions plus légères au même 
besoin, choisies délibérément à la place du multi-marque complet.
```

### C. Internationalisation (i18n) — DIFFÉRÉE Phase 3+

```
Principe (23/07) : beaucoup de jeunes kinés sont hispanophones, 
lusophones, germanophones, anglophones (mobilité européenne des 
professionnels de santé) — proposer des déclinaisons internationales 
de la plateforme.

Complexité réelle : traduction UI (infrastructure i18n à poser, 
next-intl ou équivalent) + POINT LÉGAL IMPORTANT — les templates de 
contrat (modèle CNOMK, droit français) doivent très probablement 
RESTER EN FRANÇAIS quelle que soit la langue de l'interface, avis 
juridique requis avant tout développement + formatage locale/SEO 
multilingue + coût de maintenance récurrent (chaque nouvelle feature 
à traduire dans toutes les langues actives).

STATUT : différée, à prioriser selon la demande réelle observée 
pendant la bêta (est-ce que des profils non-francophones se 
manifestent vraiment ?) plutôt que d'anticiper sans donnée.
```

### D. Modèle de pricing à la carte (façon Physiorama/LeBonCoin) — QUESTION OUVERTE

```
Rappel : le "Boost ponctuel concept" (paliers Silver/Gold/Platinum) 
était déjà identifié très tôt dans le projet comme item v1.1+ 
différé, jamais tranché.

Raisonnement (23/07) : l'abonnement mensuel (39-79€/mois) peut être 
dissuasif pour un titulaire avec un besoin PONCTUEL (un seul 
remplacement à pourvoir) — un modèle à la carte (payer pour booster 
UNE annonce précise) correspond mieux à ce cas d'usage.

Piste non tranchée : les deux modèles pourraient coexister — 
abonnement pour usage régulier, paiement à la carte pour usage 
occasionnel (comme LeBonCoin le fait). Nécessiterait un flux Stripe 
one-off distinct de l'abonnement existant.

STATUT : pas d'urgence — freeAccessMode actif, aucune facturation 
réelle en cours. Bon moment pour trancher : au Sprint 3 (Conversion 
& Activation), quand le palier 1 sera en vue. LIÉ au point E ci-dessous.
```

### E. Le palier 1 doit-il intégrer un seuil côté remplaçants, pas seulement les cabinets ? — QUESTION OUVERTE

```
Palier 1 actuel = 46 cabinets actifs (seuil de déclenchement de la 
facturation, freeAccessMode désactivé à ce seuil).

Tension identifiée (23/07) : ce seuil ne compte que les cabinets 
(côté payant = revenu potentiel), mais un cabinet qui paie sans 
jamais trouver de remplaçant churn immédiatement — la valeur réelle 
dépend de la liquidité côté candidats, pas du nombre de cabinets.

Métrique candidate déjà existante mais non connectée au palier 1 : 
le plan de passation fixe une cible d'amorçage de 15-20 remplaçants/
assistants actifs (Sprint 1, volet acquisition) — vit séparément du 
déclenchement facturation aujourd'hui.

Piste suggérée, non tranchée : palier 1 = condition DOUBLE ("46 
cabinets ET 15-20 remplaçants/assistants actifs") plutôt qu'un seul 
chiffre — garantit que la facturation ne démarre que si les cabinets 
payants ont une vraie chance de trouver quelqu'un.

STATUT : à trancher au même moment que le point D (pricing), 
probablement Sprint 3.
```

### F. Autres idées marketing capturées (différées, moins prioritaires)

```
- Archivage des contrats dans un espace dédié par compte (au-delà du 
  simple lien depuis la timeline) — Phase 3+
- Formulaire "1 pour 1" zones non prioritaires (transfert de 
  conventionnement) — interlocuteur confirmé CPAM (pas CDO, erreur 
  initiale corrigée), délai de 2 ans pour désigner un successeur. 
  Nécessite avis juridique avant automatisation. Emails RPS 
  confirmés pour DOM-TOM (rps@cgss-guadeloupe.fr, 
  rps@css-mayotte.fr) mais métropole utilise des formulaires web 
  (Dépot'doc), pas un email uniforme — complexité technique 
  supplémentaire si extension au-delà de la Guadeloupe.
```

---

## RÉCUPÉRATION D'UNE CONVERSATION ANTÉRIEURE — Fondations perdues retrouvées (29/07)

> ⚠️ CONTEXTE CRITIQUE : Jean-Charles a informé le 29/07 qu'il existait 
> une conversation Claude.ai ANTÉRIEURE à celle-ci (changée pour 
> limite d'upload de documents), dans laquelle le PRODUCT_SPEC 
> original a grandi de la section 1 à 98+ AVANT que la conversation 
> actuelle ne prenne le relais (qui a continué à partir de ~section 99 
> jusqu'à l'incident de perte de fichier). Recherché et retrouvé via 
> conversation_search. Ce qui suit reconstitue les piliers retrouvés — 
> une recherche exhaustive de TOUTES les sections 1-98 n'a pas été 
> faite (coût disproportionné), seulement les piliers marketing/business 
> demandés par Jean-Charles. D'autres éléments peuvent encore manquer.

### 1. AMBITION D'ORIGINE : NATIONALE, PAS GUADELOUPE-FIRST

```
Le projet est né avec l'ambition explicite d'être "le plus gros job 
board paramédical de France" (verbatim Jean-Charles), sur le modèle 
de Physiorama.com "en plus moderne, Tinder-like". La stratégie 
Guadeloupe-first qu'on traite depuis des semaines comme LE plan est 
en réalité une PHASE 1 PRAGMATIQUE de cette ambition plus large — 
pas la vision finale elle-même. Expansion prévue documentée dès 
l'origine : DOM-TOM → national → autres professions (infirmiers, 
orthophonistes, médecins).

Territoires prévus dès le MVP (au-delà de la seule Guadeloupe) : 
Saint-Martin et Saint-Barth (collectivités distinctes, marché kiné 
propre) — enum Region à vérifier si elle les inclut dans le schéma 
actuel.
```

### 2. LE VRAI DIFFÉRENCIATEUR D'ORIGINE : LA NOTATION (pas le matching)

```
"Différenciateur absolu" (verbatim du PRODUCT_SPEC original, §1) : 
notation des cabinets d'accueil par les remplaçants (PUBLIQUE) + 
évaluation des remplaçants par les cabinets (PRIVÉE, critères 
objectifs uniquement).

⚠️ CONTRAINTE JURIDIQUE VÉRIFIÉE ET STRUCTURANTE (recherche web faite 
à l'époque) : Article R.4321-99 du code de déontologie des 
masseurs-kinésithérapeutes interdit de "calomnier un autre, médire 
de lui, ou se faire l'écho de propos capables de lui nuire" — y 
compris sur les réseaux sociaux/plateformes numériques.

ASYMÉTRIE DE CONCEPTION VOULUE ET DOCUMENTÉE :
| | Notation CABINET (par le remplaçant) | Notation REMPLAÇANT (par le cabinet) |
|---|---|---|
| Visibilité | PUBLIQUE, visible de tous sans inscription | PRIVÉE, visible uniquement des cabinets premium |
| Commentaire libre | OUI, modéré (isPublished:false par défaut, validation admin) | NON — aucun champ de commentaire libre (évite la calomnie entre confrères) |
| Contenu | Score 1-5 + commentaire | Critères OBJECTIFS et FACTUELS uniquement (ponctualité, respect protocole, communication, tenue dossier patient) |
| Le remplaçant voit-il sa propre note ? | — | NON en V1 |

Règles métier associées : une notation ne peut être créée que si un 
Match existe entre les deux profils ; un profil ne peut noter qu'une 
fois par match (unicité matchId + authorId) ; scoreGlobal toujours 
recalculé côté serveur.

🔴 POINT DE VIGILANCE IMMÉDIAT : la feature "Glassdoor du cabinet" 
évoquée récemment dans cette conversation (piste de différenciation 
n°1, prompt déjà rédigé) mentionne des scores dans les deux sens 
(scorePonctualite, scoreQualiteSoins, scoreAccueil, scoreMateriel, 
scoreContrat, scoreAmbiance, trouvés lors de l'audit permissions) 
SANS que cette contrainte déontologique documentée ici ait été prise 
en compte explicitement. À VÉRIFIER EN PRIORITÉ : le système déjà en 
base respecte-t-il bien l'asymétrie (pas de commentaire libre côté 
notation du remplaçant, visibilité restreinte) ? Si un champ de 
commentaire libre existe côté notation candidat, c'est un vrai risque 
déontologique — particulièrement sensible pour Jean-Charles en tant 
que président du SNMKR Guadeloupe.
```

### 3. MODÈLE ÉCONOMIQUE — plus riche que ce qui était tracé récemment

```
Grille de monétisation d'origine (3 paliers implicites Free/Premium/Pro) :
- Annonce gratuite basique : gratuit sur tous les paliers
- Mise en avant d'annonce (boost) : 9€ / annonce → 9-19€ → 15-29€
- Abonnement recruteur Premium : 39€/mois → 49€/mois → 79€/mois
- Badge "Structure Certifiée" : — → 29€/mois → 49€/mois (attribué 
  aux structures au-dessus de 4/5 avec un minimum d'avis — incitation 
  à bien traiter les remplaçants)
- Publicité ciblée (formation, matériel) : CPM/CPC sur paliers 2-3
- Accès CVthèque remplaçants : 99€/mois (palier 3 uniquement)
- Partenariats syndicaux/institutionnels : forfait annuel (paliers 2-3)

Projections revenus (hypothèses basses) :
- M6 : 20 cabinets premium × 39€ + boosts ≈ 1 200€/mois
- M12 : 80 cabinets × 49€ + pubs + badges ≈ 5 500€/mois
- M24 : 400 structures × 79€ + CVthèque + partenariats ≈ 35 000€/mois
Seuil de rentabilité estimé : M8-M10 avec charges minimisées.

À RECONCILIER avec les questions ouvertes plus récentes (pricing à 
la carte façon Physiorama/LeBonCoin, palier 1 = 46 cabinets) — cette 
grille d'origine est probablement la base à partir de laquelle ces 
questions plus récentes doivent être tranchées, pas un sujet séparé.
```

### 4. MODULE CESSION & ASSOCIATION — entièrement spécifié à l'origine

```
Module premium avancé, jamais construit à ma connaissance, mais 
entièrement designé :

CADRE JURIDIQUE (vocabulaire validé) : ne JAMAIS dire "cession de 
conventionnement" (interdit) — dire "cession de droit d'accès à la 
patientèle" ou "cession d'activité libérale" ou "entrée en 
association".

TROIS CAS COUVERTS :
1. Cession complète d'activité (retraite, reconversion) — avec 
   estimation de prix AUTOMATIQUE basée sur CA moyen 3 ans × 
   coefficient zone APL (2.5 en très sous-dotée → 1.5 en non 
   prioritaire) + bonus équipement + bonus bail avantageux
2. Poste d'associé (SCM/SEL/SCP) — droit d'entrée, quote-part, 
   charges communes, conditions de sortie
3. Cession partielle de patientèle

Modèle Cession (Prisma) déjà spécifié en détail (voir conversation 
d'origine pour le schéma complet si besoin de le reconstruire).

Mention légale obligatoire sur chaque annonce : "Cette annonce 
concerne la cession de droit d'accès à la patientèle et/ou du 
matériel professionnel. Elle ne constitue pas une cession de 
conventionnement au sens du Code de la Sécurité Sociale [...] Faites 
valider les conditions par un expert-comptable et votre Ordre 
professionnel avant tout engagement."

Accès par plan : Gratuit = consultation seule ; Premium = 1 annonce ; 
Boost = illimité + estimation auto + mise en avant.

STATUT : conforme à la doctrine de prudence déjà appliquée ailleurs 
(🔒 nécessite avis juridique avant implémentation) — mais maintenant 
avec une vraie spec prête si/quand cet avis est obtenu.
```

### 5. TROIS LEVIERS DE LANCEMENT (stratégie d'origine, plus riche que le volet 1.b actuel)

```
LEVIER 1 — LE GROUPE FACEBOOK (actif immédiat)
Jean-Charles dispose d'un groupe Facebook kinésithérapeutes de 
10 000 membres (à distinguer du groupe "Kinésithérapeutes de 
Guadeloupe" plus petit utilisé récemment pour les tests — vérifier 
lequel est lequel, et si Jean-Charles en est administrateur/a un 
rôle particulier permettant publication croisée automatique).
Actions prévues : annonce officielle avec teaser vidéo 60s, bêta 
gratuite sur invitation (exclusivité), publication croisée 
automatique des annonces du site vers le groupe, sondages réguliers 
(collecte de données + engagement).

LEVIER 2 — LÉGITIMITÉ INSTITUTIONNELLE
SNMKR Guadeloupe : communication officielle, newsletter aux 
adhérents. CPTS Nord Basse-Terre : porte d'entrée vers les médecins 
et structures dès la V2 (cohérent avec le badge "Certifié CPTS" 
discuté récemment, section différenciation piste 5). Partenariats 
IFMK pour capter les jeunes diplômés (cohérent avec l'argument 
Avenant 7 2027 déjà identifié).

LEVIER 3 — SEO DÈS LE MVP
Pages dédiées par région ("Remplacement kiné Guadeloupe", "Emploi 
kiné Martinique"...), fiches établissements indexées (chaque cabinet 
= une page SEO), contenu blog ("Comment bien rémunérer son 
remplaçant", "Checklist accueil assistant").

POSITIONNEMENT DISCRET DU CABINET DE JEAN-CHARLES (prévu dès l'origine) :
Première position dans les résultats région Guadeloupe (sponsoring 
interne non visible), badge "Cabinet Fondateur", accès prioritaire 
aux candidatures avant publication publique. 
COHÉRENT avec ce qui a été effectivement implémenté plus tard dans 
le projet (desirabilityScore avec isFounding=true, score fixe à 10, 
section historique) — bonne nouvelle, cette intention d'origine a 
bien été honorée techniquement.
```

### 6. AUTRES ÉLÉMENTS FONDATEURS RETROUVÉS (résumé, non détaillés ici)

```
- Territorial algorithm vision (tension intra-territoriale vs 
  nationale) — sections 82-84 de l'ancien document
- Modèle institutionnel à 2 produits : Soignect Territoire (CPTS/MSP, 
  ~99€/mois) + futur Soignect Observatoire (ARS/CGSS, une fois les 
  données accumulées via TraceEvent)
- Principe des 2 langages visuels : sobre Material Design 3 pour les 
  titulaires (payants) vs engageant/visuel pour les remplaçants/
  assistants (moteur d'acquisition gratuit)
- Système de notation post-mission façon Airbnb : déclenchement J+1, 
  relances hebdomadaires jusqu'à J+30
- Limite de 10 messages dans le chat avant de forcer une décision 
  (contrat ou annulation)
- Question RPPS pré-remplie (façon annuaire Doctolib) — nuance 
  juridique déjà posée, avis RGPD/droit de la santé recommandé avant 
  implémentation

Ces éléments sont mentionnés pour mémoire — pas vérifiés un par un 
contre l'état actuel du code. À creuser si Jean-Charles le juge utile.
```

### RECOMMANDATION IMMÉDIATE

```
1. 🔴 PRIORITÉ : faire vérifier par Claude Code si la feature de 
   notation récemment esquissée/construite (piste "Glassdoor du 
   cabinet") respecte bien l'asymétrie déontologique documentée ici — 
   avant toute diffusion large qui exposerait ce risque à des vrais 
   utilisateurs
2. Clarifier lequel des deux groupes Facebook (10 000 membres 
   national vs "Kinésithérapeutes de Guadeloupe" plus local) est le 
   bon levier de lancement, et si Jean-Charles y a un rôle 
   administrateur permettant l'automatisation prévue à l'origine
3. Décider si l'ambition nationale doit rester présente dans la 
   documentation de vision (même différée), pour ne pas que la phase 
   Guadeloupe soit confondue avec l'objectif final par une future 
   session de travail (Sonnet notamment)
```

---

## SUIVI — Vérification déontologique du système de notation (29/07)

### Statut

```
🔴 URGENT — Prompt de vérification en lecture seule rédigé et remis 
à Jean-Charles pour envoi. En attente du rapport de Claude Code 
avant toute décision de correction. Voir point 2 de la section 
"RÉCUPÉRATION D'UNE CONVERSATION ANTÉRIEURE" ci-dessus pour le détail 
de la contrainte (article R.4321-99).
```

---

## BUGS PLANNING TITULAIRE — 29/07 (deux constats sur meme capture)

### 1. Modification dates absence non repercutee sur timeline

```
Clic sur segment "Conge" (ligne titulaire), modification des dates 
(17/08 -> 31/08), aucune mise a jour visuelle de la timeline apres 
enregistrement. A verifier : enregistrement reel en base vs probleme 
de rendu/cache client.
```

### 2. Aucun statut d'annonce visible sur la ligne titulaire pour son propre conge

```
Une annonce "Pointe-Noire, remplacement kine aout" existe (liee au 
conge de Jean-Charles) mais apparait seulement dans "ANNONCES NON 
RATTACHEES A UN POSTE", sans superposition visuelle sur la ligne 
"Jean-Charles DUBIEN (titulaire)" - contrairement aux postes 
d'equipe (Matheo) ou le statut de recrutement s'affiche bien en 
couche sur la timeline. A verifier si voulu ou oubli de couverture.
```

### Statut

```
🟡 Deux prompts rédigés, en attente d envoi.
```

---

## CLARIFICATION — Aucune action de match directe depuis notification de consultation (29/07)

### Constat

```
Clic sur notif "Un remplacant a consulte votre annonce" -> atterrit 
sur la page de l'annonce/dispo du remplacant (voulu, section 182) 
mais aucune action de match directe visible - juste "Voir et 
repondre a l'annonce ->". Cas concret : le remplacant (Julien 
Morisot) avait explicitement SWIPE interesse sur cette mission, pas 
juste consulte - Jean-Charles s'attend a pouvoir reciprocer 
directement et n'y arrive pas.
```

### Extension du 29/07 — même logique appliquée au canal email

```
Jean-Charles a etendu la meme observation au declenchement de 
l'EMAIL (pas seulement la notification in-app) : l'email actuel 
("Votre annonce a ete consultee") se declenche sur simple 
consultation, pas sur manifestation d'interet reelle (swipe). Meme 
question posee : ne faudrait-il pas declencher l'email specifiquement 
quand la personne swipe "interessee", avec un lien menant vers 
l'action de reciprocite plutot que vers sa recherche/son profil ?

Fusionne dans le meme prompt que la clarification in-app (meme 
evenement declencheur probable, les deux canaux doivent evoluer 
ensemble).
```

### Généralisation du 29/07 — principe de symétrie bidirectionnelle

```
Jean-Charles a pose le principe general qui sous-tend tout ce prompt : 
il y a TOUJOURS une annonce qui appartient a quelqu'un, et EN FACE 
une manifestation d'interet d'un tiers sur CETTE annonce precise - 
jamais deux annonces qu'on ferait matcher l'une contre l'autre. Ce 
principe doit s'appliquer SYMETRIQUEMENT dans les deux sens du 
matching :
- Cabinet publie un poste -> candidat swipe dessus -> le cabinet 
  reagit a l'interet sur SA propre annonce
- Candidat publie une disponibilite -> cabinet swipe dessus -> le 
  candidat reagit a l'interet sur SA propre disponibilite (meme 
  mecanique, pas une implementation separee)
```

### Statut

```
🟡 Prompt de clarification+feature rédigé (in-app ET email, dans 
les deux sens du matching), en attente d envoi.
```

---

## CLARIFICATION — Robustesse du match automatique en cas d'interet simultane (29/07)

### Question posée

```
Si un cabinet et un candidat swipent "interesse" l'un sur l'autre a 
peu pres au meme moment, le match automatique se cree-t-il de facon 
fiable dans tous les cas, y compris en cas de quasi-simultaneite 
(risque de concurrence/race condition) ? Les deux parties sont-elles 
bien notifiees dans tous les cas ?
```

### Statut

```
🟡 Prompt de verification rédigé, en attente d envoi. Question de 
solidite posee en amont, pas un bug constate.
```

---

## RAPPORT D'ACTIVITÉ OPUS — 28/07 → 03/08 (5 jours, 37 commits)

> ⚠️ Reçu le 03/08, alors que le suivi ci-dessus s'était arrêté au 
> 29/07 (Sprint 0.5). Beaucoup de prompts déjà cumulés dans 
> PROMPTS_EN_ATTENTE.md ont été traités en parallèle, hors du canal 
> de suivi habituel. Réconciliation faite ci-dessous.

### 🔴 DEUX POINTS CRITIQUES À RETENIR

```
1. LE TAUX DE RÉTROCESSION AFFICHAIT L'INVERSE DE SA VALEUR AU 
   CONTRAT (corrigé le 29-30/07). Pendant la fenêtre où ce bug 
   existait, un cabinet et un remplaçant ont pu voir un pourcentage 
   different de celui réellement écrit dans leur contrat PDF.
   ⚠️ ACTION REQUISE : demander à Opus de dater precisement la 
   fenetre du bug et de verifier s'il y a un ecart entre ce que les 
   parties croient avoir accepte et ce que le contrat dit, pour tout 
   contrat signe sur cette periode.

2. AGENDA PRIVÉ EXPOSÉ PUBLIQUEMENT (corrigé le 30/07) — toute ligne 
   de planning (absence, congé, présence) avait sa PROPRE PAGE 
   PUBLIQUE en HTTP 200, avec carte de partage nominative. 
   Maintenant : seules les annonces EN RECHERCHE sont publiques ; 
   l'image OG renvoie 404 hors annonce publique ; source unique pour 
   l'URL publique (lib/appUrl) sur emails/Stripe/sitemap.
```

### Réconciliation avec PROMPTS_EN_ATTENTE.md — prompts résolus

```
✅ B1 (design carrousel swipe mobile / textuel desktop) — fait
✅ B6 (fusion bioTinder + texte libre) — fait, avec 3 itérations sur 
   la place du titre avant stabilisation
✅ A4 (unification vocabulaire "mises en relation") — fait, + 
   "compte cabinet" plutôt que "titulaire" (au-delà de ce qui était 
   demandé, cohérent)
✅ B9 (modification dates absence non répercutée sur timeline) — fait
✅ B10 (statut annonce absent sur ligne titulaire pour son propre 
   congé) — fait
✅ Login jcdubien@gmail.com (Sprint 0.5, urgence #3) — cause 
   probable identifiée : normalisation email à la connexion (casse/
   espaces parasites faisaient échouer un mot de passe correct). 
   Corrige aussi les emails Resend en échec silencieux (le SDK ne 
   lève pas d'erreur sur refus) — possiblement liés à l'échec 
   d'emails de réinitialisation signalé par Jean-Charles.
🟡 B12 (match depuis notification consultation) — DIAGNOSTIC ET FIX 
   FAITS, PAS ENCORE COMMITÉS, en attente de vérification live. 
   Cause réelle : 3 verrous en série, pas juste un bouton manquant 
   (voir détail technique ci-dessous). Nouveau paramètre ?card=<id> 
   introduit, distinct de missionId. Julien MORISOT a swipé RIGHT 
   sur 3 annonces de Jean-Charles — le match est prêt à se produire 
   dès qu'un "Intéressé" réciproque est donné.
```

### Détail technique B12 (pour mémoire, une fois vérifié)

```
1. La notif menait à /annonce/<id> (page publique SEO) — sait 
   présenter, pas décider. Son seul CTA menait vers /annonces SANS 
   l'identifiant : cible perdue en route.
2. Le paramètre ?missionId= existant servait à tout autre chose 
   (présélection de LA PROPRE mission active de l'utilisateur dans 
   un sélecteur de chips) — y passer l'id d'un tiers aurait cassé ce 
   sélecteur, pas ouvert sa fiche.
3. Le feed appliquait un filtre de chevauchement de dates avec le 
   chip sélectionné (souvent une annonce périmée par défaut) — la 
   cible n'avait aucune chance d'apparaître dans le flux, même en 
   cherchant manuellement.

Fix : nouveau paramètre ?card=<id>, ouvre directement la fiche 
décisionnelle (MissionDetailSheet, Passer/Intéressé) hors feed, sans 
subir les filtres de dates. Libellé du CTA adapté au type de 
propriétaire de la fiche.
```

### Autres travaux notables (28/07-30/07)

```
- Planning : refonte du "siège du titulaire" en poste ordinaire 
  (migration cabinet_post_owner_seat, 2 phases avec garde-fou 
  intermédiaire) — les co-titulaires traités comme des assistants
- Fusion absence/annonce : publier sur une absence la transforme ; 
  gestion du retour en arrière sur une période publiée
- Suppression d'absence : refus si engagée dans une mise en 
  relation ; notification de l'autre partie au retrait d'une période
- Correction de "Qu'est-ce qui manque ?" qui réclamait des infos 
  déjà saisies
- Layouts desktop deux colonnes généralisés (création annonce, 
  matches, match, compte employeur) — au-delà du seul écran de 
  création initialement demandé
- Texte d'aide mobile recouvert par la pile de cartes — corrigé
```

### ⚠️ POINT À RÉCONCILIER — PRODUCT_SPEC.md réécrit par Opus le 30/07

```
Le rapport indique que Claude Code a réécrit le PRODUCT_SPEC.md du 
DÉPÔT (le vrai fichier, dans le code) "de fond en comble" le 30/07 : 
audit prod, vision des points d'entrée, bugs Sentry, fondations 
retrouvées. Ce document-ci (tenu dans cette conversation) a 
continué en parallèle, avec notamment la reconstitution des 
fondations marketing d'origine (section dédiée plus haut).

RISQUE DE DIVERGENCE : deux versions de PRODUCT_SPEC.md existent 
peut-être maintenant — celle du dépôt (réécrite par Opus, avec accès 
à l'historique git réel) et celle-ci (avec le contenu reconstitué de 
la conversation antérieure retrouvée). À réconcilier : demander à 
Opus de partager sa version du PRODUCT_SPEC.md pour comparaison, 
avant que Sonnet ne travaille sur une version incomplète.
```

### Suggestion d'Opus retenue

```
"Passe systématique sur chaque notification a-t-elle une action au 
bout ?" — les notifs message/match/signature pointent vers /matches 
et /match/<id>/contrat, a priori saines mais non vérifiées 
formellement. Bon réflexe après la découverte du bug B12 (même 
famille : notification qui alerte sans donner prise) — à ajouter au 
Sprint 1.
```

---

## SESSION LIVE — Vérification des correctifs B12 + suivi déploiement (03/08)

### Sécurité — action immédiate demandée

```
🔴 Un fine-grained token GitHub (droits ecriture sur le depot) a ete 
colle en clair dans la conversation avec Jean-Charles pour configurer 
git push local pour Claude Code. RÉVOCATION URGENTE DEMANDÉE tant 
que le token reste visible dans l'historique de conversation. 
Statut de revocation non confirme au moment de cette note.
```

### État du déploiement en cours

```
Push confirme (70c8544..6ef253a). Build Vercel identifie 
(oD5_95tzooi7PPOti3L2B) reste inchange apres ~10 min - plus une 
simple latence, investigation en cours cote tableau de bord Vercel.

Piste cron ecartee avec preuve (vercel.json ne declare qu'un cron 
journalier 0 9 * * *, autorise sur le plan Hobby) - pas la cause du 
blocage.
```

### Déjà vérifié, indépendant du déploiement

```
✅ Réparation du match en base CONFIRMÉE en prod : la fiche affiche 
desormais la bonne annonce (Kine Pointe-Noire, remplacant aout, 25% 
retrocession) au lieu de l'annonce de decembre. Le pourcentage 
affiche (23%) vient bien de Swipe.affinityScore (Match.aiScore reste 
a null) - coherent avec le correctif attendu.
```

### Reste à vérifier une fois le déploiement en ligne

```
1. Notif -> action (B12) : la notification de consultation doit 
   ouvrir directement la fiche de Julien avec Passer/Interesse, sans 
   passer par la page publique
2. Feed sans issue : le selecteur d'annonces doit rester affiche 
   meme quand le feed ne remonte personne, presélection ne doit plus 
   tomber sur une annonce perimee (2025)
3. Appariement : le match repare (aiScore a null, annonce d'aout) se 
   recalcule sur la bonne periode
```

---

## REFONTE DU SCORING — 03/08 (5 commits, deux vagues)

### Vague 1 — commit 979ccd8, trois chantiers de fond

```
1. DÉSIRABILITÉ RETIRÉE DU SCORE (pesait 10-15/100), déplacée dans 
   L'ORDRE DU FEED, avec disclosure explicite en langage clair : "les 
   comptes abonnés, partenaires et zones prioritaires apparaissent en 
   premier. Le score de compatibilité, lui, ne dépend d'aucun 
   abonnement." Bug corrigé au passage : le tri SQL ne lisait que la 
   colonne brute desirabilityScore, ignorant le plan d'abonnement, le 
   statut fondateur (isFounding) et les arbitrages admin.
   
   COHÉRENT avec l'intention d'origine retrouvée (section fondations, 
   "positionnement discret du cabinet de Jean-Charles" prévu dès la 
   genèse) - separer proprement la desirabilité du score de matching 
   la rend plus honnete sans la supprimer.

2. AFFICHAGE QUALITATIF au lieu de chiffré côté utilisateur - "Dates 
   compatibles", "Secteur voisin", "Profils proches", colorés selon 
   niveau. Le barème chiffré RESTE affiché aux ADMINS uniquement - 
   c'est ce qui a permis de diagnostiquer le bug du score a zero le 
   jour meme.

3. SCOREUR UNIQUE - computeMatchScore et la route /api/ai/score 
   supprimés (consolidation). Match.aiScore = instantané du score de 
   compatibilité au moment de la mise en relation. Le recalcul 
   emprunte la MEME formule que le feed et les swipes. Barèmes 
   centralisés dans lib/compatibilite, partagés calcul/affichage - 
   élimine le risque de duplication serveur/interface.
```

### ⚠️ DÉCISION EN SUSPENS — répartition des points libérés par la désirabilité

```
Opus a tranché SEUL (signalé comme tel, à valider) : les 10-15 
points libérés sont allés aux DATES et à la GÉOGRAPHIE, pas aux 
PROFILS. Raison invoquée : la composante Profils dépend du modèle 
IA, qui vient de démontrer qu'il peut s'effondrer silencieusement à 
zéro (voir vague 2 ci-dessous) - renforcer son poids amplifierait ce 
risque.

⚠️ TENSION AVEC LE PRINCIPE PRODUIT CONFIRMÉ LE 29/07 (section 
"modèle de matching, option B") : le modèle du produit repose sur 
l'intérêt porté à un PROFIL COMPLET (pas un accord logistique pur) - 
dans cette philosophie, Profils est censé être LE différenciateur. 
Diminuer relativement son poids va à contre-courant de ce principe.

ARBITRAGE NON TRANCHÉ, les deux arguments sont valables :
- POUR renforcer Profils : cohérence avec la philosophie produit 
  (option B, confirmée)
- CONTRE renforcer Profils : fragilité démontrée du scoreur IA (peut 
  retourner 0 silencieusement)

Note : en Assistanat, Profils pèse encore 55/100 (repartition 
différente selon le type de mission, à confirmer si volontaire).

À TRANCHER PAR JEAN-CHARLES.

### Extension de la vision — fluidité du statut DANS LE TEMPS (03/08, ajout de fin de session)

```
Précision apportée par Jean-Charles, distincte de la dualité 
chercheur/pourvoyeur ci-dessus mais de la même famille de question : 
le statut ne devrait pas seulement pouvoir être DOUBLE (chercheur ET 
pourvoyeur en même temps), il devrait pouvoir ÉVOLUER DANS LE TEMPS.

Scénarios réels cités :
- Un remplaçant qui cherche des missions ponctuelles depuis un 
  moment, et qui veut à un moment donné "se poser" (devenir assistant 
  ou titulaire quelque part) - progression de carrière naturelle
- Un titulaire qui veut TEMPORAIREMENT faire des remplacements 
  ailleurs (changement de rythme, envie de mobilité) AVANT DE REVENIR 
  à son propre cabinet - pas un changement définitif, un aller-retour

NUANCE SUPPLÉMENTAIRE posée par la formulation "au sein d'un même 
cabinet ou pas" : un titulaire qui explore temporairement le 
remplacement ailleurs garde-t-il son cabinet "en toile de fond" 
pendant cette parenthèse, ou est-ce un vrai changement de statut 
complet le temps de l'exploration ? Question non tranchée, à 
approfondir en même temps que la vision chercheur/pourvoyeur - même 
chantier, pas deux chantiers séparés.
```


```

### Vague 2 — commit 3c3018e, deux signalements corrigés

```
1. CARTE DE PARTAGE RECADRÉE — l'image 1200×630 alignait son contenu 
   à gauche sur toute la largeur, alors que les messageries/
   navigator.share recadrent en carré centré (les 630px du milieu) - 
   marque/badge/début du titre tombaient hors cadre. Corrigé : 
   contenu dans une zone de sécurité centrée de 600px. Vérifié en 
   générant l'image réelle de l'annonce d'août puis en la découpant 
   en carré (pas supposé).

2. FAUX STATUT "COUVERT" (vert) sur une annonce ayant une mise en 
   relation EN_ATTENTE (pas confirmée) — 
   PlanningBoard.tsx:345 traitait N'IMPORTE QUEL match (quel que soit 
   son statut) comme couvrant le poste. Une simple conversation en 
   cours peignait le planning en vert, affirmant une couverture sur 
   la foi d'un échange, pas d'un accord. Corrigé : seule une mise en 
   relation CONFIRME couvre le poste desormais.

MÊME FAMILLE que le reste de la session (rapport 28/07-03/08) : "un 
affichage qui affirme plus que ce qu'il sait."
```

### Statut

```
5 commits en prod (979ccd8 + 3c3018e). Point en suspens : arbitrage 
de repartition des points (dates/geo vs profils) a trancher par 
Jean-Charles. Test de controle DeepSeek (couple bien-note) en cours, 
resultat attendu.
```

---

## AUDIT DEMANDÉ — Chaîne titulaire→assistant→remplaçant, double visibilité timeline (03/08)

### Scénario à auditer

```
1. Titulaire recrute assistant (contrat signe)
2. Assistant a compte autonome, rattache au poste
3. Assistant recherche a son tour un remplacant ("Faire remplacer 
   mon absence")
4. QUESTION : ce remplacement apparait-il EN MEME TEMPS sur (a) la 
   timeline personnelle de l'assistant et (b) la timeline composee 
   du titulaire (ligne du poste correspondant) ?
```

### Statut

```
🟡 Prompt d'audit complet rédigé (conditions reelles, pas relecture 
de code seule), en attente d envoi. Touche des zones deja fragiles 
(rattachement poste-assistant, synchronisation timelines - cf B5, 
B9, B10).
```

---

## VISION STRATÉGIQUE — Au-delà du SaaS : donnée, MCP, et l'avenir du commerce numérique (03/08)

### Thèse de Jean-Charles

```
La mode SaaS (interface web classique) a encore 2-3 ans devant elle 
pour generer du revenu, mais l'evolution vers des agents IA (via 
MCP notamment) va commoditiser la couche interface. Ce qui restera 
rare et monnayable : la DONNEE et le rapport donnee/recherche - 
savoir quoi interroger pour obtenir une reponse utile sur un marche 
precis. Question posee : comment penser Soignect des maintenant dans 
cette logique, sans attendre que le changement soit acte ?
```

### Ce qui existe déjà et va dans ce sens (sans avoir été nommé ainsi)

```
TraceEvent (construit depuis le debut du projet) accumule deja un 
historique territorial - qui remplace ou, quand, a quel taux, quels 
postes restent vacants combien de temps. C'est deja, de facto, la 
construction d'un actif donnee, pense a l'origine pour le "Soignect 
Observatoire" (produit institutionnel ARS/CGSS deja identifie tres 
tot dans le projet). La reflexion de Jean-Charles rejoint et 
generalise quelque chose deja engage, sans lien explicite fait 
jusqu'ici entre les deux.
```

### Action concrète proposée — serveur MCP léger

```
Le MCP (Model Context Protocol) est le protocole par lequel un agent 
IA interroge un service externe - c'est litteralement le mecanisme 
par lequel cette conversation elle-meme fonctionne avec des outils 
tiers. Si la these est juste, la vraie preparation n'est pas 
philosophique mais TECHNIQUE ET PEU COUTEUSE : exposer les 
capacites de Soignect (chercher une annonce, publier une 
disponibilite, verifier un statut de match) via un serveur MCP, en 
parallele de l'interface web.

Faisabilite : toutes les routes API existent deja (les memes 
routes /api/* qui servent l'interface web) - un serveur MCP est 
essentiellement un habillage different autour de ce qui tourne deja, 
pas une reconstruction. Cout d'implementation faible relativement a 
la valeur strategique de positionnement.

STATUT : idee capturee, PAS construite maintenant (regle du gel), 
mais identifiee comme le chantier le plus concret et le moins couteux 
si Jean-Charles veut avancer sur cette reflexion au-dela de la pure 
theorie. Candidat naturel pour une session dediee en Phase 3, une 
fois la beta stabilisee.
```

### Limite légale à poser dès maintenant sur la donnée

```
Monnayable proprement : PATTERNS AGREGES ET ANONYMISES uniquement - 
taux de remplissage par zone, delai moyen avant match, saisonnalite 
des tensions, taux de retrocession moyens par secteur.

JAMAIS directement monnayable sans consentement RGPD specifique : 
donnees individuelles (RPPS, comportement d'un candidat precis).

DISCIPLINE A ADOPTER DES MAINTENANT : construire l'habitude 
d'agreger/anonymiser a la source (dans la conception des futures 
requetes/exports), plutot que de devoir retravailler retroactivement 
plus tard un historique de donnees individuelles accumule sans cette 
precaution.
```

### ✅ DÉCISION DU 03/08 — orientation adoptée MAINTENANT, pas différée

```
Jean-Charles précise : ce n'est PAS une reflexion pour plus tard, 
c'est L'ORIENTATION A PRENDRE DES MAINTENANT. Reformulation explicite 
de la mission du produit :

Soignect n'est PAS "un Uber du remplacement" (une marketplace de 
matching, point final). C'est un FOURNISSEUR DE RESSOURCES ET 
D'INTELLIGENCE SUR LES RESSOURCES DE SANTE. 

L'INTERLOCUTEUR INITIAL (celui qui utilise le produit au quotidien) 
: le remplacant, le cabinet - c'est le moteur de collecte.
L'INTERLOCUTEUR DE DESTINATION A TERME : les grandes organisations 
de sante - hopitaux, CPTS, recruteurs institutionnels, ARS/CGSS.

La marketplace n'est pas la finalite du produit - c'est le mecanisme 
qui genere la donnee dont la finalite a besoin.
```

### Trois actions concrètes adoptées immédiatement

```
1. MISSION DU PRODUIT REFORMULEE (ce document) - voir ci-dessus, a 
   reprendre dans toute presentation/pitch futur du produit.

2. NOUVELLE REGLE PERMANENTE (ajoutee a PLAN_PASSATION_SPRINTS.md) : 
   toute nouvelle feature doit desormais etre evaluee aussi sous 
   l'angle "quelle donnee ca fait remonter, utile a l'interlocuteur 
   institutionnel futur" - pas seulement sous l'angle UX immediat.

3. AUDIT TRACEEVENT DEMANDE (prompt ci-dessous) - verifier la 
   couverture reelle par rapport a cette destination.
```

### Statut

```
✅ ADOPTÉ COMME ORIENTATION ACTIVE, pas différé. Le serveur MCP 
(section precedente) reste un chantier futur (Phase 3), mais la 
DISCIPLINE DE COLLECTE, elle, s'applique des maintenant a toute 
nouvelle feature.
```

### Prompt d'audit TraceEvent rédigé (à envoyer à Opus)

```
Prompt complet redige pour auditer la couverture reelle de 
TraceEvent au regard de cette mission institutionnelle - liste des 
eventType existants, signaux manquants identifies (delai de 
remplissage, taux reels pratiques, annulations post-signature, 
saisonnalite, taux de conversion par etape). Lecture seule, aucun 
code. En attente d'envoi.
```


---

## AUDIT TRACEEVENT — Résultat et point d'urgence identifié (03/08)

### Constat d'Opus (verbatim, important)

```
Avec 46 publications, 3 mises en relation et 2 contrats, la base ne 
supporte aujourd'hui aucune affirmation territoriale. L'enjeu de cet 
audit n'est pas de produire des chiffres maintenant, c'est de 
garantir qu'ils seront là quand le volume viendra — et surtout qu'ils 
ne seront pas déjà perdus, ce qui est le cas des annulations.
```

### Le vrai trou identifié

```
Les ANNULATIONS de matches/contrats après signature ne sont PAS 
tracées par TraceEvent actuellement. Contrairement au petit volume 
(pas un problème - se corrige avec le temps), une donnée 
d'annulation non capturée aujourd'hui est PERDUE DÉFINITIVEMENT, 
meme quand le volume grossira. C'est le seul point vraiment urgent 
de l'audit, par irreversibilite.
```

### Statut

```
🔴 Prompt de fix prioritaire rédigé (capture TraceEvent des 
annulations) - passe avant les ameliorations de confort, en attente 
d'envoi.
```

---

## CAPTURE TRACEEVENT DES ANNULATIONS — Livré (03/08, commit b4bd1f1)

### 5 points de destruction couverts (2 de plus que prévu par l'audit initial)

```
| Chemin | Origine | Avant |
|---|---|---|
| DELETE /api/match/[matchId] "Annuler la mise en relation" | MATCH_SUPPRIME | suppression totale, sans trace |
| PATCH /api/matches/[id] -> DECLINE/EXPIRE | DECLINE | statut change, sans trace |
| DELETE /api/missions/[id] | ANNONCE_SUPPRIMEE | cascade silencieuse (non isole par l'audit initial) |
| DELETE /api/absences | ABSENCE_SUPPRIMEE | cascade silencieuse (non isole par l'audit initial) |
| DELETE /api/admin/missions/[id] | ADMIN | cascade silencieuse |
```

### Architecture retenue

```
UN SEUL eventType (MATCH_CANCELLED), pas deux - le moment de 
l'annulation est porte par metadata.stade, evite le risque de double 
comptage/oubli dans une future agregation.

Metadata capture : stade (EN_ATTENTE/DISCUSSION/CONFIRME/
CONTRAT_SIGNE), phase (avant/apres signature), signatures (0/1/2 - 
le cas 1 seule signature distingue explicitement), joursDepuisMatch, 
initiateur, origine. Plus type de relation et matchId en colonnes 
indexees.

Motif de l'annulation : PAS capture, aucune interface ne le collecte 
- rien invente cote UI, conforme a la consigne.
```

### ✅ Décision privacy-by-design saluée

```
PAS de profileId ecrit, seulement le ROLE (CABINET/CANDIDAT/ADMIN/
SYSTEME). Raisonnement d'Opus : mesurer la fiabilite du marche 
n'exige pas de savoir QUI annule ; conserver l'identite permettrait 
de profiler les praticiens qui se desistent, ce que le cadre RGPD 
deja pose exclut. Decision reversible (le champ existe, pourrait 
etre rempli plus tard si besoin reel et justifie).

Applique proactivement la discipline RGPD deja posee (agregation, 
jamais de profilage individuel) sans qu'elle ait ete redemandee pour 
cette feature precise - bon signe de bonne comprehension du 
principe, pas juste d'execution mecanique d'une consigne.
```

### Vérification en attente — décision prise

```
Le capteur n'a pas encore ete declenche reellement (compteur a zero, 
seule mise en relation en base = celle avec Julien MORISOT). Opus 
demandait si detruire ce match pour verifier le capteur.

DÉCISION (03/08) : NON, ne pas détruire le match Julien pour ce 
test. La premiere annulation reelle (test ou naturelle) validera le 
capteur d'elle-meme ; le match Julien sert encore a d'autres 
verifications en attente (B12 notamment) - ne pas le sacrifier pour 
un test qui peut attendre.
```

### Statut

```
✅ LIVRÉ, poussé (b4bd1f1). Vérification empirique différée, pas 
bloquante.
```

---

## VÉRIFICATION LIVE COMPLÈTE — Parcours candidat, bannière + partage (03/08)

### Résultat : tout vérifié en prod, à l'œil, en conditions réelles

```
| Élément | Statut |
|---|---|
| Bannière de confirmation côté candidat | ✅ "Votre recherche... visible par les cabinets" |
| Partage à chaud depuis la bannière | ✅ Copier le lien + Partager... |
| Copie réelle dans le presse-papier | ✅ confirmée par le collage de Jean-Charles |
| Lien partagé valide | ✅ page publique servie, puis 404 après suppression |
| Bouton Facebook retiré | ✅ bannière, page publique, fiche disponibilité |
| CTA "Voir la recherche et se positionner" | ✅ |
| Transparence sur l'ordre d'affichage | ✅ affichée sous les filtres |
| Capture d'annulation | ✅ silencieuse a juste titre (0 mise en relation sur la mission test) |

Test mené avec un vrai compte (Julien MORISOT), recherche de test 
publiee (Marie-Galante, nov 2027) puis proprement supprimee - base 
propre apres test, aucune mission "TEST technique" residuelle.
```

### Méthode notable — deux réserves honnêtes, résolues proprement

```
1. Copie presse-papier non prouvable par script (permission 
   navigateur) - resolue par le collage manuel de Jean-Charles 
   (⌘V), preuve humaine acceptee la ou l'automatisation ne pouvait 
   pas confirmer sans risquer une fausse confirmation.
2. Layout ShareActions imparfait (boutons empiles, vide a droite sur 
   grand ecran) - signale comme point ouvert plutot que corrige sans 
   permission, car la consigne "ne pas toucher ShareActions" avait 
   ete posee dans un contexte anterieur different.
```

### Décision — autorisation donnée

```
✅ Jean-Charles lève la restriction sur ShareActions pour ce fix 
précis (boutons côte à côte sur desktop). Prompt rédigé, en attente 
d'envoi.
```

### ✅ LIVRÉ ET VÉRIFIÉ (03/08, commit 3540e5e)

```
Vérifié à l'œil aux deux vraies tailles sur serveur local (pas 
seulement compilation) :
- 1564px : "Copier le lien" et "Partager..." côte à côte, largeurs 
  égales, aucun retour à la ligne
- 414px : empilés pleine largeur, cibles confortables au pouce
Bascule au point d'arrêt sm (640px) : flex-col sm:flex-row, 
sm:flex-1, whitespace-nowrap.

CATCH SUPPLÉMENTAIRE TROUVÉ EN VÉRIFIANT : la bannière de 
confirmation de publication enveloppait ShareActions dans un 
conteneur sm:min-w-[260px], dimensionné pour l'ancien empilement - à 
260px, deux boutons côte à côte auraient fait ~125px chacun, trop 
serré. Élargi à 380px. Seul appelant contraignant la largeur ; les 5 
autres (page publique, planning, disponibilités, fiche de mise en 
relation) laissent le composant s'étendre naturellement - non 
revérifiés un par un (nécessitent session/état particulier), mais 
conteneurs plus larges que 380px partout, donc rendu attendu au 
moins aussi confortable. Pas d'action requise, à observer 
occasionnellement au fil de l'usage normal.
```

---

## AUDIT CHAÎNE TITULAIRE→ASSISTANT→REMPLAÇANT — Résultat complet (03/08)

### Étape 1 — Rattachement manuel : FONCTIONNE

```
Reconstitué par le vrai parcours produit (pas d'écriture DB directe) :
Compte Paul (assistant, paulgide@gmail.com) rattaché au poste 
"Mathéo" de Jean-Charles via le rattachement manuel (Planning -> 
periode -> Voir le detail -> + Rattacher un compte assistant). 
Banniere violette s'affiche correctement chez Paul : "Vous etes 
actuellement assistant·e chez Jean-Charles DUBIEN (poste Mathéo)" + 
bouton "Faire remplacer mon absence".

⚠️ POINT NON RÉSOLU, À CLARIFIER SÉPARÉMENT : le rattachement 
AUTOMATIQUE a la signature n'a pas ete rejoue (necessite un contrat 
complet 2 signatures). Selon un etablissement fait "ce matin" (hors 
contexte direct de cette session), le garde 
assistant.type !== ProfileType.ASSISTANT n'aurait JAMAIS laisse 
passer personne en production. Si confirme, c'est un probleme 
DISTINCT et potentiellement plus grave que celui ci-dessous, car 
c'est cense etre le chemin NORMAL (pas une solution de secours 
manuelle).
```

### Étape 2 — "Faire remplacer mon absence" : CASSÉ, cul-de-sac total

```
Le formulaire atteint (/missions/create?cabinetPostId=...&needType=remplacement) 
NE PEUT PAS ETRE SOUMIS. Pas un probleme d'affichage : les champs 
exiges par sa propre validation ne sont pas rendus dans le DOM 
(0 textarea description, 0 input date debut, 0 input date fin). 
Bouton "Publier le poste" desactive sans aucun moyen de le debloquer.

CAUSE PRÉCISE : coverMode (rawProfileType === "ASSISTANT" && 
cabinetPostId present) est bien detecte, mais UNIQUEMENT applique au 
VOCABULAIRE (titres/libelles), PAS aux drapeaux de visibilite des 
champs (showStartDate, showEndDate, showMinMonths, bloc texte libre) 
qui continuent de lire le TYPE BRUT du profil. Pour un ASSISTANT, 
aucune des conditions (qui verifient REMPLACANT ou TITULAIRE) n'est 
vraie -> rien ne s'affiche. Pendant ce temps showMinMonths est VRAI 
pour ASSISTANT -> affiche a tort "Duree minimale souhaitee" (champ 
de poste long terme) dans un parcours de remplacement ponctuel.

Formule retenue : "Le mode couverture a ete cable sur les mots, pas 
sur les champs."

CONSÉQUENCE : la question centrale de l'audit (double visibilite 
timeline) reste NON OBSERVEE - aucune mission ne peut naitre de ce 
parcours actuellement. Mais le code GARANTIT (missions/route.ts:207) 
que si une mission existait, profileId=<cabinet> et 
cabinetPostId=<poste> -> elle apparaitrait sur le planning du 
titulaire mais PAS chez l'assistant (dont /disponibilites filtre sur 
profileId). Le second defaut (double visibilite) existe donc bien, 
simplement MASQUÉ par le premier (formulaire casse).

DÉCOUVERTE ARCHITECTURALE SUPPLÉMENTAIRE : la vue personnelle d'un 
ASSISTANT n'est PAS une timeline - c'est "Ma recherche de poste", 
une liste d'annonces de recherche d'EMPLOI. Aucune surface, chez 
lui, ne peut accueillir une periode de remplacement - meme en 
corrigeant uniquement la requete de visibilite.
```

### Étape 3 — Cohérence de la chaîne

```
✅ Le titulaire voit bien tout - conception juste sur ce point. 
Verifie incidemment : l'annonce d'aout de Jean-Charles est bien 
repassee en ambre "Recrutement" depuis le correctif du matin meme 
(confirmation croisee d'un fix precedent).

🔴 RISQUE DE DOUBLE EMPLOI CONFIRMÉ AVEC DE VRAIES DONNÉES : aucune 
contrainte d'unicite, aucun controle de chevauchement en base. Le 
poste "Assistant 1" porte deja 3 missions, "Mathéo" en porte 2. Une 
fois l'assistant capable de publier, titulaire ET assistant pourront 
recruter deux remplacants pour la meme absence sans se croiser - 
d'autant plus facilement que l'assistant ne voit meme pas ce qu'il a 
lui-meme cree (etape 2).
```

### Décision — répartition des 3 correctifs proposés

```
✅ FIX 1 (débloquer le formulaire, driver par coverMode partout, pas 
   par le type brut) — AUTORISÉ IMMÉDIATEMENT. Certain, reproductible, 
   rend la fonctionnalité totalement inutilisable aujourd'hui.

🟡 FIX 2 (rendre la mission visible chez l'assistant) — DÉCISION 
   PRODUIT PRISE (03/08) : l'assistant est À LA FOIS chercheur de 
   poste (candidat classique, déjà couvert par "Ma recherche de 
   poste") ET pourvoyeur de poste pour sa propre couverture (rôle 
   mini-employeur). Ces deux intentions ne doivent pas être 
   confondues dans un seul écran. Proposition à valider : un nouvel 
   espace distinct "Mes recherches de remplacement", façon liste 
   "Annonces actives" (déjà existant côté titulaire) plutôt qu'une 
   timeline complète type Planning — trop lourd pour un usage 
   occasionnel. Prompt à rédiger et valider avant envoi.

🟡 FIX 3 (garde anti-doublon, publication sur poste déjà couvert aux 
   mêmes dates) — accepté sur le principe, à faire APRÈS le fix 1, 
   pas urgent au vu du volume actuel mais risque réel et documenté.

État laissé en base : Paul reste rattaché au poste Mathéo (utile 
pour la suite des tests, pas détaché).
```

---

## AUDIT CHAÎNE — Complément : 3e défaut découvert, plus grave que les deux autres (03/08)

### Réponse définitive à la question centrale : NON, sur les deux vues

```
Confirmé par mesure DOM comparative sur la MEME URL, deux sessions 
reelles (Paul/ASSISTANT vs jcdubien/TITULAIRE) :
| | Paul (ASSISTANT) | jcdubien (TITULAIRE) |
|---|---|---|
| champs date | 0 | 2 |
| description | 0 | 1 |
Preuve la plus propre possible du bug formulaire (fix 1, deja 
autorise, confirmation maintenue).
```

### 🔴 DÉFAUT 3 — NOUVEAU, découvert en creusant, plus grave que prévu

```
La brique de decembre EST bien creee et bien rattachee cote titulaire 
(donnees justes, requete juste) - mais elle est TOTALEMENT INVISIBLE 
VISUELLEMENT quand une autre carte occupe la meme ligne/periode.

Mesure precise : brique "TEST audit" (dec.) x=697 largeur=47px, carte 
"3 postes" (ouverte) x=470 largeur=1280px - MEME ligne, MEME hauteur, 
plages imbriquees, AUCUN z-index sur aucune des deux. La plus large, 
peinte en second, recouvre integralement la plus etroite. Seul 
l'arbre d'accessibilite prouvait l'existence de la brique cachee - 
visuellement, rien ne la trahissait (juste un aplat ambre uniforme).

GRAVITÉ RECLASSÉE : ce n'est PAS un defaut specifique au parcours 
assistant - c'est un defaut de rendu GENERAL du Planning, qui peut 
cacher silencieusement n'importe quelle donnee a n'importe quel 
titulaire des que deux elements se chevauchent sur une meme ligne de 
poste. Plus grave que les defauts 1 et 2 combines, car il touche 
potentiellement TOUS les titulaires actuels, pas seulement le 
scenario assistant en cours d'audit.
```

### Mise à jour de l'ordre de priorité

```
1. 🔴 Fix z-index/chevauchement Planning (NOUVEAU, priorite la plus 
   haute - touche tous les titulaires silencieusement)
2. Fix 1 initial (débloquer formulaire couverture assistant) - 
   confirmé, autorisé, prompt prêt
3. Clarification rattachement automatique (garde jamais franchi en 
   prod) - Paul existant rend ce test maintenant possible
4. Fix "Mes recherches de remplacement" côté assistant - proposition 
   à valider par Jean-Charles avant envoi
5. Garde anti-doublon (poste "Mathéo" est passé de 2 à 3 missions 
   PENDANT le test lui-même - accumulation confirmée en direct)
```

### ✅ LIVRÉ ET VÉRIFIÉ (03/08, commit f492ccd)

```
Preuve avant/après exacte sur le cas mesuré :
| | avant | après |
|---|---|---|
| "3 postes" (ouverte, 1280px) | y=292 h=35 | y=298 h=20 |
| "TEST" (décembre, 47px) | y=292 h=35 -> invisible | y=320 h=20 -> visible |

🔴 IMPACT PRODUCTION RÉEL CONFIRMÉ (pas théorique) : Cabinet des 
ravines, poste "Assistant 1" - une occupation ouverte SANS DATE DE 
FIN (01/01/2026) recouvrait "Rempla septembre Pointe à Pitre" 
(07/09->25/09/2026) - UN RECRUTEMENT ACTIF, invisible pour ce 
cabinet jusqu'à ce correctif. Confirme que la reclassification en 
priorité maximale était justifiée - ce n'était pas un risque futur, 
c'était déjà en train de se produire.

Second cas trouvé (siège titulaire JC, deux annonces 2025 qui se 
chevauchent) - sans consequence, dates passées.

MÉCANISME AGGRAVANT IDENTIFIÉ (à retenir comme point de vigilance 
général) : une période SANS DATE DE FIN s'étale jusqu'au bord droit 
et recouvre tout ce qui vient après elle sur la même ligne. Toute 
future feature affichant des plages temporelles sur une ligne 
partagée doit anticiper le chevauchement dès la conception.

FIX : placement glouton en sous-lignes (assignLanes) - chaque brique 
prend la première sous-ligne libre à sa date de début, la hauteur de 
la ligne du poste grandit d'autant. Appliqué à desktop 
(TimelineRow/MissionBrick) ET mobile (MobilePostCard) - bug 
identique trouvé indépendamment côté mobile (positionnement en 
pourcentages), corrigé sans qu'on ait eu à le redemander séparément.

Non-régression vérifiée : sans chevauchement, une seule sous-ligne, 
hauteur inchangée - testé sur 5 scénarios dont 2 tirés de vraies 
données de production. Les fonds ("Présence", zones "non couvert") 
ne concurrencent aucune brique, ils la portent.

⚠️ RÉSERVE EN COURS : rendu mobile vérifié à la compilation 
uniquement, pas encore à l'écran - demande faite de le vérifier 
visuellement (fenêtre étroite + cas de chevauchement recréé), 
compte-rendu attendu.
```

### Statut

```
✅ LIVRÉ ET VÉRIFIÉ (desktop). 🟡 Vérification visuelle mobile en 
cours. 🟡 Fix 1 (formulaire) confirmé, prompt déjà rédigé 
précédemment. 🟡 Clarification rattachement auto toujours en 
attente. 🟡 Fix "Mes recherches de remplacement" en attente de 
validation JC.
```

---

## VISION ARCHITECTURE DE FOND — Chercheur d'emploi / pourvoyeur d'emploi, statut décidé à la recherche effective (03/08)

### Proposition de Jean-Charles

```
Par definition, un "assistant" n'est assistant que s'il est rattache 
a un cabinet - avant rattachement, l'appeler ASSISTANT est premature. 
Proposition de simplification :

- Un TITULAIRE avec des postes ouverts a des postes de titulaires, 
  assistants ou collaborateurs (ceci existe deja structurellement - 
  CabinetPost types)
- Mais l'identite de la PERSONNE elle-meme, a l'inscription, 
  pourrait etre juste binaire : CHERCHEUR D'EMPLOI / POURVOYEUR 
  D'EMPLOI
- Le STATUT PRECIS (remplacant, assistant, collaborateur, associe) 
  se decide au moment ou la recherche devient EFFECTIVE (match/
  contrat), pas fige des l'inscription

Cette proposition RESOUD DIRECTEMENT la tension decouverte dans 
l'audit precedent (assistant "a la fois chercheur de poste ET 
pourvoyeur de poste") - si l'identite de base etait deja binaire 
chercheur/pourvoyeur, cette dualite ne serait plus un cas special a 
contourner (espace "Mes recherches de remplacement" invente pour 
s'en sortir) mais une consequence naturelle du modele.
```

### Coût réel identifié — pourquoi ne pas le faire maintenant

```
ProfileType (TITULAIRE/STRUCTURE/REMPLACANT/ASSISTANT) est verifie 
QUASIMENT PARTOUT dans l'application : formulaires (le bug qu'on 
vient de corriger en est un exemple direct - "le mode couverture a 
ete cable sur les mots, pas sur les champs"), templates de contrat, 
filtres du feed, libelles de notifications, badges, scores de 
matching. Ce n'est pas un detail isole, c'est une colonne vertebrale 
du modele de donnees.

Le bug recemment corrige illustre precisement le risque : une 
logique CONTEXTUELLE (je couvre une absence) s'appuyant sur une 
IDENTITE FIGEE (profileType) produit des bugs. La proposition de 
Jean-Charles inverserait cette logique partout, pas seulement a cet 
endroit - ce qui est juste, mais massif.
```

### Décision (03/08)

```
❌ PAS MAINTENANT — trop risqué a ce stade (proche d'une beta 
stabilisee, sortir tout juste d'une vague de bugs du meme type sur 
un perimetre plus restreint). Ouvrir ce chantier maintenant risquerait 
de generer une nouvelle vague de bugs similaires sur TOUTE la surface 
de l'app d'un coup.

✅ CE QUI CONTINUE EN PARALLELE, SANS CONTRADICTION : le correctif 
pragmatique deja pose ("Mes recherches de remplacement", espace leger 
cote assistant) - n'entre pas en conflit avec cette vision, l'anticipe 
meme partiellement, sans necessiter de refonte immediate.

✅ CAPTURE POUR PHASE 3+ : vision documentee ici en detail, pour ne 
pas se perdre. PREREQUIS avant d'y toucher un jour : un audit complet 
de tous les usages de ProfileType dans le code (chaque route, chaque 
composant, chaque template) pour mesurer precisement le rayon 
d'impact avant de se lancer - pas une decision a prendre a la legere 
au detour d'une session.
```

---

---

## SECTION 190 — Asymétrie du score corrigée (renormalisation) + deux critères de bonus (06/08)

### Le défaut : un score par SENS de swipe, pas par paire

```
Les champs du score sont ORIENTES : "propose" n'existe que sur une
annonce de cabinet, "recherche" que sur un profil de candidat.

computeAffinityScore ne lisait l'OFFRE que du cote `mission` et la
DEMANDE que du cote `swiper`. Consequence : quand le CABINET swipait
la disponibilite d'un candidat, les deux etaient vides et les bonus
tombaient a zero. Le cabinet ne pouvait PAS DEPASSER 80/100 sur un
remplacant. Plafond structurel, jamais affiche, jamais soupconne.

CONSTATE SUR DONNEES REELLES : Julien notait Jean-Charles 78/48/43,
Jean-Charles notait Julien 23 (logement 0, vehicule 0). Ces nombres
n'etaient pas comparables et rien a l'ecran ne le disait.

Aggravant : le detail affichait "logement: 0", qui se lit "pas de
logement propose" alors que la bonne lecture etait "sans objet dans
ce sens".
```

### Le correctif : renormalisation

```
1. UN SCORE PAR PAIRE. Chaque critere est lu DES DEUX COTES (offre =
   mission.x || swiper.x ; demande = swiper.y || mission.y). Les
   points d'appel transmettent desormais les deux faces. Verifie :
   candidat->annonce et cabinet->dispo rendent 83 tous les deux.

2. SOCLE EN PROPORTIONS, plus en points absolus. Un critere n'entre
   au bareme QUE SI le chercheur l'exprime ; non demande, son poids
   RETOURNE AU SOCLE au lieu de laisser un trou. Un candidat sans
   besoin de logement perdait 10 points, il n'en perd plus.

   Demande mais non offert, en revanche, le critere reste au bareme
   et vaut 0 : la l'ecart est reel.

3. socleMax stocke dans scoreDetails (100 - bonus en jeu). Sans lui,
   la lecture qualitative ne peut pas savoir sur quelle echelle juger
   "dates: 27". Les lignes deja en base n'en ont pas : lectureQualitative
   retombe alors sur les baremes d'avant (LEGACY_WEIGHTS), sinon les
   scores anciens paraitraient plus faibles qu'ils ne l'etaient.
```

### Baremes

```
SOCLE (proportions sommant 100, ramenees au prorata de ce qui reste)
                  dates  geo  bio
  REMPLACEMENT      40    30   30
  COLLABORATION     35    30   35
  ASSISTANAT        20    25   55

La GEOGRAPHIE pese plus sur un remplacement court que sur un poste
long : on ne demenage pas pour trois semaines. Inversion par rapport
au bareme precedent, ou elle valait 25 dans les deux cas.

L'affinite de profils est plafonnee a 55 meme la ou elle est la plus
pertinente : seule composante dependant d'un appel modele, et seule
a pouvoir retomber au neutre silencieusement (rate-limit, section
165). On ne lui confie pas la majorite absolue.

BONUS (budget 20, INCHANGE vs logement 10 + vehicule 10 : les deux
nouveaux criteres se partagent l'existant, ils ne l'augmentent pas)
  coordination (MSP/CDS/ESP)   7
  logement                     5
  vehicule                     4
  secretariat                  4

REPARTITION EN ATTENTE DE VALIDATION — un seul endroit a modifier,
BONUS dans lib/compatibilite.ts.
```

### Pourquoi la coordination devant les trois autres

```
Logement, vehicule et secretariat sont des conditions MATERIELLES,
valables le temps de la mission. L'exercice coordonne change ce que
le kine a le DROIT de faire — acces direct sans prescription
medicale prealable, jusqu'a 8 seances (Avenant 7) — et reste un
acquis de pratique apres la mission. Ce n'est pas du meme ordre
qu'un confort.

Logement devant vehicule et secretariat : en Guadeloupe c'est le
premier blocage concret pour un remplacant venu de l'exterieur.

LIBELLE : "Exercice coordonne — acces direct sans prescription".
On nomme l'AVANTAGE avant le dispositif : "MSP" ne dit rien a qui
n'y a jamais exerce.
```

### Point de vigilance retenu

```
Ces deux criteres sont CONDITIONNELS (ils exigent une demande du
chercheur), et ce n'est pas un detail d'implementation. Un critere
qui rapporterait des points a TOUS les candidats indistinctement ne
mesurerait pas la compatibilite mais l'ATTRACTIVITE — exactement ce
qui a ete sorti du score le 03/08 avec la desirabilite. Un cabinet
en MSP merite d'etre mis en avant : cela releve de l'ORDRE DU FEED
et du badge de carte, pas du score de compatibilite.

C'est pourquoi deux champs de DEMANDE ont ete ajoutes cote candidat
(rechercheSecretariat, rechercheExerciceCoordonne) plutot que de
faire payer le bonus a tout le monde.
```

### Reste ouvert

```
Les Match.aiScore deja en base sont des instantanes calcules avec
l'ancienne formule — ils ne sont PAS recalcules par ce commit. Le
bouton "Recalculer" de la fiche de match applique la nouvelle. A
decider : rescoring de masse, ou attente de la recalculation
naturelle.
```


## AUDIT 4 PARCOURS — Résultat pour le salarié/recruteur (03/08)

### Méthode

```
Refus de créer des comptes de test (limite tenue par Opus) - 
recherche des comptes reels existants a la place. Les 4 parcours ont 
deja un compte reel en base :
- Remplacant : Julien MORISOT (2 disponibilites)
- Assistant : Paul (0 mission)
- Titulaire : Jean-Charles DUBIEN (9 missions, 5 postes)
- Salarie/recruteur : Hopital beauperthuy (0 mission, JAMAIS UTILISE)
```

### 🔴 DÉCOUVERTE CRITIQUE — Le parcours salarié est fonctionnellement mort, pas juste peu testé

```
Le feed est aveugle DANS LES DEUX SENS :
- api/feed/route.ts:70 exige ouvertSalariat=true chez le candidat 
  pour qu'un etablissement le voie -> 0 profil sur 8 candidats a 
  coche cette option
- Symetriquement, un candidat non-opte ne voit jamais les annonces 
  d'un etablissement

CAUSE RACINE : ouvertSalariat n'est ecrit QUE depuis le formulaire de 
CREATION d'une disponibilite (missions/route.ts:256). Ni la page 
Compte, ni l'edition d'une recherche existante ne l'exposent. Les 2 
candidats deja inscrits ne peuvent PAS l'activer sans tout republier 
depuis zero.

Résultat : l'établissement ne voit personne, personne ne le voit. 
Mur invisible, pas un manque d'usage.
```

### Redondances trouvées (exactement ce que demandait l'audit de simplification)

```
1. DEUX SOURCES DE VÉRITÉ POUR "EMPLOYEUR" : Profile.isEmployeur 
   vaut false sur le seul compte STRUCTURE, pendant que lib/auth.ts 
   recalcule isEmployeur = isEmployeur || titulaireKind === 
   "STRUCTURE". Le flag legacy survit sans jamais etre ecrit - deux 
   notions pour un seul concept.

2. VACATION/CDD/CDI NE SONT QUE DES ÉTIQUETTES : missions/create:104 
   renomme l'affichage mais la base ne connait que REMPLACEMENT | 
   ASSISTANAT | COLLABORATION. Un CDI est stocke comme "collaboration 
   liberale" - et TOUT ce qui lit missionType en aval (ponderation du 
   score, modele de contrat, planning) applique une logique liberale 
   a un poste salarie. Pas cosmetique - potentiellement faux a chaque 
   calcul downstream.
```

### Ce qui fonctionne bien — confirmation

```
✅ Le chemin contrat salarié est propre : match/[id]/contrat/page.tsx:155 
intercepte isSalariat AVANT le mur Premium, explique clairement que 
le contrat releve de l'etablissement, offre 2 sorties propres (ouvrir 
la conversation, ou revenir). Confirme que la decision "Cas A" 
(section historique) etait bien implementee.

⚠️ Point mineur trouvé, pas codé sans accord : sur /match/[id], un 
établissement non-Premium voit un CTA "réservé aux abonnés Premium" 
pour le PDF de contrat — alors qu'en isSalariat=true, ce PDF n'a 
JAMAIS de sens (contrat hors plateforme). Vend un accès Premium à un 
document qui ne sera jamais livré.
```

### Décisions prises (03/08)

```
1. ✅ Fix formulaire assistant — deja autorise precedemment, rien de 
   nouveau
2. ✅ AUTORISÉ — rendre ouvertSalariat modifiable depuis le Compte 
   (débloque tout le parcours salarié d'un coup, priorité haute)
3. ⚪ NON TRANCHÉ — vrai MissionType dédié au salariat plutôt que des 
   étiquettes. Même famille de question que la vision chercheur/
   pourvoyeur (Phase 3+) : touche le modèle de données au-delà du 
   cosmétique. PAS une décision à prendre à la légère - à documenter 
   pour une vraie session dédiée, pas un prompt rapide.
4. ✅ AUTORISÉ — retirer le CTA Premium/PDF quand isSalariat=true, 
   correction simple et sans ambiguïté (le PDF n'a jamais de sens 
   dans ce cas)
```

### ✅ LIVRÉ ET VÉRIFIÉ EN CONDITIONS RÉELLES (03/08, commit d1e0f8b)

```
Réglage ouvertSalariat placé dans sa propre section de "Mon compte" 
(pas parmi les notifications - c'est une préférence de recherche, 
décide ce qu'on voit ET qui nous voit) :

"TYPE DE POSTES RECHERCHÉS - 💼 Je suis aussi ouvert·e aux postes 
salariés. CDD, CDI, stage, vacation. Vous verrez alors les offres 
des établissements (EHPAD, clinique, SSR…) et ils vous verront. Sans 
cette option, vous ne voyez que les cabinets libéraux."

Libellé bidirectionnel délibéré - répond exactement à l'angle mort 
identifié (personne ne pouvait deviner l'invisibilité réciproque).

VÉRIFICATION : requête EXACTE du feed rejouée contre la base réelle, 
en basculant uniquement le réglage, sans republier :
| | Feed établissement | Julien voit les établissements |
|---|---|---|
| Avant | 0 candidat | non |
| Après bascule seule | 2 candidats (dispos de Julien) | oui |
| Restauré | 0 candidat | non |

Déblocage confirmé immédiat et symétrique, sans republication 
nécessaire. Julien remis à false après test (activation réelle = 
décision d'usage, pas effet de bord d'audit).
```

### Question ouverte — comment inciter à activer le réglage (pas encore résolue)

```
Le réglage est accessible mais rien n'incite à le trouver. Les 2 
candidats existants restent à false - le parcours salarié reste vide 
tant qu'ils ne cochent pas eux-mêmes.

DEUX OPTIONS ENVISAGÉES :
(a) Invitation explicite (ex: à l'inscription, ou quand le feed se 
    vide)
(b) Inverser la valeur par défaut (true par défaut)

DÉCISION (03/08) : (a), PAS (b). Inverser le défaut risquerait de 
proposer du CDI/CDD à quelqu'un venu spécifiquement pour du 
remplacement libéral - contredit un principe de fond du projet 
(ne jamais pousser silencieusement les gens vers autre chose que ce 
qu'ils sont venus chercher). Meilleur moment identifié pour 
l'invitation : à L'INSCRIPTION elle-même (question simple posée 
explicitement), plutôt qu'un nudge après coup quand le feed se vide 
- plus honnête, évite l'impression de vouloir faire changer d'avis 
quelqu'un qui a déjà choisi.

Pas encore transformé en prompt - à faire quand le parcours 
d'inscription sera retouché, pas une urgence isolée.
```

### Reste ouvert de cet audit

```
- Formulaire de couverture assistant (bloquant, certain, déjà 
  autorisé, prompt prêt)
- MissionType dédié au salariat vs étiquettes sur types libéraux 
  (non tranché, nécessite une vraie session dédiée)
```

---

## AUDIT FORMULAIRE SALARIÉ — Le vocabulaire libéral traverse tout (03/08)

### Constat, sur le vrai formulaire, sans rien publier

```
Ce qui FONCTIONNE : habillage employeur réel et soigné - "Ouvrir un 
poste", types Vacation/CDD/CDI avec sous-titres, "Commune de 
l'établissement", placeholder d'intitulé adapté. Champs de dates 
apparaissent correctement au choix de Vacation.

Ce qui CASSE - le vocabulaire libéral traverse le formulaire :
| Champ affiché à l'établissement | Problème |
|---|---|
| "CA mensuel estimé €" | Un salarié n'a pas de chiffre d'affaires |
| "Redevance versée au cabinet %" | Libellé adapté mais DE TRAVERS - un établissement verse un salaire, pas une redevance à un cabinet |
| Placeholder du texte libre | Exemple montré = celui d'un cabinet libéral ("Rétro 25%, CA ~8000€/mois") - non-sens pour un hôpital |
| Rémunération | ABSENTE - l'info la plus importante d'une offre salariée (brut mensuel, grille, échelon) n'est demandée NULLE PART |

Bloc de dates intitulé "Période de remplacement" pour une Vacation - 
terminologie incorrecte aussi.
```

### Élévation de priorité

```
Ce constat transforme une preoccupation architecturale abstraite 
(score/contrat/planning appliquent une logique liberale a du 
salariat, deja documentee) en un probleme d'EXPERIENCE UTILISATEUR 
PUBLIQUEMENT INCOHERENT pour toute une categorie de recruteurs. Un 
vrai etablissement qui tenterait de publier aujourd'hui verrait un 
formulaire qui semble casse, pas juste imparfait.

Reste en Phase 3 (vrai chantier, pas un correctif de 5 minutes - 
touche le modele de donnees MissionType), mais son urgence relative 
vient de monter suite a cette demonstration concrete.
```

### Décision sur la vérification finale (feed/matching en conditions réelles)

```
Compte Hopital beauperthuy porte une adresse email de VRAIE CPTS, 
pas un compte de test au nom de Jean-Charles. Opus a refusé de 
publier une offre (même temporaire, même étiquetée TEST) sans accord 
explicite - bonne discipline, le risque réputationnel réel dépasse 
le cadre d'un audit.

DÉCISION (03/08) : option 3 retenue — ON S'ARRÊTE LÀ pour ce compte. 
Le mécanisme de déblocage (ouvertSalariat) a déjà été vérifié 
rigoureusement avec de vraies données (rapport précédent, requête 
feed rejouée avant/après/restauré sur le compte de Julien) — pas 
besoin de répéter la démonstration sur un compte réel d'institution 
pour la consolider davantage.
```

### Statut

```
✅ Audit du parcours 4 (salarié/recruteur) considéré SUFFISANT pour 
conclure : inscription ✅, formulaire audité en détail (fonctionne 
partiellement, vocabulaire à corriger), contrat ✅ (déjà vérifié 
propre), feed/matching mécaniquement prouvé débloqué (via Julien). 
Aucune action supplémentaire requise sur ce compte.
```

### ⏸️ SESSION INTERROMPUE (03/08) — interruption technique, pas un échec

```
Onglet Chrome fermé + limite d'usage 5h atteinte sur les outils 
passant par un modèle. AUCUNE PUBLICATION N'A EU LIEU - le clic de 
publication n'est jamais parti (bouton disparu de la page au moment 
de la recherche). Vérifié en base : aucune mission Hopital 
beauperthuy, aucune mission TEST, aucun poste rattaché, 0 
ouvertSalariat actif - base intacte, le compte de la vraie CPTS n'a 
strictement rien reçu.

✅ CONFIRMATION : le retrait du CTA Premium/PDF trompeur (isSalariat) 
A BIEN ÉTÉ LIVRÉ (commit 42bbb6b) - passe de "autorisé" à "fait".

RÉCAPITULATIF FINAL DU PARCOURS 4 :
- Inscription ✅
- Formulaire ⚠️ audité en détail, vocabulaire libéral confirmé partout
- Feed 🔴 verrou confirmé ET mécanisme de déblocage PROUVÉ (0→2 
  candidats juste par bascule du réglage, sans republication)
- Contrat ✅ propre, CTA trompeur retiré
- Matching et notifications : NON OBSERVÉS (nécessitent une 
  publication réelle + un candidat opté qui swipe - session 
  interrompue avant ce point)

POUR REPRENDRE : rouvrir un onglet Chrome, reconnecter d'abord 
l'établissement, puis Julien avec ouvertSalariat activé depuis son 
compte. Publication de test (~1 min), puis feed/match/contrat/
notifications en une passe.
```

### ✅ SESSION REPRISE ET PARCOURS 4 CONCLU (03/08)

```
Reprise sans encombre - la panne initiale était juste des champs de 
formulaire repliés cachant le bouton, pas un vrai bug.

PUBLICATION FAITE, PREUVE DÉFINITIVE OBTENUE : une "Vacation" 
publiée par l'établissement est stockée en base comme REMPLACEMENT. 
Fuite confirmée jusqu'à l'affichage : le chip du feed montre 
"Remplacement · 1 déc. → 20 déc." et les filtres proposent 
"Remplacement/Assistanat/Collaboration" - le renommage employeur ne 
vit QUE dans le formulaire de création, rien en aval ne le sait.

TROIS VERROUS IDENTIFIÉS EN SÉRIE (méthodiquement, pas par tâtonnement) :
| Verrou | Effet | Verdict |
|---|---|---|
| ouvertSalariat du candidat | exclut tous les candidats | LE vrai blocage, déjà corrigé (d1e0f8b) |
| Chevauchement des dates avec le chip | excluait une dispo de Julien | comportement LÉGITIME |
| NO_ACTIVE_MATCH_FILTER | excluait une dispo déjà engagée | comportement LÉGITIME |

Une fois alignés : PARCOURS CONFIRMÉ FONCTIONNEL. Julien apparaît 
dans le feed de l'établissement, marqué "Compatible", boutons de 
décision présents. Confirme que d1e0f8b est bien ce qui rend ce 
parcours atteignable.

🆕 NOUVELLE TROUVAILLE : l'état vide du feed établissement AFFIRME 
LE FAUX - "Votre annonce est bien en ligne et visible. Dès qu'un 
candidat correspond, il apparaît ici" alors qu'aucun candidat ne 
PEUT apparaître tant que ouvertSalariat=0 partout, indépendamment de 
toute correspondance. Même famille que le fix du matin sur le feed 
candidat. Prompt rédigé, ciblé et sans risque - distinct des 2 autres 
chantiers qui restent en Phase 3.

PAS DE SWIPE FAIT (bonne discipline) - aurait créé un vrai choix en 
attente au nom de la CPTS, action sortante au nom d'un tiers, hors 
cadre d'un audit.

Nettoyage confirmé : aucune mission sur le compte CPTS, ouvertSalariat 
de Julien remis à false, seul le match d'origine subsiste en base.

BILAN FINAL DU PARCOURS 4 : inscription ✅, formulaire ⚠️ (vocabulaire 
à corriger, Phase 3), feed ✅ fonctionnel une fois débloqué (+ 1 fix 
ciblé état vide en attente), contrat ✅ propre, matching/notifications 
non observés par choix éthique (pas un manque de preuve du mécanisme, 
déjà démontré par le feed).

TROIS CHANTIERS RESTANTS, INCHANGÉS PAR ORDRE D'IMPACT :
1. Formulaire assistant bloqué (le plus grave - fonctionnalité 
   inexistante) - déjà autorisé, prompt prêt
2. Champs économiques salariés (CA/Redevance absurdes, rémunération 
   absente) - Phase 3
3. MissionType : "trois types libéraux qui portent aujourd'hui six 
   réalités" (formule d'Opus) - Phase 3, nécessite une vraie session 
   dédiée
```


---

## RÉSOLUTION DÉFINITIVE — Formulaire assistant débloqué, question centrale tranchée, découverte plus grave (03/08)

### Fix 1 livré avec 2 régressions rattrapées par vérification à l'écran

```
Déblocage initial (7b634ec) : mesure DOM confirmée, 0->2 champs date, 
0->1 description sur la même URL en session Paul.

2 RÉGRESSIONS trouvées SEULEMENT par vérification visuelle (la 
compilation passait dans les deux cas) :
- Champ "Intitulé du poste" affiché EN DOUBLE
- Bloc de dates encore intitulé "Mes dates de disponibilité" 
  (vocabulaire candidat) au lieu d'un libellé approprié au mode 
  couverture

CAUSE : un commentaire de code ("pas de colonne gauche, donc le 
titre n'a pas été rendu au-dessus") décrivait une prémisse devenue 
FAUSSE dès que le premier correctif a changé le contexte (la colonne 
gauche existe maintenant en mode couverture), sans que la condition 
qui en dépendait soit mise à jour en même temps. Dette silencieuse 
classique.

Corrigé et repoussé (d8036a6) : 1 seul titre, 2 dates, 1 description, 
libellé "Période de remplacement" correct.

Anecdote sans consequence : clic accidentel sur "Déconnexion" (premier 
bouton submit de la page dans l'ordre du DOM) au lieu de "Publier" - 
aucun degat, juste une reconnexion necessaire. Note legere : si un 
humain valide au clavier (Entree), meme risque existe potentiellement.
```

### 🔴 QUESTION CENTRALE DE L'AUDIT TRANCHÉE : NON, pas visible sur les deux vues

```
Publication réelle réussie depuis le compte de Paul (bouton "Faire 
remplacer mon absence"). Mission créée :
profileId = LE CABINET (jcdubien) - PAS Paul
cabinetPostId = poste Mathéo
REMPLACEMENT/RECHERCHE, 01/12->20/12/2026

| Vue | Résultat |
|---|---|
| /planning de jcdubien, ligne Mathéo | ✅ l'annonce y est |
| /disponibilites de Paul | ❌ "Aucune recherche publiée" alors qu'il vient de publier |
```

### 🔴🔴 DÉCOUVERTE PLUS GRAVE QUE PRÉVU — l'assistant est verrouillé hors de sa propre création

```
En nettoyant après le test, Paul a reçu 403 INTERDIT en tentant 
d'agir sur SA PROPRE mission (qu'il venait de créer). La route exige 
mission.profileId === session.profileId - or la mission appartient 
au CABINET (par construction du flux), pas à Paul.

CITATION EXACTE, à retenir : "L'assistant peut publier. Il ne peut 
ni voir, ni suivre, ni annuler. C'est plus sévère que ce que 
l'analyse statique laissait prévoir."

Nettoyage a dû être fait par accès direct base (Opus), Paul ne 
pouvant PAS le faire lui-même depuis le produit - confirme la 
gravité du blocage.
```

### Décision — réordonnancement des 3 pistes restantes

```
✅ AUTORISÉ ET PRIORISÉ EN PREMIER (changement d'ordre par rapport à 
   la proposition d'Opus) : permettre à l'assistant de RETIRER sa 
   propre demande (élargir le garde DELETE/gestion à cabinetPostId, 
   pas seulement profileId). Raison de la priorité : être verrouillé 
   hors de sa propre création est un blocage fonctionnel dur, plus 
   grave qu'un simple manque de confort visuel. Prompt rédigé, en 
   attente d'envoi.

🟡 Visibilité complète ("Mes recherches de remplacement") — reste en 
   attente de validation finale sur l'emplacement exact, pas de 
   changement.

🟡 Garde anti-doublon — toujours pertinent, encore plus nécessaire 
   maintenant que ni titulaire ni assistant ne voient facilement ce 
   que l'autre a fait.

4 commits en production aujourd'hui sur ce fil : 7b634ec, d8036a6 
(assistant), d1e0f8b, 42bbb6b (salarié).
```

---

## 🎉 CLÔTURE COMPLÈTE — Le fil "rattachement assistant" de toute la session, résolu de bout en bout (03/08)

### Les trois correctifs finaux, livrés ensemble (commit a1c2e66)

```
1. VISIBILITÉ — La couverture appartient au cabinet, donc 
   "mes disponibilités" (filtre profileId) ne la voyait pas. Chargée 
   désormais par le rattachement (cabinetPostId), comme le Planning 
   du titulaire. SOLUTION RETENUE, plus simple que prévu : une carte 
   "Couverture de mon absence" directement sous la bannière violette 
   (intitulé, dates, nombre de mises en relation) - PAS une nouvelle 
   section séparée comme envisagé initialement ("Mes recherches de 
   remplacement"). Plus élégant, trouvable exactement là où 
   l'utilisateur regarde après son action.

2. RETRAIT — DELETE /api/missions/[id] autorise désormais l'assistant 
   rattaché à retirer un remplacement posé sur son poste - symétrique 
   exact du droit de publier. VOLONTAIREMENT LIMITÉ AU TYPE 
   REMPLACEMENT : ne touche pas aux postes long terme du cabinet.

3. ANTI-DOUBLON — POST /api/missions refuse en 409 un remplacement 
   dont la période CHEVAUCHE (intersection, pas égalité) une annonce 
   déjà active sur le même poste, en nommant celle qui existe. 
   VOLONTAIREMENT LIMITÉ AU REMPLACEMENT : un assistanat long terme 
   et un remplacement ponctuel se chevauchent LÉGITIMEMENT - c'est le 
   cas nominal (on couvre l'absence de l'occupant du poste). Bloquer 
   ça aurait cassé le parcours qu'on venait de réparer.
```

### Vérification complète en conditions réelles, depuis le compte de Paul

```
| Correctif | Vérification |
|---|---|
| Visibilité | Bloc "Couverture de mon absence" affiché, avec dates et "Publiée sur le poste Mathéo. Visible par les remplaçants et sur le planning du cabinet." |
| Anti-doublon | 2e annonce sur 10-30 déc (chevauchement PARTIEL, pas identique à 1-20 déc) refusée avec message nommant l'annonce existante - vérifie la vraie logique d'intersection, pas un cas trivial d'égalité |
| Retrait | Clic "Retirer" depuis le compte de Paul → succès, là où la même action renvoyait 403 hier |

Nettoyage confirmé : aucune mission de test, poste détaché, cabinet à 
ses 9 missions d'origine, 1 seul match (celui d'origine).
```

### La boucle complète, résumée

```
"Il publie, il voit ce qu'il a publié, il suit les mises en relation 
reçues, il peut retirer sa demande — et ni lui ni le titulaire ne 
peuvent créer un doublon pour la même absence."

7 commits en production aujourd'hui sur cette seule chaîne (du 
déblocage du formulaire jusqu'au retrait).
```

### Ce qui reste ouvert — inchangé, toujours Phase 3, aucun urgent

```
1. Champs économiques établissement (CA/Redevance absurdes pour un 
   salarié, rémunération absente)
2. MissionType : "trois types libéraux portent aujourd'hui six 
   réalités" - Vacation/CDD/CDI ne survivent pas au formulaire (feed 
   et planning réaffichent "Remplacement"). Nécessite une migration, 
   donc une décision à part - pas urgent.
```

---

## VÉRIFICATION DÉONTOLOGIQUE — Cadrage et 7 points identifiés (03/08)

### Méthode retenue

```
Opus a correctement refusé de rendre un avis déontologique (ni 
juriste ni CDO) - propose à la place un audit FACTUEL, même méthode 
qu'aujourd'hui : chaque affirmation adossée au code/base. Livrable : 
tableau surface produit -> règle concernée -> ce que fait l'app 
aujourd'hui (avec preuve) -> question à trancher.

Point de départ encourageant : les modèles de contrat contiennent 
déjà un avertissement "à faire valider par avocat/Ordre", clause 
RCP, saisine préalable du CDO (R.4321-99 al.2), déclaration 
d'absence de convention secrète, Article 21 (communication à 
l'Ordre sous un mois).
```

### 3 points FACTUELS, concrets, avec correctifs clairs (approuvés)

```
1. COMMUNICATION À L'ORDRE = une clause, pas un acte. Le contrat dit 
   qu'elle "sera communiquée" sous un mois - rien dans le produit ne 
   le rappelle après signature, n'en trace la date, ni ne relance. 
   Obligation réglementaire, et la plateforme sait exactement quand 
   un contrat est signé.

2. enforceContractProfile À FALSE PAR DÉFAUT — RPPS/Ordre/adresse/
   SIRET ne sont que des avertissements. Un contrat peut être signé 
   avec une identité contractuelle incomplète, sans vérification que 
   le signataire est bien inscrit au tableau. (Connexion : ce flag 
   était déjà identifié tôt dans le projet comme "à activer au 
   Sprint 3", jamais fait.)

3. AUTORISATION DE REMPLACEMENT jamais demandée — un remplaçant doit 
   en détenir une, délivrée par son CDO. Aucun champ de ce type dans 
   le schéma.
```

### 4 points D'ARBITRAGE, documentés sans trancher (pour le CDO)

```
4. Publicité et valorisation — pages publiques annoncent CA/taux, 
   indexées Google Jobs. Frontière information loyale / promotion 
   commerciale ?

5. Notation entre confrères — 3 modèles existent, ratingAvg participe 
   au tri du feed. ⚠️ PRÉCISION DEMANDÉE (23/07→03/08, question 
   initiale de ce fil) : la question FACTUELLE (champ commentaire 
   libre côté notation candidat existe-t-il ? est-il déjà en usage 
   réel ?) reste à établir précisément, séparément de la question 
   d'arbitrage plus large.

6. Mise en avant payante — rendue transparente ce matin (feed). 
   Question de fond : classement dépendant de l'abonnement, tenable 
   vis-à-vis de l'égalité entre confrères ?

7. 🔴 SIGNALÉ EN PRIORITÉ — Commission au contrat (plan Structure : 
   "89€/mois + 20€/contrat"). Une commission indexée sur le NOMBRE 
   DE CONTRATS entre professionnels de santé touche potentiellement 
   au COMPÉRAGE et au PARTAGE D'HONORAIRES — notions à vraie portée 
   en droit de la santé français, pas une simple nuance. Si le 
   modèle économique lui-même pouvait être requalifié ainsi, c'est 
   une question de STRUCTURE TARIFAIRE à revoir, pas juste une 
   fonctionnalité à ajuster. À faire remonter en priorité au CDO, 
   avant les 3 autres points d'arbitrage.
```

### Statut

```
✅ Périmètre validé par Jean-Charles. Opus continue sur les points 
1-3. Point 5 : précision factuelle demandée avant classement 
définitif en arbitrage. Point 7 : signalé comme le plus consequential 
des 4, priorité de remontée au CDO.
```

---

## CORRECTION DE SUIVI — La vérification déontologique n'était pas "en attente depuis le début" (03/08)

### Erreur reconnue

```
Sonnet a affirmé à plusieurs reprises que la vérification 
déontologique était "le point le plus ancien, en attente depuis le 
début de la session" - FAUX. Le prompt avait été rédigé le 29/07 
dans une session antérieure, mais jamais confirmé transmis à cette 
session-ci d'Opus. Sonnet a continué à le lister comme "en attente" 
sur la seule base de l'intention de Jean-Charles de l'envoyer, sans 
jamais vérifier la réception réelle - exactement l'erreur de 
méthode déjà identifiée et nommée plus tôt dans cette même session 
(incident ROADMAP.md, fausse alerte timeline) : vérifier avant 
d'affirmer. Leçon non appliquée à son propre suivi.

Conséquence limitée : l'audit finalement mené (en réponse à "comment 
vérification déontologique ?") est excellent et couvre largement le 
besoin - juste une reformulation nécessaire, pas de perte réelle.
```

## AUDIT DÉONTOLOGIQUE — Résultat des 3 points factuels (03/08)

### 1. Communication à l'Ordre : une clause, jamais un acte

```
Obligation bien présente dans les 3 templates de contrat (article 
21). Mais "Ordre" n'apparaît QUE dans les PDF - aucune autre surface 
produit ne le mentionne. AUCUN champ de suivi en base (pas de date 
d'envoi, pas de statut, pas de relance) - alors que la plateforme 
trace déjà CONTRACT_SIGNED et sait exactement quand agir.
```

### 2. Vérification d'identité : un avertissement, pas une condition

```
PlatformConfig.enforceContractProfile = FALSE en production, vérifié 
en base. Mécanisme de blocage existe (contrat/route.ts:132) mais 
désarmé.

Mesure sur les 8 comptes réels : UN SEUL compte sur huit est vérifié 
RPPS. Un contrat peut aujourd'hui être signé entre deux praticiens 
dont ni l'inscription au tableau ni le numéro d'Ordre ne sont 
renseignés.
```

### 3. Autorisation de remplacement : n'existe pas dans le modèle

```
Aucun champ nulle part - le schéma porte rpps/numeroOrdre/adresse/
siret/isVerified, rien qui corresponde à l'autorisation delivrée par 
le CDO que doit détenir un remplaçant. Des contrats de remplacement 
sont générés sans jamais demander la pièce qui les autorise.
```

### 4 points d'arbitrage — précision sur le point 5

```
Notation entre confrères : 3 modèles existent (Rating, CabinetRating, 
RemplacantRating), ratingAvg participe au tri du feed — MAIS ZÉRO 
NOTATION EN BASE À CE JOUR. Le sujet est donc entièrement ouvert, 
pas encore un risque actif (contrairement à la crainte initiale d'un 
usage réel déjà en cours). Bon moment pour décider AVANT tout 
premier usage, pas pour corriger un usage existant.
```

### Décision — Fix 1 pris en premier

```
✅ ARMER enforceContractProfile — décision prise par Jean-Charles 
("1"). Effet à connaître : 7 comptes sur 8 seraient bloqués tant 
qu'ils n'ont pas complété leur profil. Opus vérifie précisément CE 
QUE le blocage bloque (génération PDF seule, ou aussi signature) 
avant de basculer - bonne prudence, en cours.

Rappel : points 4, 6, 7 restent à faire valider par le CDO de Jean-
Charles, pas par Opus ni Sonnet - l'inventaire ne vaut pas avis.
```

---

## RATTACHEMENT AUTOMATIQUE — Bug CONFIRMÉ avec preuve en production (03/08)

### Le bug, avec preuve réelle

```
attachAssistantPostForMatch (signature/route.ts:196) a pour garde :
if (cabinet.type !== TITULAIRE || assistant.type !== ASSISTANT) return;

Mais le feed autorise DEUX types à matcher une mission d'assistanat :
oppositeTypes = [REMPLACANT, ASSISTANT]

Un profil REMPLACANT peut donc signer un contrat d'assistanat SANS 
jamais être rattaché - silencieusement, sans erreur, sans trace.

PREUVE EN PRODUCTION (pas hypothétique) : le SEUL contrat d'assistanat 
jamais signé sur la plateforme (23/07, match cmrujdgx1...) n'a créé 
AUCUN rattachement. 12 postes ont fini avec linkedUserId = null. 
Même angle mort au détachement (l.97).
```

### Décision — interprétation retenue

```
Deux lectures possibles :
1. Voulu (un remplaçant qui signe un assistanat devrait d'abord 
   changer de type de profil, à lui dire au moment du match/signature)
2. Oubli (le type de profil décrit ce qu'on cherche, pas ce qu'on 
   devient - le garde doit s'élargir au type de MISSION, pas au type 
   de candidat)

✅ DÉCISION (03/08) : Interprétation 2 retenue, préférence d'Opus 
suivie. Cohérent avec le principe déjà posé "collaborateur = 
assistant", et avec le fait que le feed encourage lui-même ce match. 
CONNEXION IMPORTANTE : c'est une manifestation concrète et déjà 
survenue de la tension "chercheur/pourvoyeur" documentée plus tôt 
(section vision architecture) - le type de profil comme identité 
figée VS comme simple préférence de recherche. Contrairement à la 
grande refonte de Phase 3, ce correctif reste CIRCONSCRIT (une 
condition à 2 endroits : attache + détache), pas une réécriture de 
ProfileType partout - traité maintenant, pas différé.
```

### Statut

```
🟡 Prompt à rédiger : élargir le garde de rattachement automatique 
(attache ET détache) pour se baser sur le type de MISSION 
(ASSISTANAT/COLLABORATION) plutôt que sur le type du candidat.
```

---

## DEUX BUGS UI SIGNALÉS — création annonce/disponibilité (03/08, fin de session)

### 1. "Ouvrir les champs" affiché à tort sur desktop

```
Sur /missions/create (desktop, layout deux colonnes), le lien 
"Ouvrir les champs" apparaît alors que les champs sont déjà visibles 
à l'écran - comportement probablement pensé pour mobile (champs 
repliés par défaut), appliqué à tort sur desktop où rien n'est à 
ouvrir.
```

### 2. "Toute la Guadeloupe" seul pourrait ne pas satisfaire la validation "au moins une zone"

```
Sur /disponibilites/create, le texte d'aide dit que "Toute la 
Guadeloupe" équivaut à "aucune restriction géographique" - 
sélectionnable comme une zone valide. Signalement à vérifier : ce 
choix seul (sans autre zone) laisserait le bouton de publication 
grisé, si la validation ne reconnaît pas cette sélection comme 
suffisante.
```

### Statut

```
🟡 2 prompts rédigés, en attente d'envoi.
```

---

## enforceContractProfile ARMÉ — Effet réel mesuré + trou de sécurité trouvé (03/08)

### Bascule effectuée

```
✅ false -> true en production, via toggle /admin/config existant. 
Aucun code modifié.
```

### Effet réel, corrigé après vérification (pas l'estimation initiale)

```
Règle réelle (lib/contractProfile) : praticiens = RPPS + numéro 
Ordre + adresse ; structures = SIRET + adresse. Le SIRET N'EST PAS 
exigé d'un praticien - correction de l'estimation initiale ("7 sur 
8").

Résultat mesuré : SEULEMENT 2 comptes sur 8 passent (Jean-Charles 
DUBIEN, Julien MORISOT) - et ce sont précisément les deux qui ont 
une relation/contrat en cours. Les 6 autres sont bloqués avec 
message explicite ("Identité contractuelle incomplète") jusqu'à 
complétion de profil.
```

### 🔴 TROU DE SÉCURITÉ TROUVÉ — le garde protège le PDF, pas la signature

```
Vérifié AVANT de basculer (bonne discipline) : le blocage ne vit QUE 
dans la génération du PDF (contrat/route.ts:132). La route de 
SIGNATURE ne vérifie RIEN - aucune occurrence du contrôle d'identité.

En pratique le parcours normal est fermé (sans PDF généré, 
l'utilisateur n'atteint pas l'étape de signature via l'interface). 
Mais l'ENDPOINT reste ouvert : rien au niveau API n'empêche de 
signer un contrat dont l'identité contractuelle est incomplète.

Formule retenue : "Le drapeau protège le chemin normal, pas la porte 
de service." 

CONNEXION : même famille que l'audit permissions complet mené plus 
tôt dans le projet (findings #1-8, protection UI sans equivalent 
serveur) - une 9e variante du même défaut de fond.

✅ DÉCISION (03/08) : fermer aussi ce trou. Correctif ciblé demandé : 
même vérification, mêmes conditions, ajoutée dans signature/route.ts.
```

### Ce qui reste ouvert (inchangé)

```
- Rappel post-signature de communication à l'Ordre (avec champ de 
  suivi) - pas encore pris
- Champ "autorisation de remplacement" - pas encore pris
- 4 arbitrages (publicité, notation, mise en avant payante, 
  rémunération au contrat) - pour le CDO de Jean-Charles, pas Opus 
  ni Sonnet. Note utile sur la notation : zéro note en base 
  actuellement, moment favorable pour décider avant tout usage réel.
```

### Statut

```
✅ enforceContractProfile armé et vérifié. 🟡 Fermeture de la faille 
signature/route.ts autorisée, en attente d'envoi/exécution.
```

---

## FERMETURE DE LA PORTE DE SERVICE — Signature protégée + message proactif décidé (03/08)

### Livré

```
✅ Garde étendu à signature/route.ts (commit 1b40bd7) - mêmes 
conditions que la génération PDF. Message adaptatif selon le côté 
défaillant ("complétez votre profil" vs "l'autre partie doit 
compléter le sien"). Non vérifié à l'écran par choix éthique (aurait 
nécessité de monter une relation avec un compte tiers incomplet, 
refusé de le faire sans directive explicite) - raisonnement logique 
jugé suffisant (les 2 seuls comptes complets sont precisement ceux 
qui passent).
```

### ✅ LIVRÉ — Message proactif aux deux emplacements (commits, dont 1a52258)

```
DEUX EMPLACEMENTS, RAISON DISTINCTE POUR CHACUN :
- "Mon compte" : prévient "un jour" - bandeau visible à la prochaine 
  connexion si identité incomplète. Calcul sur L'ÉTAT COURANT DU 
  FORMULAIRE (pas le profil enregistré) - disparaît en tapant, sans 
  attendre la sauvegarde. Bon détail UX, évite de reprocher à 
  l'utilisateur ce qu'il vient de saisir.
- Fiche de mise en relation, au-dessus du bouton contrat : prévient 
  "maintenant, pour CE contrat-là", avec lien direct "Compléter mon 
  profil →" vers /compte. RIEN affiché pour un poste salarié (aucun 
  contrat n'y est généré, évite d'inquiéter sans objet).

Les deux ensemble évitent l'angle mort qu'un seul aurait laissé : on 
ne va pas sur "Mon compte" sans raison, et découvrir l'exigence sur 
la fiche sans savoir où la résoudre agace.

✅ ARCHITECTURE SALUÉE : AUCUNE DUPLICATION DE LOGIQUE. Les 4 
surfaces (2 gardes serveur + 2 avertissements) appellent TOUTES 
missingContractLabels (lib/contractProfile) - "source unique de 
vérité, partagée serveur et client", déjà conçue comme telle avant 
même cette feature. Si la règle change, les 4 suivent 
automatiquement.

Non vérifié à l'écran (le match test JC↔Julien concerne précisément 
les 2 seuls comptes complets, donc rien à voir sur cette fiche pour 
ce cas) - jugé non nécessaire, la logique s'appuie sur la même 
fonction déjà éprouvée par les gardes serveur (exigence de justesse 
plus haute que celle-ci). À observer à la prochaine connexion 
naturelle sur un compte incomplet.
```

### Récapitulatif de l'audit déontologique — état final de la session

```
✅ FAIT : enforceContractProfile armé + garde étendu à la signature 
   (fermeture complète du "chemin normal" ET de la "porte de service")
✅ FAIT : message proactif décidé, prompt prêt
🟡 RESTE À PRENDRE (proposé par Opus, pas encore choisi) : rappel 
   post-signature de communication à l'Ordre (avec champ de suivi), 
   champ "autorisation de remplacement"
⚪ POUR LE CDO DE JEAN-CHARLES, PAS POUR OPUS NI SONNET : publicité/
   valorisation des annonces, notation entre confrères (moment 
   favorable - zéro note en base), mise en avant payante, 
   rémunération au contrat (compérage/partage d'honoraires - le plus 
   consequential, signalé en priorité)
```

---

## RÉ-AUDIT FINAL DE LA SESSION — 6/7 vérifiés, découverte sur la portée du droit de retrait (03/08, clôture)

### Découverte — le droit de retrait est plus large qu'annoncé

```
Testé en conditions réelles : Paul a supprimé une annonce publiée 
par le TITULAIRE (pas par lui-même) sur son propre poste - le garde 
ouvert ce matin autorise le retrait de TOUTE couverture posée sur le 
poste, quel qu'en soit l'auteur, pas seulement "ce que j'ai publié" 
comme présenté initialement.

CAUSE : le modèle de données ne porte aucun champ d'auteur (Mission 
n'a que profileId=cabinet et cabinetPostId=poste) - impossible de 
distinguer "ma demande" de "celle du cabinet" sans migration.

DEUX OPTIONS PRÉSENTÉES, DÉCISION PRISE :
1. ✅ RETENUE — Assumer : le poste est celui de l'assistant, la 
   couverture concerne son absence, il en dispose (comportement 
   actuel, aucun changement nécessaire)
2. Restreindre — ajouter createdByUserId, migration, garde affiné 
   (NON retenue)
```

### ✅ BONNE PRATIQUE NOTÉE — commentaire de code corrigé pour refléter la portée réelle

```
Commit a4d4933, commentaire SEUL, aucun changement de comportement. 
Le commentaire décrivait initialement un droit plus étroit ("retirer 
ce que j'ai publié") que ce que le code accorde réellement. Corrigé 
pour documenter la PORTÉE RÉELLE + LA RAISON DE L'ARBITRAGE 
(contrainte du modèle de données + décision assumée), pas seulement 
le comportement.

PRINCIPE À RETENIR : un commentaire qui explique le POURQUOI d'un 
arbitrage, pas seulement le QUOI du code, évite qu'un futur lecteur 
(humain ou IA) ne "corrige" par erreur un comportement volontaire en 
le prenant pour un oubli.
```

### Bilan des vérifications du ré-audit — 6 sur 7

```
| Correctif | Statut |
|---|---|
| Bandeau proactif "compléter le profil" | ✅ vérifié à l'écran, compte Paul |
| Réglage "ouvert aux postes salariés" | ✅ vérifié, section dédiée |
| "Ouvrir les champs" masqué sur desktop | ✅ largeur nulle à 1440px |
| Anti-doublon | ✅ 409 nommant l'annonce, depuis les 2 comptes |
| Sous-lignes du planning (z-index) | ✅ brique 47px sur sa propre bande |
| Chaîne titulaire→assistant→décembre | ✅ les 2 vues, publication ET retrait |
| Message d'état vide établissement | ⏳ SEUL non observé - reporté |
```

### Décision de clôture de session

```
✅ Le point restant (message établissement) N'EST PAS vérifié à 
l'écran ce soir - raisonnement jugé suffisant (condition déjà 
confirmée vraie en production par requête directe, changement de 
texte pur, risque faible). Reporté à la prochaine connexion 
naturelle sur ce compte, pas de session supplémentaire forcée.

PRINCIPE DE CLÔTURE RETENU (citation à conserver) : "l'expérience de 
cette session dit qu'un écran non regardé cache parfois un titre en 
double ou un libellé resté en vocabulaire candidat" - la meilleure 
synthèse de la leçon de toute la journée : la compilation et la 
logique seules ne garantissent jamais qu'un écran dit ce qu'on croit 
qu'il dit. Principe à conserver pour toutes les sessions futures.
```

---

## 🏁 CLÔTURE DÉFINITIVE DE LA SESSION MARATHON DU 03/08 — 25 commits

### Dernier correctif vérifié à l'écran

```
Message d'état vide établissement CONFIRMÉ CORRECT : "Aucun candidat 
ouvert aux postes salariés pour l'instant [...] aucun ne l'a fait à 
ce jour. Ils apparaîtront ici dès qu'un premier l'activera." - dit 
enfin la vérité, là où l'ancien promettait une correspondance qui 
n'aurait jamais pu arriver.

🟡 Incohérence mineure trouvée au passage : sous ce message, le 
bouton reste "+ Publier une annonce" (hérité de l'état vide 
générique) - l'établissement a déjà une annonce en ligne, en publier 
une seconde ne débloque rien (le verrou est côté candidat). Non 
traité, priorité basse.

Base restaurée exactement à l'état trouvé : aucune mission de test, 
aucun poste rattaché, un seul match, arbre git propre.
```

### 🎯 LES 4 PARCOURS, AVANT/APRÈS CETTE SESSION — le résumé qui compte

```
REMPLAÇANT — Identité complète, contrat autorisé. Le SEUL parcours 
qui n'a jamais rien cassé aujourd'hui.

ASSISTANT — Le plus transformé. Ce matin : "Faire remplacer mon 
absence" menait à un formulaire IMPOSSIBLE à soumettre, la 
fonctionnalité n'existait tout simplement pas. Ce soir : il publie, 
voit sa couverture, la suit, la retire — et un doublon est refusé 
des deux côtés.

TITULAIRE — Les pièges d'affichage silencieux sont levés : 
sous-lignes du planning (une brique de 47px ne disparaît plus sous 
une annonce ouverte — impact production réel déjà confirmé), chip 
périmé qui vidait le feed, lien "Ouvrir les champs" fantôme sur 
desktop.

SALARIÉ/RECRUTEUR — Passé d'INEXISTANT à FONCTIONNEL. Était aveugle 
dans les deux sens ; ouvertSalariat activable depuis le compte, feed 
qui s'ouvre dès qu'un candidat coche l'option, écran vide qui dit 
enfin la vérité au lieu de promettre l'impossible.
```

### Ce qui reste, non traité (inventaire final)

```
3 défauts connus, non corrigés :
- Champs économiques du parcours salarié (CA/redevance absurdes, 
  aucune rémunération demandée)
- MissionType : 3 types libéraux portant 6 réalités (Vacation/CDD/
  CDI ne survivent pas au formulaire)
- Bouton "+ Publier une annonce" sous l'état vide établissement 
  (action sans effet)

2 points déontologiques ouverts (proposés, pas encore pris) :
- Rappel de communication à l'Ordre (clause posée, acte jamais 
  rappelé ni tracé)
- Champ "autorisation de remplacement" absent du modèle

🔴 POINT DE VIGILANCE IMMÉDIAT, ACTION MANUELLE POSSIBLE :
enforceContractProfile armé -> 6 comptes sur 8 bloqués pour 
générer/signer. DEUX D'ENTRE EUX PUBLIENT DÉJÀ DES ANNONCES. Le 
bandeau les préviendra à leur PROCHAINE visite du compte, mais rien 
ne les alerte proactivement avant ça. Si l'un de ces 2 comptes est 
un vrai testeur (pas un compte de Jean-Charles), un message direct 
éviterait la découverte du mur sans explication.
```

### Bilan chiffré de la session

```
25 commits poussés en une seule session. Quatre fils majeurs 
entièrement clos : chaîne assistant, parcours salarié, audit 
déontologique, refonte du scoring. Plusieurs bugs de production 
réels trouvés ET corrigés (pas théoriques) : z-index cachant un vrai 
recrutement, 403 verrouillant un assistant hors de sa propre 
création, taux de rétrocession affiché inversé (session précédente), 
agenda privé exposé publiquement (session précédente).

PRINCIPE DE MÉTHODE LE PLUS IMPORTANT DE TOUTE CETTE SESSION : la 
compilation ne suffit jamais à garantir qu'un écran dit ce qu'on 
croit qu'il dit. Quatre découvertes aujourd'hui (titre en double, 
libellé au mauvais vocabulaire, brique invisible malgré données 
justes, droit plus large que documenté) qu'aucune lecture de code 
seule n'aurait trouvées.
```
