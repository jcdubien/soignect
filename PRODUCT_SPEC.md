# SOIGNECT — SPÉCIFICATION PRODUIT

> **Ce document décrit le comportement du produit, pas l'histoire de sa construction.**
> L'historique des décisions (pourquoi telle règle, quelles hypothèses testées et rejetées)
> vit dans `ROADMAP.md`. Réorganisé le 12/08/2026 : le document avait grossi session par
> session et était devenu un journal chronologique de 4 209 lignes.
>
> **Convention de portée** (adoptée après le malentendu du 23/07, voir Partie VI) : tout ✅
> doit dire CE QU'IL COUVRE. « Vérifié de bout en bout » et « vérifié sur cette étape, le
> reste de la chaîne non testé » ne sont pas la même affirmation. Ne jamais laisser un ✅ nu
> sur un parcours à plusieurs étapes.
>
> **Pour qui met à jour ce fichier** : `git pull`, PUIS fusionner ses ajouts dans la version
> du dépôt. Jamais un remplacement complet depuis une copie locale — ça s'est produit deux
> fois et a effacé des corrections (voir Partie VI).

---

## PARTIE I — ÉTAT VÉRIFIÉ DU PRODUIT (12/08/2026)

> Cette partie a été établie par vérification directe contre le code et la base de production
> le 12/08, pas reprise de mémoire. Chaque ligne dit d'où vient sa preuve. Le reste du
> document documente les mécanismes en détail ; cette partie dit ce qui est vrai aujourd'hui.

### Volumes réels en base (12/08, requête directe)

```
11 profils · 22 annonces · 15 swipes · 0 mise en relation · 0 notation
Annonces par type : 11 ASSISTANAT · 9 REMPLACEMENT · 2 COLLABORATION
```

Deux chiffres comptent pour la lecture du reste du document :

- **0 mise en relation.** Les sections antérieures parlent du « match JC↔Julien » comme
  d'un objet vivant, support de plusieurs vérifications. Il n'existe plus. Toute section qui
  s'appuie sur lui décrit un état passé.
- **0 notation.** L'arbitrage déontologique sur la notation entre confrères peut donc encore
  se décider AVANT tout usage réel, et non se corriger après coup. C'était déjà vrai le
  03/08 et ça l'est toujours.

### Réglages de plateforme (PlatformConfig, lu en base le 12/08)

| Réglage | Valeur | Effet |
|---|---|---|
| `enforceContractProfile` | **true** | identité contractuelle exigée avant PDF **et** avant signature |
| `freeAccessMode` | **true** | aucune facturation réelle en cours |

### Corrections apportées le 12/08 — trois affirmations contredites par le code

Chacune était écrite ici comme un fait présent. La vérification les a contredites ; elles
sont corrigées à leur place dans le document, et listées ici parce qu'elles ont pu être
citées ailleurs.

**1. Le flux d'invitation par email EXISTE.** Une section du 26/07 concluait « CONFIRMÉ :
AUCUN mécanisme d'invitation par email n'existe pour un non-inscrit » et laissait le
chantier en attente. Le modèle `PosteInvitation` (prisma/schema.prisma:620) et la route
`POST /api/cabinet-posts/[id]/invite` sont en place ; l'inscription accepte
`?inviteToken=`. Le manque a été comblé — le suivi ne l'a jamais enregistré.

**2. Le Share Dialog Facebook n'est pas « codé derrière un flag ».** L'en-tête annonçait un
drapeau `NEXT_PUBLIC_FACEBOOK_SHARE_ENABLED` et le listait comme action en attente côté
Jean-Charles. **Ce drapeau n'existe nulle part dans le code**, et aucun code de Share Dialog
n'y est présent. `ShareActions` propose « Copier le lien » et `navigator.share()`, rien
d'autre. Le bouton Facebook a été retiré le 03/08 — ce que ce même document notait plus bas,
sans jamais corriger l'en-tête. Une action en attente réclamait donc une configuration Meta
pour une fonctionnalité absente.

**3. `Swipe.affinityScore` : les deux moitiés de la phrase étaient fausses.** Le document
affirmait qu'ils « ne sont plus affichés nulle part mais restent lus par le tri du feed ».
Vérifié : ils sont **encore affichés** sur `/matches` (matches/page.tsx:167 et 253), et le
feed ne les lit **pas** — il trie sur la désirabilité (feed/route.ts:116-123). C'est
`/api/tray` qui trie sur `affinityScore` (tray/route.ts:26). Le retrait du 03/08 portait sur
la fiche de mise en relation, pas sur la liste.

### Un défaut connu, toujours non corrigé (vérifié le 12/08)

**Le rattachement automatique à la signature ne se déclenche pas pour un profil REMPLACANT.**
Le garde de `src/lib/assistantPost.ts` est inchangé aux lignes 39 et 97 :
`assistant.type !== ProfileType.ASSISTANT` → sortie silencieuse. Or le feed autorise
REMPLACANT **et** ASSISTANT à matcher un assistanat. Un remplaçant qui signe un contrat
d'assistanat n'est donc jamais rattaché à son poste, sans erreur ni trace.

L'interprétation a été tranchée le 03/08 (élargir le garde au type de **mission**, pas au
type de candidat) et n'a jamais été implémentée. C'est le plus ancien défaut ouvert du
document, et il est circonscrit : une condition à deux endroits.

### Barèmes du score en production (lib/compatibilite.ts, vérifié le 12/08)

```
SOCLE — proportions ramenées au prorata des bonus effectivement en jeu
                                    dates  geo  bio
  REMPLACEMENT                        40    30   30
  LONG TERME (assistanat + collab.)   20    25   55

BONUS — budget 20, conditionnels (n'entrent que si le chercheur les demande)
  coordination (MSP/CDS/ESP) 7 · logement 5 · véhicule 4 · secrétariat 4
```

Validés par Jean-Charles le 06/08. Les changer est une décision produit, pas un ajustement.

**Une donnée a changé depuis la décision de fusionner les barèmes** : elle s'appuyait sur
« 0 mission COLLABORATION créée ». Il y en a **2** aujourd'hui. La décision reste valable
(elle portait sur le fait qu'une collaboration est un poste long terme, pas sur le volume),
mais la justification par le vide n'est plus disponible pour la défendre.

### Ordre du feed (lib/desirability.ts, vérifié le 12/08)

Désirabilité et boost saisonnier vivent dans l'**ordre du feed**, jamais dans le score de
compatibilité — séparation posée le 03/08 et tenue depuis.

```
BONUS_SAISONNIER = 30  (sous le futur palier Premium à 50)
FENETRE_TENSION_GUADELOUPE = mai → octobre
```

Le boost est **conditionnel** : un candidat disponible sur la fenêtre n'est remonté que si le
besoin du cabinet qui regarde recoupe aussi cette fenêtre. Un boost absolu aurait déclassé
les cabinets recrutant hors saison.

La fenêtre est nommée par **territoire**, pas par profession : la tension de mai à octobre
tient à l'insularité et à la saison, pas au métier de kinésithérapeute.

### Pages publiques de diffusion (vérifié à l'écran le 12/08)

Trois pages, factorisées par {profession × territoire} dans `lib/pagesDiffusion.ts` :

| Page | Titre |
|---|---|
| `/remplacement-kine-guadeloupe` | …de kinésithérapeute **en** Guadeloupe |
| `/remplacement-kine-saint-martin` | …de kinésithérapeute **à** Saint-Martin |
| `/remplacement-kine-saint-barth` | …de kinésithérapeute **à** Saint-Barthélemy |

La préposition voyage avec le territoire, pas avec le gabarit. Les trois sont tracées
(`LANDING_VIEW`, humains et robots distingués) et rassemblées dans `/admin/diffusion`.

**`/venir-en-guadeloupe` n'a jamais existé.** Seul le prompt avait été rédigé ; un ✅ de suivi
a laissé croire pendant des jours qu'une page était en ligne. La décision du 03/08 est de ne
pas la construire.

**Règle d'écriture de ces pages** : n'y affirmer que ce qui est vrai par construction — statut
administratif du territoire, types de poste, ce que fait Soignect, gratuité pour qui cherche
un poste. Aucune caractérisation de marché (« son propre marché », « conditions avantageuses »,
« patientèle internationale ») : invérifiable, et sur une page qui s'adresse à des
professionnels décidant d'un contrat, ça coûte plus en crédibilité que ça ne rapporte en
référencement. Le nettoyage a dû être fait deux fois — bas de page le 10/08, accroches le
12/08 — parce que la première passe avait visé un ENDROIT, pas une catégorie de texte.

### Notifications — chaque type mène à une action (passe complète du 12/08)

Passe demandée le 03/08 après le bug B12 (« une notification qui alerte sans donner prise »).
Les quatre types existants, avec leur destination réelle :

| Type | Destination | Action possible au bout |
|---|---|---|
| `consultation` | `/annonces?card=<id>` | fiche décisionnelle du visiteur, Passer / Intéressé |
| `match` | `/matches?matchId=<id>` | ouvre la mise en relation |
| `message` | `/match/<id>?chat=1` | ouvre la conversation |
| `signature` | `/match/<id>/contrat` | signer à son tour |

**Aucune impasse.** Le seul repli — visiteur sans annonce publiée — renvoie vers l'espace du
destinataire (`/planning` ou `/disponibilites`) et non vers un flux générique. L'email de
consultation garde délibérément le lien PUBLIC, son lecteur pouvant être déconnecté ; c'est la
notification in-app, elle, qui pointe la fiche décisionnelle.

### Robustesse du match automatique — une fenêtre de course existe (lecture seule, 12/08)

Question posée le 29/07, jamais instruite. Réponse vérifiée dans `api/swipe/route.ts` :

Un swipe RIGHT est d'abord **écrit** (`upsert`), puis le code **cherche** un swipe réciproque
en face. Si les deux parties swipent quasi simultanément, chaque requête peut lire avant que
l'écriture de l'autre ne soit visible : **aucune des deux ne détecte l'autre, et aucun match
n'est créé** alors que les deux personnes étaient d'accord. Silencieux — ni erreur, ni trace.

Ce qui protège déjà : `@@unique([profileAId, profileBId])` sur `Match` + un `findUnique` avant
création. Le risque n'est donc PAS le doublon — c'est le **match manquant**. Symétriquement, si
les deux se détectent, la seconde création viole la contrainte et lève un P2002 non intercepté.

**Portée réelle** : la fenêtre dure quelques millisecondes et demande deux swipes croisés
dedans. 74 `SWIPE_RIGHT` depuis l'origine du produit — ce n'est pas arrivé et n'arrivera pas à
ce volume. Noté comme dette, pas comme urgence.

**Correctif minimal proposé, NON implémenté** (la consigne d'origine demandait de proposer
avant de coder) : intercepter P2002 à la création et le traiter comme un succès (idempotence),
puis relire la réciprocité une fois le swipe commité. Moins coûteux qu'une transaction
`Serializable` autour de l'ensemble, et ça couvre les deux moitiés du problème.

### Taux de rétrocession inversé — aucun contrat concerné retrouvable (12/08)

Point marqué 🔴 critique le 03/08 : un bug affichait le taux à l'envers de sa valeur au
contrat, d'où la question « des contrats signés pendant la fenêtre sont-ils concernés ? ».

Fenêtre fermée par le commit `13202d6`, le **30/07 à 23h54**. Le défaut vivait dans le
placeholder du formulaire de création, qui invitait à corriger un taux pourtant correctement
extrait (« 75/25 » extrait à 75, le placeholder suggérait 25).

Mesuré en base le 12/08 : **zéro annonce créée avant le correctif ne porte de taux de
rétrocession** (les 5 annonces qui en portent un sont toutes postérieures). Les deux seules
signatures jamais enregistrées — `CONTRACT_SIGNED` du 18/07 (remplacement) et du 23/07
(assistanat) — ne peuvent donc pas véhiculer un taux inversé issu de ce champ.

⚠️ **Portée de cette réponse** : les deux `Match` correspondants ont depuis été supprimés
(0 mise en relation en base), le contenu exact des PDF signés n'est donc plus inspectable. La
conclusion est « aucun contrat concerné retrouvable dans les données actuelles », pas « aucun
contrat n'a été affecté ». On ne peut pas aller plus loin sans les archives.

---

## PARTIE II — PARCOURS UTILISATEUR

### Candidat — inscription, publication, suggestions

#### REFONTE INSCRIPTION — Investigation complète + validation (03/08)

##### État actuel trouvé

```
6 obligations sur 3 écrans : email, mot de passe, nom, photo, CGU, + 
choix de profil implicite.

🔴 DEUX CHAMPS FANTÔMES TROUVÉS : Commune et RPPS saisis, affichés, 
JAMAIS transmis à /api/profiles, aucune colonne en base (Profile n'a 
même pas de colonne "commune"). Le RPPS jeté ici est EXACTEMENT le 
champ qu'enforceContractProfile (armé aujourd'hui même) exige avant 
contrat - blocage incompréhensible plus tard pour une donnée déjà 
fournie une fois.

LA PHOTO EST LE VRAI VERROU, SANS UTILITÉ À CE STADE : bloque le 
passage à l'écran 3, mais le feed interroge les MISSIONS, jamais les 
PROFILS - un compte sans annonce est invisible de toute façon. La 
photo ne devient utile qu'à la première publication, pas à 
l'inscription. C'est pourtant la demande la plus lourde du parcours 
(galerie/selfie avant d'avoir rien vu du produit).
```

##### Confirmé — le type de profil reste demandé en amont

```
Colonne vertébrale du modèle (limite accroche, amorces, direction 
feed via oppositeTypes, écran de publication, libellés, modèles de 
contrat) - cohérent avec la décision déjà prise le 03/08 de différer 
la refonte chercheur/pourvoyeur après évaluation du rayon d'impact.

⚠️ RÉSERVE SIGNALÉE (4e occurrence de la même tension architecturale, 
pas traitée) : REMPLACANT vs ASSISTANT peut être une distinction 
prématurée pour un nouvel arrivant - un métropolitain ne sait pas 
toujours s'il veut du ponctuel ou du long terme, c'est souvent ce 
qu'il vient découvrir. Le libellé actuel aide déjà, reste un point 
de perte potentielle.
```

##### ✅ Proposition validée par Jean-Charles

```
UN SEUL écran après le choix du profil, QUATRE champs : Nom · Email · 
Mot de passe · CGU → compte créé, connecté.

Champs déférés :
| Champ | Nouveau moment | Pourquoi |
|---|---|---|
| Photo | 1re publication disponibilité | c'est là qu'une carte existe et sera vue |
| Accroche | idem | déjà optionnelle |
| Téléphone | "Mon compte", optionnel | inutile avant une mise en relation |
| Commune | supprimée du parcours | géographie appartient à la disponibilité (macro-zones) |
| RPPS/Ordre/adresse | 1re tentative de contrat | garde déjà existant + bannière proactive déjà construite |

POINT DE VIGILANCE CRITIQUE : déplacer la photo exige de poser le 
garde À LA PUBLICATION (sinon cartes sans visuel qui passent - le 
problème serait déplacé, pas résolu). Audit de tout ce qui suppose 
photoUrl non nul ailleurs dans le code : PAS ENCORE FAIT, à faire 
avant de coder.
```

##### Statut

```
✅ Nettoyage des champs fantômes + refonte complète VALIDÉS par 
Jean-Charles. Prompt rédigé en 2 parties (nettoyage immédiat + 
refonte), avec l'audit photoUrl explicitement demandé en préalable. 
En attente d'envoi.
```

---

#### SUGGESTION ASSISTANAT — Investigation renverse la prémisse de départ (03/08)

##### 🔴 LA PRÉMISSE ÉTAIT FAUSSE

```
Feed n'a AUCUN filtre par type de mission - un remplacant voit deja 
tous les postes d'assistanat, melanges aux remplacements. Pas de 
"feed filtre ASSISTANAT" existant vers lequel pointer.

DONNEES REELLES : Julien MORISOT (30j, 6 swipes) a dit OUI a 3 postes 
long terme sur 6 - la MOITIE de son activite. John Doe (0j, 6 swipes) 
1 seul oui sur long terme.

Le signal initialement propose ("anciennete sans jamais avoir 
consulte d'annonce d'assistanat") se serait declenche pour ZERO des 
2 remplacants reels.

REFORMULATION : ce n'est PAS un probleme de decouverte (l'appetence 
existe deja et s'exprime deja par le swipe) - c'est un probleme de 
TRANSFORMATION (rien ne recupere cet interet exprime pour en faire 
quelque chose).
```

##### Trois signaux évalués, décision prise

```
1. ✅ RETENU - swipe droite sur du long terme (≥2 swipes RIGHT sur 
   ASSISTANAT/COLLABORATION). Seul signal directement observé, 
   requête simple sans calcul fragile.
2. Remplacement long/reconduit - incalculable aujourd'hui (1 seul 
   match confirmé en base), à ajouter plus tard quand le volume le 
   permettra.
3. ❌ ÉCARTÉ - ancienneté seule. Ne mesure aucune intention, 
   sollicitation générique qui apprend à ignorer les bandeaux.
```

##### ✅ Désaccord de formulation tranché en faveur d'Opus

```
REJETÉ : "Vous cherchez peut-être à vous poser ?" - présuppose et 
infantilise quelqu'un qui a déjà répondu 3 fois.

RETENU : "Vous avez marqué de l'intérêt pour trois postes 
d'assistanat. Ces postes se cherchent différemment d'un remplacement 
— voir comment." - reflète le fait plutôt que de deviner l'intention. 
Cohérent avec la règle d'écriture opposable (n°7) déjà adoptée cette 
session.
```

##### ✅ Décisions d'implémentation

```
- Persistance de la fermeture : colonne suggestionAssistanatVueAt sur 
  Profile (pas localStorage, ne suit pas d'un appareil à l'autre) - 
  une migration de plus, cohérent avec les autres migrations du jour.
- Emplacement : bandeau discret en tête de "Mon compte", fermable.
- 🎯 DESTINATION DU LIEN, décision clé : OPTION 3 retenue - ne mène 
  PAS à une liste filtrée, mais à l'écran expliquant ce qu'implique 
  une recherche d'assistanat + publication d'une recherche long 
  terme. Raison : le vrai déséquilibre n'est pas que les remplaçants 
  ignorent l'assistanat, c'est qu'AUCUN ne se DÉCLARE candidat à 
  l'assistanat - donc aucun cabinet ne les voit comme tels. Un lien 
  vers une liste ne change pas ça ; un lien vers "publie ta 
  recherche" s'attaque au vrai manque.
```

##### Statut

```
✅ Toutes les décisions tranchées. Prompt à rédiger et envoyer.
```

---

#### SUGGESTION ASSISTANAT — Livrée, vérification visuelle en attente (03/08, commit a70e454)

##### Ce qui est livré

```
SIGNAL : ≥2 swipes RIGHT sur ASSISTANAT/COLLABORATION. Testé sur les 
9 profils réels - le bandeau ne s'affiche QUE pour Julien (3 
intérêts). John Doe (1 seul) ne le voit pas. Aucun titulaire, aucun 
assistant.

BANDEAU : tête de "Mon compte", fermable, jamais une modale. 
Fermeture mémorisée sur Profile.suggestionAssistanatVueAt - tient 
d'un appareil à l'autre, date exploitable pour mesurer le test.

DESTINATION CRÉÉE (elle n'existait pas) : un remplaçant ne pouvait 
PAS publier de recherche long terme - missionType figé à 
REMPLACEMENT, sélecteur réservé aux profils ASSISTANT. Seul recours 
avant : qu'un admin change son type de compte. Le choix du type de 
recherche est désormais ouvert à tous les candidats, avec 
"Remplacement" ajouté aux options.
```

##### Portée du changement — signalée par Opus, validée par Sonnet

```
Le drapeau isAssistant ne signifie plus "je suis assistant" mais "la 
recherche porte sur un poste long terme" - c'était déjà son sens 
réel dans ~20 lectures existantes (dates masquées, durée minimale, 
libellés). L'IDENTITÉ (ProfileType) ne bouge pas, seule la RECHERCHE 
devient un choix indépendant.

✅ VALIDÉ PAR SONNET : c'est une version étroite et pragmatique de la 
vision chercheur/pourvoyeur (Phase 3), livrée organiquement en 
résolvant le problème de destination - exactement le "test à moindre 
coût avant refonte complète" suggéré plus tôt dans la session. Ne 
touche pas la colonne vertébrale (ProfileType), juste ce formulaire. 
Gardé tel quel, pas à annuler.
```

##### Vérification visuelle demandée, en attente

```
Opus refuse de considérer le sélecteur vérifié sans l'avoir vu à 
l'écran - callback explicite à l'incident du matin même (titre en 
double sur le formulaire de couverture, trouvé seulement 
visuellement). Demande reconnexion :
- Julien (remplaçant) : bandeau + formulaire
- Paul (assistant) : au moins le formulaire, "la partie risquée"
```

##### 🔴 Correction de suivi trouvée et corrigée (03/08)

```
"Mes recherches de remplacement" n'a jamais existé dans le code - 
une formulation ambiguë de Sonnet ("le correctif pragmatique déjà 
posé") a été lue à tort comme "déjà construit". Corrigé dans les 
sections concernées. Ce qui existe réellement : la carte "Couverture 
de mon absence", plus simple, livrée sous un nom différent. Même 
famille que le "malentendu du 23/07", cette fois causée par Sonnet.
```

##### Statut

```
✅ Livré et poussé. 🟡 Vérification visuelle en attente de 
reconnexion (Julien puis Paul).
```

##### SUGGESTION ASSISTANAT — Finalisation (03/08)

###### Erreur de manipulation identifiée

```
Un prompt périmé (rédigé avant l'investigation d'Opus qui a reformulé 
toute la feature) a été renvoyé par erreur - la feature était déjà 
livrée et vérifiée à l'écran sur Julien au moment de l'envoi. Aucune 
action requise, juste ignorer ce prompt.
```

###### Correctif de texte livré au passage (bf254cc)

```
Le bandeau annonçait "postes d'assistanat OU DE COLLABORATION" dans 
tous les cas, alors que Julien n'a swipé que des assistanats - la 
mention de collaboration n'apparaît plus que si elle est réellement 
en jeu. Cohérent avec la règle d'écriture opposable (n°7) : un 
bandeau qui reflète un fait ne peut pas décrire une action non faite.
```

###### ✅ Décision sur l'étage explicatif manquant

```
Lien vérifié à l'écran : mène bien à /disponibilites/create?type=
ASSISTANAT, le vrai formulaire en mode long terme (pas de liste 
filtrée) - confirmé "Visible par les cabinets proposant des postes 
longue durée", durée minimale exigée, exemple 12 mois.

MANQUE : rien n'explique à Julien ce qu'implique un assistanat 
(patientèle du cabinet, engagement plusieurs mois, rétrocession 
versée plutôt que conservée, différence avec la collaboration).

✅ RETENU : un encart DÉPLIABLE en tête du formulaire (pas une page 
séparée), visible quand le type long terme est choisi - trois lignes 
sur ce qui change. Raison : une page dédiée coûte un écran de plus 
entre intention et action, mauvais sens pour mesurer la conversion.

Cohérence de libellé : garder "Publier une recherche de poste" pour 
le lien (décrit ce qui va se passer), PAS "voir comment" (suppose 
une page explicative séparée qu'on ne construit pas).
```

###### Statut

```
✅ Feature entièrement livrée et vérifiée sur Julien. 🟡 Encart 
explicatif décidé, prompt à rédiger. Vérification sur Paul (assistant) 
toujours en attente de reconnexion.
```

---

#### VÉRIFICATION LIVE COMPLÈTE — Parcours candidat, bannière + partage (03/08)

##### Résultat : tout vérifié en prod, à l'œil, en conditions réelles

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

##### Méthode notable — deux réserves honnêtes, résolues proprement

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

##### Décision — autorisation donnée

```
✅ Jean-Charles lève la restriction sur ShareActions pour ce fix 
précis (boutons côte à côte sur desktop). Prompt rédigé, en attente 
d'envoi.
```

##### ✅ LIVRÉ ET VÉRIFIÉ (03/08, commit 3540e5e)

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

### Assistant rattaché — couverture de sa propre absence

#### AUDIT CHAÎNE TITULAIRE→ASSISTANT→REMPLAÇANT — Résultat complet (03/08)

##### Étape 1 — Rattachement manuel : FONCTIONNE

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

##### Étape 2 — "Faire remplacer mon absence" : CASSÉ, cul-de-sac total

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

##### Étape 3 — Cohérence de la chaîne

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

##### Décision — répartition des 3 correctifs proposés

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

#### RÉSOLUTION DÉFINITIVE — Formulaire assistant débloqué, question centrale tranchée, découverte plus grave (03/08)

##### Fix 1 livré avec 2 régressions rattrapées par vérification à l'écran

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

##### 🔴 QUESTION CENTRALE DE L'AUDIT TRANCHÉE : NON, pas visible sur les deux vues

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

##### 🔴🔴 DÉCOUVERTE PLUS GRAVE QUE PRÉVU — l'assistant est verrouillé hors de sa propre création

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

##### Décision — réordonnancement des 3 pistes restantes

```
✅ AUTORISÉ ET PRIORISÉ EN PREMIER (changement d'ordre par rapport à 
   la proposition d'Opus) : permettre à l'assistant de RETIRER sa 
   propre demande (élargir le garde DELETE/gestion à cabinetPostId, 
   pas seulement profileId). Raison de la priorité : être verrouillé 
   hors de sa propre création est un blocage fonctionnel dur, plus 
   grave qu'un simple manque de confort visuel. Prompt rédigé, en 
   attente d'envoi.

✅ Visibilité complète — RÉSOLU différemment de ce qui était envisagé 
   ici : pas un espace séparé "Mes recherches de remplacement" (jamais 
   construit sous ce nom), mais une carte "Couverture de mon absence" 
   directement sous la bannière violette, livrée plus tard le même 
   jour (voir section "CLÔTURE COMPLÈTE"). Plus simple que prévu.

🟡 Garde anti-doublon — toujours pertinent, encore plus nécessaire 
   maintenant que ni titulaire ni assistant ne voient facilement ce 
   que l'autre a fait.

4 commits en production aujourd'hui sur ce fil : 7b634ec, d8036a6 
(assistant), d1e0f8b, 42bbb6b (salarié).
```

---

#### 🎉 CLÔTURE COMPLÈTE — Le fil "rattachement assistant" de toute la session, résolu de bout en bout (03/08)

##### Les trois correctifs finaux, livrés ensemble (commit a1c2e66)

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

##### Vérification complète en conditions réelles, depuis le compte de Paul

```
| Correctif | Vérification |
|---|---|
| Visibilité | Bloc "Couverture de mon absence" affiché, avec dates et "Publiée sur le poste Mathéo. Visible par les remplaçants et sur le planning du cabinet." |
| Anti-doublon | 2e annonce sur 10-30 déc (chevauchement PARTIEL, pas identique à 1-20 déc) refusée avec message nommant l'annonce existante - vérifie la vraie logique d'intersection, pas un cas trivial d'égalité |
| Retrait | Clic "Retirer" depuis le compte de Paul → succès, là où la même action renvoyait 403 hier |

Nettoyage confirmé : aucune mission de test, poste détaché, cabinet à 
ses 9 missions d'origine, 1 seul match (celui d'origine).
```

##### La boucle complète, résumée

```
"Il publie, il voit ce qu'il a publié, il suit les mises en relation 
reçues, il peut retirer sa demande — et ni lui ni le titulaire ne 
peuvent créer un doublon pour la même absence."

7 commits en production aujourd'hui sur cette seule chaîne (du 
déblocage du formulaire jusqu'au retrait).
```

##### Ce qui reste ouvert — inchangé, toujours Phase 3, aucun urgent

```
1. Champs économiques établissement (CA/Redevance absurdes pour un 
   salarié, rémunération absente)
2. MissionType : "trois types libéraux portent aujourd'hui six 
   réalités" - Vacation/CDD/CDI ne survivent pas au formulaire (feed 
   et planning réaffichent "Remplacement"). Nécessite une migration, 
   donc une décision à part - pas urgent.
```

---

### Titulaire — planning, visibilité, facturation

#### VUE LISTE, alternative au carrousel (13/08) — livré

##### Périmètre

**Desktop (`lg`, ≥ 1024 px) ET titulaire uniquement.** Sous ce seuil la bascule n'est pas
rendue — la comparaison côte à côte n'y a pas la place ; côté candidat elle n'existe pas du
tout, le geste rapide mobile-first reste son seul mode. **Les cartes restent la vue par
défaut** : la liste est un complément de comparaison, jamais un remplacement.

La bascule est placée **au bout de la barre de filtres**, alignée à droite : c'est la zone des
contrôles « comment je parcours », directement au-dessus de ce qu'elle change.

##### Un seul chemin d'enregistrement, pas deux

L'enregistrement du choix a été **extrait** de `doSwipe` dans `enregistrerChoix(mission,
direction)` — appel `POST /api/swipe` et modale de match. Le carrousel l'appelle après son
animation, la liste l'appelle directement.

Ce n'est pas de la cosmétique : dupliquer l'appel aurait fait diverger deux présentations d'un
même choix. Le score et l'appariement se calculent **côté serveur**, et aucune vue ne peut les
influencer.

##### Ce que porte chaque ligne

Auteur (badge de type + nom), intitulé, commune, dates ou durée minimale, extrait d'accroche,
et l'étiquette de compatibilité. **Les deux actions sont sur la ligne** — « Intéressé » et
« Passer » : sans elles, la liste ne serait qu'un inventaire à consulter, et il faudrait rouvrir
une fiche pour décider, ce qui la rendrait plus lente que le carrousel. Un clic sur le corps de
la ligne ouvre la fiche détaillée et enregistre la consultation, comme un tap sur une carte.

##### Le classement, et sa limite honnête

La liste classe par **compatibilité de DATES** avec l'annonce sélectionnée, décroissante.

C'est le seul signal de compatibilité disponible côté client : `/api/feed` **ne renvoie aucun
score par mission**, et le score d'affinité complet n'est calculé qu'au moment du swipe, côté
serveur. Le classement s'appuie donc sur ce que la carte affiche déjà (`computeCompatibility`),
pas sur une valeur inventée pour l'occasion.

Conséquence à connaître : **quand l'annonce sélectionnée n'a pas de date de fin** — cas d'un
assistanat — la compatibilité vaut « Dates non renseignées » pour tout le monde et le tri est
sans effet. La liste retombe alors sur l'ordre du feed.

##### La mention de transparence suit la vue

L'ordre n'est PAS le même dans les deux vues : les cartes suivent la désirabilité (abonnés,
partenaires, boost saisonnier), la liste suit la compatibilité. La ligne de transparence a donc
été dédoublée — en vue Liste elle annonce le classement par compatibilité et précise
qu'**aucun abonnement n'y entre**, contrairement aux cartes.

Garder le texte d'origine aurait affiché un ordre qui n'est plus celui présenté : la règle
d'écriture opposable (n°7) vaut aussi pour les mentions de transparence.

##### Ce qui n'a pas changé

Le score **ORDONNE**, il ne décide jamais. Aucun appariement automatique fondé sur le
classement : la liste est une autre présentation du même choix humain.

⚠️ **Portée de la vérification** : rendu, bascule, classement, repli sous 1024 px et texte de
transparence vérifiés à l'écran en production. Les deux boutons **n'ont pas été déclenchés** —
« Intéressé » engagerait une relation avec un candidat réel, « Passer » l'écarterait
définitivement du feed. Ils appellent la fonction déjà en service pour le carrousel.

---


#### BLOC-NOTE DE SUIVI SUR LA TIMELINE (12/08) — livré

##### Ce qui existait déjà, et n'était pas su

Le panneau au clic prévu par la spec du 10/07 **est construit depuis longtemps** : un
`BottomSheet` multi-étapes s'ouvre sur une brique ou une zone vide (Poser une annonce,
Modifier, Préavis, Fermer, Renommer, Voir les relations, Retirer). Ce n'est pas un survol —
et c'est le bon choix : un survol sur une timeline dense se déclencherait sans arrêt.

**`Mission.statusNote` existait, plombé de bout en bout sauf le robinet** : colonne en base,
validée en Zod par le PATCH, et déjà AFFICHÉE dans le panneau « couvert ». Aucune interface ne
l'écrivait, jamais.

La cause était mécanique, côté serveur : `statusNote` était imbriquée dans le bloc
`briqueStatus !== undefined`. **Écrire la note exigeait de changer aussi le statut du créneau.**
Le champ a donc attendu des mois un formulaire qui ne pouvait pas exister. Découplé le 12/08 —
la note se met à jour seule désormais.

Deux colonnes mortes trouvées au passage : `CabinetPost.maxSlots` mis à part, `maxCandidates`
(défaut 10) et `singleSlot` ne sont lus **nulle part** dans `src/`. La « limite de 3 matchs
actifs » de la spec du 10/07 n'existe pas et n'a jamais existé.

##### Le troisième axe de statut

Le produit portait déjà deux statuts qu'il ne fallait pas dupliquer :

| | Ce qu'il décrit |
|---|---|
| `BriqueStatus` | l'état du CRÉNEAU — et c'est lui qui donne sa couleur à la brique |
| `MatchStatus` | l'état TECHNIQUE de la mise en relation |
| **`SuiviStatut`** *(nouveau)* | **ce que l'humain a fait ou attend, hors plateforme** |

Cinq valeurs, plus l'absence de valeur par défaut : `A_RELANCER`, `APPEL_FAIT`,
`REPONSE_ATTENDUE`, `ECHANGE_HORS_PLATEFORME`, `SANS_SUITE`.

**« Contrat édité » a été écarté**, alors qu'il figurait dans la demande. Le produit connaît
déjà l'état réel d'un contrat (`MatchStatus`, routes de signature) : un drapeau manuel en
parallèle finirait par le contredire dès que quelqu'un oublie de le remettre à jour. C'est la
famille de défaut la plus coûteuse de ce produit — « l'écran affirme ce qu'il n'a pas
vérifié ». Un cran de ce genre doit être DÉRIVÉ de l'état réel, jamais saisi.

**Règle de composition qui en découle** : n'entre dans cet enum que ce que la plateforme ne
peut pas observer seule.

##### Où vit la note — et pourquoi la zone non couverte a fallu traiter à part

Une brique est une `Mission`. **Une zone non couverte n'est aucun objet en base** : c'est un
intervalle calculé entre deux briques. Rien à quoi accrocher une note.

L'accrocher à un triplet (poste + début + fin) l'aurait rendue orpheline au premier décalage
de dates — ce qui arrive réellement (bug B9, dates d'absence modifiées). Le suivi des trous est
donc porté par le **poste**, seul support stable :

```
Mission     .suiviStatut    (SuiviStatut?)   ← la brique
            .suiviUpdatedAt                     date PROPRE : savoir quand on a appelé n'a
            .statusNote      (200 car.)          rien à voir avec le dernier changement de créneau
