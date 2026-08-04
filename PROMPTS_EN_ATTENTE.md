# PROMPTS EN ATTENTE — cumul au 27/07

> Jean-Charles en est au point 2 de la série d'audit (layout desktop deux colonnes).
> Ce document cumule TOUT ce qui reste à envoyer, dans l'ordre recommandé.

---

# SÉRIE AUDIT — reste 3 sur 5

## A3. BUG — "Dates bloquées" apparaît comme annonce consultable

```
═══════════════════════════════════
FIX — Exclure les missions INDISPONIBLE des annonces consultables
═══════════════════════════════════

CONTEXTE
Le correctif du RecentMissionsTray purge les annonces INACTIVES. Mais 
une mission de type INDISPONIBLE ("Dates bloquées", créée depuis la 
timeline) peut être ACTIVE en base — c'est une erreur de catégorie, 
pas un problème d'état. Elle continue donc probablement d'apparaître.
Constaté en session live : "Dates bloquées · Pointe-à-Pitre" listé 
dans "Dernières annonces consultées".

FIX
Exclure les missions INDISPONIBLE (briqueStatus) partout où une 
annonce est présentée comme consultable :
- RecentMissionsTray et son endpoint active-check
- Le feed
- La page publique /annonce/[id] — une indisponibilité ne devrait pas 
  y être accessible du tout

Une indisponibilité est un marqueur de calendrier privé, jamais une 
offre.

npm run build à la fin.
git add . && git commit -m "fix: missions INDISPONIBLE jamais presentees comme annonces consultables" && git push
```

---

## A4. COHÉRENCE — Unifier le vocabulaire des mises en relation

```
═══════════════════════════════════
COHÉRENCE — Unifier le vocabulaire des mises en relation
═══════════════════════════════════

CONTEXTE
Une même notion porte quatre noms différents dans l'interface :
- Navigation : "Relations"
- Titre de page : "Mes mises en relation"
- Tray sur /annonces : "VOS MISES EN RELATION" à côté de "VOS CHOIX"
- Route technique : /matches

Pour un produit dont la promesse est la simplicité, c'est de la 
charge mentale gratuite.

FIX
Choisis UN terme et applique-le partout dans l'interface visible. 
Recommandation : "Mises en relation" (le plus explicite pour un 
professionnel de santé, moins jargonneux que "match"), avec 
"Relations" comme forme courte acceptable en navigation si la place 
manque.

La route technique /matches peut rester telle quelle (invisible pour 
l'utilisateur, la changer casserait des liens existants) — c'est 
l'interface visible qu'il faut unifier.

Rapporte la liste des endroits que tu as harmonisés.

npm run build à la fin.
git add . && git commit -m "fix: unification du vocabulaire mises en relation dans toute l'interface" && git push
```

---

## A5. FINITION — Typographie + CA/rétrocession encouragés sans être imposés

```
═══════════════════════════════════
FINITION — Espace manquante + encourager CA/rétrocession sans les imposer
═══════════════════════════════════

CONTEXTE
Deux points de finition sur /missions/create.

FIX 1 — TYPOGRAPHIE
"Décrivez votre besoin en toute liberté— dates, commune, taux…" : 
espace manquante avant le tiret cadratin. Doit être "liberté — dates".

FIX 2 — CA ET RÉTROCESSION : ENCOURAGÉS, PAS IMPOSÉS
Décision produit confirmée : le CA estimé et le taux de rétrocession 
restent FACULTATIFS (les rendre bloquants ferait fuir des titulaires 
qui ne veulent pas publier ces chiffres — sur 5 annonces réelles 
analysées, une seule publiait son CA).

En revanche, quand ils manquent, le bouton "Optimiser mon annonce" 
doit les faire remonter en priorité dans ses suggestions, avec un 
argument concret pour le candidat (ex : "ajouter votre CA estimé et 
le taux de rétrocession permet au candidat de se projeter 
financièrement — les annonces qui le font reçoivent plus de 
candidatures").

Ne les ajoute PAS à la liste des champs obligatoires de publication.

npm run build à la fin.
git add . && git commit -m "fix: typographie tiret cadratin + CA/retro encourages via bouton optimiser" && git push
```

---

# HORS SÉRIE AUDIT

## B1. DESIGN — Boutons du carrousel (décision du 27/07)

