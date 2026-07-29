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