CabinetPost .suiviNote       (500 car.)       ← le poste, donc les trous
            .suiviUpdatedAt
```

Pas de niveau `Match` séparé : 0 mise en relation en base et une mission couverte n'en affiche
qu'une. Un troisième niveau maintenant reviendrait à construire pour un cas absent.

##### Restitution sur la timeline

Une **pastille de 6 px superposée en coin**, en position absolue, jamais dans le flux — et
**aucun changement de couleur** : la couleur appartient à `briqueStatus`, un second code
chromatique rendrait les deux illisibles. Seul `A_RELANCER` reçoit un accent distinct, c'est le
seul état qui appelle une action.

La pastille **n'agrandit pas la brique**, contrainte explicite : une brique de 47 px a déjà
disparu sous une autre faute de place (défaut 3 du 03/08 — un recrutement actif invisible en
production). Appliqué desktop et mobile.

Migration additive appliquée à la main via `prisma db execute --url $DIRECT_URL` : Vercel ne
joue pas `migrate deploy`.

---

#### LISTE NOMINATIVE DES INTÉRÊTS REÇUS (13/08) — livré

##### Ce que le compteur savait, et ce qu'il taisait

Le badge ⏳ d'une annonce affichait « N candidatures en attente » — un `groupBy` sur les swipes
RIGHT reçus (`layout.tsx:93-100`), moins les relations confirmées. Il savait dire **3**, jamais
**qui**. Et il menait au fil, filtré sur l'annonce.

##### Le badge ouvre désormais la liste

Même motif de repli inline que le partage, déjà en place dans `ActiveAnnoncesList` : pas de
nouvel écran, la liste s'ouvre dans la ligne de l'annonce concernée. Chaque entrée porte **le
nom, le type, l'ancienneté du geste et l'accroche** quand elle existe.

Source : `GET /api/missions/[id]/interesses`, **réservée au propriétaire de l'annonce**
(403 sinon), déjà créée pour la bande « personnes signalées ». Elle exclut les personnes déjà
en relation — atteignables par les écrans habituels.

##### La distinction que le compteur écrasait

| Situation | Ce que la ligne propose |
|---|---|
| Recherche publiée | « Se prononcer dans le fil → » — la personne y figure, on peut décider |
| Aucune recherche publiée | « Pas encore de recherche publiée — vous ne pouvez pas encore vous prononcer » |

Le badge renvoyait auparavant tout le monde vers le fil, **qui liste des ANNONCES** : une
personne sans publication n'y apparaît jamais. Le compteur promettait donc une action
impossible pour une partie de ce qu'il comptait — mesuré, 2 des 8 swipes RIGHT.

##### Vérifié à l'écran, en production

Annonce « Kiné à Pointe-Noire : 3 postes », badge ⏳ 2 → deux lignes, une de chaque nature :
**John Doe** (il y a 6 jours, sans recherche publiée) et **Julien MORISOT** (il y a 9 jours,
« Se prononcer dans le fil → »).

##### Ce qui n'est PAS construit

**Répondre depuis cette liste.** La tâche s'arrête à la visibilité : créer une mise en relation
sans annonce en face bute sur `Match.missionBId` et sur `@@unique([profileAId, profileBId])`
— une seule relation par paire de personnes, tous types confondus. Contrainte de schéma à
trancher avant, chantier séparé.

Ni profil navigable, ni exposition permanente : ces lignes n'existent que pour le propriétaire
de l'annonce, et seulement parce que ces personnes ont swipé **cette annonce précise**.

---

#### SIGNALER MON INTÉRÊT — rendre lisible un geste qui existait déjà (13/08) — livré

##### Le geste n'a pas été créé, il a été nommé

Un visiteur sans recherche publiée **pouvait déjà** manifester son intérêt : la fiche porte
Passer / Intéressé, le swipe RIGHT est enregistré même sans mission de son côté, et le cabinet
le compte — `layout.tsx:93-100` agrège les swipes RIGHT par annonce en « N candidatures en
attente ».

Construire un second signal aurait fait doublon avec le premier, en plus faible. Ce qui
manquait était la **lisibilité, des deux côtés**.

##### Côté visiteur — le même geste, deux portées

Le drapeau `relation.aPublieUneRecherche` (route card, `count` indexé borné à 1) distingue les
deux situations. Sans recherche publiée, « Intéressé » devient **« Signaler mon intérêt »**,
suivi de la portée réelle : le cabinet verra son nom pour **cette annonce et aucune autre**,
son profil n'est publié nulle part, et une mise en relation suppose une recherche publiée.

Taire cette différence laissait croire à une réciprocité impossible — le cabinet n'a rien à
swiper en face (règle de méthode n°7).

##### Côté cabinet — l'angle mort mesuré

Le badge ⏳ mène au feed, **qui liste des ANNONCES**. Un candidat sans publication n'y figure
jamais : le compteur annonçait des intérêts inatteignables. **Mesuré le 13/08 : 2 des 8 swipes
RIGHT** venaient de personnes sans recherche active.

`GET /api/missions/[id]/interesses` — réservée au **propriétaire de l'annonce** (403 sinon) —
liste les swipes RIGHT reçus, en excluant les personnes déjà en relation (atteignables par les
écrans habituels). Une bande repliée, au-dessus du carrousel de l'annonce sélectionnée, ne
montre **que celles sans recherche publiée**, avec ce qui est possible ou non.

##### Ce que ce n'est pas

**Ni profil navigable, ni feed de profils sans annonce** — décision de positionnement du 13/08
respectée. Chaque ligne résulte d'un **geste explicite sur cette annonce précise** et n'existe
que là. Aucune visibilité permanente, aucune disponibilité implicite exposée.

Aucune table ajoutée : le signal reste le `Swipe` existant.

##### Vérifié à l'écran, sur un cas réel de production

Annonce « Kiné à Pointe-Noire : 3 postes » — la bande affiche « 1 personne s'est signalée sur
cette annonce · sans recherche publiée — invisible dans le fil », dépliée sur John Doe et son
accroche.

⚠️ **Portée** : le rendu et le classement sont vérifiés ; le bouton visiteur n'a pas été
déclenché — il écrirait un swipe au nom d'un compte tiers.

##### Reste ambigu, non traité

Le libellé « candidatures en attente » compte **ensemble** les personnes atteignables et celles
qui ne le sont pas. La bande corrige l'effet, pas la cause : distinguer les deux dans le badge
serait un choix d'affichage à trancher.

---

#### EMAIL DE CONSULTATION — ce que le lien peut et ne peut pas faire (13/08)

##### Le constat, et ce qu'il n'était pas

Signalé sur capture : l'email « Un remplaçant vient de consulter votre annonce » proposait
« Voir mes annonces », qui ramène le cabinet à son propre espace — pas au visiteur.

Vérifié dans `api/missions/[id]/card/route.ts` : **le visiteur est TOUJOURS identifié.**
L'email part d'une session authentifiée, `swiperId` est connu. Le lien direct existe déjà et
fonctionne — `/annonce/<id>` avec le libellé « Voir sa recherche → » — **à une condition** :
que le visiteur ait une annonce active.

##### Le vrai obstacle : identifié ne veut pas dire atteignable

Un visiteur qui n'a rien publié est **hors d'atteinte**, et pas par oubli d'un lien :

- **Aucune page de profil n'existe** dans le produit. La seule page publique d'une personne est
  `/annonce/[id]` — une ANNONCE, pas un profil.
- **Le feed interroge les missions, jamais les profils** (`api/feed`, `include: { profile }` sur
  une requête de missions). Sans publication, la personne n'apparaît nulle part, ne peut être
  ni swipée ni appariée.

Il n'y a donc littéralement rien vers quoi pointer. **Le lien de repli était le seul honnête.**

**Mesuré en base le 13/08 : 9 visiteurs distincts ont déclenché cet email, 5 n'ont aucune
annonce active.** Le repli n'est pas un cas marginal, c'est la majorité.

##### Ce qui a changé — le texte, pas le lien

Le défaut n'était pas la destination mais la **promesse**. L'email nommait un événement précis
et offrait un bouton qui laissait croire à une action possible ; le lecteur cliquait et
atterrissait chez lui, sans savoir pourquoi.

- Quand le visiteur n'a rien publié, l'email le dit : « Cette personne n'a pas encore publié de
  recherche : il n'est donc pas possible de la contacter ni de se positionner pour l'instant.
  Elle apparaîtra parmi les profils à consulter dès qu'elle en publiera une. »
- Le libellé de repli annonçait **« Voir mes annonces » alors que le lien mène au Planning**,
  qui n'est pas une liste d'annonces. Il nomme désormais sa destination réelle — « Voir mon
  planning » côté cabinet, « Voir mes disponibilités » côté candidat.

Le cas nominal est inchangé : visiteur ayant publié → lien direct vers sa recherche.

##### Piste non prise

Rendre ces visiteurs atteignables demanderait soit une **page de profil**, soit l'entrée des
profils sans annonce dans le feed. Les deux touchent au principe « le feed présente des
annonces, pas des personnes » et dépassent un correctif d'email.

---

#### INVITER QUELQU'UN SANS COMPTE À REPRENDRE UN POSTE (13/08) — livré

##### Le cul-de-sac

Depuis le Planning, « + Rattacher un compte assistant » appelle `/api/cabinet-posts/[id]/link`,
qui exige un compte **déjà existant** de type ASSISTANT. Sans compte, la réponse était
« Aucun compte trouvé pour cet email » — et le parcours s'arrêtait là. Aucun chemin ne partait
de cette erreur.

##### Ce qui existait sans interface

La route `POST /api/cabinet-posts/[id]/invite` était **complète depuis longtemps** : création
d'une `PosteInvitation` (token + expiration à 7 jours), email nommant le cabinet et le poste,
et rattachement automatique à la finalisation de l'inscription via `?inviteToken=`
(`profiles/route.ts:75`). **Aucun fichier `.tsx` ne l'appelait.**

Les deux routes étaient même conçues comme complémentaires : `/invite` refuse en 409 un email
déjà inscrit en renvoyant vers « Rattacher un compte assistant ». Chacune pointait vers
l'autre ; l'interface n'en connaissait qu'une.

Même motif que `statusNote` (section 200) : moitié serveur livrée, moitié interface jamais.

##### Ce qui a changé

Les deux chemins s'enchaînent dans `PostAssistantLink` :

- **404 sur `/link`** (aucun compte) → ce n'est plus une erreur mais une proposition :
  « Aucun compte Soignect pour cet email. Vous pouvez l'inviter à en créer un et à reprendre la
  gestion de « *nom du poste* ». » avec **Corriger l'email** / **Inviter par email**. L'email
  déjà saisi est réutilisé — rien à retaper.
- **409 sur `/invite`** (un compte existe finalement) → retour au rattachement.

##### L'écran d'après ne ment pas

Après envoi : « **Invitation envoyée** — *email* va recevoir un lien pour créer son compte. Le
rattachement à « *poste* » se fera automatiquement quand elle ou il aura terminé son
inscription — rien à refaire de votre côté. »

Le rattachement **n'est pas encore fait** à cet instant, et l'écran le dit. Annoncer un poste
rattaché aurait été exactement le défaut que la règle 7 vise.

##### Vérification

Chaîne complète jouée en production sur le poste « Mathéo », avec une adresse en `.invalid`
(TLD réservé, non routable — aucune personne réelle destinataire) : 404 → proposition nommant
le poste → envoi → `PosteInvitation` créée en base (PENDING, expiration à 7 jours) → écran de
confirmation. Ligne d'essai supprimée, 0 invitation restante.

---

#### RELANCES EN ATTENTE — vue agrégée tous postes (13/08) — livré

##### Le manque

Le bloc-note de suivi (section 200) n'exposait ses statuts que par une **pastille de 6 px** en
coin de brique. Repérer « qu'est-ce qui attend une action de ma part » imposait de parcourir la
timeline visuellement, poste par poste — la donnée existait, l'interface ne la rassemblait pas.

##### Emplacement

Une bande **sous le bandeau d'alerte du Planning**, dans la même zone « ce qui appelle une
action » : l'alerte dit ce que le CALENDRIER réclame (postes non couverts), cette bande ce que
le SUIVI réclame.

**Repliée par défaut** — elle informe sans repousser la timeline, qui reste l'objet de l'écran.
Le titre replié porte déjà l'essentiel : un compteur « N à relancer » en corail, et le total
suivi tous postes confondus. **Elle ne s'affiche pas du tout s'il n'y a rien à montrer** : un
bandeau permanent à zéro apprend à être ignoré.

##### Aucune requête ajoutée

`planning/page.tsx` charge déjà tous les postes du cabinet avec leurs missions
(`include`, pas `select`) : `suiviStatut`, `statusNote` et `suiviNote` arrivent avec. La vue
n'est qu'une **lecture transverse de ce qui est déjà en mémoire** — dérivation client, zéro
appel réseau, aucune logique de feed ou de tray dupliquée.

##### Trois groupes, une seule hiérarchie d'action

| Groupe | Contenu | Traitement |
|---|---|---|
| **À relancer** | `A_RELANCER` | en tête, bordure et fond corail — même accent que la pastille sur la timeline |
| **Autres suivis** | les 4 autres statuts | second, neutre |
| **Notes de poste** | `CabinetPost.suiviNote` | troisième — ces notes n'ont pas de statut, elles couvrent les zones non couvertes |

##### Retour à la brique

Un clic sur une ligne **rouvre exactement le panneau du clic sur la timeline**
(`setPanel({ type: "covered", mission, post })`), plutôt que de faire défiler jusqu'à elle.
Plus direct, et surtout : aucune duplication, c'est le même `Panel`. Une note de poste ouvre le
panneau du poste.

Vérifié à l'écran en production : bande repliée puis dépliée, groupes dans l'ordre, pastilles
de la timeline concordant avec le contenu de la bande.

---

#### AUDIT CHAÎNE — Complément : 3e défaut découvert, plus grave que les deux autres (03/08)

##### Réponse définitive à la question centrale : NON, sur les deux vues

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

##### 🔴 DÉFAUT 3 — NOUVEAU, découvert en creusant, plus grave que prévu

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

##### Mise à jour de l'ordre de priorité

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

##### ✅ LIVRÉ ET VÉRIFIÉ (03/08, commit f492ccd)

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

##### Statut

```
✅ LIVRÉ ET VÉRIFIÉ (desktop). 🟡 Vérification visuelle mobile en 
cours. 🟡 Fix 1 (formulaire) confirmé, prompt déjà rédigé 
précédemment. 🟡 Clarification rattachement auto toujours en 
attente. 🟡 Fix "Mes recherches de remplacement" en attente de 
validation JC.
```

---

#### 🔴 PAYWALL RÉAPPARU — Root cause trouvée et corrigée (03/08, en continu)

##### Le bug réel

```
isFounding existait déjà (100% désirabilité) mais hasPremiumAccess 
ne le consultait JAMAIS. Résultat : le compte fondateur de 
Jean-Charles a basculé SILENCIEUSEMENT en mode facturation le 1er 
août - quatorze jours après la signature d'un contrat le 18/07 
(billingTriggeredAt), sans que isFounding n'intervienne pour 
l'exempter.

FIX (commit 966389e) :
if (!(await isFreeAccessMode())) return false;   // le mode global reste souverain
if (input?.isFounding) return true;              // exemption de la bascule individuelle SEULEMENT

L'exemption ne porte QUE sur la bascule individuelle (grâce/
facturation par compte) - PAS sur le mode global freeAccessMode. Si 
freeAccessMode passe à false un jour, le compte fondateur redevient 
soumis aux mêmes règles que les autres, SAUF décision contraire 
explicite (voir ci-dessous).
```

##### Vérification avant push — 6 scénarios, 1 seul change

```
| Cas | Avant | Après |
|---|---|---|
| Fondateur, contrat signé 18/07 | 🚧 mur | ✅ accès |
| Cabinet lambda, aucun contrat | ✅ | ✅ |
| Cabinet lambda, grâce écoulée | 🚧 | 🚧 |
| Cabinet lambda, grâce en cours | ✅ | ✅ |
| Fondateur, après fin du mode gratuit | 🚧 | 🚧 |
| Abonné payant | ✅ | ✅ |

Un seul cas change - exactement celui de Jean-Charles. Les 4 murs 
concernés confirmés exhaustivement : fiche de mise en relation, feed 
/annonces (bouton "Envoyer un contrat"), contrat-info, génération PDF.
```

##### ✅ Deux disciplines saluées

```
1. PAS d'exemption perpétuelle décidée seul - "ouvrir un Premium 
   perpétuel aux fondateurs aurait été une décision commerciale 
   déguisée en correctif". Signalé comme "une ligne à déplacer" si 
   Jean-Charles veut l'inverse - pas décidé à sa place.
2. billingTriggeredAt NON effacé - "la facturation a été 
   réellement déclenchée, c'est un fait comptable, et l'effacer 
   aurait réécrit l'histoire pour masquer un symptôme. L'exemption 
   suffit." Intégrité des données historiques préservée.
```

##### 🆕 DÉCOUVERTE IMPORTANTE — la bascule en facturation est silencieuse pour TOUT futur cabinet

```
"Le mécanisme a fonctionné comme prévu, mais [...] Ton compte a 
basculé le 1er août en silence. Quand la bêta grandira, chaque 
cabinet qui signera son premier contrat vivra la même surprise 
quatorze jours plus tard. Un email à la bascule, ou au moins à 
l'entrée dans la grâce, éviterait que le premier signal soit un mur."

CE N'EST PAS SPÉCIFIQUE AU CAS FONDATEUR - c'est un vrai gap produit 
qui touchera CHAQUE futur cabinet payant. À traiter avant que la 
bêta ne grandisse réellement.
```

##### ✅ DÉCISION COMMERCIALE PRISE (03/08) : le fondateur reste gratuit, inconditionnellement

```
Jean-Charles : "fondateur devra rester gratuit" - décision claire, 
l'exemption doit devenir INCONDITIONNELLE (pas seulement pendant 
freeAccessMode). 

Opus vérifie AVANT d'implémenter qui porte ce drapeau et qui peut 
l'accorder ("ça devient un engagement commercial") - bonne 
prudence maintenue même face à une décision claire, pas d'exécution 
aveugle d'une directive business sans en comprendre le mécanisme 
technique sous-jacent d'abord.
```

##### Non vérifié à l'écran

```
Navigateur resté sur session Hopital beauperthuy. Reconnexion en 
jcdubien nécessaire pour confirmer visuellement la disparition des 
murs sur la fiche du match avec Julien et sur le tray.
```

##### Statut

```
🟡 Fix du bug racine livré et vérifié par requête. Décision 
d'exemption inconditionnelle en cours d'implémentation (investigation 
prudente en cours). 