```
═══════════════════════════════════
DESIGN — Boutons du carrousel : swipe seul sur mobile, contrôles textuels sobres sur desktop
═══════════════════════════════════

CONTEXTE
Les deux gros boutons ronds (croix et cœur) alourdissent le design et 
donnent une couleur "application de rencontre" qui ne colle pas à un 
outil professionnel. Décision : les supprimer sur mobile au profit du 
geste seul, et les remplacer sur desktop par des contrôles textuels 
sobres.

Cohérent avec le principe produit : mobile-first pour le chercheur de 
poste (qui swipe naturellement), desktop-first pour l'employeur (qui 
n'a pas de geste de swipe à la souris et a besoin d'un contrôle 
explicite).

MOBILE
- Supprimer les boutons ✕ et ♥
- L'interaction se fait uniquement au swipe (gauche = passer, droite 
  = intéressé), comportement déjà en place

DESKTOP
- Remplacer les deux boutons ronds par deux contrôles TEXTUELS et 
  SOBRES : "Passer" et "Intéressé"
- Style discret, cohérent avec le reste de l'interface titulaire 
  (Material Design sobre) — pas de gros boutons colorés, pas d'icônes 
  émotionnelles
- Conserver / ajouter les raccourcis clavier ← et → en complément 
  (vérifie s'ils existent déjà)

VÉRIFIE AUSSI
- Que le drag/swipe à la souris n'existe pas déjà sur desktop
- Accessibilité : quelqu'un qui ne peut pas faire un geste précis doit 
  conserver un moyen d'agir sur mobile — signale-moi si la suppression 
  des boutons pose un problème, avec ta recommandation

NE PAS TOUCHER
- La logique de swipe elle-même (enregistrement, scoring, matching)
- Le tray des sélectionnés en bas de l'écran

npm run build à la fin.
git add . && git commit -m "design: swipe seul sur mobile, controles textuels sobres sur desktop" && git push
```

---

## B2. BUG — Bouton "Déconnexion" serré sur mobile

```
═══════════════════════════════════
BUG UI — "Déconnexion" serré/mal positionné (mobile)
═══════════════════════════════════

CONTEXTE
Sur mobile, l'élément "Déconnexion" du header apparaît serré à gauche 
de l'écran — probable problème de layout/débordement dans la barre 
d'outils mobile, qui contient déjà plusieurs éléments (logo, badge 
profil, badge zone, bouton Annonce, cloche).

À INVESTIGUER
1. Reproduire sur mobile et capturer l'état exact
2. Vérifier si "Déconnexion" reste un texte complet sur mobile ou 
   s'il devrait être une icône compacte comme d'autres éléments du 
   header à cette largeur
3. Vérifier l'ensemble du header mobile pour d'éventuels autres 
   éléments serrés dans le même espace restreint

FIX ATTENDU
Un header mobile propre, sans élément écrasé — envisage de 
transformer "Déconnexion" en icône seule sur mobile si l'espace est 
trop contraint.

npm run build à la fin.
git add . && git commit -m "fix: bouton deconnexion serre sur mobile" && git push
```

---

## B3. BUG — Image OG : texte tronqué, infos essentielles

```
⚠️ PARTIELLEMENT TRAITÉ — Claude Code a déjà travaillé dessus 
(dimensionnement dynamique de police, badge différencié cabinet/
candidat). À vérifier avant de renvoyer : le rendu est-il maintenant 
correct sur le débogueur Facebook ?

RAPPEL PIÈGE : le débogueur Facebook met en cache agressivement. Si 
l'ancienne image apparaît, cliquer "Scrape Again" pour forcer le 
rechargement avant de conclure à un bug.

Si le problème persiste après Scrape Again :

═══════════════════════════════════
BUG — Image de partage (OG) : texte tronqué, informations essentielles manquantes
═══════════════════════════════════

CONTEXTE
L'image dynamique de partage (opengraph-image.tsx) affiche du texte 
coupé au cadrage (constaté sur un aperçu de partage Facebook réel).

FIX
Revoir la mise en page pour afficher clairement, sans troncature :
1. Type de poste (Remplacement / Assistanat / Collaboration, et côté 
   candidat "Remplaçant disponible" / "Assistant recherche poste")
2. Dates (même approximatives — "Septembre 2026" plutôt que tout 
   couper)
3. Commune

Le texte doit être DIMENSIONNÉ pour tenir dans le cadre (1200×630) — 
ajuste la taille de police dynamiquement selon la longueur plutôt que 
de laisser déborder. Priorité à la lisibilité sur mobile (c'est là 
que la plupart verront cette carte dans leur fil Facebook).

npm run build à la fin.
git add . && git commit -m "fix: image OG partage - texte non tronque, type/dates/commune lisibles" && git push
```

---

## B4. FEATURE — Flux d'invitation par email (rattachement poste↔assistant)

