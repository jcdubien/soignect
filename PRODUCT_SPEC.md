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