🟢 NOUVEAU CHANTIER IDENTIFIÉ, VOLONTAIREMENT REPORTÉ (03/08) : email/
notification à l'entrée en période de grâce pour tout futur cabinet - 
pas de prompt rédigé, GARDÉ POUR LA PROCHAINE SESSION. Pas urgent 
tant que la bêta reste petite (peu de cabinets qui signent leur 
premier contrat en ce moment).
```

---

#### AUDIT PRODUCTION — 27/07 (réalisé en session live, données vérifiées)

##### Méthode

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

##### Ce qui tient debout

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

##### Findings

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

##### Observation notable

```
2 candidats assistants sont maintenant présents en base, alors que 
le 24/07 Claude Code n'en trouvait AUCUN d'actif. Quelque chose a 
bougé — à vérifier si ce sont de vrais utilisateurs (effet de la 
communication de JC) ou des comptes de test.
```

---

### Salarié et établissement recruteur

#### AUDIT 4 PARCOURS — Résultat pour le salarié/recruteur (03/08)

##### Méthode

```
Refus de créer des comptes de test (limite tenue par Opus) - 
recherche des comptes reels existants a la place. Les 4 parcours ont 
deja un compte reel en base :
- Remplacant : Julien MORISOT (2 disponibilites)
- Assistant : Paul (0 mission)
- Titulaire : Jean-Charles DUBIEN (9 missions, 5 postes)
- Salarie/recruteur : Hopital beauperthuy (0 mission, JAMAIS UTILISE)
```

##### 🔴 DÉCOUVERTE CRITIQUE — Le parcours salarié est fonctionnellement mort, pas juste peu testé

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

##### Redondances trouvées (exactement ce que demandait l'audit de simplification)

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

##### Ce qui fonctionne bien — confirmation

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

##### Décisions prises (03/08)

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

##### ✅ LIVRÉ ET VÉRIFIÉ EN CONDITIONS RÉELLES (03/08, commit d1e0f8b)

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

##### Question ouverte — comment inciter à activer le réglage (pas encore résolue)

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

##### Reste ouvert de cet audit

```
- Formulaire de couverture assistant (bloquant, certain, déjà 
  autorisé, prompt prêt)
- MissionType dédié au salariat vs étiquettes sur types libéraux 
  (non tranché, nécessite une vraie session dédiée)
```

---

#### AUDIT FORMULAIRE SALARIÉ — Le vocabulaire libéral traverse tout (03/08)

##### Constat, sur le vrai formulaire, sans rien publier

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

##### Élévation de priorité

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

##### Décision sur la vérification finale (feed/matching en conditions réelles)

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

##### Statut

```
✅ Audit du parcours 4 (salarié/recruteur) considéré SUFFISANT pour 
conclure : inscription ✅, formulaire audité en détail (fonctionne 
partiellement, vocabulaire à corriger), contrat ✅ (déjà vérifié 
propre), feed/matching mécaniquement prouvé débloqué (via Julien). 
Aucune action supplémentaire requise sur ce compte.
```

##### ⏸️ SESSION INTERROMPUE (03/08) — interruption technique, pas un échec

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

##### ✅ SESSION REPRISE ET PARCOURS 4 CONCLU (03/08)

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

## PARTIE III — BRIQUES TRANSVERSES

### Score de compatibilité

#### REFONTE DU SCORING — 03/08 (5 commits, deux vagues)

##### Vague 1 — commit 979ccd8, trois chantiers de fond

```
1. DÉSIRABILITÉ RETIRÉE DU SCORE (pesait 10-15/100), déplacée dans 
   L'ORDRE DU FEED, avec disclosure explicite en langage clair : "les 
   comptes abonnés et partenaires apparaissent en premier. Le score de 
   compatibilité, lui, ne dépend d'aucun abonnement." Bug corrigé au 
   passage : le tri SQL ne lisait que la colonne brute 
   desirabilityScore, ignorant le plan d'abonnement, le statut 
   fondateur (isFounding) et les arbitrages admin.
   
   CORRECTION 17/08 : la disclosure disait aussi "et zones 
   prioritaires". Elle l'a affirmé à l'écran depuis 979ccd8 sans que 
   ce soit vrai une seule fois — getDesirabilityPercent() ne contient 
   aucun terme géographique. Les mots sont retirés du composant ET de 
   cette ligne. Trouvé en scopant le PoC CPTS, pas par un incident : 
   une disclosure fausse ne remonte par aucun canal, personne ne 
   signale un ordre d'affichage qu'il ne peut pas vérifier.
   
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

##### ⚠️ DÉCISION EN SUSPENS — répartition des points libérés par la désirabilité

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

##### Extension de la vision — fluidité du statut DANS LE TEMPS (03/08, ajout de fin de session)

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

##### Vague 2 — commit 3c3018e, deux signalements corrigés

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

##### Statut

```
5 commits en prod (979ccd8 + 3c3018e). Point en suspens : arbitrage 
de repartition des points (dates/geo vs profils) a trancher par 
Jean-Charles. Test de controle DeepSeek (couple bien-note) en cours, 
resultat attendu.
```

---

#### SCORING — Asymétrie chercheur/pourvoyeur corrigée + deux critères de bonus (06/08, commits beb13ae + 48033be)

⚠️ CETTE SECTION DÉCRIT LE CODE DÉPLOYÉ. Une version antérieure la donnait comme « en attente
de décision » alors que la renormalisation et les deux nouveaux critères étaient EN PRODUCTION
depuis le 06/08. Elle affichait aussi l'ancien barème comme « actuel ».

##### Le défaut — un score par SENS de swipe, pas par paire

```
Les champs du score sont ORIENTES : "propose" n'existe que sur une
annonce de cabinet, "recherche" que sur un profil de candidat.
computeAffinityScore ne lisait l'OFFRE que du cote `mission` et la
DEMANDE que du cote `swiper`. Quand le CABINET swipait la
disponibilite d'un candidat, les deux etaient vides : les bonus
tombaient a zero et le cabinet ne pouvait PAS DEPASSER 80/100.
Plafond structurel, jamais affiche.

Aggravant : le detail affichait "logement: 0", qui se lit "pas de
logement propose" alors que la bonne lecture etait "sans objet dans
ce sens".
```

##### ⚠️ CORRECTION D'ATTRIBUTION — la preuve n'est pas celle qu'on a cru

```
Le couple "Julien 78 / Jean-Charles 23" a d'abord ete presente comme
la demonstration mesuree de ce plafond, ici meme et dans le message
de commit. IL NE LA DEMONTRE PAS, et cette correction a deja ete
poussee une fois (48033be) avant d'etre effacee par une reecriture
de ce fichier. Elle est retablie ici.

Sur cette paire, AUCUN des deux camps n'avait coche de critere :
logement 0 et vehicule 0 des DEUX cotes. L'ecart venait d'ailleurs :

  - dates 30 vs 0 : l'annonce a ete MODIFIEE le 04/08, apres le
    swipe de Julien du 01/08 (dates passees a 2025, annee revolue).
    Le 78 note un etat qui n'existait plus.
  - geo 25 vs 6 : les deux calculs n'utilisaient pas la meme mission
    cote swipeur (defaut findFirst, corrige depuis - voir section
    "Deux defauts supplementaires").

LE PLAFOND A 80 EST REEL — il se lit dans le code et se verifie par
test : memes deux profils, 100 max d'un cote contre 80 de l'autre
avant correctif, 83 des deux cotes apres. Mais il se demontre par
LECTURE DU CODE, pas par ces chiffres-la.

Lecon retenue : un chiffre de production n'est une preuve que si
l'on a verifie que rien d'autre ne l'explique.
```

##### Le correctif livré

```
1. UN SCORE PAR PAIRE. Chaque critere est lu DES DEUX COTES
   (offre = mission.x || swiper.x ; demande = swiper.y || mission.y).
   Les points d'appel transmettent les deux faces.

2. SOCLE EN PROPORTIONS. Un critere n'entre au bareme QUE SI le
   chercheur l'exprime ; non demande, son poids RETOURNE AU SOCLE au
   lieu de laisser un trou. Demande mais non offert, il reste au
   bareme et vaut 0 : la, l'ecart est reel.

3. socleMax (100 - bonus en jeu) stocke dans scoreDetails. Sans lui,
   la lecture qualitative ne sait pas sur quelle echelle juger
   "dates: 27". Les lignes anterieures n'en ont pas : on retombe
   alors sur LEGACY_WEIGHTS, sinon les anciens scores paraitraient
   plus faibles qu'ils ne l'etaient.

Invariant verifie sur les 16 combinaisons de demandes x 3 profils :
socle + bonus en jeu = 100 partout.
```

##### Barèmes EN PRODUCTION (lib/compatibilite.ts)

```
SOCLE — proportions sommant 100, ramenees au prorata de ce qui reste
                              dates  geo  bio
  REMPLACEMENT                  40    30   30
  LONG TERME (assistanat +
             collaboration)     20    25   55

La GEOGRAPHIE pese plus sur un remplacement court que sur un poste
long : on ne demenage pas pour trois semaines. Inversion par rapport
a l'ancien bareme, ou elle valait 25 dans les deux cas.

L'affinite de profils est plafonnee a 55 meme la ou elle est la plus
pertinente : seule composante dependant d'un appel modele, et seule
a pouvoir retomber au neutre silencieusement (rate-limit, section
165). On ne lui confie pas la majorite absolue.

BONUS — budget 20, INCHANGE vs logement 10 + vehicule 10. Les deux
nouveaux criteres se partagent l'existant, ils ne l'augmentent pas.
  coordination (MSP / CDS / ESP)   7
  logement                         5
  vehicule                         4
  secretariat                      4

ANCIEN BAREME, pour memoire (ne plus citer comme actuel) :
  Remplacement 35/25/20 + 10/10 · Collaboration 40/30/30 ·
  Assistanat 20/25/55
```

##### ✅ Statut de validation — tranché

```
VALIDE PAR JEAN-CHARLES LE 06/08 : la repartition des bonus
(coordination 7 / logement 5 / vehicule 4 / secretariat 4) ET
l'inversion geographique du socle (la geo pese 30 en remplacement
court contre 25 en assistanat — on ne demenage pas pour trois
semaines).

Ces chiffres etaient deployes depuis beb13ae sans validation, avec la
mention "en attente" dans le code et le commit. L'ecart est ferme :
code et decision disent desormais la meme chose.

Ils ne sont plus provisoires. Les changer est une decision produit,
pas un ajustement — un seul endroit, la constante BONUS et les
SOCLE_* dans lib/compatibilite.ts.
```

##### Assistanat et collaboration fusionnes en un seul bareme (06/08)

```
QUESTION DE JEAN-CHARLES : « assistant et collaborateur sont des
statuts quasi identiques (seule difference : se faire sa propre
patientele), et dans les faits quasi que des assistants. Pourquoi
faire un scoring different ? »

CONSTAT (au 06/08 — ⚠️ le 12/08 il y a 2 missions COLLABORATION en base ;
la décision reste valable, elle portait sur le fait qu'une collaboration
est un poste LONG TERME, mais l'argument du volume nul n'est plus
disponible) : le bareme collaboration n'avait JAMAIS servi — 0 mission
COLLABORATION creee, 0 swipe note. Les seuls profils de ponderation
appliques en base sont ASSISTANAT et REMPLACEMENT.

ET IL ETAIT DU MAUVAIS COTE : 35/30/35, la copie de celui du
remplacement (40/30/30 a l'origine), alors qu'une collaboration est
un poste LONG TERME. Ca ressemble a un profil cree en dupliquant
celui d'a cote, pas a une decision.

DEFAUT CONCRET, pas theorique : comme un assistanat, une
collaboration se publie SANS dates (duree minimale seule).
scoreDates rend 17/35 en neutre dans ce cas. Avec les dates pesees
a 35, ce neutre injectait 17 points de bruit ; a 20, il n'en injecte
que 10. La premiere collaboration publiee aurait ete moins bien
notee qu'un assistanat identique, pour une raison etrangere a la
compatibilite.

LE RESTE DU PRODUIT LES TRAITE DEJA COMME UN SEUL CAS : le
formulaire de disponibilite branche sur `postKind !== "REMPLACEMENT"`
— dates masquees et duree minimale exigee pour les deux. La
patientele propre, seule vraie difference, change ce qu'on SIGNE,
pas ce qui rend deux personnes compatibles.

DECISION (validee) : un seul SOCLE_LONG_TERME (20/25/55) pour les
deux. MissionType garde ses TROIS valeurs — contrats et libelles en
ont besoin — et le label affiche reste « Collaboration » quand c'en
est une. Seul le bareme n'en distingue plus que deux.

Aucun score existant affecte : ce bareme n'avait jamais ete applique.

A RESSEPARER si le terrain le demande. Hypothese plausible : un
collaborateur qui se constitue sa patientele a peut-etre un besoin
geographique plus fort (il lui faut un secteur ou capter des
patients). Avec zero collaboration en base, la separer aujourd'hui
reviendrait a encoder une supposition.
```

##### Pourquoi la coordination devant les trois autres

```
Logement, vehicule et secretariat sont des conditions MATERIELLES,
valables le temps de la mission. L'exercice coordonne change ce que
le kine a le DROIT de faire — acces direct sans prescription
medicale prealable, jusqu'a 8 seances (Avenant 7) — et reste un
acquis de pratique apres la mission. Pas du meme ordre qu'un confort.

Logement devant vehicule et secretariat : en Guadeloupe c'est le
premier blocage concret pour un remplacant venu de l'exterieur.

LIBELLE : "Exercice coordonne — acces direct sans prescription". On
nomme l'AVANTAGE avant le dispositif : "MSP" ne dit rien a qui n'y a
jamais exerce.
```

##### Les deux criteres sont CONDITIONNELS — et ce n'est pas un detail

```
Ils exigent une demande du chercheur (rechercheSecretariat,
rechercheExerciceCoordonne, champs ajoutes cote candidat). Un critere
qui rapporterait des points a TOUS les candidats indistinctement ne
mesurerait pas la compatibilite mais l'ATTRACTIVITE — exactement ce
qui a ete sorti du score le 03/08 avec la desirabilite.

Un cabinet en MSP merite d'etre mis en avant : cela releve de
l'ORDRE DU FEED et du badge de carte, pas du score de compatibilite.
```

##### Méthode d'ajustement évidence-based — notée, pas engagée

```
Correler scores eleves et mises en relation reellement abouties pour
calibrer les poids sur des resultats plutot qu'a l'aveugle. Volume
juge encore trop faible - a reconsiderer quand il aura grossi.
```

##### Reste ouvert

```
Les Match.aiScore et Swipe.affinityScore deja en base sont des
instantanes calcules a l'ancienne formule. Le bouton "Recalculer"
applique la nouvelle. A decider : rescoring de masse, ou attente de
la recalculation naturelle. ⚠️ CORRIGÉ LE 12/08 : la phrase disait « ne sont plus affichés nulle
part mais restent lus par le tri du feed ». LES DEUX MOITIÉS ÉTAIENT
FAUSSES. Ils sont ENCORE AFFICHÉS sur /matches (matches/page.tsx:167 et
253), et le feed ne les lit PAS (il trie sur la désirabilité,
feed/route.ts:116-123). C'est /api/tray qui trie dessus (tray/route.ts:26).
Le retrait du 03/08 portait sur la fiche de mise en relation, pas la liste.
```

---

#### SCORING — Deux défauts supplémentaires trouvés et corrigés (03/08, commit 43408a4)

##### Défaut 1 — la mission du swipeur comparée était tirée au hasard

```
Le score comparait l'annonce swipee a findFirst({isActive: true}) - 
une mission prise dans l'ordre d'INSERTION, pas celle que le match 
allait reellement apparier. Il notait donc un couple qui n'existait 
pas.

FIX : suit maintenant le MEME classement deja utilise pour 
l'appariement reel (recouvrement reel > periode non datee > ecart le 
plus faible > annonces revolues en dernier). Meme regle des deux 
cotes -> meme couple compare.

BONNE PRATIQUE : logique extraite dans src/lib/periodes.ts - "tant 
qu'elle vivait dans un fichier de route Next, rien ne pouvait la 
tester isolement, et c'est elle qui s'est trompee". Rend le bug 
impossible a repeter silencieusement.

Verifie sur les 2 vraies disponibilites de Julien - 3 cas sur 4 
corriges. Le 4e ("non datee") : attente initiale d'Opus fausse, code 
correct des le depart - TEST CORRIGE plutot que force a passer.
```

##### Défaut 2 — deux scores contradictoires sur la même fiche

```
Le bandeau "Score d'affinite" affichait Swipe.affinityScore (un 
instantane fige au moment du swipe, different par sens - meme famille 
que l'asymetrie deja trouvee) a cote du nouveau score de paire 
recalcule. RETIRE. Un seul score desormais, celui de la paire, avec 
lecture qualitative + bouton recalcul, en tete de fiche et dans 
l'en-tete du chat.

Raison : l'instantane ne survit pas a l'edition des annonces qu'il 
note - celui du match de Jean-Charles decrivait un etat disparu 
depuis 3 jours.

DETTE TECHNIQUE CONNUE, ACCEPTEE (volume minuscule) : les 8 
Swipe.affinityScore figes existent toujours en base, ne sont plus 
affiches nulle part, MAIS restent lus par le tri du feed - les 
swipes anciens gardent un classement a l'ancienne formule jusqu'a 
rejeu. Pas corrige, volume trop faible pour justifier l'effort 
maintenant.
```

##### ✅ Correction de donnée autorisée

```
Cause du score a 22% du match de reference identifiee : une annonce 
de Jean-Charles porte des dates aout-septembre 2025 (annee revolue) 
alors que creee le 31/07/2026 - faute de frappe quasi certaine 
(2025 au lieu de 2026). Ne recouvrira JAMAIS aucune disponibilite 
tant que non corrigee.

✅ AUTORISÉ (03/08) : corriger l'année en 2026. Opus avait bien fait 
de demander avant de toucher au contenu d'une annonce utilisateur.
```

---

### Ordre du feed et saisonnalité

#### STRATÉGIE DE MARCHÉ — Déséquilibre remplaçant/assistant + saisonnalité (03/08)

##### Deux constats de Jean-Charles

```
1. Beaucoup de remplaçants, pas assez d'assistants. Souhait : un 
   flux incitatif qui récupère implicitement une partie des 
   remplaçants vers l'assistanat.
2. Saisonnalité : mai-octobre a MOINS de candidats visibles que 
   octobre-mai. Souhait : booster la visibilité de ceux qui 
   cherchent quand même sur cette fenêtre creuse.
```

##### Connexion avec l'existant

```
Le point 1 est EXACTEMENT le cas d'usage qui justifie la vision 
chercheur/pourvoyeur déjà documentée en Phase 3 ("on peut chercher 
des remplas puis vouloir se poser"). Décision : ne pas attendre la 
refonte complète - tester une version légère (suggestion 
contextuelle, pas de refonte du modèle de données) pour valider 
l'intuition à moindre coût avant d'investir dans l'architecture 
complète.

Le point 2 s'articule naturellement avec le travail du jour sur la 
désirabilité (sortie du score, vivant désormais dans l'ordre du 
feed) - le bon endroit pour ajouter un boost saisonnier, sans 
toucher au calcul de compatibilité.
```

##### Investigation du boost saisonnier — résultat et validation (03/08)

```
LIEU CONFIRMÉ : getDesirabilityPercent (lib/desirability.ts), 
appliqué en post-traitement dans api/feed/route.ts:105-106.

TROIS CONSTATS QUI CHANGENT LA CONCEPTION :
1. La désirabilité vaut 0 pour TOUS les candidats aujourd'hui (jamais 
   facturés, aucun override/statut partenaire) - le boost saisonnier 
   ne serait donc pas "un facteur parmi d'autres" mais LE SEUL signal 
   de classement du feed cabinet. Change complètement l'enjeu du 
   dosage.
2. 🔴 CATCH IMPORTANT : un boost ABSOLU aurait déclassé les cabinets 
   qui ne recrutent pas l'été - 3 annonces cabinet sur 8 sont sans 
   date de fin (postes long terme, filtre inapplicable). Un cabinet 
   recrutant pour décembre aurait vu des candidats disponibles en 
   août remonter en tête, le score disant "dates éloignées" mais 
   trop tard - l'ordre déjà faussé. Trouvé AVANT d'être construit.
3. Les assistants structurellement exclus - poste sans dates (option 
   1, minMonths seul) donc aucun chevauchement calculable. Cohérent 
   avec la nature du poste, pas un défaut.

DONNÉES : seulement 3 disponibilités candidats en base (toutes dans 
mai-octobre), 8 annonces cabinet (5 démarrant dans la fenêtre). 
Aujourd'hui le boost serait INERTE (100% des candidats concernés, 
aucun ordre relatif changé) - bonne discipline de ne pas confirmer/
infirmer la rareté mai-octobre sur cette base ("c'est ton observation 
terrain qui fait foi, pas ces trois lignes").

✅ PROPOSITION VALIDÉE (03/08), trois arbitrages tranchés :
1. Boost CONDITIONNEL (pas absolu) - un candidat mai-octobre n'est 
   boosté que si le besoin du cabinet regardant recoupe aussi cette 
   fenêtre. Seule option évitant le déclassement trouvé au point 2.
2. Dosage : +30, sous le futur palier Premium (50) pour que la 
   monétisation future reste toujours prioritaire sur la saisonnalité
3. Assistants exclus : accepté, cohérent avec l'absence de fenêtre 
   saisonnière pour un engagement long terme

Règle de chevauchement simple retenue : test d'appartenance des mois 
couverts à mai-octobre, sans arithmétique d'années, pas de cas 
particulier au 31 décembre. Ligne de transparence prolongée 
(existante + mention saisonnalité).
```

##### Statut

```
✅ Boost saisonnier : investigation complète, 3 arbitrages validés, 
AUTORISÉ à implémenter (~30 lignes, lib/desirability.ts).
🟡 Suggestion légère assistanat pour remplaçants à profil compatible : 
prompt toujours en attente d'envoi, indépendant.
```

---

### Mise en relation — unicité

#### CONTRAT — refus explicite plutôt qu'un type deviné (13/08) — livré

##### Le repli

`contrat/route.ts` déterminait le gabarit ainsi :

```ts
missionTitulaire?.missionType ?? missionAutre?.missionType ?? MissionType.REMPLACEMENT
```

Sans mission d'aucun côté, il choisissait **REMPLACEMENT par défaut** — sans le moindre signal
à l'écran ni dans le PDF. Un contrat de remplacement aurait pu être généré, puis **signé**,
pour un assistanat.

##### Pourquoi maintenant

Inoffensif tant qu'un match portait toujours au moins une mission. **Ça ne l'est plus** :
l'unicité repose désormais sur la paire de missions (section 209) et `missionBId` est nullable.
Le repli est passé de « inatteignable » à « atteignable un jour », sur un document juridique.

##### Vérifié inatteignable AUJOURD'HUI, avant de pousser

- `Mission.missionType` est **NOT NULL** au schéma — les 22 missions en base en portent une ;
- l'**unique** chemin de création d'un `Match` (`api/swipe:244`) renseigne toujours les deux
  `missionId` ;
- aucun code ne remet un `missionId` à `null`.

Aucun cas légitime n'est donc cassé.

##### Ce qui remplace le repli

Un **422** nommant la cause et l'action : « aucune annonce n'est rattachée à cette mise en
relation, le type de contrat ne peut donc pas être déterminé. Rattachez l'annonce concernée
avant de poursuivre. »

Un contrat absent se remarque et se corrige ; un contrat faux se découvre trop tard. C'est la
règle d'écriture opposable appliquée au document lui-même.

##### Vérifié en production, en atteignant réellement le garde

Le refus est **le troisième** de la route : signature, puis identité contractuelle, puis type.
Pour l'atteindre il a fallu une mise en relation entre les **deux seuls comptes à identité
complète** (Jean-Charles DUBIEN et Julien MORISOT), sans aucune mission, appelée en
`?draft=true` pour franchir le garde de signature. Le message attendu s'affiche. Base
restaurée — 0 mise en relation.

`contrat-info` rend déjà `null` sans deviner : rien à y changer. Les autres occurrences de
`MissionType.REMPLACEMENT` sont des valeurs par défaut **à la création** (absence, présence,
type de poste), où l'utilisateur choisit — pas la même famille.

---

#### UNICITÉ D'UN MATCH — de la paire de personnes à la paire de missions (13/08) — livré

##### Ce qui contraignait

`@@unique([profileAId, profileBId])` : **une seule relation par paire de personnes**, tous
types confondus. Un cabinet et un candidat ouverts à la fois au remplacement et à l'assistanat
ne pouvaient pas mener les deux — invisible à 0 mise en relation, mais coûteux à changer une
fois le volume arrivé.

##### La contrainte, désormais

```sql
UNIQUE (COALESCE("missionAId","profileAId"), COALESCE("missionBId","profileBId"))
-- index Match_paire_missions_key
```

**Le `COALESCE` n'est pas un ornement.** `missionBId` est nullable — une relation peut naître
sans mission côté candidat — et **Postgres traite chaque `NULL` comme DISTINCT** dans un index
unique. Un `UNIQUE(missionAId, missionBId)` nu aurait donc laissé passer autant de relations
« cabinet ↔ Jean sans mission » qu'on voudrait. Le repli sur `profileXId` ramène l'unicité à
celle de la personne dans ce cas précis — exactement le comportement voulu.

##### Arbitrage retenu

| | Objets à maintenir | Déclarable dans Prisma |
|---|---|---|
| **Index d'expression `COALESCE`** *(retenu)* | **1** | non |
| `@@unique([missionAId, missionBId])` + 2 index partiels | 3 | partiellement — les partiels échappent de toute façon à Prisma |

Une règle vaut mieux que trois. La contrepartie — pas de clé composée typée, donc pas de
`findUnique` sur cette paire — est sans coût réel : le garde applicatif devait changer de
sémantique de toute façon et utilise `findFirst`.

**La contrainte n'apparaît pas dans `schema.prisma`** (Prisma ne sait pas déclarer un index
d'expression) : un commentaire l'y signale, à l'emplacement de l'ancien `@@unique`.

##### Le garde applicatif suit

`api/swipe` vérifiait « ces deux personnes ont-elles déjà une relation ? ». Il vérifie
désormais « cette **paire de missions** a-t-elle déjà une relation ? » — code et base disent la
même chose.

##### Migration

`DROP CONSTRAINT` + `CREATE UNIQUE INDEX`, appliqués à la main via
`prisma db execute --url $DIRECT_URL`. **0 mise en relation en base** : aucune donnée à
réconcilier, aucun risque. C'est précisément la fenêtre où l'opération est gratuite.

##### Vérifié par l'échec, contre la base réelle (13/08)

Trois insertions successives entre **Jean-Charles DUBIEN** et **John Doe** — ce dernier n'ayant
aucune mission, donc `missionBId = NULL` des deux côtés, ce qui est précisément le cas piège :

| | Résultat |
|---|---|
| 1. Relation sur l'annonce A | créée |
| 2. Seconde relation, **mêmes personnes**, autre annonce | **créée** — refusée sous l'ancienne contrainte |
| 3. Doublon sur la **même paire de missions** | **refusé, P2002** |

Le cas 3 est la démonstration du `COALESCE` : les deux lignes portaient `missionBId = NULL`, et
un `UNIQUE(missionAId, missionBId)` nu les aurait acceptées toutes les deux. Base restaurée
après essai — 0 mise en relation.

##### Ce que cela ouvre, et qui n'est pas encore exercé

Deux personnes peuvent désormais avoir **plusieurs relations**, sur des missions différentes.
Rien ne l'exploite aujourd'hui : `NO_ACTIVE_MATCH_FILTER` retire du feed toute mission déjà
engagée, si bien qu'une seconde relation ne peut pas naître spontanément.