```
⚠️ GROS CHANTIER — nouveau modèle, nouvelle route, nouvel email, 
adaptation du flux d'inscription. À envoyer seul, pas dans un lot.

═══════════════════════════════════
FEATURE — Flux d'invitation par email pour rattacher un poste à un futur compte assistant
═══════════════════════════════════

CONTEXTE
Gap confirmé en lecture seule : un titulaire ne peut rattacher un 
poste qu'à un compte ASSISTANT DÉJÀ EXISTANT (recherche par email). 
Il n'existe aucun moyen d'inviter quelqu'un qui n'a pas encore de 
compte Soignect.

AVANT DE CODER — INVESTIGUE
1. Comment fonctionne le flux d'inscription actuel (étapes, 
   paramètres d'URL déjà supportés) — réutiliser au maximum
2. Existe-t-il déjà un mécanisme de token/lien à durée limitée 
   ailleurs dans l'app ?

MÉCANISME PROPOSÉ (ajuste si tu identifies mieux)

1. SCHÉMA (additif)
   model PosteInvitation {
     id             String    @id @default(cuid())
     cabinetPostId  String
     invitedEmail   String
     token          String    @unique
     status         String    @default("PENDING")
     createdAt      DateTime  @default(now())
     expiresAt      DateTime
   }

2. ROUTE POST /api/cabinet-posts/[id]/invite
   - Réservée au titulaire propriétaire (même garde que /link)
   - Si un compte existe déjà pour cet email → erreur claire 
     renvoyant vers le rattachement manuel (/link), pas de double 
     mécanisme pour le même cas
   - Sinon : PosteInvitation avec token unique, expiration 7 jours, 
     envoi de l'email

3. EMAIL sendPosteInvitationEmail
   - Pré-rempli avec le nom du cabinet et l'intitulé du poste
   - Lien /register?inviteToken=xxx
   - Style cohérent avec les emails existants (lib/email.ts)

4. FLUX D'INSCRIPTION ADAPTÉ
   - inviteToken présent → pré-sélectionner et verrouiller le type 
     de profil sur ASSISTANT
   - Message contextuel ("Vous avez été invité·e par [cabinet] pour 
     le poste [intitulé]")
   - Après inscription réussie → rattachement automatique au poste + 
     PosteInvitation marqué USED
   - Gérer token expiré/déjà utilisé avec message clair

5. UI CÔTÉ TITULAIRE
   - Sur PostAssistantLink, ajouter "Inviter par email" à côté du 
     rattachement manuel — les deux doivent cohabiter clairement 
     (rattacher un compte existant VS inviter quelqu'un de nouveau)

NE PAS TOUCHER
- Le rattachement manuel /link (reste pour les comptes existants)
- Le rattachement automatique à la signature 
  (attachAssistantPostForMatch)

npm run build à la fin.
git add . && git commit -m "feat: flux d'invitation par email pour rattachement poste-assistant" && git push
```

---

## B5. BUG — Annonce postée depuis timeline "Assistant 1" n'apparaît nulle part

```
═══════════════════════════════════
BUG — Annonce postée depuis la timeline d'un poste assistant rattaché n'apparaît pas
═══════════════════════════════════

CONTEXTE
Clic sur la zone timeline du poste "Assistant 1" (rattaché, Confirmé) 
dans le Planning cabinet, pour poser une annonce couvrant le trou 
détecté ("Assistant 1 sans couverture dans 9 semaines"). Rien 
n'apparaît après création.

À VÉRIFIER EN CONDITIONS RÉELLES (base + session live, PAS seulement 
une relecture de code)
1. La Mission a-t-elle été créée en base ? (liée à ce CabinetPost, 
   avec les bonnes dates)
2. Si OUI : pourquoi ne se rend-elle pas sur la ligne "Assistant 1" 
   du Planning ? Compare avec une ligne qui fonctionne (ex: la ligne 
   titulaire juste au-dessus)
3. SÉPARÉMENT : doit-elle apparaître sur /disponibilites du compte 
   ASSISTANT rattaché ? Vérifie ce côté aussi
4. Si la Mission n'existe PAS : le clic sur cette zone (poste rattaché 
   à un assistant) déclenche-t-il le bon flux ? Compare avec le clic 
   sur un poste NON rattaché pour isoler si le rattachement change 
   la logique

Rapporte precisément avec les vraies données (IDs, dates) avant de 
proposer un fix.

npm run build à la fin si un fix est nécessaire.
git add . && git commit -m "fix: annonce postee depuis timeline poste assistant rattache" && git push
```

---

## B6. REFONTE — Fusionner le champ bioTinder et le champ texte à interpréter