⚠️ Deux endroits raisonnent encore **par personne** et devront être revus le jour où ce cas
existera : `detachAssistantPostForMatch` (détache par cabinet + assistant) et le calcul
`enRelation` de `api/missions/[id]/interesses` (exclut une personne dès qu'une relation existe,
quelle qu'elle soit).

---

### Contrat, identité contractuelle, déontologie

#### SUIVI — Vérification déontologique du système de notation (29/07)

##### Statut

```
✅ RÉSOLU — vérifié directement, portée : RemplacantRating (le 
cabinet évalue le remplaçant) ne porte aucun champ de commentaire 
libre ; l'asymétrie voulue par l'article R.4321-99 est respectée à 
ce niveau du modèle. Ce prompt original — plus précis que le cadrage 
en 7 points fait le lendemain — visait exactement ce point, et 
c'est lui qui répond à la question, pas l'audit élargi.

⚠️ CE QUE "RÉSOLU" COUVRE ICI, PRÉCISÉMENT (convention de portée 
adoptée suite au malentendu du 23/07, voir plus bas) : l'absence de 
champ de commentaire libre sur le modèle RemplacantRating. 
NE COUVRE PAS : une revue exhaustive de tous les points où le 
produit touche à la déontologie (voir la section "AUDIT 
DÉONTOLOGIQUE" du 03/08 pour ce périmètre plus large, séparément 
traité).

Historique : resté marqué 🔴 en attente pendant 6 jours (29/07→03/08) 
sans confirmation qu'il avait été transmis à une session Opus — 
symptomatique de la même faille que celle nommée dans la règle de 
méthode n°7.
```

---

#### VÉRIFICATION DÉONTOLOGIQUE — Cadrage et 7 points identifiés (03/08)

##### Méthode retenue

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

##### 3 points FACTUELS, concrets, avec correctifs clairs (approuvés)

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

##### 4 points D'ARBITRAGE, documentés sans trancher (pour le CDO)

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

##### Statut

```
✅ Périmètre validé par Jean-Charles. Opus continue sur les points 
1-3. Point 5 : précision factuelle demandée avant classement 
définitif en arbitrage. Point 7 : signalé comme le plus consequential 
des 4, priorité de remontée au CDO.
```

---

#### AUDIT DÉONTOLOGIQUE — Résultat des 3 points factuels (03/08)

##### 1. Communication à l'Ordre : une clause, jamais un acte

```
Obligation bien présente dans les 3 templates de contrat (article 
21). Mais "Ordre" n'apparaît QUE dans les PDF - aucune autre surface 
produit ne le mentionne. AUCUN champ de suivi en base (pas de date 
d'envoi, pas de statut, pas de relance) - alors que la plateforme 
trace déjà CONTRACT_SIGNED et sait exactement quand agir.
```

##### 2. Vérification d'identité : un avertissement, pas une condition

```
PlatformConfig.enforceContractProfile = FALSE en production, vérifié 
en base. Mécanisme de blocage existe (contrat/route.ts:132) mais 
désarmé.

Mesure sur les 8 comptes réels : UN SEUL compte sur huit est vérifié 
RPPS. Un contrat peut aujourd'hui être signé entre deux praticiens 
dont ni l'inscription au tableau ni le numéro d'Ordre ne sont 
renseignés.
```

##### 3. Autorisation de remplacement : n'existe pas dans le modèle

```
Aucun champ nulle part - le schéma porte rpps/numeroOrdre/adresse/
siret/isVerified, rien qui corresponde à l'autorisation delivrée par 
le CDO que doit détenir un remplaçant. Des contrats de remplacement 
sont générés sans jamais demander la pièce qui les autorise.
```

##### 4 points d'arbitrage — précision sur le point 5

```
Notation entre confrères : 3 modèles existent (Rating, CabinetRating, 
RemplacantRating), ratingAvg participe au tri du feed — MAIS ZÉRO 
NOTATION EN BASE À CE JOUR. Le sujet est donc entièrement ouvert, 
pas encore un risque actif (contrairement à la crainte initiale d'un 
usage réel déjà en cours). Bon moment pour décider AVANT tout 
premier usage, pas pour corriger un usage existant.
```

##### Décision — Fix 1 pris en premier

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

#### enforceContractProfile ARMÉ — Effet réel mesuré + trou de sécurité trouvé (03/08)

##### Bascule effectuée

```
✅ false -> true en production, via toggle /admin/config existant. 
Aucun code modifié.
```

##### Effet réel, corrigé après vérification (pas l'estimation initiale)

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

##### 🔴 TROU DE SÉCURITÉ TROUVÉ — le garde protège le PDF, pas la signature

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

##### Ce qui reste ouvert (inchangé)

```
- Rappel post-signature de communication à l'Ordre (avec champ de 
  suivi) - pas encore pris
- Champ "autorisation de remplacement" - pas encore pris
- 4 arbitrages (publicité, notation, mise en avant payante, 
  rémunération au contrat) - pour le CDO de Jean-Charles, pas Opus 
  ni Sonnet. Note utile sur la notation : zéro note en base 
  actuellement, moment favorable pour décider avant tout usage réel.
```

##### Statut

```
✅ enforceContractProfile armé et vérifié. 🟡 Fermeture de la faille 
signature/route.ts autorisée, en attente d'envoi/exécution.
```

##### FERMETURE DE LA PORTE DE SERVICE — Signature protégée + message proactif décidé (03/08)

###### Livré

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

###### ✅ LIVRÉ — Message proactif aux deux emplacements (commits, dont 1a52258)

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

###### Récapitulatif de l'audit déontologique — état final de la session

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

#### RÉ-AUDIT FINAL DE LA SESSION — 6/7 vérifiés, découverte sur la portée du droit de retrait (03/08, clôture)

##### Découverte — le droit de retrait est plus large qu'annoncé

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

##### ✅ BONNE PRATIQUE NOTÉE — commentaire de code corrigé pour refléter la portée réelle

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

##### Bilan des vérifications du ré-audit — 6 sur 7

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

##### Décision de clôture de session

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

#### RATTACHEMENT AUTOMATIQUE — Bug CONFIRMÉ avec preuve en production (03/08)

##### Le bug, avec preuve réelle

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

##### Décision — interprétation retenue

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

##### ✅ CORRIGÉ LE 13/08 — dix jours après la décision

La décision du 03/08 est restée dix jours sans exécution : documentée, jamais livrée. C'était
le plus ancien défaut fonctionnel ouvert du produit.

**Ce que « rattaché » veut dire, concrètement** : `CabinetPost.linkedUserId = userId` du
candidat — le lien entre le compte et le poste du Planning. **Le `ProfileType` n'est pas
touché**, conformément à la décision : « le type de profil décrit ce qu'on cherche, pas ce
qu'on devient ». C'est la mission signée qui fait foi, et son type est vérifié en amont.

**La garde n'était pas entièrement un oubli** — vérifié avant de la lever. Elle portait deux
conditions dans une seule ligne :

| Condition | Verdict |
|---|---|
| `cabinet.type !== TITULAIRE` | **protection réelle, conservée** — c'est elle qui détermine quel camp porte le poste ; sans elle, un match sans titulaire inverserait les rôles |
| `assistant.type !== ASSISTANT` | **l'oubli** — le feed propose les assistanats aux DEUX types (`oppositeTypes = [REMPLACANT, ASSISTANT]`) |

Le côté candidat accepte désormais `REMPLACANT` **ou** `ASSISTANT`. Le contrôle n'a pas été
supprimé : le laisser tomber ferait passer un match TITULAIRE↔TITULAIRE, où l'« assistant »
désigné serait le propriétaire d'un autre cabinet.

**Les deux points sont indissociables.** Le détachement (l.97) portait la même garde :
relâcher l'attache seule aurait créé des rattachements qu'aucune annulation ne défait — un
poste resterait occupé par quelqu'un dont le contrat est rompu.

##### Vérification — fonction réelle, base réelle

Le module TypeScript a été chargé tel quel (via `jiti`) et exercé contre la base de
production, sur le poste « Mathéo » du cabinet de Jean-Charles :

| Cas | Rattaché | Attendu | |
|---|---|---|---|
| REMPLACANT (John Doe) | oui | oui | ✅ le correctif |
| ASSISTANT (Paul) | oui | oui | ✅ pas de régression |
| TITULAIRE (Cabinet la Palmeraie) | non | non | ✅ protection intacte |

Le détachement a été vérifié dans la foulée : `linkedUserId` repasse à `null`. État restauré
après essai — 0 mise en relation, 0 poste rattaché, 5 postes pour le cabinet (inchangé, le cas
TITULAIRE n'a créé aucun poste parasite).

⚠️ **Portée de cette vérification** : elle couvre la fonction de rattachement et son
détachement, contre de vraies données. Elle **NE couvre PAS** le parcours complet depuis
l'interface — un enchaînement swipe → match → double signature aurait signé un contrat au nom
d'un tiers réel, action sortante hors du cadre d'une vérification technique. La route de
signature appelle cette fonction sans condition supplémentaire
(`signature/route.ts:222`), le maillon non rejoué est donc l'appel lui-même, pas la logique.

---

### Donnée, traçabilité et destination institutionnelle

#### AUDIT TRACEEVENT — Résultat et point d'urgence identifié (03/08)

##### Constat d'Opus (verbatim, important)

```
Avec 46 publications, 3 mises en relation et 2 contrats, la base ne 
supporte aujourd'hui aucune affirmation territoriale. L'enjeu de cet 
audit n'est pas de produire des chiffres maintenant, c'est de 
garantir qu'ils seront là quand le volume viendra — et surtout qu'ils 
ne seront pas déjà perdus, ce qui est le cas des annulations.
```

##### Le vrai trou identifié

```
Les ANNULATIONS de matches/contrats après signature ne sont PAS 
tracées par TraceEvent actuellement. Contrairement au petit volume 
(pas un problème - se corrige avec le temps), une donnée 
d'annulation non capturée aujourd'hui est PERDUE DÉFINITIVEMENT, 
meme quand le volume grossira. C'est le seul point vraiment urgent 
de l'audit, par irreversibilite.
```

##### Statut

```
🔴 Prompt de fix prioritaire rédigé (capture TraceEvent des 
annulations) - passe avant les ameliorations de confort, en attente 
d'envoi.
```

##### CAPTURE TRACEEVENT DES ANNULATIONS — Livré (03/08, commit b4bd1f1)

###### 5 points de destruction couverts (2 de plus que prévu par l'audit initial)

```
| Chemin | Origine | Avant |
|---|---|---|
| DELETE /api/match/[matchId] "Annuler la mise en relation" | MATCH_SUPPRIME | suppression totale, sans trace |
| PATCH /api/matches/[id] -> DECLINE/EXPIRE | DECLINE | statut change, sans trace |
| DELETE /api/missions/[id] | ANNONCE_SUPPRIMEE | cascade silencieuse (non isole par l'audit initial) |
| DELETE /api/absences | ABSENCE_SUPPRIMEE | cascade silencieuse (non isole par l'audit initial) |
| DELETE /api/admin/missions/[id] | ADMIN | cascade silencieuse |
```

###### Architecture retenue

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

###### ✅ Décision privacy-by-design saluée

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

###### Vérification en attente — décision prise

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

###### Statut

```
✅ LIVRÉ, poussé (b4bd1f1). Vérification empirique différée, pas 
bloquante.
```

---

#### VISION STRATÉGIQUE — Au-delà du SaaS : donnée, MCP, et l'avenir du commerce numérique (03/08)

##### Thèse de Jean-Charles

```
La mode SaaS (interface web classique) a encore 2-3 ans devant elle 
pour generer du revenu, mais l'evolution vers des agents IA (via 
MCP notamment) va commoditiser la couche interface. Ce qui restera 
rare et monnayable : la DONNEE et le rapport donnee/recherche - 
savoir quoi interroger pour obtenir une reponse utile sur un marche 
precis. Question posee : comment penser Soignect des maintenant dans 
cette logique, sans attendre que le changement soit acte ?
```

##### Ce qui existe déjà et va dans ce sens (sans avoir été nommé ainsi)

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

##### Action concrète proposée — serveur MCP léger

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

##### Limite légale à poser dès maintenant sur la donnée

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

##### ✅ DÉCISION DU 03/08 — orientation adoptée MAINTENANT, pas différée

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

##### Trois actions concrètes adoptées immédiatement

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

##### Statut

```
✅ ADOPTÉ COMME ORIENTATION ACTIVE, pas différé. Le serveur MCP 
(section precedente) reste un chantier futur (Phase 3), mais la 
DISCIPLINE DE COLLECTE, elle, s'applique des maintenant a toute 
nouvelle feature.
```

##### Prompt d'audit TraceEvent rédigé (à envoyer à Opus)

```
Prompt complet redige pour auditer la couverture reelle de 
TraceEvent au regard de cette mission institutionnelle - liste des 
eventType existants, signaux manquants identifies (delai de 
remplissage, taux reels pratiques, annulations post-signature, 
saisonnalite, taux de conversion par etape). Lecture seule, aucun 
code. En attente d'envoi.
```

---

### Module embarquable pour sites de territoire

#### QUATRE PORTES D'ENTRÉE — troisième axe du module (14/08) — livré

##### Ce qui empêche l'explosion en matrice

Trois axes pourraient laisser craindre un produit cartésien de textes à maintenir. Il n'en est
rien, parce que **chaque axe ne déclare que ce qui varie avec lui** :

| Axe | Ce qu'il porte |
|---|---|
| `Profession` | le vocabulaire — 4 formes du même mot, plus le `slug` d'URL |
| `Territoire` | le nom, la préposition, la forme courte — des **données**, pas des phrases |
| `Porte` | les **phrases**, écrites comme fonctions de `(profession, territoire)` |

La porte compose ; les deux autres sont ses ingrédients. **Ajouter une porte = une entrée.
Ajouter un territoire = une entrée.** Le module tient en 220 lignes pour trois dimensions.

La porte `CHERCHEUR` **délègue** aux champs déjà portés par `Territoire` : ces textes étaient
les siens depuis l'origine, sans être nommés. Nommés sans être réécrits — les trois pages
géographiques, vérifiées à l'écran, ne changent pas d'un caractère et **gardent leur chemin
historique**, indexé et partagé depuis des semaines.

##### Les six pages

| Porte | URL | À qui |
|---|---|---|
| Chercheur *(existant)* | `/remplacement-kine-{territoire}` × 3 | remplaçants, assistants |
| Cabinet | `/recrutement-kine-guadeloupe` | cabinets libéraux qui recrutent |
| Établissement | `/emploi-kine-guadeloupe` | hôpital, clinique, EHPAD, SSR, CAMSP |
| MSP / CPTS | `/territoire-kine-guadeloupe` | structures territoriales |

Motif `{porte}-{profession}-{territoire}`, dont `remplacement-kine-guadeloupe` était déjà un cas.

##### La porte territoire ne suit PAS le gabarit — délibérément

Les trois premières s'adressent à quelqu'un qui vient **chercher ou pourvoir un poste** : une
liste d'annonces y est l'argument. **Une CPTS ne cherche pas un poste**, elle pilote une offre
de soins. Lui dérouler un fil d'annonces répondrait à côté.

Sa page affiche donc une **répartition par zone, calculée en direct** via `COMMUNE_ZONE`, puis
un argumentaire en trois points. Le **traitement de diffusion est identique** — même trace,
même entrée admin, même partage : c'est la mise en page qui diffère, pas le régime.

##### /admin/diffusion est dérivé du module, plus recopié

La liste des pages y était écrite à la main. Elle est désormais **calculée** depuis `PORTES` et
`TERRITOIRES` : une porte ajoutée y apparaît sans toucher cet écran. C'est l'oubli qu'on rend
impossible — Jean-Charles avait déjà découvert des pages en ligne dont il ignorait l'existence.
Le module embarquable y figure aussi, bien qu'il ne soit pas une page de campagne.

##### Un défaut trouvé par la trace, pas par la compilation

`cheminPage` construisait l'URL depuis `Profession.court` — **« kiné », accentué**. Les chemins
générés pointaient vers `/emploi-kiné-guadeloupe` quand la route est `/emploi-kine-guadeloupe`.

Les pages répondaient (la route existe), donc rien ne se voyait : mais le lien « Ouvrir ↗ » de
`/admin/diffusion` aurait renvoyé un **404**, les `canonical` et `og:url` étaient faux, et les
clés de trace divergeaient des historiques. **Les deux formes compilent aussi bien** — c'est
la lecture des traces en base, après déploiement, qui l'a révélé.

`Profession` porte maintenant un **`slug` déclaré**, pas translittéré : une normalisation
automatique marcherait ici et échouerait ailleurs, et surtout elle serait invisible. Un chemin
public se lit, il ne se devine pas.

##### Vérification

Les six pages répondent en 200, et **les sept clés de trace attendues existent en base**, avec
la distinction humains/robots — aucune clé inattendue, aucune page en « non tracée ». Les 5
traces accentuées, toutes issues de mes propres appels de vérification, ont été retirées pour
ne pas scinder les compteurs.

⚠️ **Non vérifié à l'écran** : l'extension navigateur s'est déconnectée avant le contrôle de
`/admin/diffusion`. La liste y est dérivée du même module que les chemins vérifiés ci-dessus,
et les compteurs lisent les clés confirmées en base — mais le rendu de cet écran n'a pas été
regardé.

---

#### /embed/territoire/[zone] — v1 postes ouverts (13/08) — livré

##### URL et intégration

```
https://www.soignect.fr/embed/territoire/nord-basse-terre
```

```html
<iframe src="https://www.soignect.fr/embed/territoire/nord-basse-terre"
        title="Postes de kinésithérapie — Nord Basse-Terre"
        style="width:100%; height:520px; border:0;"
        loading="lazy"></iframe>
```

Hauteur conseillée **520 px** pour 5 postes (~70 px par ligne + en-tête + CTA). La largeur suit
l'hôte, la mise en page est fluide. Une iframe ne s'auto-dimensionne pas : au-delà d'une
dizaine d'annonces, prévoir un `height` plus grand ou accepter le défilement interne.

##### Trois mécanismes déjà en place — rien à créer

| Besoin | Ce qui existait |
|---|---|
| Rendu sans chrome | le layout **racine** n'a ni en-tête ni menu ; la navigation vit dans le groupe `(app)`. Être hors de ce groupe suffit — comme `/annonce/[id]` et les pages de campagne |
| Accès public | **aucun middleware** dans le produit : chaque route appelle `auth()` si elle en a besoin. Celle-ci ne le fait pas |
| Iframe autorisée | **aucun `X-Frame-Options` ni `frame-ancestors`** servi en production (vérifié par `curl`) |

##### Filtre partagé, pas réécrit

`lib/annoncesTerritoire.filtreAnnoncesVivantes(zones, communes)` porte les deux corrections
apprises sur la page de campagne, qu'une réécriture aurait refaites :

- **macro-zones ET communes acceptées** — les annonces antérieures au système de zones n'ont
  qu'un `location` en texte libre ; ne comparer que les zones en écartait 3 sur 10 ;
- **expiration écrite en positif** — `NOT (null < maintenant)` ne vaut pas vrai en SQL et
  faisait disparaître toutes les annonces sans date de fin.

La page `/remplacement-kine-guadeloupe` l'utilise désormais aussi : une seule source.

##### Neutralité visuelle — dont un défaut trouvé à l'écran

Gris, une seule couleur d'accent pour le CTA, aucun aplat de marque.

**Le `<body>` de l'application impose `background-color: var(--md-background)`** (globals.css).
Dans une iframe plus haute que son contenu, cette couleur débordait et dessinait une bande
étrangère sur le site hôte. Le fond est désormais **transparent** sur cette route : celui de
l'hôte passe au travers, clair ou sombre.

Le CTA s'ouvre **hors de l'iframe** (`target="_blank"`) : enfermer une inscription dans un
cadre de quelques centaines de pixels sur un site tiers ne mènerait nulle part.

##### Périmètre du territoire

`NORD_BASSE_TERRE` au sens du produit — **Pointe-Noire, Deshaies, Sainte-Rose, Lamentin**.
5 annonces actives au 13/08, toutes à Pointe-Noire.

⚠️ **Le périmètre réel de la CPTS Nord Basse-Terre n'a pas été vérifié** et peut différer de
cette macro-zone, qui est un découpage produit. À confirmer avec Jean-Charles avant diffusion :
un module qui prétend couvrir un territoire doit couvrir le bon.

##### v2 non construite, emplacement réservé

L'**indicateur de tension** est marqué en commentaire dans le code, non implémenté. Sa source
n'est pas tranchée : le zonage ARS (arrêté 971-2024, 2 catégories en Guadeloupe) est un
classement réglementaire régional, l'APL de la DREES est une donnée nationale brute — deux
couches distinctes. Un indicateur de tension faux sur le site d'une CPTS coûterait plus cher
que son absence.

La page est **non indexée** (`robots: noindex`) : son contenu duplique la page de campagne, qui
reste canonique. Sa fréquentation est tracée sous la clé `embed-nord-basse-terre`, visible dans
`/admin/diffusion`.

---

### Diffusion et acquisition

#### VISION — Multiples points d'entrée adressés par cible (27/07)

##### Constat déclencheur

```
Aujourd'hui, tout lien externe (post Facebook, etc.) mène vers 
/login — une porte de service sans argument, sans preuve, sans 
réponse à "pourquoi moi, pourquoi maintenant". Un seul point 
d'entrée pour des cibles aux besoins radicalement différents.
```

##### Décision de cadrage

```
DES PORTES DIFFÉRENTES, PAS DES NOMS DIFFÉRENTS. La vision 
multi-marque (section 185, différée) reste hors sujet ici : "Soignect" 
n'est même pas encore déposé à l'INPI, créer plusieurs identités 
maintenant serait une dilution avant l'établissement de la marque 
mère. Une seule marque, plusieurs pages d'entrée adressées, qui 
débouchent toutes sur la même inscription — en PRÉ-SÉLECTIONNANT le 
type de profil (gain d'usage, pas seulement marketing).
```

##### Cibles identifiées et leur douleur spécifique

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

##### Pages envisagées (une seule construite pour l'instant)

```
- /venir-en-guadeloupe (métropolitain) — PRIORITAIRE, en cours
- /assistanat (jeune diplômé, argument réglementaire 2027)
- /cabinets (titulaire)
- /etablissements (salariat)
```

##### Bénéfice secondaire

```
Chaque porte devient un point de mesure. TraceEvent déjà en place — 
permet enfin de savoir quel canal produit des inscriptions, ce qui 
est impossible aujourd'hui avec un point d'entrée unique.
```

##### Discipline de séquencement

```
Une seule page construite d'abord (métropolitain), mesurée, puis 
généralisation SEULEMENT si conversion prouvée. Rappel du risque 
déjà vécu : lancer plusieurs chantiers d'un coup a fait reculer la 
bêta de 4 jours (audit du 21/07).
```

##### Statut

```
✅ Prompt complet rédigé et remis à Jean-Charles pour envoi (27/07). 
Cumulé dans PROMPTS_EN_ATTENTE.md (B7). Contrainte de portée explicite 
dans le prompt : une seule page construite, pas les 3 autres, pas de 
nom de marque distinct.

🔴 CORRECTION DE SUIVI (03/08) : B7 N'A JAMAIS ÉTÉ CONSTRUITE. Le ✅ 
ci-dessus documentait que le prompt était rédigé et remis — pas 
qu'il avait été exécuté. Aucune vérification n'a jamais confirmé 
l'exécution. MÊME FAMILLE que le "malentendu du 23/07" (voir section 
dédiée) : un ✅ affirmant plus qu'il ne sait.

Ce qui existe réellement : une page DIFFÉRENTE, /remplacement-kine-
guadeloupe (origine exacte non tracée), trouvée et largement corrigée 
le 03/08 par Opus (filtres zones, disponibilités remplaçants absentes 
du côté preuve, annonces expirées affichées comme actives, piège SQL 
NOT(null<now), messaging gratuité). 

✅ DÉCISION (03/08) : ne pas construire B7 séparément. Utiliser 
/remplacement-kine-guadeloupe comme page de diffusion, avec l'ajout 
de la pré-sélection du profil au CTA (~30 lignes, voir prompt ci-
dessous). Cohérent avec la discipline de simplification déjà 
engagée — ne pas construire deux fois la même chose.

B7 reste documenté ci-dessus pour mémoire historique, mais n'est PLUS 
un chantier actif.
```

---

#### PAGE DE DIFFUSION — /remplacement-kine-guadeloupe corrigée, décision prise (03/08)

##### Corrections livrées (commit 1aef755)

```
| | Avant | Après |
|---|---|---|
| Annonces affichées | 7 | 9 |
| Dont chercheurs de poste | 0 | 2 |
| Promesse chiffrée fausse | présente | retirée |

FILTRE ZONES corrigé : comparait une liste figée de 32 communes au 
champ libre "location" - accepte désormais les deux (une annonce 
antérieure au système de zones n'en a pas). Saint-Martin/Saint-Barth 
restent exclus (pages dédiées).

DISPONIBILITÉS REMPLAÇANTS ENFIN VISIBLES - leur "location" valait 
une macro-zone ("Sud Basse-Terre") ou une liste, ne passait jamais le 
filtre exact. "Une page censée prouver que ça bouge des deux côtés 
n'affichait que des cabinets."

FILTRE ANNONCES EXPIRÉES ajouté - aucun avant, une annonce à période 
passée s'affichait comme preuve d'activité. PIÈGE SQL TROUVÉ EN 
EXÉCUTANT (pas en relisant) : NOT (null < maintenant) ne vaut pas 
vrai en SQL - 3 annonces sans date de fin ("dès septembre") 
disparaissaient silencieusement dans la première version du fix.

GRATUITÉ : plus aucun seuil/date annoncé pour les cabinets. Confirmé 
: triggerBillingIfNeeded ne s'applique qu'au type TITULAIRE - un 
chercheur de poste n'est JAMAIS facturé, quel que soit le devenir du 
mode bêta. Message : "Remplacement, assistanat, collaboration : la 
recherche de poste est gratuite, sans frais ni engagement."
```

##### 🔴 Découverte majeure — /venir-en-guadeloupe (B7) n'a jamais existé

```
Voir correction dans la section B7 plus haut. Résumé : un suivi 
erroné a laissé croire pendant des jours qu'une page dédiée existait, 
alors que seul le prompt avait été rédigé, jamais confirmé exécuté.
```

##### ✅ Décision (03/08)

```
Utiliser /remplacement-kine-guadeloupe comme page de diffusion, ne 
pas construire B7 séparément. Ajouter la pré-sélection du profil au 
CTA d'inscription (actuellement /register nu, sans lecture du type 
de profil souhaité).
```

##### Statut

```
✅ Corrections de fond livrées et vérifiées. 🟡 Prompt de 
pré-sélection du profil rédigé ci-dessous, en attente d'envoi.
```

---

### Géographie du matching

#### COMMUNE ↔ ZONE — comment le score géographique est résolu (13/08)

##### Trois granularités, deux portées par le même modèle

| Rôle | Champ | Remarque |
|---|---|---|
| Proposeur | `Mission.location` (`String`) | commune, obligatoire |
| Chercheur | `Mission.zones` (`ZoneGeographique[]`) | macro-zones souhaitées |
| Territoire | `Profile.region` | Guadeloupe / Saint-Martin / Saint-Barth — **pas** une zone |

Les deux premiers vivent sur `Mission`, pas un par camp : la distinction cabinet/candidat est
un **usage**, pas une contrainte de schéma.

##### La correspondance EST résolue — par une constante, pas par la base

`scoreGeo` (`deepseek.ts:101`) pivote sur `zoneOfCommune()`, qui n'est qu'un accès à
`COMMUNE_ZONE` — 35 entrées en TypeScript.

```
25 pts — la commune de l'un tombe dans les zones souhaitées de l'autre
25 pts — communes identiques
18 pts — communes différentes, MÊME macro-zone
12 pts — commune manquante d'un côté
 6 pts — rien en commun
```

La comparaison est **toujours commune ↔ zones de l'autre**, jamais zones ↔ zones : la
flexibilité géographique n'existe que côté candidat, le cabinet a une adresse fixe.

**Le poids réel n'est pas 20/100** : `geoRaw` est sur 25, puis renormalisé au socle —
**30 en remplacement, 25 en long terme**, eux-mêmes au prorata des bonus en jeu.

##### Les couches ne sont PAS mélangées

`communes.ts` porte deux objets distincts, sans aucune valeur APL :

- `COMMUNE_ZONE` — commune → **macro-zone produit**, découpage maison, sans rapport avec l'ARS ;
- `ZONE_3_INTERMEDIAIRE` / `ZONE_4_NON_PRIORITAIRE` — le **zonage réglementaire** (arrêté
  971-2024).

Le seul piège est le mot « zone », qui désigne deux choses. `CommuneAPL` porte bien la donnée
DREES (couche 2), nationale par construction.

---

#### COMMUNEZONE — table générée depuis COMMUNE_ZONE (13/08) — livré

##### Deux référentiels d'accord par chance

`CommuneZone` (table Prisma, 35 lignes) dupliquait `COMMUNE_ZONE` (35 entrées). Comparés entrée
par entrée le 13/08 : **zéro écart** — mais **rien ne les synchronisait**. Aujourd'hui ils
coïncident ; demain, rien ne le garantissait.

La table n'est lue par **aucun code produit** : elle sert les analyses SQL par territoire
(Soignect Observatoire). C'est la constante qui décide du matching.

##### La constante est désormais la source, la table en est dérivée

`scripts/sync-commune-zone.mjs`, dans la convention maison (`.mjs`, idempotent, mode simulation
par défaut) :

```
node scripts/sync-commune-zone.mjs           → rapporte les écarts, n'écrit rien, sortie 1
node scripts/sync-commune-zone.mjs --apply   → régénère        (npm run db:sync-zones)
                                                                 npm run db:check-zones
```

Il lit `COMMUNE_ZONE` **depuis le vrai module TypeScript** (via `jiti`), jamais une copie : le
script et `scoreGeo` voient forcément la même chose. Une recopie aurait recréé le problème
qu'on ferme.

Régénération par `upsert`, pas `TRUNCATE` + `INSERT` : la table n'est jamais vide, même une
fraction de seconde.

**`scoreGeo` et `zoneOfCommune` sont inchangés** — le scoring reste synchrone et lit toujours
la constante. Aucun changement de comportement.

##### Vérifié en provoquant la divergence

La conformité seule ne prouvait rien (les deux étaient déjà d'accord). Trois écarts ont donc été
introduits en base, un de chaque nature :

| Écart | Détecté | Corrigé par `--apply` |
|---|---|---|
| `Deshaies` classée en `MARIE_GALANTE` | ✅ | ✅ → `NORD_BASSE_TERRE` |
| « Commune fantôme » absente de la source | ✅ | ✅ supprimée |
| `Goyave` retirée de la table | ✅ | ✅ recréée |

Sortie **1** en mode vérification, **0** après régénération, table revenue à ses 35 lignes
d'origine. La sortie 1 rend le script utilisable tel quel comme garde-fou — **le projet n'a ni
CI ni hook de pré-commit** (aucun `.github/workflows`, aucun `.husky`), donc rien à y brancher
aujourd'hui : `npm run db:check-zones` est le crochet prêt à l'emploi le jour où l'un des deux
existera.

##### Le commentaire du schéma dit maintenant le danger

Une modification faite dans la table serait effacée à la régénération **et**, plus grave,
n'aurait aucun effet sur le matching entre-temps — le scoring ne la lit pas. C'est écrit
au-dessus du modèle, avec le renvoi vers la source et la commande.

#### LE PONT COMMUNE → CODE INSEE (17/08) — livré

##### Ce que l'investigation du 13/08 n'avait pas vu

Elle avait cartographié `Mission.location`, `Mission.zones`, `CommuneAPL` et le zonage ARS, et
conclu que `CommuneAPL` « porte la bonne donnée mais reste non alimentée ». **Deux erreurs dans
cette phrase**, trouvées le 17/08 en interrogeant la base au lieu de lire le schéma :

1. **La table EST alimentée** : 112 lignes, dont les **32 communes de Guadeloupe**, `aplKine`
   renseigné partout. « Alimentation absente » désignait l'absence de **script**, pas de
   données — la nuance décide s'il faut créer des lignes ou seulement les lire. Il ne faut pas.
2. **Rien ne reliait cette table à une annonce.** `CommuneAPL` est clé par `codeInsee` ; or
   `codeInsee` n'apparaissait **nulle part** hors du schéma et de `/admin/apl`. La donnée était
   à la fois présente et inatteignable. C'est le vrai obstacle, et il n'était nommé dans aucune
   des deux investigations.

##### Le décalage de libellés, mesuré et non déduit

La jointure évidente (`WHERE commune = location`) échoue sur **7 libellés sur 35** :

| Forme du piège | Libellés | Ce que fait la jointure naïve |
|---|---|---|
| Produit désambiguïsé, INSEE non | `Grand-Bourg (Marie-Galante)`, `Saint-Louis (Marie-Galante)`, `Terre-de-Haut (Les Saintes)`, `Terre-de-Bas (Les Saintes)` | perd les 4, en silence |
| Deux libellés, un territoire | `Marigot (Saint-Martin)`, `Grand Case (Saint-Martin)` | correspondance **non injective** |
| Pas une commune du tout | `Grand Case (Saint-Martin)` | aucun code propre, emprunte celui de Saint-Martin |

Le rapport de scoping annonçait « au moins 4 » sur la foi de la nomenclature INSEE. **7** après
comptage : il avait manqué Saint-Martin (×2) et Saint-Barthélemy.

##### `COMMUNE_INSEE`, déclaré et non dérivé

Table dans `src/lib/communes.ts`, aux côtés de `COMMUNE_ZONE`, plus `inseeOfCommune()`.
**Troisième application de la même règle** après le `slug` d'URL (14/08) et `Profession.enumBase`
(17/08) : aucune normalisation automatique (retirer la parenthèse, comparer sans accents) ne
survivrait au cas « deux libellés, un code », et surtout elle serait invisible.

**Un code valide ne garantit pas une ligne APL.** `CommuneAPL` ne couvre que 971/972/973/974 :
Saint-Martin (978) et Saint-Barthélemy (977) ont quitté la Guadeloupe en 2007. Leurs 3 codes
sont exacts et ne trouveront jamais rien — fait administratif, pas défaut à corriger.

##### `npm run db:check-insee` — rapporte, ne répare pas

Volontairement **sans `--apply`**, contrairement à `db:sync-zones`. Là-bas une constante fait
autorité et la table en est dérivée ; ici les deux côtés sont autoritaires et aucun ne peut
réparer l'autre — un code INSEE ne s'invente pas, et la donnée DREES n'a pas à être réécrite
depuis le produit. **Un `--apply` aurait été le vrai danger** : il aurait fabriqué des lignes APL
vides pour faire taire l'alerte.

Sortie 1 réservée au cassant (libellé non ponté, entrée orpheline, code introuvable dans un
département couvert). Les absences 977/978 sont signalées **sans** faire échouer.

##### Vérifié en cassant, comme le précédent

| Écart injecté | Détecté |
|---|---|
| `Deshaies` → code inexistant `97199` | ✅ `INTROUVABLE dans CommuneAPL` |
| `Goyave` retirée du pont | ✅ `dans le produit, absente du pont` |
| « Commune Fantôme » ajoutée au pont | ✅ `dans le pont, absente du produit` + partage de code signalé |

Sortie **1** sur le pont cassé, **0** après restauration. À l'état sain, le script affiche les
4 libellés que seul le pont rapproche — le décalage est montré, pas supposé.

**Aucun consommateur au moment de sa livraison** : le pont a été construit avant son premier
lecteur. Celui-ci est arrivé le jour même — voir la priorité territoriale ci-dessous.

#### PRIORITÉ TERRITORIALE DÉCLARÉE (17/08) — livrée

##### Ce qui existait, et ne faisait rien

`CommuneAPL.boost*` (−10 à +10, une colonne par profession) est éditable dans `/admin/apl`
depuis longtemps. **16 des 32 communes de Guadeloupe portent une valeur non nulle**, dont trois
des quatre communes de Nord Basse-Terre (Pointe-Noire, Deshaies, Sainte-Rose à +2). Aucune
logique produit ne les lisait. L'écran invitait donc à régler un curseur sans effet, pendant que
le feed affirmait à l'utilisateur que ce curseur agissait.

##### Ces valeurs ne sont pas des déclarations — mesuré le 18/08

La phrase ci-dessus est vraie et a été lue de travers, ici comme dans le ROADMAP : « quelqu'un a
déjà déclaré des priorités dans l'admin ». **Personne n'a jamais touché ces curseurs.**

Les **112 lignes** de `CommuneAPL` portent un `updatedAt` identique **à la milliseconde**
(`2026-06-28T18:16:37.780Z`). La colonne est `@updatedAt` : une seule saisie dans `/admin/apl`
aurait décalé sa ligne. Aucune ne l'est. Les `boost*` sont entrés avec l'import initial, et
suivent l'indicateur APL au lieu de le contredire :

| `boostKine` | communes | `aplKine` observé |
|---|---|---|
| 3 | 11 | 0 (aucune donnée) |
| 2 | 22 | 24,6 → 166 |
| 1 | 23 | 117,5 → 203,7 |
| 0 | 56 | 0,3 → 405 |

Réparti uniformément sur les quatre départements — 16/32 (971), 17/34 (972), 11/22 (973),
12/24 (974). Une CPTS de Guadeloupe n'aurait pas classé Maripasoula ni Cilaos.

**Ce que le module met donc en avant est une dérivation d'un indicateur national, pas un jugement
porté par une institution locale.** Le comportement reste défendable — une commune sous-dotée
mérite d'être montrée. Le récit ne l'était pas : c'est la même erreur que `979ccd8` d'un cran plus
bas. En `979ccd8` le mécanisme n'existait pas ; ici il existe, mais on attribuait à une
institution un chiffre que personne n'avait posé. Attrapée avant tout push.

Conséquence sur la colonne elle-même : `boost*` **ne peut pas devenir** le canal de déclaration
d'une CPTS. Elle est déjà occupée par une valeur dérivée, et une colonne qui mélange les deux rend
une déclaration indistinguable d'un calcul — c'est le manque n°3 déjà nommé sur `CommuneAPL`.

##### Où elle vit : dans l'ordre, jamais dans le score

`src/lib/territoire.ts`, appliqué dans `/api/feed` à côté de la désirabilité et du bonus
saisonnier. La discipline du 03/08 vaut telle quelle : « cette commune manque de kinés » est un
jugement de santé publique porté par une institution, il ne dit rien de l'accord entre deux
personnes et n'a rien à faire dans `computeAffinityScore`.

**Dosage — facteur 3, soit ±30 au maximum.** Le boost brut (±10) ajouté tel quel serait noyé
face à un palier Premium de 50. ±30 le met à égalité avec le bonus saisonnier et sous le palier
Premium, ce qui se défend en une phrase devant une CPTS comme devant un abonné : une commune
déclarée prioritaire au maximum pèse autant que la fenêtre de tension, jamais autant qu'un
abonnement payé.

##### Elle ne joue que dans un sens, et c'est délibéré

« Il manque des kinés à Deshaies » veut dire : montrer les **postes** de Deshaies aux candidats.
Pas : mettre en avant les **candidats** habitant Deshaies auprès des cabinets — un cabinet de
Deshaies cherche quelqu'un, pas quelqu'un du coin. Le bonus ne s'applique donc qu'aux lecteurs
candidats. Le produit avait déjà un bonus directionnel en sens inverse (le saisonnier ne joue
que devant un cabinet) : les deux ne se rencontrent jamais.

##### La mention de transparence est revenue, mais conditionnée

Retirée le matin faute d'être vraie, remise l'après-midi avec son mécanisme. Elle n'apparaît que
si au moins une annonce du feed courant est réellement remontée à ce titre (en-tête
`x-feed-priorite-territoriale`), et se tait sinon. **Ne jamais la réécrire en inconditionnel** :
une phrase en dur redeviendrait fausse le jour où plus aucune commune n'est déclarée, et
personne ne le remarquerait — c'est exactement ainsi que la version précédente a survécu depuis
`979ccd8`.

**« par sa CPTS » retiré le 18/08.** La condition portait sur le mécanisme et tenait ; c'est
l'attribution qui était fausse (voir ci-dessus : personne n'a rien déclaré). La mention affichée
ne nommait donc plus d'auteur.

**Et remise le 20/08 (B2, `d238531`)** — troisième version de cette phrase, la première qui
puisse être vérifiée. Voir le détail plus bas ; en résumé : elle nomme l'institution quand une
seule a déclaré, et retombe sur une formule **sans auteur** dans tous les autres cas. Le repli
n'est jamais une attribution approximative.

##### Vérifiée sur la donnée réelle

| Cas | Attendu | Obtenu |
|---|---|---|
| Bornage `+99` / `−99` | ±30 | ±30 |
| `Deshaies`, `Pointe-Noire`, `Sainte-Rose` (boost 2) | +6 | +6 |
| `Lamentin` (boost 0) | 0 | 0 |
| **`Terre-de-Bas (Les Saintes)`**, base écrit `Terre-de-Bas` | +3 | **+3** |
| `Grand Case (Saint-Martin)`, hors périmètre APL | 0 | 0 |
| Profession `INFIRMIER`, mêmes communes | boosts différents | 3 entrées |

La ligne en gras est celle qui compte : **sans le pont `COMMUNE_INSEE`, elle aurait rendu 0 en
silence.** C'est la démonstration que le bloc précédent n'était pas une précaution théorique.

##### Effet réel aujourd'hui : AUCUN — vérifié à l'écran, contre l'attente

6 des 12 annonces de cabinet vivantes sont à Pointe-Noire, seule commune déclarée qui porte des
annonces, et le bonus leur donne bien +6. **L'ordre affiché est pourtant identique avec et sans
le bonus**, comparé ligne à ligne :

```
SANS bonus            AVEC bonus
100  Pointe-Noire ×6   106  Pointe-Noire ×6      ← même rang
  0  Le Gosier           0  Le Gosier
  0  Saint-Claude        0  Saint-Claude          (…)
```

**Parce que ces 6 annonces sont celles du cabinet fondateur**, dont `isFounding` fixe la
désirabilité à 100. Elles étaient déjà en tête, pour une raison qui n'a rien de territorial.
Le bonus les fait passer de 100 à 106 : rien ne bouge.

La première formulation de cette section affirmait « le levier déplace réellement quelque chose,
le PoC est démontrable ». **C'était faux**, et l'erreur mérite d'être gardée : elle vient d'avoir
lu que 6 annonces recevaient le bonus, sans vérifier ce qu'elles valaient sans lui. Un bonus qui
s'applique n'est pas un bonus qui déplace.

##### La tension structurelle que ça révèle

Le plafond du levier institutionnel est **+30** ; `isFounding` vaut **100**. Une commune déclarée
prioritaire par une CPTS ne peut donc JAMAIS faire remonter une annonce au-dessus de celles du
cabinet fondateur. Sur un feed où ce cabinet publie, la priorité territoriale ne réordonne que
ce qui est déjà sous lui.

Ce n'est pas un défaut de dosage — remonter le facteur ferait passer une préférence gratuite
devant un abonnement payé, ce que le §dosage écarte explicitement. C'est un arbitrage entre deux
leviers qui n'avaient jamais eu à cohabiter, **à trancher avant la démonstration à la CPTS** :
sur le territoire de Nord Basse-Terre, le cabinet fondateur et la commune prioritaire sont le
même endroit (Pointe-Noire), donc la démonstration ne montrerait rien.

Pour rendre l'effet visible il faudrait une commune déclarée prioritaire portant des annonces
d'un cabinet NON fondateur — aujourd'hui Le Gosier, Saint-Claude, Baie-Mahault, Pointe-à-Pitre
et Les Abymes sont toutes à désirabilité 0 et aucune n'est déclarée.

##### L'arbitrage, tranché le 18/08 : le dosage n'était pas la question

**Verdict : `isFounding` garde la tête, le facteur ne bouge pas — mais pas pour la raison
avancée ci-dessus.** Le défaut n'est pas que 30 soit trop petit devant 100 : c'est que ces deux
nombres s'**additionnent sur un seul axe** alors qu'ils sont de deux natures.

| | Nature | Valeurs |
|---|---|---|
| Désirabilité | **échelle de rang** commerciale — qui paie, qui possède | Gratuit 0 · Premium/Structure 50 · Boost 80 · Fondateur 100 |
| Saisonnier, territorial | **modulations** — une tension du terrain | +30 · ±30 |

Les sommer oblige chaque nouveau levier à se doser contre le tarif. C'est ce qui a produit la
fausse alternative — « trahir l'abonné » ou « un levier inerte » : les deux branches sont
mauvaises parce que la question l'est.

**La forme juste est un tri lexicographique** : rang commercial d'abord, modulations ensuite au
sein du rang. Aucun levier gratuit ne passe alors devant un abonnement payé quel que soit son
dosage, et `FACTEUR_PRIORITE_TERRITORIALE` cesse de porter une signification commerciale qu'il
n'aurait jamais dû porter.

**Elle n'est pas implémentée, et c'est le point.** Elle protégerait un levier institutionnel qui
n'existe pas : la colonne lue ne contient aucune déclaration. L'écrire aujourd'hui serait de
l'architecture à vide — la règle qui garde `FENETRE_TENSION_GUADELOUPE` en constante plutôt qu'en
table. Le déclencheur est nommé dans le code : le jour où une institution écrit vraiment dans le
produit, c'est le tri qu'on change, pas le facteur.

##### Ce qui bloque réellement la démonstration à la CPTS

Ni le dosage ni l'ordre. Deux faits mesurés le 18/08 sur les **11** annonces de cabinet vivantes :

1. **Le cabinet fondateur est celui de Jean-Charles** (`isFounding`, `institutionalPartner`), et
   il porte **6 des 11 annonces**, toutes à **Pointe-Noire** — la commune de Nord Basse-Terre
   dont il serait question. Montrer « votre commune prioritaire remonte » y afficherait le
   cabinet du vendeur, en tête pour une raison qui n'a rien de territorial. Aucune règle de tri
   ne corrige ça ; seul le choix du terrain, ou le dire à voix haute, le corrige.
2. **Rien n'a été déclaré par personne**, donc il n'y a pour l'instant aucune priorité de la CPTS
   à lui montrer — seulement notre import du 28/06.

**Mise à jour du 20/08.** Le point 2 est levé : la CPTS Nord Basse-Terre a une relation ouverte
et une déclaration réelle (Deshaies). Le point 1 tient, avec des chiffres qui ont bougé — **5
des 10** annonces de cabinet vivantes sont au cabinet fondateur, toutes à Pointe-Noire (le total
était de 11 le 18/08). Les mesures ci-dessus restent datées du 18/08 et ne sont pas réécrites :
ce qui a changé se lit ici.

**L'ordre des chantiers s'inverse donc.** B3 (écran de déclaration) n'est pas la suite de B2, il
en est le **prérequis** : tant qu'une institution ne peut pas écrire dans une colonne qui ne
contient QUE des déclarations, il n'y a pas de levier institutionnel — ni à arbitrer, ni à
mentionner, ni à démontrer.

**Mais `Mission.location` n'est pas toujours une commune.** Sur les annonces vivantes on trouve
`« Cabinet des ravines »` (un nom de cabinet), `« Sud Basse-Terre »`, `« Sud Grande-Terre »`,
`« Toute la Guadeloupe »` (des zones, saisies par des candidats). `inseeOfCommune` rend `null`
et le bonus vaut 0 : **pas de boost plutôt qu'un mauvais boost**, ce qui est le bon échec. Il
reste qu'une annonce de cabinet sur douze ne pourra jamais en bénéficier tant que sa `location`
n'est pas une commune. À traiter comme une question de saisie, pas de scoring.

#### B3 — LE CANAL DE DÉCLARATION (19/08, `b669afa`) — livré

##### Le défaut n'était pas la valeur, c'était le support

Un entier nu ne dit ni qui a déclaré, ni quand, ni sur quelle base : rien dans `boostKine = 2`
ne distingue un jugement de santé publique d'un résultat de calcul. **Toute phrase attribuant
ce 2 à une institution était donc invérifiable par construction** — ce qui a produit deux
affirmations fausses d'affilée (`979ccd8`, puis la mention « par sa CPTS » retirée le 18/08).

`PrioriteTerritoriale` est le support qui peut porter la vérité : **aucune ligne n'existe sans
nommer son institution, sa date de déclaration et l'administrateur qui l'a co-saisie.**

| Choix | Motif |
|---|---|
| Table, pas colonne de plus | une déclaration a un auteur ; `boost*` ne pouvait pas en porter un |
| **Table vide au départ** | amorcer depuis les 56 communes à `boost != 0` aurait fabriqué 56 déclarations que personne n'a faites |
| Échelle **1..10**, plus −10..+10 | une institution déclare un manque, pas qu'une commune mérite d'être enfoncée |
| `@@unique([codeInsee, profession])` | deux déclarations concurrentes poseraient « laquelle gagne ? », sans réponse honnête |
| `expireLe` | sans lui, un jugement de 2026 classerait encore le feed en 2031 |
| Commune et profession non modifiables | les changer ne corrige pas une déclaration, ça en fabrique une autre sous l'auteur de la première |

**Le feed ne lit plus `boost*`.** Ces colonnes restent éditables dans `/admin/apl` et ne sont
plus lues par aucune logique produit — ce qu'on en fait est une question ouverte, pas un oubli.

##### Le gating par relation client (19/08, `35e25aa`)

Une déclaration ne suffit pas. Le levier territorial est un **service institutionnel vendu** —
PoC gratuit aujourd'hui, client payant demain. S'il s'appliquait dès qu'une valeur existe en
base, le produit distribuerait gratuitement ce qu'il est censé vendre.

`PrioriteTerritoriale.institution` était du **texte libre** : « CPTS Nord Basse-Terre » et
« test » se valaient. Remplacé par `clientId` → `ClientInstitutionnel`, qui porte la nature de
la relation (`POC_GRATUIT` / `CLIENT_PAYANT` / `GRATUITE_NEGOCIEE`), son début et son échéance.

C'est la **troisième fois** que la même faute se présente sous un autre visage, et c'est ce qui
justifie de ne pas la traiter par un drapeau :

1. `boost*` agissait sans que personne ne l'ait déclaré → B3 a créé un support pour l'auteur ;
2. `institution` en texte libre ne prouvait aucune relation → cette version la remplace ;
3. un statut nu (« client actif : oui ») aurait affirmé une relation sans pouvoir la prouver
   → `ClientInstitutionnel` porte nature, début et échéance de revue.

À chaque étape, le correctif donne au support la capacité de porter ce qu'on lui fait dire —
jamais un champ de plus qui l'affirme.

##### `revueLe` est une date de revue, PAS une preuve de fonction active

La gratuité CPTS est conditionnée à une fonction (« tant que Jean-Charles en est secrétaire »).
**Un rôle institutionnel ne s'interroge par aucune API** : le produit ne peut pas constater
qu'il est toujours exercé. Un champ nommé `fonctionActive` aurait affirmé le contraire — la
faute exacte déjà commise avec `boost*`.

Ce que la colonne garantit est plus modeste et vrai : **la relation n'est jamais silencieusement
permanente.** `NOT NULL`, donc aucune relation ne naît sans échéance. 6 à 12 mois.

**L'échéance ÉTEINT le levier, elle ne se contente pas de signaler.** Si le boost continuait de
courir après la date, la revue ne serait qu'un post-it que personne n'est obligé de lire.
L'extinction est le défaut, la reconduction un geste explicite.

##### Vérifié contre la base — matrice de six cas

`chargerPrioritesTerritoriales` filtre **deux conditions indépendantes, toutes deux en SQL** :
la déclaration est vivante, ET la relation est active.

| Cas | Attendu | Obtenu |
|---|---|---|
| Relation active | 1 | 1 |
| Revue dépassée | 0 (levier éteint) | 0 |
| Reconduite | 1 | 1 |
| Relation close | 0 | 0 |
| Déclaration échue | 0 | 0 |
| `clientId` inexistant | refus | refusé par la base (P2003) |

L'expiration est filtrée en SQL et non après coup, `expireLe: null` devant passer — un `lt` seul
les écarterait toutes, piège classique du NULL en SQL.

##### L'écran, vu en conditions réelles le 20/08

`/admin/priorites` porte les deux blocs — relations au-dessus, déclarations en dessous. Les
séparer inviterait à saisir la seconde sans regarder la première. Une colonne « Agit ? » dit non
*et pourquoi*.

**La réserve « jamais vu à l'écran » est levée** : Jean-Charles a ouvert la relation et saisi la
déclaration de bout en bout, « Agit ? oui » confirmé. Deux défauts relevés à cette première
utilisation, corrigés depuis (`d8bb6ca`) :

| Défaut | Cause | Correctif |
|---|---|---|
| Une déclaration saisie le 20/08 s'affichait **19/08** | ces champs sont des **dates**, stockées à minuit UTC ; rendues dans le fuseau du navigateur elles reculent partout à l'ouest de Greenwich — en Guadeloupe (UTC−4), minuit UTC le 20 est le 19 à 20 h | `timeZone: "UTC"` à l'affichage |
| Le compteur « Déclarations » restait à **0** | il vient de `_count`, calculé au chargement serveur ; rien ne le mettait à jour après une création | mise à jour à la création **et** à la suppression |

Le premier correctif porte sur le **rendu**, jamais sur la donnée : décaler la valeur stockée
aurait cassé la comparaison d'échéance que le feed fait en SQL.

##### État réel au 25/08 — deux déclarations, aucune créditée, mention muette

| | |
|---|---|
| Relation | **CPTS NORD BASSE TERRE** — CPTS, `POC_GRATUIT`, ouverte le 20/08, revue le 20/02/2027, non close |
| Déclarations | **Deshaies** (20/08) et **Sainte-Rose** (21/08) — `KINESITHERAPEUTE`, niveau 2 → 6 points, sans échéance |
| Annonces créditées | **0 sur 14** |
| Mention affichée | **aucune** |

Aucune des deux communes ne porte d'annonce. Le levier est donc **actif et sans effet**, et la
mention se tait — le comportement correct, pas un échec.

##### Pointe-Noire : déclarée le 25/08, retirée le jour même

Elle est la seule commune du territoire qui porte des annonces (5), et elle a été déclarée pour
tester ce que ça produirait. **Trois faits mesurés avant retrait**, qui valent d'être gardés :

1. **La mention s'est affichée pour la première fois**, et elle nommait son auteur : « …une
   commune **déclarée prioritaire par CPTS NORD BASSE TERRE** ». La branche « une seule
   institution → on la nomme » est donc exercée pour de vrai, pas seulement simulée.
2. **L'ordre n'a pas bougé d'un rang.** Les 5 annonces créditées passent de 100 à 106 — ce sont
   celles du cabinet fondateur, déjà en tête. `937c884` reproduit à l'identique quatre jours plus
   tard, sur une déclaration réelle cette fois au lieu d'une valeur dérivée de l'APL. **Le levier
   s'applique ; il ne déplace rien.**
3. **La démonstration aurait été trompeuse** : « déclarée prioritaire par CPTS NORD BASSE TERRE »
   se serait affiché au-dessus de cinq annonces appartenant à Jean-Charles. Un observateur peut
   en conclure que la déclaration met en avant le cabinet de celui qui vend l'outil. C'est faux —
   elles seraient premières sans elle — mais l'écran ne le dit pas.

Retirée pour cette raison. Ce n'est pas un défaut du levier : c'est le levier qui rend visible un
conflit d'intérêt préexistant, et le bon geste est de ne pas s'en servir là.

##### « Agit ? oui » ne veut pas dire « a un effet »

L'écran `/admin/priorites` affiche **« Agit ? oui »** pour Deshaies et Sainte-Rose alors que 0
annonce est créditée. Ce n'est pas faux : la colonne dit que la déclaration est **en vigueur**
(relation active, déclaration non échue), pas qu'elle change quelque chose au feed aujourd'hui.

La distinction n'est pas anodine dans un produit qui a passé une semaine à corriger des écrans
affirmant plus qu'ils ne savent. Un administrateur peut lire « Agit ? oui » comme « ça marche ».
**À reformuler si le doute se confirme à l'usage** — pas corrigé aujourd'hui faute d'avoir vu
quelqu'un s'y tromper.

##### Ce qui reste bloqué, et ce n'est pas technique

La chaîne est complète et vérifiée de bout en bout, mention comprise. Ce qui manque pour une démo
qui **montre** un déplacement n'est pas du code : il faut **un cabinet non fondateur publiant sur
une commune déclarée**. Sur les quatre communes du territoire, trois portent 0 annonce et la
quatrième n'en porte que du cabinet fondateur. C'est du recrutement d'annonceur.

**Le niveau 2 des deux déclarations est une valeur posée par défaut, pas un arbitrage de la
CPTS** — noté dans chaque ligne, modifiable dans `/admin/priorites`. À niveau égal, le levier ne
peut pas trancher entre deux communes déclarées ; il ne le pourra que si la CPTS hiérarchise
réellement son territoire.

#### B2 — LA MENTION NOMME L'INSTITUTION (20/08, `d238531`) — livrée

##### Trois versions de la même phrase, deux fausses

| Version | Ce qu'elle affirmait | Pourquoi c'était faux |
|---|---|---|
| `979ccd8` → 17/08 | « et zones prioritaires » | **aucun mécanisme n'existait** — `getDesirabilityPercent` ne contenait aucun terme géographique |
| 18/08 (matin) | retirée | — |
| 18/08 (ap.-midi) | « déclarée prioritaire par sa CPTS » | le mécanisme existait, mais **l'auteur était inventé** : `boost*` dérivait de l'APL, personne n'avait rien déclaré |
| **20/08 (B2)** | « déclarée prioritaire par CPTS NORD BASSE TERRE » | **vérifiable** — adossée à une ligne `PrioriteTerritoriale` réelle, portée par une relation client active |

La phrase n'a pas changé de nature en changeant de mots : elle a changé de nature quand le
produit a acquis **la capacité de désigner un auteur**. C'est tout l'objet de B3 et du gating.

##### Le transport, et pourquoi il est fait comme ça

`chargerPrioritesTerritoriales` rend désormais `{ points, institution }` au lieu d'un nombre nu.
**Le nom voyage avec les points** : il ne peut pas se retrouver associé à la mauvaise commune,
puisqu'il ne s'en sépare jamais.

L'en-tête `x-feed-priorite-institutions` porte les institutions distinctes à créditer **pour ce
lecteur**, en `JSON` + `encodeURIComponent`. Un en-tête HTTP est du latin-1 : un nom accentué
(« Communauté… ») le casserait ou le mutilerait en silence. **Aucune institution accentuée
n'existe aujourd'hui — c'est précisément pourquoi le faire maintenant**, pendant que l'absence
de bug est vérifiable plutôt qu'espérée. Même raisonnement que le filtre de profession du 17/08.

##### La règle d'écriture, qui est la vraie livraison

| Cas | Phrase |
|---|---|
| **1** institution | « une commune **déclarée prioritaire par {nom}** » |
| **plusieurs** | « une commune où votre profession est signalée comme manquante » |
| **aucune**, en-tête absent, JSON illisible | idem — formule sans auteur |

Énumérer trois CPTS dans une mention de 10 px la rendrait illisible ; en choisir une serait
arbitraire. **Le repli n'est jamais une attribution approximative** : c'est exactement ce qui a
rendu cette phrase fausse deux fois. Une phrase sans auteur est vraie ; une phrase au mauvais
auteur ne l'est pas.

Le `try/catch` autour du décodage retombe sur la liste vide, donc sur la formule sans auteur —
un en-tête corrompu ne peut pas produire un nom inventé.

##### Vérifiée par simulation, puis une fois en conditions réelles (25/08)

La réserve du 20/08 — « la phrase nommée n'a jamais été vue à l'écran » — **a été levée le 25/08**
par la déclaration temporaire de Pointe-Noire (voir plus haut) :

```
annonces créditées : 5 sur 14
x-feed-priorite-territoriale : 5
x-feed-priorite-institutions : %5B%22CPTS%20NORD%20BASSE%20TERRE%22%5D
PHRASE : « …une commune déclarée prioritaire par CPTS NORD BASSE TERRE »
```

La branche « une seule institution → on la nomme » a donc bien été exercée. Pointe-Noire retirée
depuis, la mention est de nouveau muette — mais on sait désormais qu'elle fonctionne, ce qui
n'était pas le cas jusque-là.

Les branches à plusieurs institutions et à en-tête illisible restent vérifiées **par simulation
uniquement** : elles demandent une seconde CPTS, qui n'existe pas.

#### PAGES PERSONA FILTRÉES PAR AUDIENCE (25/08) — livré

##### Le défaut : chaque page montrait le camp du visiteur

`filtreAnnoncesVivantes` filtrait la profession, le territoire et l'expiration — **jamais qui
avait publié**. La page « Je recherche un kinésithérapeute pour renforcer mon cabinet » affichait
donc 18 annonces dont l'essentiel étaient **les offres d'autres cabinets** : sans le moindre
intérêt pour un visiteur qui recrute, et noyant l'unique disponibilité candidate — la seule qu'il
était venu chercher.

**Règle retenue : chaque page montre à son visiteur l'inverse de lui-même, jamais son propre
camp.** C'est la logique d'`oppositeTypes` de `/api/feed`, appliquée aux pages publiques où elle
manquait.

##### Le discriminant est `Profile.type`, pas `missionType`

| Camp | Types de profil |
|---|---|
| `EMPLOYEUR` | `TITULAIRE` — couvre cabinets libéraux **et** structures (EHPAD, clinique, SSR) : une STRUCTURE est un TITULAIRE dont `titulaireKind` vaut STRUCTURE, jamais un type à part |
| `CANDIDAT` | `REMPLACANT` **+** `ASSISTANT` confondus |

`missionType` (REMPLACEMENT / ASSISTANAT / COLLABORATION) décrit la **nature du poste**, pas qui
le publie : un cabinet cherchant un remplaçant et un remplaçant cherchant un cabinet portent tous
deux `REMPLACEMENT`. Filtrer par là aurait marché sur les libellés et menti sur le sens.

Chaque camp voit l'**intégralité** du pool d'en face, ce qui préserve le multi-préférences : un
candidat publiant plusieurs types de recherche reste visible depuis les pages employeur, quel que
soit leur nombre.

##### Le camp est déclaré par la porte, et le paramètre est obligatoire

`Porte.montre` porte le camp affiché. Déclaré plutôt que dérivé : **ajouter une porte oblige à
trancher à qui elle parle**, au lieu de laisser un défaut décider en silence.

Le paramètre `camp` de `filtreAnnoncesVivantes` est **obligatoire et sans valeur par défaut** —
même raison que la profession le 17/08 : un défaut aurait refermé la fuite aujourd'hui et l'aurait
rouverte à la première page oubliée.

| Page | Visiteur | Affiche |
|---|---|---|
| `/recrutement-kine-guadeloupe` | cabinet | **CANDIDAT** |
| `/emploi-kine-guadeloupe` | établissement | **CANDIDAT** |
| `/remplacement-kine-guadeloupe` | chercheur de poste | **EMPLOYEUR** |
| `/territoire-kine-guadeloupe` | CPTS | **EMPLOYEUR** |
| `/embed/territoire/[zone]` | candidats | **EMPLOYEUR** |

**La porte TERRITOIRE était concernée, contrairement à l'attente.** Elle n'affiche pas de liste —
seulement une répartition par zone — mais elle **comptait les deux camps** tout en écrivant
« combien de postes cherchent preneur » et « les postes publiés par les cabinets et les
établissements ». Son chiffre contredisait sa propre légende.

##### Vérifié en base

```
sans filtre de camp : 20 annonces
camp EMPLOYEUR : 13  → types distincts : [TITULAIRE]
camp CANDIDAT  :  7  → types distincts : [REMPLACANT]
```

13 + 7 = 20 : les deux camps sont **disjoints et exhaustifs**, aucune annonce n'est perdue ni
comptée deux fois.

##### Deux effets de bord, assumés

**Longueur limitée à 8** (`take: 20` auparavant). Une page d'entrée montre un échantillon, pas un
inventaire : au-delà, elle devient une liste à faire défiler et le CTA passe sous le pli.

**`isSelfPresence: false` ajouté au filtre.** Une absence du titulaire (congés, formation) n'est
pas une offre. Le feed l'écarte depuis longtemps ; les pages publiques la laissaient passer. Même
correction, un cran plus loin — non demandé, mais du même geste et de la même famille.

#### TROIS MENTIONS « KINÉ » EN DUR DANS DES ÉCRANS INTERNES (25/08) — livré

Prolongement de l'audit du 19/08, qui n'avait regardé que B0-B3. Un balayage plus large a trouvé
trois endroits nommant le kiné en dur **dans des écrans que toute profession utilise** — invisible
aujourd'hui, les 22 comptes étant tous kiné, donc du défaut latent au sens strict.

| Fichier | Avant | Après |
|---|---|---|
| `missions/create` (×3) | « Vacation **kiné** sport », « recrute un **kiné** en CDI », « équipe de 4 **kinés** », « Recherche CDI **kiné** sport » | « Vacation temps partiel », « recrute un **praticien** », « équipe de 4 **praticiens** », « Recherche CDI temps plein » |
| `premium:169` | « votre visibilité auprès des **kinésithérapeutes** » | « auprès des **remplaçants et assistants disponibles** » |
| `layout:19` | chaîne en dur | interpolée depuis le **registre** (`KINESITHERAPEUTE.pluriel`) |

##### Neutralisés dans le texte, pas paramétrés — et c'est un arbitrage

`missions/create` et `premium` sont des composants client dont la session **ne porte pas la
profession** : `useSession` expose `profileType`, `isEmployeur`, `profileId` — pas
`Profile.profession`. Y câbler la profession aurait demandé soit de l'ajouter au JWT, **figé au
sign-in** et déjà responsable d'un défaut cette semaine, soit une requête de plus pour un
placeholder.

« Praticien » dit la même chose et reste vrai pour les cinq professions de l'enum. Du texte, pas
de la logique — le coût de la généricité était ici plus élevé que son bénéfice.

Détail relevé au passage : la page premium disait déjà « des **soignants** » dans sa branche
établissement et « des **kinésithérapeutes** » dans sa branche cabinet. La correction aligne les
deux, et la nouvelle formule nomme le **camp** visé plutôt qu'un métier — plus précise que
l'ancienne, pas seulement plus générique.

##### La méta-description reste kiné, et c'est voulu

`layout.tsx` est une métadonnée publique sans contexte utilisateur. La rendre neutre
(« professionnels de santé ») aurait été **moins exact**, pas plus : le produit ne sert qu'une
profession, et le dire est vrai. Ce qui change est la source — le jour où une seconde s'ouvre,
cette ligne suit le registre au lieu d'être un oubli de plus à retrouver.

##### Non touché, délibérément

Les URLs de campagne (`/recrutement-kine-guadeloupe` et voisines) assument le kiné dans leur
adresse même, et les **gabarits de contrat CNOMK** — ~850 lignes de droit — sont légitimement
propres à la kinésithérapie. Les y neutraliser serait faux.

#### GABARITS DE CONTRAT INFIRMIER — PHASE A (27-28/08)

Premier gabarit d'une profession autre que le kiné :
`template-infirmier-remplacement-autorisation.tsx`, transcrit du modèle du **Conseil national de
l'Ordre des infirmiers (15/11/2023)**, variante « remplaçant titulaire d'une autorisation ».

##### Ce qui a été vérifié sur les sources avant d'écrire une ligne

**Le commentaire du CNOI est séparable du texte contractuel.** Les PDF fournis sont les versions
commentées, qui portent « vous ne devez pas l'utiliser comme contrat à signer ». Les blocs sont
délimités par un marqueur littéral `Commentaire :` — 9 dans ce document — et n'ont pas été repris.

**Le comptage des alternatives a dû être corrigé deux fois**, et c'est la leçon de méthode :

| Détection | Ce qu'elle manquait |
|---|---|
| `OU` seul sur une ligne | un `OU` coupé par le rendu PDF en `O` + `U` |
| idem, corrigé | les `OU` en **milieu de phrase** et les `Option :` |

Décompte annoncé puis réel : **0 → 3** pour cette variante, **3 → 5** pour « confrère installé »,
**5 → 9** pour la collaboration. Une méthode de comptage n'est fiable que confrontée au texte.

##### Les trois alternatives, tranchées par Jean-Charles

| Article | Retenu | Motif |
|---|---|---|
| 2 — Durée | « du … au … » + planning annexé | `startDate`/`endDate` existent ; rien ne décrit une liste de jours |
| 5 — Honoraires | CPS **du remplaçant** | modalité pratique, sans incidence sur le modèle de données |
| 11 — Non-concurrence | **rayon en km** | `rayonKm` existe et sert la clause équivalente côté kiné |

Ces choix sont **inscrits dans le gabarit**, pas rendus configurables : un choix par contrat
aurait multiplié les combinaisons sans besoin réel. Ils sont documentés en tête de fichier.

##### Le piège du document : la rétrocession va dans l'autre sens

Chez le CNOMK, le remplaçant encaisse et reverse un pourcentage au remplacé. **Ici c'est
l'inverse** : le remplaçant n'étant pas installé, le remplacé perçoit et lui reverse. Réutiliser
`retrocessionPct` aurait **inversé un pourcentage sur un document signé** — d'où un type dédié,
`ContractDataRemplacementInfirmierAutorise`, avec `reversementDirectPct` et
`reversementTiersPayantPct` nommés dans le sens réel, et leurs deux délais que le modèle sépare.

##### Trois champs que `Profile` n'a pas, saisis à la génération

Le modèle exige le **numéro d'autorisation** de remplacement, sa **date**, et la **CPAM** de
rattachement. Portés par `ContractParty` et saisis au moment de générer le contrat — décision (b)
du 27/08 — plutôt que déclarés à l'inscription : un champ rempli une fois l'an devient un levier
dormant, et le produit en compte déjà quatre.

##### Le vocabulaire de l'Ordre passe par le registre

Le CNOMK écrit « N° Ordre », le CNOI « **n° ordinal** » — même donnée, deux vocabulaires.
`LIBELLE_NUMERO_ORDRE: Record<Profession, string>` dans `professions.ts`, à côté de
`PROFESSION_LABELS_CONTRAT` et pour la même raison. Le `Record` impose l'exhaustivité.

`party-identity.tsx` lit ce registre via `ContractParty.professionEnum`. **La valeur kiné reste
« N° Ordre »** : les PDF déjà générés ne changent pas d'un caractère.

##### Les trois gabarits sont écrits (28/08)

| Fichier | Articles | Modèle |
|---|---|---|
| `template-infirmier-remplacement-autorisation.tsx` | 13 | CNOI 15/11/2023 |
| `template-infirmier-remplacement-confrere.tsx` | 13 | CNOI 15/11/2023 |
| `template-infirmier-collaboration.tsx` | 21 + préambule | CNOI 15/11/2023 |

**Les 11 alternatives ont toutes été tranchées par Jean-Charles**, clause par clause, avant
transcription. Aucune n'a été devinée. Elles sont documentées en tête de chaque fichier.

##### Une conséquence de l'arbitrage R-3, signalée parce qu'elle n'est pas évidente

Le choix « le remplaçant facture avec ses propres identifiants » ne retire pas une phrase : il
retire **une économie entière**. Dans le modèle, le `OU` de l'article 5 sépare deux régimes :

- **A)** le remplaçant facture avec ses identifiants → il encaisse → option de redevance ;
- **B)** il utilise ceux du remplacé → « il perçoit **pour le compte** du remplacé » → suivent le
  bordereau récapitulatif et les deux pourcentages que le remplacé lui reverse.

A ayant été retenu, tout le bloc B est écarté, **reversements compris**. Les conserver aurait
produit un contrat où le remplaçant garde les honoraires *et* reçoit une rétrocession —
économiquement absurde. C'est une lecture de la structure du document, pas une évidence
typographique ; elle est signalée comme telle dans le fichier.

##### R-3 revérifié le 28/08 — la lecture tenait, le commentaire du CNOI l'a confirmée

Jean-Charles a demandé si le remplaçant ne devait pas **obligatoirement** encaisser au nom du
remplacé, par nature de la pratique. Le commentaire du CNOI sur l'article 5 — écarté de la
transcription, mais consulté pour cette vérification — tranche :

> « lors du remplacement par un infirmier **lui-même installé**, ce dernier **a la possibilité**
> d'utiliser ses propres feuilles de soins ou sa CPS. Dans ce cas, le Remplaçant percevra lui-même
> les honoraires qu'il aura facturés, **il n'y aura pas de rétrocession**. […] Il revient alors aux
> cocontractants de **choisir** l'une ou l'autre des clauses. »

Ce n'est donc pas une norme déguisée : c'est un choix contractuel, ouvert **parce que** le
remplaçant est installé, donc conventionné. C'est exactement ce qui sépare les deux variantes.
Aucun texte cité ne rend l'encaissement au nom du remplacé obligatoire — `L.4311-15`, cité dans
l'autre variante, porte sur l'inscription au tableau, pas sur la facturation.