```
═══════════════════════════════════
REFONTE — Fusionner le champ bioTinder et le champ texte à interpréter
═══════════════════════════════════

CONTEXTE
Le formulaire de création demande aujourd'hui DEUX saisies de texte 
distinctes : le grand champ libre à interpréter, et le champ 
"accroche" (bioTinder) affiché sur la carte de swipe. L'utilisateur 
écrit donc deux fois la même chose, à deux endroits. C'est 
exactement la friction que la refonte texte libre visait à supprimer.

FIX
Une SEULE zone de saisie : le champ texte libre.

L'accroche (bioTinder) devient une DONNÉE EXTRAITE au même titre que 
les dates, la commune ou le taux :
- Au clic sur "Analyser le texte", l'IA propose une accroche courte 
  et percutante tirée du texte de l'utilisateur (une phrase, dans 
  la limite de caractères actuelle du champ)
- Elle apparaît dans la zone des champs extraits, ÉDITABLE — 
  l'utilisateur peut la reformuler, mais n'a jamais à la réécrire 
  de zéro
- Si le budget DeepSeek est épuisé ou l'analyse indisponible : repli 
  gracieux, le champ accroche reste saisissable à la main (ne jamais 
  bloquer la publication)

RÈGLE MAINTENUE
L'IA ne doit pas inventer de contenu absent du texte. L'accroche est 
une CONDENSATION de ce que l'utilisateur a écrit, pas un ajout 
créatif : pas de promesse ou d'argument qui ne figure pas dans son 
texte d'origine.

À VÉRIFIER AVANT DE CODER
1. Où le champ bioTinder apparaît-il ailleurs dans l'app (édition 
   d'une annonce existante, profil, disponibilité candidat) ? La 
   fusion doit être cohérente partout où le couple 
   "texte libre + accroche" existe, pas seulement à la création.
2. Le champ bioTinder reste-t-il nécessaire en base ? (oui a priori — 
   c'est lui qui alimente la carte de swipe et le score DeepSeek. On 
   change la façon de le REMPLIR, pas son existence.)

Rapporte ce que tu trouves au point 1 avant d'implémenter, pour 
qu'on ne casse pas un parcours d'édition existant.

npm run build à la fin.
git add . && git commit -m "refonte: accroche extraite du texte libre, fusion des deux zones de saisie" && git push
```

---

## B7. FEATURE — Page d'entrée dédiée "Venir en Guadeloupe" pour remplaçants métropolitains

```
═══════════════════════════════════
FEATURE — Page d'entrée dédiée "Venir en Guadeloupe" pour remplaçants métropolitains
═══════════════════════════════════

CONTEXTE
Aujourd'hui, tout lien externe mène vers /login — porte de service 
sans argument. Cible prioritaire identifiée : le remplaçant/assistant 
métropolitain, qui ne cherche pas un poste mais une aventure 
sécurisée (logement, véhicule, cadre de vie, réassurance sur 
l'inconnu). C'est la cible la plus rare (le côté qui manque le plus 
à la plateforme) et la plus différenciante (aucune plateforme 
nationale ne peut jouer cet argument local).

FEATURE
Nouvelle page publique /venir-en-guadeloupe, distincte de /login :
- Accroche orientée destination et réassurance, pas fonctionnalités 
  produit — parle du territoire, du cadre, de ce que ça change 
  concrètement de remplacer ici plutôt qu'ailleurs
- Preuve sociale si possible : mettre en avant les annonces réelles 
  actives qui proposent logement/véhicule (réutilise les champs 
  logementPropose et vehiculePropose s'il existe déjà, sinon 
  vérifie l'état de ce champ — voir prompt précédent sur les champs 
  manquants)
- Quelques annonces réelles visibles SANS create de compte (aperçu, 
  pas le détail complet) pour donner une preuve concrète immédiate 
  plutôt qu'une promesse abstraite
- Call-to-action vers l'inscription, en PRÉ-SÉLECTIONNANT le type de 
  profil REMPLACANT (évite à l'utilisateur une étape de choix — 
  vérifie comment le type de profil est présélectionnable au 
  parcours d'inscription, réutilise le mécanisme existant si un 
  paramètre d'URL le permet déjà, sinon ajoute-le simplement)

CONTRAINTE DE PORTÉE — IMPORTANT
Cette page est un point d'entrée UNIQUEMENT — ne construis QUE 
celle-ci. Ne construis PAS les autres pages d'entrée envisagées 
(cabinets, assistanat, établissements) : elles seront évaluées 
séparément, seulement si celle-ci convertit. Pas de nom de marque 
différent, pas de structure multi-marque — même Soignect, même 
charte graphique de base, juste un contenu et une accroche adaptés à 
cette page.

AVANT DE CODER
Rapporte comment tu comptes structurer le pré-remplissage du type de 
profil à l'inscription, avant de l'implémenter si le mécanisme 
n'existe pas déjà clairement.

npm run build à la fin.
git add . && git commit -m "feat: page d'entree dediee venir-en-guadeloupe pour remplacants metropolitains" && git push
```