Le « il n'y aura pas de rétrocession » valide aussi l'écart des deux pourcentages de reversement :
les conserver aurait produit un contrat où le remplaçant garde les honoraires *et* reçoit une
rétrocession.

##### Trois ajouts issus de ce commentaire, validés le 28/08

Ils ne figurent pas dans le texte contractuel du modèle, mais l'Ordre les pose ou les recommande :

| Ajout | Nature |
|---|---|
| Art. 4.2 — la CPAM est informée de **l'option de facturation retenue** | **Obligation** : « La CPAM doit être informée de l'option choisie » |
| Art. 5 — assiette de la redevance explicitée, **frais kilométriques exclus** | Recommandation : ces frais sont avancés par le remplaçant, le remplacé n'a rien déboursé |
| Clause de **répétition d'indus** | Rédaction proposée textuellement par le CNOI, reprise mot pour mot |

L'Ordre signale par ailleurs qu'un pourcentage de redevance trop élevé « pourrait s'apparenter à un
partage d'honoraires, prohibé par l'article **R.4312-30** », et constate un usage de **5 à 10 %**.
Ces repères ne sont pas imposés par le gabarit — le montant reste saisi — mais ils sont consignés
dans son en-tête pour que le prochain lecteur sache où se situe la limite.

**Les trois gabarits infirmier sont désormais définitifs côté contenu.**

##### Le registre `GABARITS`, et pourquoi une liste

`src/lib/contrats/gabarits.ts`. La sélection se faisait sur `missionType` seul, ce qui supposait
un gabarit unique par type. Deux faits l'ont démenti : le remplacement infirmier a **deux**
modèles selon le statut du remplaçant, et l'`ASSISTANAT` n'existe pas chez les infirmiers.

Une liste est **naturellement partielle** — l'absence se lit comme un fait, là où un trou dans une
table imbriquée se lit comme un oubli. Vérifié :

```
KINESITHERAPEUTE  ["REMPLACEMENT","ASSISTANAT","COLLABORATION"]
INFIRMIER         ["REMPLACEMENT","COLLABORATION"]
INFIRMIER/REMPLACEMENT -> 2 variantes
INFIRMIER/ASSISTANAT   -> 0
```

Le module **ne référence aucune fonction de rendu** : il reste importable côté client, sans tirer
`@react-pdf/renderer` dans le bundle du navigateur.

##### `ASSISTANAT` retiré du formulaire, et la profession vient du serveur

`missions/create/page.tsx` devient une **enveloppe serveur** qui charge `Profile.profession` et la
passe en prop à `CreateMissionClient.tsx`. Deux voies écartées, et pourquoi :

- **le JWT** — figé au sign-in, jamais relu ; il a déjà produit un défaut cette semaine, et une
  profession modifiée dans `/compte` n'aurait pris effet qu'à la reconnexion suivante ;
- **une route dédiée** — la profession est nécessaire **au premier rendu** ; une route aurait
  affiché « Assistanat » puis l'aurait retiré sous les yeux de l'utilisateur.

La correspondance besoin → `MissionType`, jusqu'ici reconstruite à la soumission, est remontée en
constante partagée : **le filtre d'affichage et l'envoi parlent désormais de la même table**, sans
quoi on pourrait masquer une option tout en continuant de l'accepter.

##### Un effet de bord traité : les professions sans gabarit

`MEDECIN`, `SAGE_FEMME` et `ORTHOPHONISTE` n'ont aucun modèle — le filtre leur laissait donc une
grille **vide, sans explication**. Un blocage muet aurait été pire que le défaut qu'on ferme. Le
formulaire affiche désormais que la publication est suspendue faute de modèle de contrat.

Aucun compte n'est concerné aujourd'hui (les 22 profils sont kiné), mais le cas devient atteignable
dès qu'on change sa profession dans `/compte`.

##### Ce qui n'est PAS fait

**Le retrait d'`ASSISTANAT` est effectif** — un infirmier ne peut plus publier un poste dont aucun
contrat ne pourrait sortir.

##### Le branchement (28/08) — la route sélectionne par le registre

`/api/match/[matchId]/contrat` ne choisit plus sur `missionType` seul. Trois gardes s'ajoutent,
toutes en **refus explicite** plutôt qu'en repli silencieux — la règle posée le 13/08 quand le
`?? REMPLACEMENT` a été fermé :

| Situation | Réponse |
|---|---|
| Les deux parties ne déclarent pas la même profession | **422** — le modèle applicable dépend de l'ordre concerné |
| Aucun gabarit pour (profession × type) | **422** — « ce statut n'a pas nécessairement d'équivalent d'un ordre à l'autre » |
| Plusieurs variantes, aucune choisie | **422**, avec la liste des choix (`id`, `libelle`, `quandLUtiliser`) |

**La première garde n'est pas théorique** : le feed borne chaque lecteur à sa profession depuis le
17/08, mais `Profile.profession` reste modifiable dans `/compte` **après** la mise en relation.
Générer un contrat de kiné entre un kiné et un infirmier produirait un document faux, et signé.

**La troisième non plus.** Les deux variantes du remplacement infirmier sont économiquement
opposées — dans l'une le remplaçant encaisse et verse une redevance, dans l'autre le remplacé
perçoit et reverse. Prendre la première par défaut aurait **inversé le sens de l'argent**.

##### Le choix remonte jusqu'à l'écran

`contrat-info` renvoie désormais les modèles applicables. Le formulaire affiche :

- **un seul modèle** → rien à demander, retenu d'office ;
- **plusieurs** → un sélecteur, avec le `quandLUtiliser` de chacun et sa source réglementaire ;
- **aucun** → un message, plutôt qu'un bouton qui échouerait en 422 après le clic.

S'y ajoute le **partage des forfaits** (art. 6.2), affiché pour la seule collaboration infirmier :
trois modes qui décrivent des organisations de cabinet différentes, et qu'il aurait été faux de
figer au gabarit.

##### Non-régression kiné

Le diff de la route ne **supprime qu'une ligne** — l'ancien `if (missionType === REMPLACEMENT) {`,
devenu un `else if`. Les trois appels kiné sont intacts, et les trois fichiers de gabarit kiné
n'ont jamais été touchés (diff vide, vérifié à chaque étape).

**Réserve** : je n'ai pas pu rendre les PDF hors de l'application — le harnais de test ne compile
pas le TSX. Ce qui est vérifié est la compilation des quatre gabarits, le typage de la route et la
résolution du registre ; **pas le rendu final**, qui reste à constater à l'écran.

##### Les champs propres aux variantes ne sont pas tous saisissables

Le n° d'autorisation, sa date, la CPAM, les préavis et les durées d'information sont acceptés par
la route en paramètres, avec des défauts bornés — mais **aucun champ de saisie ne les expose**
encore. Ils s'impriment donc en placeholder `[à compléter]`, comportement normal du système de
placeholders, jamais un blanc silencieux. À compléter quand un contrat infirmier réel sera préparé.

##### Les sources restent hors du dépôt

Les 9 PDF (102 Mo) sont ignorés, nommés par motif et non par `*.pdf` — même règle que
`Zonage MK_2024.pdf` le 17/08, pour qu'une future source à versionner ne soit pas écartée en
silence. Les gabarits citent leur modèle par titre et date de mise à jour : c'est la référence
qui compte, pas le binaire.

#### SCALABILITÉ À PLUSIEURS CPTS (20/08) — audit et deux correctifs

Nord Basse-Terre est le **secteur de test**, pas la cible. Vérification que rien ne suppose une
institution unique. **Trois points sur cinq étaient déjà génériques ; deux ont été corrigés.**

##### Ce qui l'était déjà, vérifié en base

| Point | Constat |
|---|---|
| Plusieurs relations actives | ✅ Aucun `findFirst`, aucune notion de « la » relation — tout est `findMany`. **Testé : 2 relations actives simultanément.** |
| Étanchéité entre institutions | ✅ Chaque déclaration porte `clientId`. **Testé** : Deshaies remonte 6 pts au nom de la CPTS Nord Basse-Terre, Petit-Bourg 15 pts au nom d'une seconde — chacune avec la sienne, aucune interférence. |
| « CPTS Nord Basse-Terre » en dur | ✅ **Nulle part en logique.** Occurrences : un `placeholder` de formulaire, des commentaires. C'est une donnée saisie, jamais une référence. |

##### Les territoires chevauchants ne sont PAS représentables — et c'est délibéré

`@@unique([codeInsee, profession])` ne contient **pas** `clientId`. Deux institutions ne peuvent
donc pas déclarer la même commune pour la même profession : la seconde est refusée par la base
(**P2002, vérifié**). La même commune reste ouverte à une **autre profession** (vérifié aussi :
Deshaies/`INFIRMIER` par une seconde CPTS passe).

**Ce n'est pas un défaut de scalabilité, c'est un refus d'arbitrer à la place des institutions.**
Autoriser deux déclarations concurrentes obligerait le produit à choisir laquelle fait foi — la
plus forte ? la plus récente ? la payante ? Aucune de ces réponses n'est honnête, et le levier
perdrait ce qui fait sa valeur : être attribuable à quelqu'un.