---

## B8. 🔴 BUG PROD (Sentry) — Suppression d'une Mission échoue si des Swipes existent

```
═══════════════════════════════════
BUG PROD — Suppression d'une Mission échoue si des Swipes existent (contrainte de clé étrangère)
═══════════════════════════════════

CONTEXTE
Erreur Sentry en production (29/07) :
PrismaClientKnownRequestError sur prisma.mission.delete() — 
Foreign key constraint violated: Swipe_swipedMissionId_fkey

Une Mission ayant reçu au moins un Swipe (même sans match, même sans 
contrat) ne peut pas être supprimée — la base refuse à cause de la 
contrainte de clé étrangère. Le garde-fou existant pour les missions 
liées à un contrat confirmé (menu "Annonces actives") ne couvre 
visiblement pas ce cas plus courant : une annonce simplement swipée 
par quelqu'un, sans même avoir matché.

À INVESTIGUER D'ABORD
1. Confirme que c'est bien la route de suppression du menu "Annonces 
   actives" qui est en cause (ou une autre route si plusieurs existent)
2. Vérifie l'étendue : TOUTE mission ayant au moins un swipe est-elle 
   bloquée, ou seulement certains cas ?

FIX
Deux approches possibles, choisis la plus cohérente avec le reste de 
l'app (le garde-fou contrat confirmé renvoie déjà l'utilisateur vers 
"Supprimer ce match" plutôt que de planter — même logique à 
appliquer ici) :
- Suppression en cascade des Swipes liés à la Mission (perte 
  d'historique de matching, acceptable si ces swipes n'ont mené à rien)
- OU passage en soft-delete (isActive=false) au lieu d'un vrai DELETE 
  si des swipes existent, pour préserver l'intégrité historique

Dans tous les cas : plus jamais d'erreur brute remontée à 
l'utilisateur. Message clair, quelle que soit l'issue choisie.

npm run build à la fin.
git add . && git commit -m "fix: suppression mission echoue si swipes existants (contrainte FK)" && git push
```

---

## B9. BUG — Modification des dates d'une absence non répercutée sur la timeline

```
═══════════════════════════════════
BUG — Modification des dates d'une absence (Congé) non répercutée sur la timeline
═══════════════════════════════════

CONTEXTE
Sur "Mon Planning" (compte titulaire), clic sur le segment "Congé" 
de sa propre ligne, modification des dates de fin (17/08 → 31/08). 
Après enregistrement, la timeline n'est PAS mise à jour visuellement.

À VÉRIFIER EN CONDITIONS RÉELLES
1. La modification a-t-elle bien été enregistrée en base ?
2. Si oui : pourquoi le rendu ne se met-il pas à jour ? Cache client 
   non invalidé ? Absence de router.refresh() après sauvegarde ?
3. Reproduire précisément (modifier une absence EXISTANTE, pas en 
   créer une nouvelle)

FIX ATTENDU
Toute modification de dates sur une absence existante doit se 
refléter immédiatement sans rechargement manuel.

npm run build à la fin si un fix est nécessaire.
git add . && git commit -m "fix: modification dates absence non repercutee sur timeline" && git push
```

---

## B10. BUG/INCOHÉRENCE — Aucun statut d'annonce visible sur la ligne titulaire pour son propre congé

```
═══════════════════════════════════
BUG/INCOHÉRENCE — Aucun statut d'annonce visible sur la ligne de Jean-Charles pour sa propre période de congé
═══════════════════════════════════

CONTEXTE
Une annonce "Pointe-Noire, remplacement kiné août" existe (recherche 
pour couvrir le congé de Jean-Charles) mais apparaît seulement dans 
"ANNONCES NON RATTACHÉES À UN POSTE" — aucune superposition visuelle 
sur la ligne "Jean-Charles DUBIEN (titulaire)", contrairement aux 
postes d'équipe (ex: Mathéo, où le statut de recrutement s'affiche 
bien en couche sur la timeline).

À INVESTIGUER
1. Le rattachement d'une annonce à la ligne PROPRE du titulaire 
   fonctionne-t-il comme le rattachement à un poste d'équipe ?
2. Est-ce voulu ou un oubli de couverture pour ce cas précis ?
3. Compare le mécanisme d'affichage entre une ligne de poste (qui 
   fonctionne) et la ligne titulaire (qui ne semble pas l'afficher)

FIX ATTENDU (si confirmé comme oubli)
La ligne du titulaire devrait afficher le même type de superposition 
que les autres lignes — sinon Jean-Charles n'a aucun moyen visuel de 
savoir que son propre congé a une recherche active en face.

Rapporte ce que tu trouves avant de corriger — peut-être un choix de 
design distinct, pas nécessairement un bug.

npm run build à la fin si un fix est nécessaire.
git add . && git commit -m "fix: statut annonce non affiche sur ligne titulaire pour son propre conge" && git push
```