**L'unicité est donc conservée. C'est le MESSAGE qui a été corrigé.** Il disait, quelle que soit
la situation : « la modifier plutôt que d'en ajouter une seconde ». Bon conseil quand une
institution se corrige elle-même ; **très mauvais entre deux institutions différentes** — modifier
la déclaration de l'une ferait passer le jugement de l'autre sous son nom. L'erreur d'attribution
que toute cette section existe pour empêcher, refaite par un administrateur suivant une consigne.

Deux conflits, deux messages, distingués par comparaison de `clientId` (champ `conflit` :
`meme-institution` / `chevauchement`). Le second dit explicitement de **ne pas** modifier la
déclaration existante, et que le territoire est à arbitrer entre les deux institutions.

##### Le module embarquable marchait, mais aurait été invisible

Le registre `ZONES` vivait dans `src/app/embed/territoire/[zone]/page.tsx`. Il était **bien
formé** — ajouter une zone = ajouter une entrée — mais visible de cette page seule. Or
`/admin/diffusion` codait son entrée **à la main** (chemin, titre, clé de trace), alors que le
reste de ce fichier est dérivé du module de portes depuis le 14/08, précisément pour fermer le
risque de pages découvertes après coup.

**Une deuxième CPTS aurait donc fonctionné côté module et n'aurait jamais paru côté
administration** — le même défaut que les pages Saint-Martin/Saint-Barth de juillet, à un endroit
différent.

Registre extrait dans `src/lib/embedTerritoire.ts`, consommé par les deux. **Ajouter une CPTS =
une entrée**, la page et l'écran d'administration s'alignent seuls. Vérifié que le chemin et la
clé de trace dérivés sont **identiques au caractère près** à ceux codés en dur
(`embed-nord-basse-terre`) : l'historique de fréquentation n'est pas coupé en deux.

Le champ `destinataire` est purement descriptif — **le module embarquable ne dépend d'aucune
relation client** : il liste des annonces publiques, il n'applique aucune priorité territoriale.

#### AUDIT DE GÉNÉRICITÉ PROFESSION SUR B0-B3 (19/08, `a7d4de8`)

Tout ce qui a été construit depuis B0 n'avait jamais été relu sous l'angle « suppose-t-il
kiné ? ». **Cinq éléments sur six sont génériques par construction** ; un seul défaut trouvé.

| Élément | Verdict |
|---|---|
| `CommuneAPL` | générique — 5 colonnes `apl*` + 5 `boost*`, une par profession |
| Script DREES | générique — boucle sur un tableau déclaratif, borné par la source (pas d'orthophoniste) |
| `PrioriteTerritoriale` | générique — unicité sur la **paire** commune+profession : une CPTS peut déclarer kiné niveau 4 **et** infirmier niveau 2 sur la même commune, sans migration future |
| Bonus territorial | générique — profession en paramètre ; la table `COLONNE_BOOST` de B1 a disparu avec B3 |
| `COMMUNE_INSEE` / `COMMUNE_ZONE` | profession-neutres — `Record<commune, …>`, aucune profession dans la signature |
| Module embarquable | inchangé depuis le 14/08, B4 non commencé |

**Le défaut :** la mention affichée au candidat disait « une commune signalée comme manquant de
**kinés** » alors que le feed est borné par la profession du **lecteur** depuis `924e329`. Un
infirmier aurait lu « manquant de kinés » dans son propre feed. Invisible aujourd'hui — les 16
profils en base sont tous kiné — donc exactement le défaut latent que `924e329` documentait,
réintroduit dans la phrase voisine le lendemain, dans `9b4322c`.

**Corrigé sans nommer aucune profession** : « une commune où **votre profession** est signalée
comme manquante ». `chargerPrioritesTerritoriales` ne remonte que les déclarations portant sur
la profession du lecteur — « votre profession » est donc *plus exact* qu'un mot décliné, ne
demande aucun câblage, et reste vrai pour toute profession future sans être retouché.

**Second correctif, même famille :** la liste des professions de `/admin/priorites` était
recopiée à la main. Une 6ᵉ profession ajoutée à l'enum n'y serait jamais apparue — sans erreur
de compilation, la colonne l'acceptant. Elle est désormais **dérivée de l'enum Prisma** par la
page serveur. Le vocabulaire reste **déclaré** (`VOCABULAIRE_PROFESSION`, partiel à dessein) :
`libelleProfession` rend la valeur d'enum telle quelle quand rien n'est déclaré — voir
`SAGE_FEMME` dans une liste **signale** que sa déclaration manque, là où un « Sage-femme »
fabriqué par translittération l'aurait masqué.

**N'ouvre aucune profession** : c'est la forme du code qui change, pas ce que le produit sert.

**Défaut connu, non corrigé** : `/admin/apl` affiche 3 colonnes de boost sur 5 (kiné, infirmier,
médecin) alors que le formulaire d'édition en propose bien 5. Sage-femme et orthophoniste sont
éditables mais invisibles au tableau. Antérieur à B0, mis en file séparément.

---

### Zonage ARS et données APL

#### ZONAGE ARS — vérifié contre la source officielle (12/08)

##### Le barème codé est exact et à jour

`src/lib/communes.ts` porte deux `Set` de communes, référencés à l'**arrêté n°971-2024 du
31 décembre 2024**. Confronté au PDF officiel de l'ARS Guadeloupe (annexes 1 et 2) : **zéro
écart**. 12 communes en zone intermédiaire, 20 en zone non prioritaire, classées à l'identique
une par une. La cartographie de l'annexe 2 porte la légende « 3-Zone Intermédiaire (12) /
4-Zone non prioritaire (20) » — le code nomme ses Sets `ZONE_3_` et `ZONE_4_`.

L'arrêté ne compte que **2 catégories** : aucune zone sous-dotée ni très sous-dotée en
Guadeloupe aujourd'hui. `ZonageType` conserve `SOUS_DOTEE` et `TRES_SOUS_DOTEE` pour d'autres
professions et territoires — ce n'est pas un résidu.

Les libellés du code suffixent `Grand-Bourg (Marie-Galante)`, `Terre-de-Bas (Les Saintes)`…
là où l'arrêté écrit `Grand-Bourg`, `Terre-de-Bas`. C'est **volontaire** : la comparaison est un
`Set.has()` exact sur `Mission.location`, qui utilise le vocabulaire de `COMMUNES_GUADELOUPE`.

##### Trois couches à ne pas confondre

| Couche | Portée | Où elle vit |
|---|---|---|
| Méthodologie de calcul APL (arrêté du 20/03/2024) | nationale, propre au métier de kiné | nulle part — c'est un document |
| **Donnée APL brute DREES**, par commune et profession | **nationale** | `CommuneAPL.aplKine…` |
| **Zonage régional** (arrêté ARS 971-2024) | **Guadeloupe seule** | `communes.ts`, Sets codés |

Seule la troisième est territoriale : elle applique des seuils régionaux sur la donnée
nationale. L'arrêté 971-2024 vise d'ailleurs nommément celui du 20/03/2024 — la chaîne est
explicite dans la source.

**Le Set ne mélange pas ces couches** : il ne contient aucune valeur APL, seulement le
résultat du seuillage. La séparation est respectée.

##### Correctif livré le 12/08 — le zonage n'était calculé qu'à la création

`Mission.zonage` est **dérivé** de la commune, jamais saisi. Il n'était calculé qu'au POST :
`PATCH /api/missions/[id]` acceptait `location` sans jamais recalculer le classement. Changer
la commune d'une annonce laissait l'ancien.

Constaté en production : une annonce du **Gosier** portait `INTERMEDIAIRE`, alors que Le Gosier
est non prioritaire **depuis toujours** dans le barème (Sets inchangés dans tout l'historique
git). La valeur ne venait donc pas du calcul — elle avait survécu à une édition de commune.

Corrigé : le zonage se recalcule dès que la commune bouge. La ligne fautive a été rectifiée en
base ; **0 écart sur 21 annonces** après vérification.

##### Les 12 lignes « sans zonage » ne sont PAS un défaut (rectifié le 12/08)

Une version antérieure de cette section présentait « 12 annonces sur 21 sans zonage » comme un
second trou à corriger, et le champ `location` comme portant deux natures confondues.
**C'est faux.** Jean-Charles a posé la règle métier : le zonage ne qualifie que **le lieu où le
kiné va effectivement exercer**, donc la commune du cabinet cible. La granularité commune est
la bonne, et les 12 lignes se répartissent en trois natures, toutes légitimement sans zonage :

| Nature | Exemples | Pourquoi aucun zonage |
|---|---|---|
| 6 disponibilités de CANDIDAT | `location` = « Sud Basse-Terre », « Sud Grande-Terre » | le candidat déclare où il ACCEPTE d'aller, pas où il travaillera |
| 5 occupations de poste | `location` vide — « Léa », « Mathéo », « Marion »… | briques de planning, pas des offres |
| 1 absence déclarée | « Cabinet des ravines », titre « Congés » | pas une offre |

**Les 7 vraies annonces de cabinet portent toutes leur zonage, et il est juste.** Aucune
exception. `location` n'est donc pas ambigu : il est cohérent avec le côté qui publie — un
cabinet ancre une commune, un candidat déclare des zones. Deux vocabulaires pour deux
intentions, pas une confusion à réparer.

**Conséquence de conception** : si le zonage sert un jour côté candidat, ce ne sera pas à la
publication mais **au match**, en héritant du zonage du cabinet retenu — c'est à ce moment que
le lieu d'exercice devient connu.

**Impact réel aujourd'hui : nul.** `Mission.zonage` et `Profile.zonage` ne sont lus NULLE PART
— ni scoring, ni contrat, ni affichage. Donnée écrite et jamais relue. Le correctif empêche
qu'elle se dégrade avant d'avoir un usage.

**Après ce correctif, la base est exacte : 0 écart sur 21 lignes** entre le zonage stocké et
celui que le barème calcule.

#### CommuneAPL — structure nationale, alimentation absente (constaté le 12/08)

```
112 lignes · 971 (32) · 972 (34) · 973 (22) · 974 (24)
codeInsee unique — exactement la clé « Code commune » de l'annexe 1 de l'arrêté
aplKine renseigné 112/112 · min 0 · médiane 144,9 · max 405
```

**La structure est nationale par construction** : rien n'y suppose l'outre-mer. Alimentée, elle
servirait n'importe quelle commune de France sans une ligne de code supplémentaire. C'est le
bon porteur si le zonage doit un jour sortir du code.

Trois manques identifiés le 12/08. **Les deux premiers sont fermés depuis le 19/08**, le
troisième a été résolu autrement que prévu (voir la priorité territoriale déclarée) :

1. ~~**Le script d'alimentation n'existe pas.**~~ **Fermé — il existait déjà.** Le schéma
   annonçait « Alimenté par `scripts/update_apl.py` (cron annuel) », fichier qui n'a jamais
   existé ; la mention est retirée. Mais `scripts/sync-commune-apl.mjs`, lui, était **complet et
   fonctionnel**, committé par erreur dans `924e329` — un commit sur le filtrage par profession.
   Il a été listé comme « absent » pendant une semaine alors qu'il était dans le dépôt.
   Lancement `npm run db:check-apl` (rapport, sortie 1 sur écart) / `db:sync-apl` (`--apply`).

   **Le piège de l'homonyme est réel, et inversé.** Le bon jeu DREES (« Accessibilité potentielle
   localisée (APL) aux professionnels de santé », Licence Ouverte v2.0, publication ANNUAL) porte
   `records_count = 0` et `has_records = false` : sa donnée est dans **10 pièces jointes XLSX**,
   pas dans `/records`. C'est le *mauvais* jeu — structures médico-sociales personnes âgées — qui
   répond à `/records`. Un script écrit « naturellement » sur `/records` aurait donc importé la
   donnée des EHPAD en croyant lire l'APL des kinés, **sans une seule erreur à l'écran**. Le
   script contrôle le titre du jeu à chaque exécution plutôt que de le supposer une fois.

   Couverture : kiné, infirmiers, médecins généralistes, sages-femmes. **Pas d'orthophonistes** —
   le jeu 530 n'en publie pas, `aplOrthophoniste` restera NULL tant qu'une autre source n'est pas
   choisie. Limite de donnée, pas de code : le script boucle sur un tableau déclaratif
   `{ colonne, piece, entete }`, ajouter une profession y est une ligne.
2. ~~**Aucun millésime.**~~ **Fermé (`f3e2f20`, migration appliquée le 19/08).** `aplAnnee`,
   `aplSource` et `aplImportedAt` existent en base. **Aucun backfill** : les 112 lignes
   existantes restent à NULL, qui se lit « millésime inconnu » et qui est la vérité — leur
   inventer une année aurait affirmé ce que personne ne sait. Le premier `--apply` les
   renseignera par un fait vérifié.

   ⚠️ **Le message du commit `f3e2f20` dit « migration livrée, non appliquée »** : vrai à
   l'écriture, faux depuis. L'historique git n'est pas réécrit ; la correction vit ici.

   **`db:sync-apl` n'a jamais été exécuté.** Mesuré : **105 des 112 lignes changeraient** (kiné
   62↑/39↓, infirmier 21↑/84↓, médecin 49↑/54↓, sage-femme 58↑/35↓). À regarder avant
   d'autoriser, pas à lancer sur confiance.
3. **Elle mélange déjà deux natures.** Les colonnes `boost*` ne sont pas de la DREES : ce sont
   des leviers produit éditables en admin (−10 à +10), et **16 des 32 communes de Guadeloupe en
   portent un non nul**. Donnée externe immuable et réglage maison cohabitent sans rien qui les
   distingue. **Pire que prévu, mesuré le 18/08** : les `boost*` non nuls n'ont jamais été
   saisis à la main — ils sont entrés avec l'import et dérivent de `apl*`. La colonne « réglage
   maison » contient donc aujourd'hui une copie retraitée de la donnée externe, ce qui rend le
   mélange invisible dans les deux sens. Conséquence directe : elle **ne peut pas** servir de
   canal de déclaration à une institution.

L'écran `/admin/apl` liste la table et permet d'éditer les 5 boosts. Si le zonage la rejoignait,
il devrait y être **en lecture seule, avec sa référence d'arrêté** : c'est un acte du directeur
général de l'ARS, pas un réglage.

##### L'écran affichait 3 colonnes de boost sur 5 — corrigé le 20/08

Le formulaire d'édition proposait bien les cinq professions, mais le tableau n'en affichait que
trois (kiné, infirmier, médecin). **Sage-femme et orthophoniste étaient donc réglables sans
jamais être relisibles.** Les colonnes sont désormais dérivées de `BOOST_FIELDS`, et le `colSpan`
est calculé (`4 + BOOST_FIELDS.length + 1`) plutôt qu'écrit : le `8` en dur qu'il remplace serait
redevenu faux à la première colonne ajoutée, et un `colSpan` faux ne casse rien visiblement — il
décale la ligne d'édition d'une case, en silence.

**Rendre les cinq colonnes visibles ne suffisait pas, et aurait même aggravé les choses.** Depuis
B3, le feed ne lit plus `boost*` : ces curseurs restent éditables et **ne pilotent plus rien**.
Les afficher tous sans le dire aurait rendu un levier mort *plus* visible qu'avant — exactement
le défaut que cette section a passé trois jours à fermer, commis une fois de plus en croyant
l'améliorer.

L'écran porte donc un bandeau qui dit trois choses vérifiables : ces curseurs ne pilotent plus
l'ordre du feed ; la priorité territoriale se déclare dans `/admin/priorites` ; et les valeurs
présentes viennent de l'import DREES du 28/06, personne ne les a saisies. Elles sont **conservées,
pas maintenues** — ce qu'il faut en faire reste une question ouverte.

---

### Exploitation, incidents, veille

#### INVITATION EXPIRÉE : ÉCHEC SILENCIEUX DES DEUX CÔTÉS (21/08) — non corrigé

##### Ce qui s'est passé

Une invitation a été envoyée le **13/08 09:16** pour le poste « Marion » du cabinet fondateur,
valable 7 jours. L'invitée a créé son compte le **20/08 14:13** — soit **4 h 57 après
l'expiration**. L'invitation est restée `PENDING`, jamais consommée, et le poste jamais rattaché.

Elle s'est retrouvée **titulaire de son propre cabinet**, qu'elle a nommé du nom du cabinet
invitant. Le compte non fondateur trouvé plus tard à Pointe-Noire venait de là.

##### Le code a fait exactement ce qui est écrit

`src/app/api/profiles/route.ts` exige `status === "PENDING"` **et** `expiresAt > new Date()` **et**
l'email correspondant. La deuxième condition était fausse, et le bloc est dans un `try/catch`
dont le commentaire assume le silence : « un token périmé ne doit pas faire échouer une
inscription par ailleurs valide ». **Aucun cabinet fantôme n'a été créé** : le profil vient du
formulaire ordinaire, avec le type et le nom que l'utilisatrice a saisis.

##### Le défaut réel : le motif est calculé, renvoyé, et jeté

`/api/poste-invitations/[token]` distingue précisément `introuvable`, `utilisée`, `expirée`,
`poste supprimé`. **`register/page.tsx` ne lit que `d.valid` et ignore le motif.**

Du point de vue de l'invitée : elle clique sur « Créer mon compte → » dans l'email, arrive sur un
formulaire vierge sans mention du cabinet ni du poste, remplit ce qu'elle croit devoir remplir, et
devient titulaire. **Rien ne lui a dit que son invitation avait expiré.**

Le silence côté serveur est défendable ; il repose pourtant sur une hypothèse fausse — que
l'utilisateur sait pourquoi le contexte n'apparaît pas.

**Portée : toute invitation ouverte après 7 jours produira le même résultat.** Non corrigé — le
motif existe déjà côté serveur, l'afficher est peu coûteux.

##### Remise en état (21/08, données uniquement)

Sur demande explicite de Jean-Charles, la personne voulant être rattachée : profil passé de
`TITULAIRE` à `ASSISTANT`, rattaché au poste « Marion » (ligne 2 du Planning, vérifiée dans
l'ordre `isOwnerSeat` puis ancienneté — c'est bien le poste que visait l'invitation), puis
suppression de ses 2 annonces et de son siège de cabinet devenus sans objet.

Dépendances contrôlées **avant** suppression, toutes à zéro : aucun swipe reçu, aucun match,
aucun swipe émis. Sauvegarde JSON intégrale écrite avant effacement. Compte et profil conservés.

⚠️ `titulaireKind` **n'est pas nullable** : le profil garde `CABINET` bien qu'il ne soit plus
titulaire. Donnée dormante, sans effet aujourd'hui (seul `STRUCTURE` est lu, pour dériver
`isEmployeur`). Signalée, pas forcée.

#### MÉLANGE APPARENT ENTRE DEUX COMPTES (19/08) — cache de routeur, pas fuite de données

##### Le signalement

Sur `/planning`, sous la session `jcdubien@gmail.com` : barre de tête affichant **« Cabinet des
ravines · TITULAIRE · Pointe-à-Pitre · 3 annonces actives »**, corps de page affichant
**« 5 postes · Jean-Charles DUBIEN »** avec les bons postes (Marion, Mathéo, Léa, JP,
Jean-Charles DUBIEN). « Cabinet des ravines » est un autre compte du même utilisateur,
`osteoguadeloupe@gmail.com`.

##### Ce que l'investigation a écarté, dans cet ordre

| Hypothèse | Verdict |
|---|---|
| Mélange en base | **Non.** Deux `Profile` distincts, deux jeux de `CabinetPost` **strictement disjoints**. Les 5 postes appartiennent tous à `jcdubien` ; `osteoguadeloupe` n'en a que 2 (Assistant 1, Cabinet des ravines). Aucun poste partagé. |
| JWT périmé | **Non.** Le corps affichait les bons postes, donc `session.user.profileId` valait bien celui de `jcdubien` au moment du rendu. |
| `planning/page.tsx` fautif | **Non.** Il tire un seul `profileId` de la session et s'en sert pour l'en-tête et les postes — un mélange y est structurellement impossible. |
| `(app)/layout.tsx` lisant `session.user` en aveugle | **Non.** Il requête la base sur le **même** `profileId`. |

##### La cause

`router.push` est une navigation **côté client**. Dans l'App Router, un layout n'est pas re-rendu
à l'intérieur de son propre segment : le segment `page` est refetché, le segment `layout` est
servi depuis le **cache du routeur**. Après une bascule de compte, la barre gardait donc le nom,
la commune et le compte d'annonces de la session précédente au-dessus d'un corps correct.

**Aucune des deux moitiés n'était fausse — elles dataient de deux instants différents.** Les
trois valeurs de la barre correspondent exactement au profil `osteoguadeloupe` en base, le
sous-titre du corps exactement à `jcdubien`.

`export const dynamic = "force-dynamic"` sur le layout **ne protège pas de ça** : il gouverne le
rendu serveur, pas le cache client.

##### Correctif (`9c0e8e5`, vérifié à l'écran par Jean-Charles avant push)

`window.location.assign` aux deux bascules d'identité — `SignOutButton.tsx` et `login/page.tsx`
— ce qui vide le cache du routeur par construction. `router.refresh()` aurait marché, mais il
faudrait penser à l'ajouter à chaque nouveau point d'entrée ; un rechargement dur ne s'oublie
pas. **Les quatre destinations** de la connexion sont traitées pareil : n'en durcir que
certaines aurait laissé le défaut vivant sur les autres, et c'est ainsi qu'il a survécu.

##### Le motif, fermé aux 4 points d'entrée (20/08)

Recherche systématique de `signIn`/`signOut` dans tout `src/` : **quatre sites, pas un de plus**.
Tous corrigés, tous par `window.location.assign`.

| Site | Bascule | Corrigé |
|---|---|---|
| `SignOutButton.tsx` | déconnexion | 19/08 (`9c0e8e5`) |
| `login/page.tsx` | connexion — **les 4 destinations** | 19/08 (`9c0e8e5`) |
| `register/page.tsx` | inscription | 20/08 (`8fe8292`) |
| `CompteForm.tsx` — `handleDeleteAccount` | **suppression de compte** | 20/08 |

Le dernier était le pire des quatre, et c'est pour ça qu'il méritait d'être traité seul : les
trois autres montraient une identité **périmée**, celui-ci montrait une identité **effacée** — la
barre aurait nommé un compte qui venait d'être supprimé.

`useRouter` a disparu des quatre fichiers : il n'y servait plus. C'est le meilleur contrôle que
le motif est clos — il ne reste aucun outil pour le refaire par distraction à ces endroits.

**Pourquoi le rechargement dur plutôt que `router.refresh()`** : `refresh()` marcherait, mais il
faudrait penser à l'ajouter à chaque nouveau point d'entrée. Un rechargement dur ne s'oublie pas.
Le motif s'est justement propagé à quatre endroits parce que `router.push` était le geste naturel.

##### Portée réelle, et ce qui reste ouvert