---

## B11. AJUSTEMENT — Simplifier l'affichage post-extraction (masquer champs secondaires, envoi direct)

```
═══════════════════════════════════
AJUSTEMENT — Simplifier l'affichage post-extraction : masquer les champs secondaires, envoi direct
═══════════════════════════════════
Lis PRODUCT_SPEC.md, prompt de refonte "Saisie d'annonce en texte 
libre + assistance IA" avant de commencer — ceci en est un 
ajustement, pas un remplacement.

CONTEXTE
Une fois le texte analysé, l'écran actuel affiche tous les champs 
extraits pour confirmation (pastilles éditables). Décision : 
simplifier encore — la plupart de ces champs n'ont pas besoin d'être 
visibles ni confirmés un par un.

CE QUI RESTE VISIBLE À L'ÉCRAN
- Le champ texte libre lui-même
- Le titre suggéré (déjà prévu dans la refonte) + son encart
- Le bouton "Aide à la rédaction" / "Optimiser mon texte"
- Le bouton d'envoi

CE QUI DEVIENT IMPLICITE — extrait et enregistré SANS s'afficher à 
l'écran, ni case à cocher, ni pastille à confirmer :
- Commune, zones géographiques
- Type de poste
- Logement, véhicule, demi-journées libres
- Répartition cabinet/domicile
- Tout champ extrait AUTRE que les dates, le taux de rétrocession et 
  le CA estimé

CE QUI RESTE UN GARDE-FOU VISIBLE (NE PAS MASQUER, décision explicite 
de Jean-Charles le 29/07) :
- Les DATES : si elles n'ont pas pu être extraites avec certitude du 
  texte, un message discret doit le signaler avant l'envoi — sans 
  dates, l'annonce n'apparaît sur aucune brique de timeline (bug déjà 
  vécu et corrigé, ne pas régresser silencieusement)
- Le TAUX DE RÉTROCESSION et le CA ESTIMÉ : restent visibles/
  confirmables avant envoi, pas d'automatisation totale sur ces deux 
  champs pour l'instant — risque identifié (valeur erronée finissant 
  dans un contrat PDF)

ENVOI
Au clic sur le bouton d'envoi, soumission directe si dates présentes 
— pas d'étape intermédiaire de relecture des champs masqués.

NE PAS TOUCHER
- La règle "l'IA n'invente jamais une valeur absente du texte" 
  (inchangée, s'applique aussi aux champs devenus invisibles)
- Le parcours manuel complet en repli, toujours accessible

npm run build à la fin.
git add . && git commit -m "ajustement: masquer champs extraits secondaires, envoi direct sauf dates/taux/CA" && git push
```

---

## B12. CLARIFICATION + FEATURE — Distinguer consultation et manifestation d'intérêt (in-app ET email)

```
═══════════════════════════════════
CLARIFICATION + FEATURE — Distinguer consultation et manifestation d'intérêt réelle, sur les DEUX canaux (notification in-app ET email)
═══════════════════════════════════

CONTEXTE
Jean-Charles clique sur une notification "Un remplaçant a consulté 
votre annonce" (in-app ET email, même événement déclencheur) — il 
atterrit sur la page de l'annonce/disponibilité du remplaçant en 
question (comportement voulu, section 182). Mais il ne trouve aucun 
moyen direct de "matcher"/swiper depuis cet écran — seulement "Voir 
et répondre à l'annonce →" (in-app) ou "Voir sa recherche →" (email).

Cas concret : le remplaçant (compte Julien Morisot) a explicitement 
SWIPÉ "intéressé" sur une mission de Jean-Charles (pas juste 
consulté). Jean-Charles, côté titulaire, s'attend à pouvoir 
réciproquer directement depuis cette page/cet email, et n'y arrive 
pas.

À VÉRIFIER D'ABORD (lecture seule, rapporte avant de coder)
1. Où se trouve concrètement, aujourd'hui, l'entrée "⏳ en attente" 
   correspondant au swipe de Julien sur la mission de Jean-Charles ?
2. Le bouton "Voir et répondre à l'annonce →" / "Voir sa recherche →" 
   mène-t-il vers un endroit où le match peut effectivement se 
   faire, ou juste vers une vue supplémentaire sans action possible ?
3. L'événement qui déclenche la notification in-app ET l'email est-il 
   bien le même (simple consultation), ou existe-t-il déjà un 
   événement distinct pour le swipe ?

PRÉCISION IMPORTANTE (reformulation de Jean-Charles, 29/07, étendue 
au canal email le 29/07) : la distinction n'est PAS entre deux 
annonces différentes — c'est entre DEUX NIVEAUX D'ENGAGEMENT sur la 
même interaction :
- CONSULTATION SEULE (vue passive, sans swipe) : reste informatif, 
  pas d'action forte attendue
- MANIFESTATION D'INTÉRÊT (swipe "intéressé") : signal fort, doit 
  déclencher une expérience différente sur les DEUX canaux

SI CONFIRMÉ QUE CONSULTATION ET SWIPE PARTAGENT LE MÊME DÉCLENCHEUR 
— FEATURE EN DEUX PARTIES

1. DÉCLENCHEMENT — séparer les deux événements
   - Consultation seule : garder la notification/email actuels 
     (informatif), OU envisager de réduire leur fréquence si jugé 
     trop bruyant (à la discrétion d'Opus, signale-le si pertinent, 
     ne décide pas seul)
   - Swipe "intéressé" : déclenche un email ET une notification 
     DÉDIÉS, au contenu différent — "Un remplaçant est intéressé par 
     votre annonce" plutôt que "a consulté votre annonce"

2. DESTINATION — action directe de réciprocité
   Pour le cas swipe (email ET notification in-app), le bouton doit 
   mener à un endroit où le titulaire peut réciproquer/matcher 
   directement — pas seulement consulter le profil du remplaçant. 
   Pas de retour obligatoire au fil de swipe classique pour retrouver 
   cette même interaction.

   Cohérence de langage : ne pas dire "voir sa recherche"/"répondre à 
   l'annonce" pour ce cas — le message doit refléter qu'on répond à 
   une manifestation d'intérêt précise, pas à un contenu publié par 
   le remplaçant.

   Consultation seule sans swipe : conserve le comportement actuel 
   (lien vers le profil/la recherche du visiteur), pas de bouton de 
   match direct puisqu'il n'y a pas encore d'intérêt réel exprimé.

PRINCIPE DE SYMÉTRIE — À APPLIQUER DANS LES DEUX SENS (généralisation 
de Jean-Charles, 29/07)

Ce mécanisme doit fonctionner IDENTIQUEMENT dans les deux directions 
du matching, pas seulement côté cabinet :

- SENS 1 (déjà décrit ci-dessus) : un cabinet publie une annonce 
  (poste). Un remplaçant/assistant swipe "intéressé" dessus. Le 
  cabinet doit pouvoir réagir à CETTE manifestation d'intérêt sur SA 
  PROPRE annonce.

- SENS 2 (symétrique, à construire de la même façon) : un remplaçant/
  assistant publie une disponibilité ("recherche un poste sur le 
  département X"). Un cabinet swipe "intéressé" sur CETTE 
  disponibilité. Le remplaçant/assistant doit, de la même manière, 
  pouvoir réagir à cette manifestation d'intérêt sur SA PROPRE 
  disponibilité — pas être renvoyé vers l'annonce/le contenu du 
  cabinet comme s'il fallait comparer deux publications entre elles.

RÈGLE GÉNÉRALE À RETENIR : il y a TOUJOURS une annonce qui appartient 
à quelqu'un, et EN FACE une manifestation d'intérêt d'un tiers sur 
CETTE annonce précise — jamais deux annonces qu'on ferait matcher 
l'une contre l'autre. Le fix doit être écrit une seule fois de façon 
générique (le "propriétaire de l'annonce" reçoit et réagit à 
l'intérêt, quel que soit son profil cabinet ou candidat), pas 
dupliqué en deux implémentations séparées.

Rapporte precisément le parcours actuel (in-app ET email, dans les 
deux sens du matching) avant de proposer un fix.

npm run build à la fin si un fix est nécessaire.
git add . && git commit -m "fix: action de match directe depuis la page atteinte par notification de consultation" && git push
```

---

## B13. CLARIFICATION — Robustesse du match automatique en cas de manifestations d'intérêt quasi simultanées