Rien de propre à ces deux comptes : **sur tout poste où deux personnes se succèdent** (cabinet
partagé, démonstration, ordinateur d'accueil), la barre affichait l'identité de la précédente.
Les données servies restaient les bonnes — c'est le nom affiché qui mentait, ce qui suffit à
faire croire à une fuite.

**`register/page.tsx:220` porte le même motif** (`signIn` puis `router.push`) et n'est pas
corrigé : le symptôme y est moins probable (le layout n'a en principe rien en cache pour un
compte qui vient de naître), mais quelqu'un s'inscrivant depuis une session ouverte tomberait
dessus.

#### ÉTAT CONSOLIDÉ DU PRODUIT — 26/07/2026

##### Sprint 0 : ✅ TERMINÉ À 100% CÔTÉ TECHNIQUE

Tous les items de sécurité pré-diffusion, bugs bloquants, et 
fondations sont livrés et vérifiés en production.

##### Sécurité & infrastructure

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

##### Bilan Sentry — 5 premières issues (preuve que le monitoring fonctionne)

| Issue | Nature | Statut |
|---|---|---|
| NEXTJS-1 | Self-test volontaire | Faux positif, à résoudre manuellement |
| NEXTJS-2 | P1017 — connexion pooler DB fermée (/api/notifications) | Corrigé (53d0465) |
| NEXTJS-3 | P2000 — bioTinder trop long à l'inscription | Corrigé + migration prod (1c5f396) |
| NEXTJS-4 | SyntaxError JSON (formulaire annonce) | Corrigé (b3f8a72) |
| NEXTJS-5 | P2000 — pitch trop long (annonce cabinet) | Corrigé + migration prod (b3f8a72) |

**Leçon transverse retenue** : des colonnes DB en VarChar avaient une limite inférieure au plafond réellement autorisé côté formulaire/validation Zod. Balayage complet effectué — toutes les colonnes d'accroche (bioTinder/pitch) alignées à 700 caractères. Point de vigilance permanent : toute nouvelle migration Prisma doit être appliquée **manuellement** en prod (le build Vercel ne fait pas `migrate deploy` automatiquement).

##### Cycle de vie des matches (3 états)

```
- Contrat signé des deux côtés -> sort de la liste "Relations" 
  active, reste accessible via la timeline (clic sur la période)
- Fiche /match/[id] autonome avec chat intégré
- Notifications de message renvoient directement vers 
  /match/[id]?chat=1 (ouverture directe de la conversation)
- Une annonce/disponibilité matchée disparaît du feed de TOUS les 
  autres utilisateurs (filtre NO_ACTIVE_MATCH)
```

##### Parcours candidat/assistant

```
- Bug "publier disponibilité grisé" + timeline vide -> corrigé 
  (dates obligatoires remplaçant)
- Assistant "sans dates" -> vue dédiée AssistantDispoView, minMonths 
  requis, édition accroche
- Menu rapide timeline : ancrage du tap mobile corrigé, plage 
  éditable, mécanisme de blocage unifié
- État vide du swipe : espace vide sous les cartes corrigé
```

##### Contrat

```
- Clauses négociables éditables in-app (mode de paiement, délai, 
  modalités)
- Slider de taux de redevance élargi 10-50% (cas réels sous 20% 
  couverts)
```

##### UI/UX & cohérence

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

##### Facebook — Share Dialog

```
⚠️ CORRIGÉ LE 12/08 — CE PARAGRAPHE ÉTAIT FAUX. Il annonçait un Share 
Dialog « codé derrière un flag NEXT_PUBLIC_FACEBOOK_SHARE_ENABLED ». 
Vérifié : ce drapeau n'existe NULLE PART dans le code, et aucun code de 
Share Dialog n'y figure. ShareActions propose « Copier le lien » et 
navigator.share(), rien d'autre. Le bouton Facebook a été retiré le 
03/08 — ce que ce document notait plus bas sans jamais corriger ici.
```

---

#### ACTIONS JEAN-CHARLES EN ATTENTE (à relancer chaque session)

```
1. connection_limit=1 sur DATABASE_URL (Vercel) — mitigation racine 
   du problème de pooler DB (NEXTJS-2). PAS ENCORE FAIT.
2. ANS_API_KEY sur Vercel — sans ça, la vérification RPPS ne 
   fonctionne pas réellement (juste l'affichage a été corrigé pour 
   ne plus mentir, mais la fonctionnalité reste inactive tant que 
   la clé manque). PAS ENCORE FAIT.
3. Sentry DSN — FAIT, monitoring actif.
4. ⚠️ SANS OBJET (constaté le 12/08) — cette action réclamait une 
   configuration Meta pour une fonctionnalité qui n'existe pas dans le 
   code. Rien à faire tant qu'un Share Dialog n'est pas réellement 
   construit.
5. Résoudre/archiver manuellement l'issue Sentry self-test (NEXTJS-1) 
   dans le dashboard Sentry.
6. Toujours en attente : dépôt INPI "Soignect", soumission du sitemap 
   à Google Search Console. ✅ Le domaine soignect.fr est RÉSERVÉ ET EN 
   LIGNE (le site est servi depuis www.soignect.fr, vérifié le 12/08).
```

---

#### RAPPORT D'ACTIVITÉ OPUS — 28/07 → 03/08 (5 jours, 37 commits)

> ⚠️ Reçu le 03/08, alors que le suivi ci-dessus s'était arrêté au 
> 29/07 (Sprint 0.5). Beaucoup de prompts déjà cumulés dans 
> PROMPTS_EN_ATTENTE.md ont été traités en parallèle, hors du canal 
> de suivi habituel. Réconciliation faite ci-dessous.

##### 🔴 DEUX POINTS CRITIQUES À RETENIR

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

##### Réconciliation avec PROMPTS_EN_ATTENTE.md — prompts résolus

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

##### Détail technique B12 (pour mémoire, une fois vérifié)

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

##### Autres travaux notables (28/07-30/07)

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

##### ⚠️ POINT À RÉCONCILIER — PRODUCT_SPEC.md réécrit par Opus le 30/07

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

##### Suggestion d'Opus retenue

```
"Passe systématique sur chaque notification a-t-elle une action au 
bout ?" — les notifs message/match/signature pointent vers /matches 
et /match/<id>/contrat, a priori saines mais non vérifiées 
formellement. Bon réflexe après la découverte du bug B12 (même 
famille : notification qui alerte sans donner prise) — à ajouter au 
Sprint 1.
```

---

#### 📌 VEILLE — Hausse de tarif DeepSeek annoncée (03/08)

```
Email officiel DeepSeek : hausse significative des tarifs API a 
venir, chiffres non encore communiques ("sujet a notice officielle"). 
Pas d'action requise maintenant.

IMPACT POTENTIEL SUR SOIGNECT : DeepSeek est utilise pour extraction 
texte libre (creation annonce), composante "Profils" du score de 
matching, aide a la redaction, suggestions d'optimisation. Protection 
deja en place : rate-limiting/budget existant (deepseekBudget.ts, 
plafonds journaliers user + global, depuis Sprint 0) - limite le 
risque d'emballement de cout meme si le prix au call augmente.

ACTION SUGGEREE QUAND LES VRAIS CHIFFRES TOMBERONT : demander a Opus 
le volume d'appels reel des 30 derniers jours (logs existants) pour 
chiffrer l'impact concret avant de reagir. Si marginal, ne rien 
changer. Si lourd, evaluer alternatives (autre fournisseur LLM, 
reduction frequence d'appels non critiques) a ce moment-la.
```

---

## PARTIE IV — DÉCISIONS OUVERTES ET CHANTIERS NON PRIS

#### DÉCISIONS PRODUIT OUVERTES (non bloquantes)

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

#### CLARIFICATION — Robustesse du match automatique en cas d'interet simultane (29/07)

##### Question posée

```
Si un cabinet et un candidat swipent "interesse" l'un sur l'autre a 
peu pres au meme moment, le match automatique se cree-t-il de facon 
fiable dans tous les cas, y compris en cas de quasi-simultaneite 
(risque de concurrence/race condition) ? Les deux parties sont-elles 
bien notifiees dans tous les cas ?
```

##### Statut

```
🟡 Prompt de verification rédigé, en attente d envoi. Question de 
solidite posee en amont, pas un bug constate.
```

---

#### VISION ARCHITECTURE DE FOND — Chercheur d'emploi / pourvoyeur d'emploi, statut décidé à la recherche effective (03/08)

##### Proposition de Jean-Charles

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

##### Coût réel identifié — pourquoi ne pas le faire maintenant

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

##### Décision (03/08)

```
❌ PAS MAINTENANT — trop risqué a ce stade (proche d'une beta 
stabilisee, sortir tout juste d'une vague de bugs du meme type sur 
un perimetre plus restreint). Ouvrir ce chantier maintenant risquerait 
de generer une nouvelle vague de bugs similaires sur TOUTE la surface 
de l'app d'un coup.

🔴 CORRECTION DE SUIVI (03/08, trouvée par Opus) : la phrase 
ci-dessous, écrite plus tôt le même jour, était ambiguë et a été lue 
à tort comme "déjà construit". Précision : "Mes recherches de 
remplacement" n'a JAMAIS existé dans le code — c'était une 
PROPOSITION de nom d'espace, jamais un fait. Ce qui a RÉELLEMENT été 
construit et livré à la place, plus tard le même jour, c'est plus 
simple : une carte "Couverture de mon absence" directement sous la 
bannière violette (voir section "CLÔTURE COMPLÈTE — Le fil 
rattachement assistant"). Les deux noms ne désignent PAS la même 
chose — le second a remplacé le premier dans les faits, sans jamais 
mettre à jour cette note-ci en conséquence. Même famille que le 
"malentendu du 23/07" : une formulation qui affirme plus qu'elle ne 
sait, cette fois causée par moi (Sonnet), pas par le produit.

✅ CE QUI CONTINUE EN PARALLELE, SANS CONTRADICTION : le correctif 
pragmatique PROPOSÉ à ce moment-là ("Mes recherches de remplacement", 
espace léger côté assistant — jamais construit sous ce nom) - 
n'entre pas en conflit avec cette vision, l'anticipe même 
partiellement, sans necessiter de refonte immediate.

✅ CAPTURE POUR PHASE 3+ : vision documentee ici en detail, pour ne 
pas se perdre. PREREQUIS avant d'y toucher un jour : un audit complet 
de tous les usages de ProfileType dans le code (chaque route, chaque 
composant, chaque template) pour mesurer precisement le rayon 
d'impact avant de se lancer - pas une decision a prendre a la legere 
au detour d'une session.
```

---

#### FEATURE — Bloc-notes d'événements (poste + mise en relation) (03/08)

##### Besoin exprimé

```
Carnet de bord manuel pour documenter des evenements qui ne rentrent 
dans aucun champ structure : contact telephonique, contact email, 
annonce postee ailleurs, date probablement amenee a changer. 
DISTINCT de TraceEvent (automatique/systeme) - ici c'est manuel, 
saisi par l'utilisateur.
```

##### Périmètre tranché

```
LES DEUX NIVEAUX, meme mecanisme technique reutilise :
- Attache au POSTE (CabinetPost) - contexte general, independant du 
  candidat en cours (ex: annonce postee ailleurs)
- Attache a une MISE EN RELATION (Match) precise - suit cette 
  relation specifique (ex: appel telephonique a un candidat donne)

Modele generique propose (TimelineNote, entityType POSTE|MATCH, 
entityId polymorphique) - a valider par Opus avant implementation.
```

##### Statut

```
🟡 Prompt rédigé, demande explicitement un rapport de structure 
avant code (nouvelle feature, pas un correctif). En attente d'envoi.
```

---

## PARTIE V — STRATÉGIE ET FONDATIONS

#### RECONSTITUTION — Stratégie marketing & différenciation (reconstruite le 29/07, gap identifié post-incident du 24/07)

> Cette section reconstitue le contenu perdu lors de l'incident de 
> fichier. Contrairement au reste du document (état consolidé sans 
> détail historique), ces éléments méritent d'être conservés dans 
> leur substance complète — ce sont des décisions stratégiques 
> réfléchies, pas des faits d'implémentation.

##### A. Neuf pistes de différenciation produit (acquisition remplaçants/assistants)

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

##### B. Vision multi-marque (nom variable par profession/région) — DIFFÉRÉE Phase 3+

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

##### C. Internationalisation (i18n) — DIFFÉRÉE Phase 3+

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

##### D. Modèle de pricing à la carte (façon Physiorama/LeBonCoin) — QUESTION OUVERTE

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

##### E. Le palier 1 doit-il intégrer un seuil côté remplaçants, pas seulement les cabinets ? — QUESTION OUVERTE

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

##### F. Autres idées marketing capturées (différées, moins prioritaires)

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

#### RÉCUPÉRATION D'UNE CONVERSATION ANTÉRIEURE — Fondations perdues retrouvées (29/07)

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

##### 1. AMBITION D'ORIGINE : NATIONALE, PAS GUADELOUPE-FIRST

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

##### 2. LE VRAI DIFFÉRENCIATEUR D'ORIGINE : LA NOTATION (pas le matching)

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

##### 3. MODÈLE ÉCONOMIQUE — plus riche que ce qui était tracé récemment

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

##### 4. MODULE CESSION & ASSOCIATION — entièrement spécifié à l'origine

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

##### 5. TROIS LEVIERS DE LANCEMENT (stratégie d'origine, plus riche que le volet 1.b actuel)

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

##### 6. AUTRES ÉLÉMENTS FONDATEURS RETROUVÉS (résumé, non détaillés ici)

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

##### RECOMMANDATION IMMÉDIATE

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

## PARTIE VI — RÈGLES DE MÉTHODE ÉTABLIES

### Les 7 règles, rapatriées ici le 13/08

Elles vivaient dans `PLAN_PASSATION_SPRINTS.md`, que plus personne ne tient. Ce document les
citait sans les contenir — trois renvois, dont deux vers une règle n°7 **qui n'a jamais existé
dans ce fichier** : il n'en comptait que 6. La règle 7 était pourtant décidée et écrite ici
même (évaluation UX/UI du 03/08), avec la mention « désormais ajoutée au protocole permanent » —
ajout jamais fait. Encore une décision documentée comme livrée sans l'être.

1. **LE GEL** — pousser une idée vers un sprint ultérieur plutôt que la construire tout de
   suite.
2. **LA CHECKLIST DE CHAÎNE** — tout nouveau type / enum / acteur se vérifie sur toute la
   chaîne : inscription → feed → matching → contrat → notifications → partage. *(Le défaut du
   rattachement assistant est exactement ce que cette règle attrape : le feed ouvrait
   l'assistanat aux remplaçants, le rattachement ne suivait pas.)*
3. **LA RELANCE SYSTÉMATIQUE** — tout point « à tester / décider » est relancé à chaque session
   tant qu'il n'est pas confirmé.
4. **L'ALIGNEMENT VARCHAR / ZOD** — toute colonne texte a une limite DB alignée sur le plafond
   de validation du formulaire. *(Deux P2000 en production l'ont imposée.)*
5. **LA VÉRIFICATION AVANT RECONSTRUCTION** — avant de déclarer un fichier perdu ou de
   reconstruire quoi que ce soit, vérifier l'état réel de chaque fichier. Ne pas supposer.
6. **LA VIGILANCE DÉONTOLOGIQUE** — toute feature de notation entre profils respecte
   l'asymétrie de l'article R.4321-99 avant d'être construite.
7. **L'ÉCRITURE OPPOSABLE** — un écran n'affirme jamais ce qu'il n'a pas vérifié. Chaque
   message est rédigé pour le cas nominal ET pour « et si c'est faux ? ». C'est le défaut de
   fond unique identifié le 03/08 après manipulation des 4 parcours.

À quoi s'ajoute la **convention de portée** (en tête de ce document) : tout ✅ dit ce qu'il
couvre.

### Absorption de PRODUCT_SPEC_v1_1_addendum.md (13/08)

L'addendum « ParaBoard v1.1 » (juin 2026, ancien nom du produit) n'était pas une spec mais un
**plan de construction — et il a été exécuté**. Vérifié pièce par pièce contre le code :

| Ce qu'il prévoyait | État réel |
|---|---|
| `/admin/desirability` | ✅ existe |
| `/premium` | ✅ existe |
| Webhook Stripe | ✅ existe |
| `Profile.desirabilityScore/Override/Expiry`, `subscriptionPlan`, `isFounding` | ✅ tous en base |
| `/dashboard/billing` | ❌ jamais construit |

**Trois divergences, le code faisant foi :**

- **`bioTinder` : 280 → 700 caractères.** L'addendum décrit 280 ; la colonne vaut 700 des deux
  côtés (profil et annonce), alignée après deux P2000 en production.
- **Grille tarifaire divisée par ~4, et un 4ᵉ plan.** L'addendum annonce PREMIUM 39 €/BOOST 79 €.
  Réel : PREMIUM **9 €**, BOOST **29 €**, plus un plan **STRUCTURE** (89 €/mois + 20 €/contrat)
  qui n'existait pas — c'est lui qui porte la question de compérage signalée à l'audit
  déontologique.
- **La désirabilité n'ajoute plus de points au score.** L'addendum la décrit comme
  « jusqu'à 10 points ajoutés au score d'affinité ». **Faux depuis le 03/08** : elle a été
  sortie du score et vit uniquement dans l'ORDRE DU FEED, avec disclosure explicite. C'est la
  divergence la plus importante — elle contredit un mécanisme de fond.

Le reste de l'addendum (algorithme de score DeepSeek, comportement des cartes, ordre
d'implémentation par sprints) est soit périmé, soit déjà décrit ailleurs dans ce document, en
version vérifiée. **Rien d'autre n'en a été repris**, et le fichier n'a plus lieu d'être
consulté.

### Éléments livrés pendant le gel de ce document, revérifiés contre le code (13/08)

Entre le 06/08 et le 12/08, ce document était gelé : des travaux ont été livrés sans jamais y
entrer. Revérifiés dans le code, pas recopiés depuis `ROADMAP.md`.

- **`professionLabel` — divergence rendue impossible à la compilation.** `src/lib/professions.ts`
  type ses deux tables en `Record<Profession, string>` : ajouter une valeur à l'enum sans la
  traduire ne compile plus. Deux registres distincts, courant et contractuel.
- **`remunerationBrute` — chaîne complète.** Colonne en base, extraction IA (`annonceAI.ts`,
  5 occurrences), formulaire de création (8), routes POST et PATCH. C'est l'équivalent salarié
  du CA estimé, pour un établissement à qui « rétrocession » ne veut rien dire.
- **Édition d'annonce par `?editId=`** — le formulaire de création sert aussi de formulaire
  d'édition, côté annonce (`missions/create`) comme côté disponibilité
  (`disponibilites/create`). Un seul écran, deux usages.
- **Cartographie générique / kiné-spécifique** — investigation en lecture seule, aucun code.
  Son résultat vit dans `ROADMAP.md` (principe de factorisation) ; rien à documenter ici comme
  comportement.

⚠️ **La « vue liste desktop titulaire » n'existe PAS.** `ROADMAP.md` la porte à la fois comme
close (à verser ici) et comme prompt en file, non envoyé. Le code tranche : **aucune
occurrence**. C'est la file qui a raison. Elle n'est donc pas documentée ici — l'y écrire aurait
créé une spec décrivant une fonctionnalité inexistante, exactement le malentendu du 23/07.

---


#### 🎓 LE MALENTENDU DU 23/07 — quand un ✅ valide une marche et déclare l'escalier praticable

> Trouvé par relecture intégrale d'Opus (03/08, après-coup de la 
> session marathon). C'est la découverte méthodologique la plus 
> importante de tout ce document — elle montre que le défaut de 
> fond identifié dans l'évaluation UX/UI ("l'écran affirme ce qu'il 
> n'a pas vérifié") a aussi infecté LE SUIVI DE PROJET LUI-MÊME, pas 
> seulement le produit.

##### Les faits

```
18/07 (Sprint 3) : "Rattachement compte ASSISTANT à un poste cabinet 
(section 153) — non testé en conditions réelles, test end-to-end 
recommandé"

23/07 : "✅ Test assistant↔poste CONFIRMÉ OK par Jean-Charles — 
c'était le dernier vrai bloquant produit du Sprint 0. Levé."

03/08 (11 jours plus tard, session marathon) : découverte que TOUT 
ce qui vient après le rattachement manuel était cassé - le 
formulaire de couverture ne pouvait pas être soumis, l'assistant ne 
voyait pas ce qu'il publiait, ne pouvait pas le retirer, et le 
rattachement AUTOMATIQUE n'avait jamais fonctionné (toujours pas 
corrigé à ce jour, voir section dédiée).
```

##### Le diagnostic, dans les mots d'Opus

```
"Le test du 23/07 a validé la première marche et déclaré l'escalier 
praticable."

Ce n'est pas un reproche - c'est exactement l'erreur que la règle de 
méthode n°7 vise, et sa découverte PROUVE que cette règle est bien 
placée. Mais elle a une conséquence pratique très concrète : un ✅ 
"vérifié en prod" dans ce document ne dit pas QUELLE PORTION du 
parcours a été vérifiée. Un item marqué clos a masqué une chaîne 
rompue pendant onze jours.
```

##### Trois occurrences de la même famille, trois sessions différentes

```
1. §152 — le type ASSISTANT ne pouvait pas s'inscrire, bloquant 
   "tout le produit gold depuis le début"
2. §161 — un contrat CDD/CDI générait un PDF d'assistanat libéral 
   juridiquement incorrect (ANCÊTRE DIRECT du travail du 03/08 sur 
   isSalariat)
3. Le rattachement assistant (23/07 → 03/08, ci-dessus)

Trois occurrences, trois sessions, même famille : PAS une série de 
maladresses isolées, mais une PROPRIÉTÉ DU PRODUIT à traiter comme 
telle systématiquement, pas au cas par cas.
```

##### ✅ CONVENTION ADOPTÉE — distinguer la portée d'une vérification, symétriquement aux statuts d'attente

```
La légende de ce document distingue déjà finement les statuts 
d'ATTENTE (🟡🟠🔵⚪🔒). Il manquait la distinction symétrique côté 
FAIT : "✅ vérifié en prod" recouvrait aussi bien "mesuré à l'écran 
de bout en bout" que "confirmé sur un seul point d'entrée".

RÈGLE ADOPTÉE À PARTIR DE MAINTENANT : tout ✅ dans ce document doit 
préciser sa PORTÉE entre parenthèses ou en une phrase courte — 
"vérifié de bout en bout" vs "vérifié sur [étape précise], le reste 
de la chaîne non testé". Ne plus jamais laisser un ✅ nu sur un 
parcours à plusieurs étapes sans dire laquelle a été couverte.

Cette convention s'ajoute à la règle de méthode n°7 (PLAN_PASSATION_
SPRINTS.md) — elle en est l'application directe au suivi de projet 
lui-même, pas seulement au produit.
```

---

#### 🎓 ÉVALUATION UX/UI DE FIN DE SESSION — synthèse critique après 4 parcours manipulés en réel (03/08)

> Évaluation à chaud d'Opus, fondée sur la manipulation réelle des 4 
> parcours (une trentaine d'écrans), pas une grille théorique. À 
> conserver intégralement — c'est le document le plus utile de toute 
> la session pour la suite.

##### Ce qui est bon, et sous-estimé

```
1. LA SAISIE TEXTE LIBRE + EXTRACTION — "l'idée la plus forte du 
   produit". Enlève la marche administrative la plus haute sans 
   sacrifier la donnée structurée.
2. LA TIMELINE DU PLANNING — métaphore juste, une ligne par poste, 
   compréhension d'un coup d'œil. "Rare et difficile à concevoir."
3. L'ÉCRITURE — français soigné, vocabulaire adapté au profil, états 
   vides qui expliquent. "Quelqu'un s'en occupe vraiment."
4. LES CONTRATS — modèles sérieux, articles cités, clause Ordre.
```

##### 🔴 LE DÉFAUT DE FOND, UNIQUE ET RÉPÉTÉ

```
"L'écran affirme ce qu'il n'a pas vérifié." PAS une accumulation de 
bugs — UN BIAIS D'ÉCRITURE : le produit rassure par défaut, chaque 
message rédigé pour le cas nominal, jamais "et si c'est faux ?"

Six exemples réels rencontrés dans CETTE session :
- "Aucun candidat disponible" alors qu'un candidat attendait depuis 
  3 swipes
- "Dès qu'un candidat correspond, il apparaît ici" — aucun ne 
  pouvait apparaître
- "Email envoyé !" au-dessus d'un paragraphe disant l'inverse
- Score de compatibilité à 0 — pas un jugement, un calcul jamais fait
- Poste "Confirmé" en vert — sur la foi d'une conversation en cours
- "Détails réservés aux membres" — à un membre déjà connecté

CETTE RÈGLE EST DÉSORMAIS AJOUTÉE AU PROTOCOLE PERMANENT (voir 
PLAN_PASSATION_SPRINTS.md, correction de méthode n°7).
```

##### Trois motifs additionnels, moins graves

```
1. LES IMPASSES — une notif menant à une vitrine sans action, un 
   bouton vers un formulaire non soumissible, un CTA Premium pour un 
   PDF qui n'existera jamais. Le produit propose souvent une action 
   de plus qu'il ne peut en tenir.
2. LE PRODUIT NE MONTRE PAS CE QU'IL FAIT — l'assistant publiait et 
   ne retrouvait rien ; une brique existait, invisible sous une 
   autre. La donnée est là, l'interface ne l'expose pas.
3. LA PROFONDEUR — rattacher un assistant demande de cliquer une 
   période (pas le lien évident), puis dérouler un panneau. Trois 
   niveaux pour une action structurante, ratée du premier coup même 
   par Opus lui-même.
```

##### Ce qu'Opus changerait, dans l'ordre

```
1. Une règle d'écriture opposable (ci-dessus, adoptée)
2. Toute action a une issue — un bouton mène quelque part, un 
   blocage dit comment le lever
3. Montrer à l'utilisateur ce qu'il vient de faire — "le correctif 
   qui a le plus changé le parcours assistant"
4. Alléger le formulaire de publication — texte libre + 4 boutons IA 
   + repli + 2 colonnes + sélecteur + 8 champs + encart prérequis. 
   "L'idée d'origine se noie dans son propre outillage." 
   ⚠️ NOUVEAU CHANTIER DE SIMPLIFICATION À CONSIDÉRER, distinct de 
   ceux déjà identifiés (partage Facebook, etc.)
```

##### Jugement d'ensemble (à retenir mot pour mot)

```
"C'est un produit conçu par quelqu'un qui connaît son métier, avec 
un modèle de données qui le montre. Les défauts ne sont pas des 
maladresses de débutant : ce sont des écarts entre ce que le système 
sait et ce que l'écran raconte, ce qui est typique d'un développement 
rapide où la donnée avance plus vite que la mise en scène.

Pour une bêta, le socle est là. Ce que je surveillerais en priorité 
n'est pas l'esthétique — elle est correcte et cohérente — mais la 
véracité des écrans. Dans un outil où des praticiens engagent des 
contrats, un message qui ment coûte plus cher qu'un bouton mal 
aligné."
```

---

#### CORRECTION DE SUIVI — La vérification déontologique n'était pas "en attente depuis le début" (03/08)

##### Erreur reconnue

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

---

#### 🚨 DÉCOUVERTE STRUCTURELLE — Deux PRODUCT_SPEC.md divergents, source des malentendus répétés (03/08)

##### Le problème, nommé clairement

```
Le PRODUCT_SPEC.md tenu par Sonnet dans cette conversation (celui-ci) 
N'EST PAS le PRODUCT_SPEC.md que lit Opus (celui du dépôt réel, 
réécrit par Opus le 30/07 - déjà flagué comme risque à ce moment-là, 
jamais réconcilié depuis).

CONSÉQUENCE CONCRÈTE, 4 OCCURRENCES EN UNE SEULE JOURNÉE : un prompt 
cite une section de CE document comme source ("lis PRODUCT_SPEC.md, 
section X") ; Opus consulte SON document (le dépôt), ne trouve pas 
la section, rapporte à raison qu'elle "n'existe pas" :
1. /venir-en-guadeloupe
2. "Mes recherches de remplacement" (déjà trouvé et corrigé plus haut)
3. Section "STRATÉGIE DE MARCHÉ"
4. Section "investigation inscription 03/08"

MOTIF IDENTIFIÉ PAR OPUS : "mes investigations te sont rendues en 
conversation, tu me demandes d'implémenter, donc rien n'atterrit 
dans la spec [du dépôt] — et le prompt suivant la cite comme source."
```

##### ✅ SOLUTION ADOPTÉE (03/08) — Opus écrit sa propre spec après chaque investigation

```
Désormais : à la fin de CHAQUE investigation (même en lecture seule, 
même sans modification de code), Opus écrit une section de spec 
DIRECTEMENT DANS LE DÉPÔT. Coût : un commit de documentation par 
investigation. Bénéfice : élimine le décalage à la racine - le 
document qu'Opus lit devient le document qu'il vient d'écrire.

RÔLE DE CE DOCUMENT-CI (tenu par Sonnet) DÉSORMAIS CLARIFIÉ : mémoire 
de conversation et vue d'ensemble stratégique pour Jean-Charles, PAS 
la source que Opus doit citer dans ses prompts. Les prompts futurs 
rédigés par Sonnet ne devraient plus dire "lis PRODUCT_SPEC.md, 
section X" en référence à CE document - soit reformuler le contexte 
nécessaire directement dans le prompt, soit référencer la vraie spec 
du dépôt une fois qu'Opus l'aura mise à jour.
```

##### Ce que ça implique pour la suite

```
- Les deux documents (celui-ci et celui du dépôt) vont continuer de 
  diverger sur le contenu FUTUR sauf réconciliation périodique - à 
  faire de temps en temps si besoin (demander à Opus un export de sa 
  version pour comparaison), mais pas urgent vu la nouvelle règle 
  d'écriture d'Opus qui rend SA version fiable au jour le jour.
- Ce document-ci reste la référence pour tout ce qui a été DÉCIDÉ 
  dans cette conversation (arbitrages produit, décisions de Jean-
  Charles) - mais plus la référence technique pour Opus.
```

##### Statut

```
✅ Règle adoptée. Prompt/consigne à faire suivre à Opus : écrire 
systématiquement dans le dépôt, même en lecture seule.
```

##### ⚠️ COMPLÉMENT (06/08) — la règle ci-dessus ne suffit pas, mesuré deux fois

```
CONSTAT : « Opus écrit dans le dépôt » ne protège de rien si la
réécriture suivante de ce fichier repart d'une copie figée. Opus a
écrit dans le dépôt, DEUX FOIS, et les deux fois la régénération
suivante a écrasé son travail :

  1. commit 48033be (correction d'attribution) → écrasé par bf254cc
  2. commit 94bf35b (section scoring réécrite)  → écrasé le 06/08

La seconde régénération n'était pas un retour en arrière volontaire :
elle a produit « version d'avant + 117 lignes nouvelles, ZÉRO
suppression ». Signature d'un remplacement complet du fichier à
partir d'une base qui n'a jamais contenu les commits d'Opus.

CE QUI A ÉTÉ PERDU PUIS RÉTABLI DEUX FOIS : la correction établissant
que « Julien 78 / Jean-Charles 23 » ne démontre PAS le plafond à 80
(aucun des deux camps n'avait coché de critère ; l'écart vient d'une
annonce modifiée après le swipe). Réaffirmée comme preuve mesurée à
chaque régénération.

CE QU'IL FAUT À LA PLACE, pour qui régénère ce fichier :
  git pull, PUIS fusionner ses ajouts dans la version du dépôt.
  Jamais un remplacement complet à partir d'une copie locale.

Sans ça, chaque correction technique d'Opus a une durée de vie d'une
régénération, et les erreurs corrigées reviennent à l'identique.
```

---