```
═══════════════════════════════════
CLARIFICATION — Robustesse du match automatique en cas de manifestations d'intérêt quasi simultanées (les deux côtés)
═══════════════════════════════════

CONTEXTE
Question de robustesse posée par Jean-Charles : si un cabinet et un 
candidat swipent "intéressé" l'un sur l'autre à peu près au même 
moment (l'un sur l'annonce, l'autre sur la disponibilité, ou 
inversement), le match automatique se crée-t-il de façon fiable dans 
tous les cas, y compris si les deux actions arrivent quasi 
simultanément (risque de concurrence/race condition) ?

À VÉRIFIER (lecture seule, rapporte avant de coder)
1. Explique le mécanisme actuel de détection de réciprocité : au 
   moment où un Swipe est enregistré, comment le système vérifie-t-il 
   si un Swipe réciproque existe déjà côté opposé ?
2. Ce mécanisme est-il protégé contre un cas où les deux Swipes 
   arrivent quasi en même temps (les deux requêtes traitées en 
   parallèle) ? Y a-t-il un risque que, dans ce cas précis, aucune 
   des deux ne détecte l'autre au moment de l'écriture, et qu'aucun 
   match ne soit créé alors que les deux parties étaient bien 
   intéressées ?
3. Une fois le match créé, les DEUX parties sont-elles notifiées 
   immédiatement (in-app + email), peu importe laquelle des deux a 
   swipé en second ?
4. Si un risque de concurrence est identifié : propose un mécanisme 
   de correction (contrainte d'unicité en base, transaction, ou 
   verrou applicatif) — sans le coder avant validation, juste le 
   proposer clairement.

Ce n'est pas un bug constaté, c'est une question de solidité posée en 
amont — teste mentalement le scénario avant de conclure qu'il n'y a 
pas de problème.

Aucune modification de code pour cette tâche — clarification 
uniquement, sauf si un vrai risque est identifié et que tu proposes 
un fix ciblé et minimal pour le corriger.
```

---

# RAPPEL — ACTIONS JEAN-CHARLES (aucune ne nécessite Claude Code)

```
1. connection_limit=1 sur DATABASE_URL (Vercel) — mitigation P1017
2. ANS_API_KEY sur Vercel — vérification RPPS réellement fonctionnelle
3. ✅ Sentry DSN — fait
4. Facebook : App Domains + mode Live + NEXT_PUBLIC_FACEBOOK_SHARE_ENABLED
5. Résoudre l'issue Sentry self-test NEXTJS-1 (2 min)
6. INPI "Soignect" + domaine soignect.fr + sitemap Search Console
   ⚠️ BLOQUANT RÉEL pour la campagne : Jean-Charles a explicitement 
   suspendu la diffusion Facebook en attendant la protection du nom.
   Ce n'est donc pas de l'administratif secondaire, c'est ce qui 
   bloque le lancement.
```

---

# ⚠️ MISE À JOUR DU 03/08 — Réconciliation avec le rapport d'activité Opus (28/07→03/08)

```
Résolus par le travail des 5 derniers jours, à NE PLUS envoyer :
✅ B1 (design carrousel)
✅ B6 (fusion bioTinder)
✅ A4 (vocabulaire unifié)
✅ B9 (dates absence non répercutées)
✅ B10 (statut annonce ligne titulaire)
✅ Urgence connexion jcdubien@gmail.com (cause probable trouvée : 
   normalisation email)

EN COURS, PAS ENCORE COMMITÉ — à vérifier en session live avant de 
considérer clos :
🟡 B12 (match depuis notification) — fix fait, jamais commité, 
   nécessite vérification UI avec l'extension Chrome + session ouverte

NOUVEAU, CRITIQUE, À TRAITER EN PRIORITÉ :
🔴 Vérifier la fenêtre exacte du bug "taux de rétrocession inversé" 
   et si des contrats signés durant cette fenêtre sont concernés
🔴 Réconcilier PRODUCT_SPEC.md — Opus en a réécrit sa propre version 
   le 30/07, à comparer avec celle tenue ici avant de continuer

TOUJOURS EN ATTENTE, À CONFIRMER SI ENCORE PERTINENTS après tout ce 
travail (statut réel inconnu, à vérifier avant renvoi) :
- A3, A5 (série audit restante)
- B2 (déconnexion mobile serré)
- B3 (image OG)
- B4 (invitation email poste-assistant)
- B5 (annonce timeline Assistant 1)
- B7 (page venir-en-guadeloupe)
- B8 (bug Sentry suppression Mission)
- B11 (masquer champs secondaires extraction IA)
- B13 (robustesse match simultané)
- Déontologie (vérification système de notation) — statut inconnu, 
  URGENT à reconfirmer

NOUVEAU SUJET, du 03/08 : passe systématique "chaque notification 
a-t-elle une action au bout ?" — suggestion d'Opus, bon réflexe à 
lancer.
```
