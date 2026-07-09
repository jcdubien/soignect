# ParaBoard — Product Spec v1.0
> Document de référence unique. Claude Code doit lire ce fichier en entier avant toute modification.
> Dernière mise à jour : juin 2026

---

## 1. Vision produit

ParaBoard est un job board paramédical Tinder-like avec un système de notation différencié.
Cible MVP : kinésithérapeutes en Guadeloupe.
Expansion prévue : DOM-TOM → national → autres professions (infirmiers, orthophonistes, médecins).

**Différenciateur absolu** : notation des cabinets d'accueil par les remplaçants (publique) + évaluation des remplaçants par les cabinets (privée, critères objectifs uniquement).

---

## 2. Deux profils utilisateurs distincts

### CABINET (titulaire)
- Publie des annonces de remplacement ou d'assistanat
- Swipe sur les profils remplaçants entrants
- Reçoit une notation publique de ses remplaçants
- Évalue ses remplaçants en privé (critères objectifs uniquement — conformité déontologique)
- Peut s'abonner en premium pour accéder aux scores privés des remplaçants

### REMPLACANT (remplaçant / assistant)
- Swipe les annonces de cabinets
- Voit le score public des cabinets avant de postuler
- Note le cabinet après chaque mission (public, commentaire libre modéré)
- Reçoit une évaluation privée du cabinet (non visible par lui-même en V1)

---

## 3. Modèle de données cible

### Tables existantes à conserver sans modification
- `User` — OK tel quel
- `Mission` — OK tel quel
- `Swipe` — OK tel quel
- `Match` — OK tel quel
- `Message` — OK tel quel

### Table `Profile` — à enrichir (migration additive uniquement)
Ajouter les champs suivants SANS supprimer l'existant :
```prisma
model Profile {
  // ... champs existants conservés ...
  
  profileType     ProfileType   @default(REMPLACANT)  // CABINET | REMPLACANT
  rppsNumber      String?       // numéro RPPS/ADELI
  specialty       String?       // kinésithérapie, ostéopathie, etc.
  region          String?       // Guadeloupe, Martinique, etc.
  isPremium       Boolean       @default(false)
  isVerified      Boolean       @default(false)  // badge certifié ParaBoard
  
  cabinetRatings     CabinetRating[]    // reçues si CABINET
  remplacantRatings  RemplacantRating[] // reçues si REMPLACANT
}

enum ProfileType {
  CABINET
  REMPLACANT
}
```

### Table `Rating` — à REMPLACER par deux tables distinctes

> ⚠️ Ne pas supprimer `Rating` immédiatement — créer les deux nouvelles tables d'abord, migrer les données existantes si besoin, puis supprimer.

#### `CabinetRating` (notation publique du cabinet par le remplaçant)
```prisma
model CabinetRating {
  id              String    @id @default(cuid())
  createdAt       DateTime  @default(now())
  
  cabinetId       String    // Profile.id du cabinet noté
  cabinet         Profile   @relation("CabinetRatings", fields: [cabinetId], references: [id])
  
  authorId        String    // Profile.id du remplaçant qui note
  matchId         String    // Match.id — notation uniquement post-match
  
  // Critères (1-5 chacun)
  scoreAccueil    Int       // Accueil et intégration
  scoreMateriel   Int       // Matériel et locaux
  scoreContrat    Int       // Respect des conditions contractuelles
  scoreAmbiance   Int       // Ambiance équipe
  scoreGlobal     Float     // Calculé automatiquement (moyenne)
  
  commentaire     String?   // Commentaire libre — modéré avant publication
  isPublished     Boolean   @default(false)  // false = en attente de modération
  
  cabinetResponse String?   // Réponse du cabinet à l'avis
}
```

#### `RemplacantRating` (évaluation PRIVÉE du remplaçant par le cabinet)
```prisma
model RemplacantRating {
  id              String    @id @default(cuid())
  createdAt       DateTime  @default(now())
  
  remplacantId    String    // Profile.id du remplaçant évalué
  remplacant      Profile   @relation("RemplacantRatings", fields: [remplacantId], references: [id])
  
  authorId        String    // Profile.id du cabinet qui évalue
  matchId         String    // Match.id — évaluation uniquement post-match
  
  // Critères objectifs uniquement — PAS de commentaire libre (déontologie)
  scorePonctualite    Int   // Ponctualité
  scoreQualiteSoins   Int   // Qualité des soins
  scoreDossierPatient Int   // Tenue du dossier patient
  scoreCommunication  Int   // Communication avec le titulaire
  scoreGlobal         Float // Calculé automatiquement
  
  // Visibilité : jamais publique, visible uniquement par les cabinets premium
  visibleToCabinets   Boolean @default(true)
  visibleToRemplacant Boolean @default(false)  // V1 : non visible par le remplaçant
}
```

---

## 4. Règles métier critiques

### Notation
- Une `CabinetRating` ne peut être créée que si un `Match` existe entre les deux profils
- Une `RemplacantRating` ne peut être créée que si un `Match` existe entre les deux profils
- Un profil ne peut noter qu'une seule fois par match (unicité matchId + authorId)
- `scoreGlobal` est toujours recalculé côté serveur, jamais côté client
- Les commentaires libres (`CabinetRating.commentaire`) passent en `isPublished: false` par défaut — un admin doit valider

### Visibilité des scores
- Score d'un cabinet : public, visible par tous sans inscription
- Score d'un remplaçant : visible uniquement par les cabinets avec `isPremium: true`
- Un remplaçant ne voit PAS son propre score RemplacantRating en V1

### Conformité déontologique
- `RemplacantRating` n'a PAS de champ commentaire (évite calomnie entre confrères — art. R.4321-99)
- Critères objectifs et factuels uniquement
- Mention explicite dans l'UI : "Évaluation confidentielle — visible uniquement des cabinets inscrits"

---

## 5. Parcours utilisateurs (résumé)

### Parcours cabinet
1. Inscription → choix profil CABINET
2. Création profil cabinet (nom, adresse, spécialités, équipements)
3. Publication annonce mission
4. Swipe sur profils remplaçants entrants
5. Match → messagerie
6. Post-mission : évaluation privée du remplaçant (RemplacantRating)
7. Réception notation publique du remplaçant (CabinetRating)
8. Upgrade premium → accès scores remplaçants

### Parcours remplaçant
1. Inscription → choix profil REMPLACANT (via lead magnet email)
2. Création profil (RPPS, diplôme, disponibilités, mobilité)
3. Swipe annonces cabinets → voit score public cabinet
4. Match → messagerie
5. Post-mission : notation publique du cabinet (CabinetRating)

---

## 6. Pages / routes à implémenter

| Route | Rôle | Priorité |
|-------|------|----------|
| `/` | Landing page + CTA inscription | MVP |
| `/onboarding` | Choix CABINET ou REMPLACANT | MVP |
| `/annonces` | Feed swipe des annonces (vue remplaçant) | MVP |
| `/profils` | Feed swipe des profils (vue cabinet) | MVP |
| `/match/[id]` | Messagerie post-match | MVP |
| `/profil/[id]` | Fiche publique cabinet avec score | MVP |
| `/noter/cabinet/[matchId]` | Formulaire CabinetRating | MVP |
| `/noter/remplacant/[matchId]` | Formulaire RemplacantRating | MVP |
| `/dashboard` | Tableau de bord (annonces, matchs, stats) | MVP |
| `/admin` | Modération avis + gestion utilisateurs | V1 |
| `/premium` | Page upgrade abonnement Stripe | V1 |

---

## 7. Règles pour Claude Code

### Ne jamais faire sans instruction explicite
- Supprimer ou renommer une colonne existante en base
- Changer le schéma Prisma sans créer une migration nommée
- Modifier les routes d'API existantes qui fonctionnent
- Changer le système d'authentification

### Toujours faire
- Lire ce fichier avant toute session de travail
- Créer des migrations additives (ajout de colonnes/tables) plutôt que destructives
- Nommer les migrations de façon explicite (ex: `add_cabinet_rating_table`)
- Tester que `npm run build` passe après chaque modification
- Garder la cohérence avec les types TypeScript existants

### Ordre de priorité des modifications
1. Base de données (schema + migration) — une seule fois, validée avant tout
2. Types TypeScript et API routes
3. Composants UI
4. Pages

---

## 8. Stack technique

- Frontend : Next.js (App Router)
- ORM : Prisma
- Base de données : Supabase PostgreSQL
- Auth : NextAuth
- Paiement : Stripe (V1)
- Hébergement cible : Vercel

---

## 9. Ce qui NE change PAS en V1

- Le système de matching (Swipe + Match) — ne pas y toucher
- La messagerie (Message) — ne pas y toucher  
- L'authentification User — ne pas y toucher
- La structure de Mission — ne pas y toucher

---

## 10. Roadmap géographique & professions — NON NÉGOCIABLE

### Ordre de déploiement géographique
```
Phase 1 — MVP        Guadeloupe uniquement
Phase 2 — DROM       Martinique, Guyane, La Réunion, Mayotte
Phase 3 — National   France métropolitaine complète
```

### Ordre d'ouverture par profession
```
V1 (MVP)     Kinésithérapeutes uniquement
V2           Infirmiers (IDEL), Orthophonistes
V2-V3        Sages-femmes
V3           Médecins (généralistes + toutes spécialités)
```

### Impact technique — prévoir dès maintenant dans le code
- Le champ `Profile.profession` doit exister dès la V1 (même si une seule valeur possible)
- Le champ `Profile.region` et `Mission.region` doivent exister dès la V1
- Les filtres feed/tray doivent accepter profession + region comme paramètres
- Ne jamais hard-coder "kinésithérapeute" dans le code — toujours passer par Profile.profession

### Enum à créer dès le Sprint 2 (si pas encore fait)
```prisma
enum Profession {
  KINESITHERAPEUTE
  INFIRMIER
  ORTHOPHONISTE
  SAGE_FEMME
  MEDECIN
}

enum Region {
  GUADELOUPE
  MARTINIQUE
  GUYANE
  REUNION
  MAYOTTE
  METROPOLE
}
```

### Règle absolue pour Claude Code
Ne jamais créer de logique ou d'UI qui suppose une seule profession ou une seule région.
Toujours filtrer par `profession` et `region` dans les requêtes Prisma.

---

## 11. Modèle économique — intégré au produit

### Principe directeur
Les remplaçants sont gratuits à vie. Leur présence EST le produit pour attirer les cabinets.
Ne jamais leur demander de payer, ne jamais leur afficher de paywall.

### Sources de revenus par phase

#### Phase 1 — M0 à M8 (Guadeloupe, gratuit total)
- Tout est gratuit pour tous
- Objectif : atteindre 80+ cabinets inscrits avant de monétiser
- Premier revenu : CPTS / MSP / Collectivités (forfait annuel pour booster attractivité zone)
- Cabinet fondateur (Jean-Charles Dubien) : désirabilité 10/10 permanent, retour sur investissement immédiat

#### Phase 2 — M8 à M18 (monétisation cabinets)
- Plan Gratuit : 1 annonce active, pas de boost, pas d'accès scores remplaçants
- Plan Premium 39€/mois : annonces illimitées, boost +5, accès scores privés remplaçants, badge certifié
- Plan Boost 79€/mois : tout Premium + boost +8, badge prioritaire, stats avancées, accès anticipé profils
- CPTS / ARS / Collectivités : forfait annuel 2 000–10 000€ pour zones sous-dotées

#### Phase 3 — M18+ (diversification nationale)
- IFMK / écoles de formation : accès CVthèque jeunes diplômés (1 000–3 000€/an)
- Publicité B2B ciblée : fabricants matériel kiné, logiciels métier, assureurs (CPM/forfait)
- Partenariats syndicaux et ordinaux : label officiel, co-branding, ouverture autres professions

### Impact sur le code — règles pour Claude Code

**Gratuit à vie :**
- Jamais de paywall côté remplaçant
- Jamais de feature cachée derrière isPremium pour les profils REMPLACANT

**Lié à l'abonnement (cabinets uniquement) :**
- Accès aux scores RemplacantRating → isPremium = true requis
- Boost désirabilité automatique → calculé depuis subscriptionPlan
- Badge "Certifié ParaBoard" → isPremium = true requis

**CPTS / Institutionnel :**
- Traités comme des cabinets avec subscriptionPlan = BOOST
- Champ optionnel Profile.institutionalPartner Boolean @default(false)
- Leur zone géographique est boostée (desirabilityScore élevé sur toutes leurs annonces)

**Cabinet fondateur :**
- Profile.isFounding = true → desirabilityScore bloqué à 10, non modifiable
- Ne jamais permettre à une logique automatique de descendre ce score sous 10

---

## 12. Distribution & territoires

### Territoires — enum Region à mettre à jour
```prisma
enum Region {
  GUADELOUPE
  SAINT_MARTIN
  SAINT_BARTH
  MARTINIQUE
  GUYANE
  REUNION
  MAYOTTE
  METROPOLE
}
```
Saint-Martin et Saint-Barth sont des collectivités distinctes de la Guadeloupe —
elles ont leur propre marché kiné, leurs propres besoins de remplacement.
Les inclure dès le MVP dans les filtres feed/tray et les pages SEO.

### Pages SEO locales à créer (Sprint 6)
Une page statique par territoire, indexée par Google :
- `/remplacement-kine-guadeloupe`
- `/remplacement-kine-saint-martin`
- `/remplacement-kine-saint-barth`
- `/remplacement-kine-martinique` (V2)
- etc.

### Distribution vers Facebook — approche légale uniquement

#### Bouton "Copier pour Facebook" — MVP (Sprint 6)
Sur chaque fiche annonce, un bouton génère le texte formaté de l'annonce
et le copie dans le presse-papier. Le kiné colle lui-même dans son groupe.
Format du texte généré :
```
📍 [VILLE] — [TYPE MISSION] · [DURÉE]
💶 Rétrocession : [TAUX]%
📅 Du [DATE_DEBUT] au [DATE_FIN]
🏥 [NOM_CABINET] · Score ParaBoard : [SCORE]/5 ⭐

[BIO_TINDER]

👉 Voir l'annonce complète : paraboard.fr/annonces/[ID]
```

#### Facebook Graph API — publication automatique (Sprint 6)
Quand un cabinet publie une annonce sur ParaBoard :
1. Cron toutes les heures vérifie les nouvelles annonces non publiées sur Facebook
2. Publie via Graph API dans le groupe (Jean-Charles est admin = autorisation app)
3. Marque l'annonce comme publiée (Mission.facebookPostId String?)
4. 100% légal — API officielle Meta, pas de scraping

Champs à ajouter sur Mission :
```prisma
facebookPostId    String?   // ID du post Facebook si publié
facebookPostedAt  DateTime? // Date de publication Facebook
autoPostFacebook  Boolean   @default(true) // Le cabinet peut désactiver
```

#### Ce qu'on ne fait jamais
- Scraper Physiorama, Rempleo, Appines — violation CGU + risque juridique
- Bot Facebook non autorisé — risque de ban du groupe 10 000 membres
- Publier sans consentement du cabinet (autoPostFacebook doit être true)

### Agrégation des usages — objectif
ParaBoard devient le point de départ unique :
- Le kiné publie UNE FOIS sur ParaBoard
- L'annonce se diffuse automatiquement sur Facebook (Graph API)
- Le lien SEO capte les recherches Google
- L'email/WhatsApp alerte les remplaçants correspondants
- Plus besoin de multiplier les posts manuels sur chaque plateforme

---

## 13. Correction modèle économique — financement institutionnel CPTS

### Réalité terrain Guadeloupe (correction section 11)

Les CPTS et ARS ne paieront PAS pour attirer des kinésithérapeutes ou des infirmiers
en Guadeloupe — ces professions sont en surnombre sur le territoire.

**Les professions en tension réelle en Guadeloupe (cibles institutionnelles) :**
- Orthophonistes — désert orthophonique marqué, délais d'attente > 18 mois
- Médecins spécialistes — cardiologues, psychiatres, pédiatres, rhumatologues
- Médecins généralistes — zones sous-dotées hors Pointe-à-Pitre/Basse-Terre

**Ce que les CPTS/ARS/Collectivités paieront réellement :**
- Boost de visibilité des annonces d'orthophonistes et médecins spécialistes
- Pages territoriales dédiées aux professions en tension
- Accès données anonymisées (cartographie des besoins par zone)

**Impact sur la roadmap professions :**
```
V1 MVP    Kinésithérapeutes (masse critique, audience Facebook existante)
V2        Orthophonistes EN PRIORITÉ (tension réelle = financement institutionnel)
V2        Médecins spécialistes (même logique)
V3        Infirmiers, sages-femmes, médecins généralistes
```

**La vraie séquence commerciale CPTS :**
1. MVP kiné — prouve que la plateforme fonctionne
2. Pitch CPTS avec données réelles : "On a X remplaçants inscrits, voici comment
   on peut attirer des orthophonistes dans votre zone"
3. Forfait annuel CPTS pour boost orthophonistes/médecins spécialistes uniquement

---

## 14. Zonage démographique médical — donnée centrale du produit

### Contexte réglementaire
L'Assurance Maladie classe les zones géographiques selon la densité de professionnels
de santé. Ce classement conditionne directement les aides à l'installation et les
décisions de carrière des jeunes diplômés.

**Les 4 zones (nomenclature CNAM/ARS) :**
```
Zone sur-dotée        Trop de professionnels — pas d'aide, concurrence forte
Zone intermédiaire    Densité correcte — aides limitées
Zone sous-dotée       Manque de professionnels — aides majeures à l'installation
Zone très sous-dotée  Désert médical — aides maximales, conventionnement facilité
```

### Pourquoi c'est un frein à l'installation en Guadeloupe
- Un kiné qui s'installe en zone sur-dotée = pas d'aide + patientèle difficile à construire
- Les jeunes diplômés ne connaissent pas la carte des zones avant de chercher
- Les cabinets en zone sous-dotée ont du mal à l'afficher clairement comme avantage
- Le remplacement en zone sous-dotée peut être une porte d'entrée vers une installation aidée

### Impact produit — ce qu'on ajoute à ParaBoard

#### Champ sur Mission et Profile
```prisma
enum ZonageType {
  SUR_DOTEE
  INTERMEDIAIRE
  SOUS_DOTEE
  TRES_SOUS_DOTEE
}

// Sur Mission — ajouter :
zonage    ZonageType?  // Calculé automatiquement depuis la commune

// Sur Profile cabinet — ajouter :
zonage    ZonageType?  // Zone du cabinet
```

#### Affichage sur les cartes swipe
- Badge coloré visible sur chaque carte annonce :
  - Rouge  → Zone sur-dotée
  - Jaune  → Zone intermédiaire
  - Vert   → Zone sous-dotée
  - Vert foncé + étoile → Zone très sous-dotée
- Tooltip au clic : "Cette zone ouvre droit aux aides à l'installation CNAM"

#### Impact sur le score d'affinité
Les zones sous-dotées et très sous-dotées reçoivent un bonus de visibilité :
```
Zone très sous-dotée  → desirabilityScore + 3 (automatique, sans override admin)
Zone sous-dotée       → desirabilityScore + 1 (automatique)
Zone intermédiaire    → 0
Zone sur-dotée        → 0
```
Ce bonus est cumulable avec le boost abonnement et le boost fondateur,
mais le total ne peut pas dépasser 10.

#### Page d'information dédiée (Sprint 6)
`/zones` — carte interactive Guadeloupe + Saint-Martin + Saint-Barth
avec le zonage par commune, les aides disponibles par zone,
et les annonces actives dans chaque zone.

#### Valeur pour les CPTS et ARS
Les zones très sous-dotées sont exactement là où les CPTS cherchent à attirer
des professionnels. C'est l'argument commercial institutionnel pour les professions
en tension (orthophonistes, médecins spécialistes) — voir section 13.

### Source des données de zonage
- Arrêtés ARS publiés au Journal Officiel (mis à jour annuellement)
- API CNAM / data.ameli.fr (données publiques)
- À intégrer comme données statiques dans la DB au lancement,
  mise à jour manuelle annuelle (ou webhook si API disponible)

---

## 15. Zonage réel Guadeloupe — données officielles ARS 2024

### Source officielle
Arrêté n°971-2024 — 12-31-00003 /ARS/DDAPS/SDPS du 31 décembre 2024
Signé par Laurent LEGENDART, Directeur Général ARS Guadeloupe, Saint-Martin, Saint-Barthélemy

### Réalité du zonage kiné en Guadeloupe
**Il n'existe PAS de zone sous-dotée kiné en Guadeloupe.**
Seules deux catégories existent :
- Zone non prioritaire (4) — offre élevée, pas d'aide à l'installation
- Zone intermédiaire (3) — offre correcte, aides limitées

**Idem pour les infirmiers** (arrêté ARS du 2 avril 2025) :
aucune zone déficitaire, Guadeloupe non éligible aux contrats aidés infirmiers.

### Communes par zone — données complètes arrêté 2024

**Zone 4 — Non prioritaire (20 communes) :**
Les Abymes, Baie-Mahault, Basse-Terre, Saint-Claude, Le Gosier, Lamentin,
Morne-à-l'Eau, Le Moule, Petit-Bourg, Pointe-à-Pitre, Sainte-Anne,
La Désirade, Saint-François, Gourbeyre, Terre-de-Bas, Terre-de-Haut,
Trois-Rivières, Vieux-Fort, Baillif, Vieux-Habitants

**Zone 3 — Intermédiaire (12 communes) :**
Bouillante, Pointe-Noire, Capesterre-Belle-Eau, Capesterre-de-Marie-Galante,
Grand-Bourg, Saint-Louis (Marie-Galante), Goyave, Petit-Canal,
Anse-Bertrand, Port-Louis, Deshaies, Sainte-Rose

### Impact sur le produit ParaBoard

#### Correction de l'enum ZonageType (section 14)
```prisma
enum ZonageType {
  NON_PRIORITAIRE    // Zone 4 — offre élevée
  INTERMEDIAIRE      // Zone 3 — offre intermédiaire
  // Pas de SOUS_DOTEE ni TRES_SOUS_DOTEE pour kiné/infirmier en Guadeloupe
  // Ces valeurs restent pour les autres professions et territoires futurs
  SOUS_DOTEE
  TRES_SOUS_DOTEE
}
```

#### Ce que ça change pour l'affichage
- Pas de badge "zone sous-dotée" pour kiné en Guadeloupe — ça n'existe pas
- Badge "Zone intermédiaire" sur les communes de la liste zone 3 (Bouillante, etc.)
- Badge "Zone non prioritaire" sur les communes zone 4 (Pointe-à-Pitre, etc.)
- Tooltip informatif : "En zone intermédiaire, des aides ponctuelles peuvent exister — renseignez-vous auprès de l'ARS"

#### Ce que ça change pour le modèle commercial
- L'argument CPTS/ARS ne tient PAS pour kiné et infirmier en Guadeloupe
- Il tient pour orthophonistes et médecins spécialistes (professions réellement en tension)
- Saint-Martin et Saint-Barth ont potentiellement un zonage différent — à vérifier

#### Valeur de l'information pour les remplaçants
Même sans zone sous-dotée, l'information reste utile :
- Un remplaçant qui vise une installation future sait que Bouillante/Pointe-Noire
  sont en zone intermédiaire = moins de concurrence que Pointe-à-Pitre
- C'est un argument pour choisir un remplacement dans une commune
  plutôt qu'une autre en vue d'une installation future

---

## 16. Zonage — correction périmètre d'application

### Qui est concerné par le zonage ARS ?

```
Remplaçant      → NON concerné — mobile par définition, pas d'installation
Assistant       → OUI concerné — le contrat peut mener à une installation
Titulaire       → OUI concerné — sa zone conditionne l'attractivité de son offre
```

### Impact sur l'affichage dans ParaBoard

Le badge de zonage s'affiche UNIQUEMENT sur les annonces de type :
- `ASSISTANAT`
- `COLLABORATION_LIBERALE`

Il ne s'affiche PAS sur les annonces de type :
- `REMPLACEMENT` — non pertinent pour un remplaçant mobile

### Enum MissionType à vérifier/compléter
```prisma
enum MissionType {
  REMPLACEMENT          // Court ou long — remplaçant mobile, zonage non affiché
  ASSISTANAT            // Contrat assistanat — zonage affiché
  COLLABORATION         // Collaboration libérale — zonage affiché
}
```

### Wording sur les annonces assistanat/collaboration
Quand la commune est en zone intermédiaire (zone 3), afficher :

> "Cabinet situé en zone intermédiaire (zone 3 ARS) — 
>  votre installation future peut ouvrir droit à des aides.
>  Renseignez-vous auprès de l'ARS Guadeloupe."

Ne jamais promettre des aides spécifiques — le cadre réglementaire évolue.
Toujours rediriger vers l'ARS pour confirmation.

### Valeur produit pour le recrutement d'assistants
Un cabinet en zone 3 (Bouillante, Capesterre, Port-Louis, Deshaies, etc.)
peut valoriser sa localisation comme avantage concurrentiel dans son annonce :
"Zone intermédiaire — perspectives d'installation aidée"
C'est un argument de différenciation fort face aux cabinets zone 4.

---

## 17. Planning Board — vue cabinet (feature premium)

### Concept
Le titulaire dispose d'une vue timeline de l'ensemble de ses postes.
C'est sa "tour de contrôle RH" — il voit d'un coup d'œil qui travaille,
quand, et surtout quand il va avoir un trou à combler.

### Interface — timeline horizontale

```
POSTE 1  [████████████ Assistant Marie L. ████████████]--préavis--[???]
POSTE 2  [████ Remplacement Paul D. ████][  vide  ][██ Remplacement Ana M. ██]
POSTE 3  [████████████████ Assistant Jean T. ████████████████████████████████]
          Jan     Fév     Mar     Avr     Mai     Juin    Juil    Août    Sep
```

### Code couleur
```
Bleu foncé   → Assistant (contrat long, stable)
Bleu clair   → Collaboration libérale
Vert         → Remplaçant confirmé (match effectué)
Orange       → Remplaçant en cours de recherche (annonce active)
Rouge        → Trou non couvert (alerte)
Gris hachuré → Période de préavis (3 mois avant fin de contrat)
```

### Fonctionnalités

#### Vue d'ensemble
- 1 à 15 postes affichables selon la taille du cabinet
- Zoom : vue semaine / mois / trimestre / année
- Chaque brique cliquable → ouvre la fiche du remplaçant/assistant

#### Détection automatique des trous
Quand un poste est vide sur une période future :
- Badge rouge "Trou non couvert" sur la timeline
- Bouton "Créer une annonce" directement depuis le trou
- Durée du trou pré-remplie dans le formulaire d'annonce

#### Alerte préavis automatique (feature clé)
Les contrats d'assistanat ont généralement 3 mois de préavis.
- À J-90 de la fin d'un contrat : notification au titulaire
- "Le contrat de Marie L. se termine dans 3 mois — publier une annonce ?"
- CTA → création d'annonce en 1 clic avec dates pré-remplies
- Cette automatisation est une feature BOOST uniquement

#### Génération automatique d'annonces (V2 — feature Boost)
Quand un préavis est détecté ET que le titulaire a activé l'option :
1. ParaBoard génère automatiquement le brouillon d'annonce
2. Le titulaire reçoit une notification : "Votre annonce est prête — publier ?"
3. En 1 clic : l'annonce est publiée + partagée sur Facebook (Graph API)

### Modèle de données à prévoir

```prisma
model CabinetPost {
  id            String      @id @default(cuid())
  createdAt     DateTime    @default(now())
  
  cabinetId     String
  cabinet       Profile     @relation(fields: [cabinetId], references: [id])
  
  label         String      // "Poste 1", "Dr. Marie L.", etc.
  postType      PostType    // ASSISTANT | COLLABORATION | REMPLACEMENT_REGULIER
  maxSlots      Int         @default(1) // Nombre de remplaçants simultanés possibles
  
  // Missions liées à ce poste (briques sur la timeline)
  missions      Mission[]   @relation("PostMissions")
  
  // Alertes préavis
  noticeMonths  Int         @default(3)  // Durée préavis en mois
  autoAlert     Boolean     @default(true)
  autoPublish   Boolean     @default(false) // Boost uniquement
}

enum PostType {
  ASSISTANT
  COLLABORATION
  REMPLACEMENT_REGULIER
}
```

### Accès par plan
```
Gratuit   → Non disponible
Premium   → Vue timeline + détection trous + alertes manuelles
Boost     → Tout Premium + alertes automatiques + génération annonces auto
```

### Ordre d'implémentation
- Sprint 7 : modèle CabinetPost + migration
- Sprint 8 : UI timeline (composant PlanningBoard)
- Sprint 9 : système d'alertes préavis + notifications
- Sprint 10 : génération automatique d'annonces (Boost)

---

## 18. Moteur relationnel intelligent — au-delà des notifications

### Philosophie
ParaBoard n'est pas un système de notifications chronologiques.
C'est un moteur de maintien du lien humain entre professionnels.

La clé n'est pas "quand a eu lieu le dernier message" mais
"quelle est la force de cette relation professionnelle et quand
a-t-elle besoin d'être nourrie ?"

### Le problème réel
Les remplaçants et titulaires se perdent dans des boucles WhatsApp.
Le dernier message détermine qui est visible, pas qui est pertinent.
Un bon remplaçant vu il y a 6 mois est oublié. Un inconnu qui vient
de poster est prioritaire. C'est l'inverse de ce qu'on veut.

### Moteur de relation — fonctionnement

#### Score de relation (RelationScore)
Calculé entre chaque paire cabinet/remplaçant ayant eu un match :

```
RelationScore = (affinityScore × 0.4)
              + (missionCount × 10)        // Nombre de missions effectuées ensemble
              + (ratingAvg × 8)            // Note moyenne reçue
              + (recencyBoost)             // Décroît avec le temps, remonte au contact
              + (bioAffinityScore × 0.2)   // Affinité DeepSeek des bioTinder
```

#### Relances intelligentes — déclencheurs
PAS de relance systématique à intervalles fixes.
DeepSeek analyse le contexte et décide si une relance a du sens :

```typescript
// Prompt DeepSeek pour décider d'une relance
const prompt = `
Tu es un assistant RH bienveillant pour un cabinet de kinésithérapie.
Voici le contexte de cette relation professionnelle :
- Dernière mission : ${lastMission}
- Score d'affinité : ${affinityScore}/100
- Note mutuelle : ${rating}/5
- BioTinder cabinet : "${cabinetBio}"
- BioTinder remplaçant : "${remplacantBio}"
- Prochaine période creuse détectée : ${nextGap}

Dois-tu suggérer une relance ? Si oui, quel message personnalisé ?
Réponds en JSON : { "shouldNotify": boolean, "message": string, "timing": string }
`
```

#### Types de relances (jamais automatiques sans validation titulaire)
- "Marie L. a souvent remplacé dans votre cabinet — 
   elle pourrait être disponible cet été. Voulez-vous la recontacter ?"
- "Vous n'avez pas eu de nouvelles de Paul D. depuis 4 mois —
   il correspond toujours à vos critères. Un message ?"
- "3 remplaçants avec qui vous avez bien travaillé sont 
   disponibles en août — voir leurs profils ?"

### Boost géographique éthique — zones CPTS et ultra-périphérie

#### Principe
Certaines zones ont besoin d'un coup de pouce algorithmique
pour des raisons de santé publique, pas de business.
Ce boost est transparent, documenté, et justifiable auprès des ARS.

#### Règles de boost géographique
```
Cabinet en zone intermédiaire (zone 3)     → +1 désirabilité automatique
Cabinet en zone CPTS contractualisée       → +2 désirabilité (contrat CPTS)
Cabinet en ultra-périphérie isolée         → +2 désirabilité automatique
  (Marie-Galante, Les Saintes, La Désirade,
   nord Basse-Terre, communes rurales)
Cabinet fondateur (JCD)                    → 10 permanent
```

Ces boosts sont cumulables dans la limite de 10 total.
Ils sont affichés dans l'interface admin avec leur justification.

#### Transparence côté utilisateur
Sur la carte swipe, un badge discret :
- "Zone prioritaire" sur les cabinets en zone 3 ou CPTS
- Tooltip : "Ce cabinet est mis en avant car situé dans une zone
   à renforcer — ParaBoard soutient l'accès aux soins en Guadeloupe"

### Impact sur le modèle de données

```prisma
model Relation {
  id              String   @id @default(cuid())
  cabinetId       String
  remplacantId    String
  
  relationScore   Float    @default(0)
  missionCount    Int      @default(0)
  lastContactAt   DateTime?
  lastMissionAt   DateTime?
  
  // Relances
  nextSuggestedAt DateTime?
  lastSuggestion  String?   // Message suggéré par DeepSeek
  
  @@unique([cabinetId, remplacantId])
}

// Sur Profile — ajouter :
// isUltraPeripherie Boolean @default(false)
// isCPTSPartner     Boolean @default(false)
// geoBoost          Float   @default(0)  // Calculé automatiquement
```

### Accès par plan
```
Gratuit   → Aucune relance intelligente
Premium   → Suggestions de relance (validation manuelle)
Boost     → Relances semi-automatiques + messages personnalisés DeepSeek
```

### Ordre d'implémentation
- Sprint 9  : modèle Relation + calcul RelationScore post-mission
- Sprint 10 : moteur de suggestions DeepSeek + interface titulaire
- Sprint 11 : relances semi-automatiques (Boost)

---

## 19. Génération automatique de contrat au moment du match

### Principe
Quand un match est confirmé entre un titulaire et un remplaçant/assistant,
ParaBoard génère automatiquement un contrat pré-rempli au format PDF
à partir des données des deux profils et de l'annonce.

### Type de contrat
Contrat de remplacement type de l'Ordre des Masseurs-Kinésithérapeutes
(modèle officiel — à intégrer comme template dans le système)

### Données pré-remplies automatiquement

**Depuis le profil Titulaire :**
- Nom, prénom
- Numéro RPPS / ADELI
- Numéro d'inscription à l'Ordre
- Adresse du cabinet (commune d'exercice)
- Spécialités

**Depuis le profil Remplaçant/Assistant :**
- Nom, prénom
- Numéro RPPS / ADELI
- Numéro d'inscription à l'Ordre
- Date d'obtention du diplôme
- Adresse personnelle

**Depuis l'annonce (Mission) :**
- Dates de début et de fin
- Taux de rétrocession
- Type de contrat (remplacement / assistanat / collaboration)
- Conditions particulières (logement, matériel, etc.)

### Workflow

```
Match confirmé
     ↓
Notification aux deux parties :
"Votre contrat est prêt — vérifiez et téléchargez"
     ↓
Page /match/[id]/contrat
- Aperçu du contrat pré-rempli
- Champs manquants à compléter manuellement
- Bouton "Télécharger le PDF"
     ↓
Chaque partie télécharge, signe, scan et renvoie à l'autre
(signature électronique = V2)
```

### Champs manquants à compléter dans l'UI
Certaines données ne sont pas dans les profils et doivent être
saisies au moment de la génération :
- Clause de non-concurrence (durée + périmètre) — négociée entre parties
- Modalités de paiement (fréquence, mode)
- Conditions particulières spécifiques à cette mission

### Stack technique
- Génération PDF côté serveur : `pdfkit` ou `puppeteer` (HTML → PDF)
- Template : HTML/CSS fidèle au modèle Ordre des MK
- Route : `GET /api/match/[matchId]/contrat` → retourne le PDF
- Stockage : Supabase Storage (PDF conservé 30 jours)

### Extensions futures (V2)
- Signature électronique intégrée (DocuSign ou Yousign API)
- Contrats pour autres professions (infirmiers, orthophonistes)
- Archivage sécurisé dans l'espace personnel
- Envoi automatique à l'Ordre si API disponible

### Accès par plan
```
Gratuit   → Non disponible
Premium   → Génération contrat illimitée
Boost     → Tout Premium + signature électronique (V2)
```

### Ordre d'implémentation
- Sprint 8 : template HTML contrat MK + route PDF
- Sprint 9 : intégration dans la page /match/[id]
- Sprint 10 : signature électronique Yousign (Boost)

### Données à collecter obligatoirement à l'inscription
Pour que le contrat soit générable, ces champs deviennent
obligatoires lors de l'onboarding :
- Numéro RPPS (les deux parties)
- Numéro d'inscription à l'Ordre (les deux parties)
- Date d'obtention du diplôme (remplaçant)
- Adresse complète du cabinet (titulaire)

---

## 20. Contrats — trois types à couvrir

### Correction section 19 — pas uniquement le remplacement

Rempleo couvre déjà le contrat de remplacement.
ParaBoard se différencie en couvrant les trois types de contrats :

```
Type 1 — Contrat de remplacement
  Usage : remplaçant temporaire (quelques jours à quelques mois)
  Modèle : Ordre des MK (modèle officiel)
  Concurrent : Rempleo le fait déjà → on le fait aussi mais mieux
               (pré-remplissage RPPS + données profil complet)

Type 2 — Contrat d'assistanat
  Usage : assistant salarié ou libéral rattaché au cabinet
  Modèle : contrat spécifique avec clause de non-concurrence
  Durée : généralement 1 à 3 ans
  Concurrent : Rempleo ne le fait PAS → différenciateur fort

Type 3 — Contrat de collaboration libérale
  Usage : collaboration entre deux praticiens libéraux indépendants
  Modèle : contrat de collaboration (cadre loi Évin + convention MK)
  Durée : indéterminée avec préavis
  Concurrent : Rempleo ne le fait PAS → différenciateur fort
```

### Données spécifiques par type de contrat

**Contrat d'assistanat (en plus des données communes) :**
- Statut de l'assistant (libéral ou salarié)
- Taux de rétrocession OU salaire selon statut
- Clause de non-concurrence (durée + rayon en km)
- Conditions d'installation future (droit de préférence ?)
- Durée de la période d'essai

**Contrat de collaboration libérale (en plus des données communes) :**
- Répartition de la patientèle
- Conditions d'utilisation du plateau technique
- Modalités de résiliation (préavis 3 mois minimum)
- Clause d'exclusivité (oui/non)
- Droit de présentation à la clientèle en fin de contrat

### Champ MissionType — mise à jour
```prisma
enum MissionType {
  REMPLACEMENT          // Contrat type 1 — contrat de remplacement
  ASSISTANAT            // Contrat type 2 — contrat d'assistanat
  COLLABORATION         // Contrat type 3 — contrat de collaboration libérale
}
```

### Accès par plan
```
Gratuit   → Aucun contrat généré
Premium   → Contrat de remplacement uniquement
Boost     → Les trois types de contrats
```

### Templates à produire
- [ ] Template HTML contrat de remplacement MK (modèle Ordre)
- [ ] Template HTML contrat d'assistanat MK
- [ ] Template HTML contrat de collaboration libérale MK
- [ ] Adaptation pour infirmiers (V2)
- [ ] Adaptation pour orthophonistes (V2)

### Note sur la responsabilité juridique
Mention obligatoire sur chaque contrat généré :
"Document pré-rempli à titre indicatif — à faire valider par un
 avocat ou l'Ordre des masseurs-kinésithérapeutes avant signature.
 ParaBoard ne peut être tenu responsable du contenu juridique."

---

## 21. Header contextuel — identité et résumé de situation

### Principe
Le header affiche en permanence un résumé succinct de l'identité
et de la situation de l'utilisateur connecté.
Un coup d'œil suffit pour savoir "qui je suis" et "où j'en suis".

### Vue CABINET (titulaire)
```
[ Kiné Board ]  [ Cabinet Dubien · Saint-Claude · 2 postes actifs · 1 trou détecté ]  [ + Annonce ]  [ Déconnexion ]
```

Détail du résumé contextuel :
- Nom du cabinet (depuis Profile.name)
- Commune (depuis Profile.region / commune)
- Nombre de postes actifs (annonces en cours)
- Alerte si trou détecté sur la timeline (badge rouge)

### Vue REMPLACANT
```
[ Kiné Board ]  [ Marie L. · Disponible juin-août · Guadeloupe ]  [ + Dispo ]  [ Déconnexion ]
```

Détail du résumé contextuel :
- Prénom + initiale nom
- Statut disponibilité (Disponible du X au Y / Non disponible)
- Zone de recherche

### Cas multi-comptes — un kiné peut avoir plusieurs profils
Un même utilisateur (User) peut avoir plusieurs profils (Profile) :
- Plusieurs cabinets distincts (titulaire de 2 ou 3 cabinets)
- Chercher plusieurs assistants sur des postes qui se chevauchent

**Gestion dans le header :**
- Si l'utilisateur a plusieurs profils CABINET → sélecteur de cabinet
  dans le header (dropdown) : "Cabinet Dubien ▾" → choisir le cabinet actif
- Le contexte (annonces, timeline, stats) change selon le cabinet sélectionné
- Le profil actif est stocké en session : Profile.activeProfileId

### Modifications base de données
```prisma
// Sur User — ajouter :
activeProfileId  String?  // Profil actif sélectionné (multi-profils)

// Relation User → Profile déjà existante
// Un User peut avoir plusieurs Profile
```

### Composant HeaderContext
Nouveau composant `src/components/ui/HeaderContext.tsx` :
- Charge les données du profil actif
- Affiche le résumé contextuel selon le profileType
- Si multi-profils CABINET : affiche un dropdown de sélection
- Mis à jour en temps réel quand les annonces changent

### Ordre d'implémentation
Sprint 6 — après les corrections logiques CABINET/REMPLACANT

---

## 22. Données APL — architecture scalable nationale

### Ce qui est fait (MVP DOM)
Fichier `paraboard_apl_boost.sql` — 112 communes DOM :
- 971 Guadeloupe (33 communes)
- 972 Martinique
- 973 Guyane
- 974 Réunion
Source : DREES APL 2023, calculé automatiquement

### Ce qui doit être prévu pour le scale national (~35 000 communes)

#### Ne pas stocker en SQL statique
35 000 communes × 4 professions = table volumineuse.
Solution : table `CommuneAPL` en base avec index,
alimentée par un script de mise à jour annuelle (cron).

#### Architecture cible
```
Table CommuneAPL (déjà créée)
  ↑
Script Python update_apl.py (cron annuel)
  ↑
Fichiers DREES APL téléchargés automatiquement depuis data.gouv.fr
  ↑
API data.gouv.fr (dataset ID par profession)
```

#### IDs datasets data.gouv.fr à conserver
```
Kinésithérapeutes  : APL 2023 xlsx DREES
Infirmiers         : APL 2023 xlsx DREES
Médecins généralistes : APL 2023 xlsx DREES
Sages-femmes       : APL 2023 xlsx DREES
Orthophonistes     : à vérifier sur data.gouv.fr
```

#### Calcul du boost — logique nationale
Les seuils de boost (P25/P50) doivent être calculés
par département, pas nationalement —
sinon toute la France dense écrase les DOM.

```python
# Seuils calculés PAR DÉPARTEMENT
# Boost = comparaison à la médiane départementale
# Pas à la médiane nationale
```

#### Phases de déploiement données
```
MVP      → 112 communes DOM (fait)
V2       → France entière via script automatisé
V3       → Mise à jour annuelle automatique (cron)
           + Orthophonistes quand dataset disponible
```

#### Script à créer : scripts/update_apl.py
- Télécharge les fichiers DREES depuis data.gouv.fr
- Calcule les boosts par département
- Met à jour la table CommuneAPL en base
- Loggue les changements (communes dont le boost change)
- À lancer une fois par an après publication DREES (généralement mars)

---

## 23. Correction boost géographique — par profession et non global

### Principe corrigé
Le boost géographique s'applique par profession, pas globalement.
Un boostMax global est trompeur et injuste.

### Logique correcte
```
Annonce kiné publiée par cabinet à Pointe-Noire
→ boost = CommuneAPL.boostKine (= 2 pour Pointe-Noire)
→ PAS boostMax

Annonce orthophoniste publiée à Pointe-Noire
→ boost = CommuneAPL.boostOrthophoniste (quand disponible)

Annonce médecin publiée à Pointe-Noire  
→ boost = CommuneAPL.boostMedecin (= 1 pour Pointe-Noire)
```

### Calcul du desirabilityScore final d'une annonce
```typescript
function calcDesirability(profile: Profile, mission: Mission, commune: CommuneAPL): number {
  // 1. Score de base selon abonnement
  let score = profile.isFounding ? 10
    : profile.desirabilityOverride ?? planScore(profile.subscriptionPlan)

  // 2. Boost géographique selon la PROFESSION de l'annonce
  const geoBoost = {
    KINESITHERAPEUTE: commune.boostKine,
    INFIRMIER:        commune.boostInfirmier,
    MEDECIN:          commune.boostMedecin,
    SAGE_FEMME:       commune.boostSageFemme,
    ORTHOPHONISTE:    commune.boostOrthophoniste ?? 0,
  }[mission.profession] ?? 0

  // 3. Total plafonné à 10
  return Math.min(score + geoBoost, 10)
}
```

### Modification table CommuneAPL
Supprimer boostMax — remplacer par des boosts par profession :
```sql
-- Correction Supabase
ALTER TABLE "CommuneAPL" DROP COLUMN IF EXISTS "boostMax";

-- Colonne orthophoniste à ajouter quand données disponibles
ALTER TABLE "CommuneAPL" ADD COLUMN IF NOT EXISTS "aplOrthophoniste" FLOAT;
ALTER TABLE "CommuneAPL" ADD COLUMN IF NOT EXISTS "boostOrthophoniste" INT DEFAULT 0;
```

### Correction immédiate dans Supabase
```sql
-- Corriger Pointe-Noire (boostKine = 2, pas 1)
UPDATE "CommuneAPL" 
SET "boostKine" = 2
WHERE "codeInsee" = '97121';
```

### Impact sur le modèle Prisma
```prisma
model CommuneAPL {
  id                  Int      @id @default(autoincrement())
  codeInsee           String   @unique
  commune             String
  departement         String
  aplKine             Float?
  aplInfirmier        Float?
  aplMedecin          Float?
  aplSageFemme        Float?
  aplOrthophoniste    Float?   // Disponible quand dataset DREES publié
  boostKine           Int      @default(0)
  boostInfirmier      Int      @default(0)
  boostMedecin        Int      @default(0)
  boostSageFemme      Int      @default(0)
  boostOrthophoniste  Int      @default(0)
  updatedAt           DateTime @default(now()) @updatedAt
}
```

---

## 24. UX — séquence inscription et parcours post-match

### Onboarding — 4 écrans maximum

```
Écran 1 : Qui êtes-vous ?
  → 2 gros boutons : CABINET ou REMPLACANT
  → Rien d'autre sur cet écran

Écran 2 : Votre identité
  → Email + mot de passe
  → Nom (cabinet ou professionnel)
  → Commune principale
  → RPPS (obligatoire — nécessaire pour le contrat)

Écran 3 : Votre BioTinder
  → Champ 280 caractères
  → Placeholder : "Je suis kiné passionné de sport,
    je cherche un cabinet avec plateau technique,
    j'aspire à une collaboration durable..."
  → Compteur temps réel
  → Boutons aide : "Je suis..." / "Je cherche..." / "J'aspire à..."

Écran 4 : Premier swipe
  → Redirection directe vers /annonces
  → Pas d'écran de confirmation intermédiaire
  → La valeur est immédiate
```

**Règle absolue : aucune étape supplémentaire.**
Tout le reste (photo, spécialités, etc.) se complète depuis le dashboard
après la première connexion — pas pendant l'inscription.

### Écran "It's a match !" — expérience visuelle forte

L'écran match doit être une célébration — pas une ligne de texte.

**Composition :**
- Fond plein écran couleur (emerald/vert)
- Deux avatars avec initiales qui convergent au centre
- Titre grand format : "C'est un match !"
- Score d'affinité avec barre de progression (ex: 87/100)
- Sous-titre rassurant : "Le match n'engage à rien — c'est le début d'une conversation"
- Deux boutons :
  - Primaire : "Envoyer un message"
  - Secondaire : "Voir plus tard"

### Action post-match — séquence logique

Match ≠ engagement. C'est l'ouverture d'une relation.

La page `/match/[id]` affiche dans l'ordre :

```
1. Header : profils des deux parties + score affinité + barre progression
2. "Envoyer un message" → messagerie in-app (toujours disponible)
3. "Générer le contrat" → /match/[id]/contrat (Premium uniquement)
4. "Noter après la mission" → disponible uniquement après la date de fin de mission
```

Le bouton "Générer le contrat" est grisé avec badge "Premium" si le cabinet
n'est pas abonné — pas caché, visible mais verrouillé.

Le bouton "Noter" est grisé avec tooltip "Disponible après le [date fin]"
jusqu'à la fin de la mission — évite les notations prématurées.

### Tray des matchs — visibilité améliorée

- Hauteur : 80px (au lieu de 60px)
- Badge rouge avec nombre de nouveaux matchs non lus
- Animation pulse sur le premier item si nouveau match depuis dernière visite
- Libellé au-dessus du tray : "Vos matchs — triés par affinité"

### Nombre de clics pour poster une annonce (objectif)

```
Connexion → Dashboard → "+ Annonce" → Formulaire → Publier = 3 clics
```

Le formulaire doit être sur une seule page scrollable —
pas de wizard multi-étapes.

---

## 25. Algorithme d'affinité — révision et slider de flexibilité dates

### Nouvelle pondération (remplace section B de l'addendum v1.1)

```
Critère                          Poids   Logique
───────────────────────────────────────────────────
Dates + flexibilité              35 pts  Prioritaire — modulé par le slider
Bio DeepSeek (valeurs/projet)    25 pts  Second critère — l'humain prime sur le factuel
Proximité géographique           20 pts  Distance cabinet/zone remplaçant
Spécialités communes             10 pts  +2.5 pts par spécialité commune, max 10
Score de désirabilité            10 pts  Boost admin/abonnement
TOTAL                           100 pts
```

### Slider de flexibilité des dates

Inspiré du sélecteur Appines — chaque profil déclare sa flexibilité
sur les dates proposées ou souhaitées.

**Options du slider (Profile et Mission) :**
```
0    → Dates exactes requises (pas de tolérance)
1    → ± 1 à 3 jours
2    → ± 1 semaine
3    → ± 2 semaines
4    → ± 1 mois (flexibilité maximale)
```

**Champs à ajouter :**
```prisma
// Sur Mission — ajouter :
dateFlexibility   Int   @default(0)  // 0=exact, 1=3j, 2=1sem, 3=2sem, 4=1mois

// Sur Profile — ajouter :
dateFlexibility   Int   @default(0)  // Flexibilité par défaut du remplaçant
```

**Algorithme de calcul du score dates (35 pts) :**
```typescript
function scoreDates(mission: Mission, profile: Profile): number {
  const flexDays = [0, 3, 7, 14, 30]
  const missionFlex = flexDays[mission.dateFlexibility ?? 0]
  const profileFlex = flexDays[profile.dateFlexibility ?? 0]
  const totalFlex = Math.max(missionFlex, profileFlex) // On prend le max des deux

  // Calcul de l'overlap avec tolérance
  const mStart = mission.startDate?.getTime() ?? 0
  const mEnd = mission.endDate?.getTime() ?? 0
  const pStart = profile.availableFrom?.getTime() ?? 0
  const pEnd = profile.availableTo?.getTime() ?? 0

  const toleranceMs = totalFlex * 24 * 60 * 60 * 1000

  const overlapStart = Math.max(mStart, pStart - toleranceMs)
  const overlapEnd = Math.min(mEnd, pEnd + toleranceMs)

  if (overlapEnd <= overlapStart) return 0  // Aucun overlap même avec tolérance

  const overlap = overlapEnd - overlapStart
  const shortest = Math.min(mEnd - mStart, pEnd - pStart)
  const ratio = Math.min(overlap / shortest, 1)

  // Bonus si flexibilité maximale des deux côtés
  const flexBonus = totalFlex >= 14 ? 5 : 0

  return Math.min(Math.round(ratio * 30) + flexBonus, 35)
}
```

### UI — slider dans le formulaire

**Sur le formulaire d'annonce (cabinet) :**
```
Flexibilité sur les dates
[─────●────────────────] ± 1 semaine
 Exact  3j  1sem  2sem  1mois
```

**Sur le profil remplaçant (disponibilités) :**
```
Ma flexibilité sur les dates
[──────────────●────────] ± 2 semaines
 Exact  3j  1sem  2sem  1mois
```

**Affichage sur la carte swipe :**
Badge discret sous les dates :
- "Dates exactes" (0)
- "Flexible ± 1 sem" (2)
- "Très flexible" (4)

### Révision système de notation → recommandation binaire

Après réflexion, le formulaire de notation à 4 critères est trop lourd.
Taux de complétion prévisible < 20%.

**Remplacement par une recommandation binaire (1 clic) :**

Après la mission :
```
"Recommanderiez-vous ce cabinet à un confrère ?"
  ✓ Oui    ✗ Non
```

```
"Recommanderiez-vous ce remplaçant à un confrère ?"  
  ✓ Oui    ✗ Non
```

Le score affiché devient un **taux de recommandation** :
"94% · 16 missions" → lisible, honnête, résistant aux biais

**Les critères détaillés restent optionnels** après le vote binaire
pour les utilisateurs qui veulent préciser.

**Modification base de données :**
```prisma
// Remplacer les champs score1..4 par :
model CabinetRating {
  // ... champs existants ...
  recommended     Boolean         // true = recommande, false = ne recommande pas
  // Critères détaillés — optionnels
  scoreAccueil    Int?            // Devient nullable
  scoreMateriel   Int?
  scoreContrat    Int?
  scoreAmbiance   Int?
  scoreGlobal     Float?          // Calculé si critères renseignés, sinon null
}

model RemplacantRating {
  // ... champs existants ...
  recommended          Boolean     // true/false
  scorePonctualite     Int?        // Optionnel
  scoreQualiteSoins    Int?
  scoreDossierPatient  Int?
  scoreCommunication   Int?
  scoreGlobal          Float?
}
```

---

## 26. Extension cibles — secteur hospitalier et salariés

### Nouvelles cibles payantes à intégrer

**Établissements de santé (gros payeurs institutionnels) :**
- Hôpitaux publics et ESPIC
- Cliniques privées
- EHPAD / USLD
- SSR (Soins de Suite et Réadaptation)
- Centres de santé pluriprofessionnels

**Profil DRH / Cadre de santé :**
- Cherche des soignants qualifiés en permanence
- Difficulté chronique = douleur forte = fort pouvoir d'achat
- Budget recrutement existant (agences d'intérim paramédical)
- ParaBoard = alternative moins chère et plus qualitative aux agences

**Professionnels salariés en recherche de poste :**
- Kinés salariés cherchant un poste en établissement
- Infirmiers hospitaliers en mobilité
- Médecins salariés (PH, praticiens contractuels)
- Sages-femmes hospitalières

### Impact sur le modèle économique

```
Cibles libérales (actuel)
  Cabinet titulaire     → Premium 39€ / Boost 79€/mois
  CPTS / MSP en tension → Forfait annuel institutionnel

Nouvelles cibles salariales
  Hôpital / Clinique    → Abonnement RH 199€/mois (accès illimité)
  EHPAD / SSR           → Forfait annuel 1 500–3 000€
  DRH multi-sites       → Licence entreprise (sur devis)
```

### Nouveaux types de missions à créer

```prisma
enum MissionType {
  REMPLACEMENT          // Libéral → libéral
  ASSISTANAT            // Libéral → libéral long terme
  COLLABORATION         // Libéral → libéral indépendant
  POSTE_SALARIE         // Établissement → salarié (nouveau)
  VACATION              // Établissement → vacation (nouveau)
  INTERIM               // Remplacement urgence établissement (nouveau)
}
```

### Canaux de distribution par cible

```
Libéraux kinés / infirmiers / ortho
  → Groupe Facebook (10 000 membres — actif)
  → Boucles WhatsApp syndicats SNMKR, FNEK, etc.
  → Instagram (jeunes diplômés)

Médecins libéraux
  → LinkedIn (plus formel)
  → Syndicats (CSMF, MG France)

Salariés / hospitaliers
  → LinkedIn (canal principal)
  → Syndicats hospitaliers (CGT Santé, FO Santé, CFDT Santé)
  → Réseaux cadres de santé

DRH / direction établissements
  → LinkedIn (décideurs)
  → Salons RH santé (Santexpo, etc.)
  → Approche directe FEHAP / FHF / FHP
```

### Positionnement produit élargi

ParaBoard n'est plus seulement un job board kiné —
c'est la plateforme de mise en relation des professionnels
de santé paramédicaux, qu'ils soient libéraux ou salariés,
en Guadeloupe d'abord, en France ensuite.

---

## 27. Identité de marque — Soignect

### Nom retenu : Soignect

**Étymologie :** Soigner + Connect
**Prononciation :** "swa-gnèkt"
**Domaines cibles :** soignect.fr · soignect.com · @soignect

### Pourquoi ce nom

- Neutre sur la profession — médecins, kinés, infirmiers, sages-femmes,
  établissements : personne ne se sent exclu
- "Paramédical" exclu volontairement du nom — les médecins n'iraient pas
  sur une plateforme qui se dit "para"
- L'IA est dans le produit, pas dans le nom — plus pérenne
- Court, mémorable, bilingue FR/EN
- Scalable du groupe Facebook des 10 000 kinés au LinkedIn des DRH

### Taglines par cible

```
Professionnels libéraux (Facebook / Instagram) :
"Soignect — le matching intelligent des professionnels de santé"

DRH / établissements (LinkedIn) :
"Soignect — recrutez les soignants qu'il vous faut, plus vite"

International / investisseurs :
"Soignect — AI-powered healthcare professional matching"

Accroche virale (groupe kiné) :
"Soignect — trouve ton remplacement, pas juste un CV"
```

### Canaux de distribution par cible et réseau

```
Kinés / infirmiers / ortho libéraux
  → Facebook (groupe 10 000 membres — distribution immédiate)
  → WhatsApp (boucles syndicats SNMKR, FNEK, etc.)
  → Instagram (jeunes diplômés IFMK)

Médecins libéraux
  → LinkedIn
  → Syndicats (CSMF, MG France, URPS)

Professionnels salariés
  → LinkedIn (canal principal)
  → Syndicats hospitaliers

DRH / direction établissements
  → LinkedIn
  → Salons RH santé (Santexpo)
  → Approche directe FEHAP / FHF / FHP
```

### Ce qui change dans le code

- Renommer KineBoardIA → Soignect partout
- package.json : name = "soignect"
- Titre de l'app dans le header : "Soignect" (pas "Kiné Board")
- Métadonnées SEO : title, description, og:title
- Domaine cible : soignect.fr (à réserver)

---

## 28. Planning Board — spécification complète

### Vue remplaçant / assistant — timeline simple

Sur la fiche "Mon compte" du remplaçant ou assistant :
une seule timeline horizontale montrant ses missions passées,
en cours et à venir.

```
[── Remplacement Cabinet Dubien ──][── Cabinet des Salines ──][  disponible  ]
Jan    Fév    Mar    Avr    Mai    Juin    Juil    Août    Sep    Oct
```

**Interactions :**
- Clic sur une brique mission → ouvre la fiche de la mission
  (avec accès à la notation / recommandation si mission terminée)
- Zone "disponible" → ouvre le formulaire de disponibilités

---

### Vue titulaire — board multi-postes

La fiche titulaire affiche autant de timelines que de postes,
nombre configurable par le titulaire (paramètre libre).

**Chaque ligne = un poste :**
```
POSTE 1  [████ Son propre temps de présence ████████████████████████████]
POSTE 2  [████ Assistant Marie L. ████████████]--préavis--[  NON COUVERT  ]
POSTE 3  [██ Remplaçant Paul D. ██][  NON COUVERT  ][██ Remplaçant Ana M. ██]
POSTE 4  [  NON COUVERT — annonce active 🔴  ]
          Jan    Fév    Mar    Avr    Mai    Juin    Juil    Août    Sep
```

**Le titulaire s'inclut lui-même** dans le board :
- Poste 1 = son propre temps de présence (toujours affiché)
- Postes 2..N = les remplaçants / assistants / collaborateurs

---

### Code couleur des briques

```
Bleu foncé    → Titulaire lui-même (temps de présence)
Bleu moyen    → Assistant confirmé (contrat signé)
Bleu clair    → Collaboration libérale confirmée
Vert          → Remplaçant confirmé (match accepté)
Orange        → Remplaçant en cours de recrutement (annonce active)
Rouge         → Poste non couvert (aucune annonce, aucun match)
Gris hachuré  → Période de préavis (J-90 avant fin de contrat)
```

---

### Interactions sur le board — logique au clic

#### Clic sur une zone NON COUVERTE (rouge / orange)
1. Ouvre un panneau latéral droit avec :
   - L'annonce correspondante (dernière publiée pour ce poste)
   - Les matchs en attente pour cette annonce (triés par affinité)
   - Bouton "Publier une annonce" si aucune annonce active
   - Bouton "Voir tous les matchs" → liste complète

#### Clic sur une zone COUVERTE (vert / bleu)
1. Ouvre un panneau latéral droit avec :
   - La fiche du remplaçant / assistant
   - Son score d'affinité avec ce cabinet
   - Son historique de missions dans ce cabinet
   - Bouton "Recommander" (si mission terminée)
   - Bouton "Évaluer" → recommandation binaire + critères optionnels
   - Bouton "Recontacter" → ouvre la messagerie

#### Clic sur une zone PRÉAVIS (gris hachuré)
1. Ouvre un panneau avec :
   - Date de fin de contrat
   - Rappel : "Préavis de 3 mois — pensez à recruter"
   - Bouton "Publier une annonce de remplacement" pré-rempli
     avec les dates correspondantes

---

### Gestion des candidats multiples sur un même poste

#### Côté remplaçant — choix obligatoire si > 3 matchs actifs
Un remplaçant ne peut pas rester en attente sur plus de 3 postes
simultanément pour la même période de dates.

Au 4ème match sur une même période :
- Notification : "Vous avez 3 matchs actifs pour cette période —
  confirmez un poste ou libérez vos autres matchs"
- Écran de choix : liste des matchs actifs pour cette période,
  avec score d'affinité, nom cabinet, conditions
- Actions possibles :
  - "Confirmer ce poste" → notifie le cabinet, ferme les autres
  - "Mettre en pause" → garde le match mais signale l'indisponibilité
  - "Décliner" → libère le poste pour d'autres candidats

#### Côté titulaire — deux modes au choix

**Mode "Ouvert" (par défaut) :**
Plusieurs candidats peuvent matcher sur le même poste.
Le titulaire choisit parmi les candidats entrants.
Adapté pour les remplacements courts (flexibilité maximale).

**Mode "Une annonce par poste" (Premium) :**
Chaque poste a son annonce dédiée.
La timeline est directement liée à chaque annonce.
Quand un candidat est confirmé, l'annonce se ferme automatiquement.
Adapté pour les assistanats et collaborations (un seul poste à pourvoir).

```prisma
// Sur Mission — ajouter :
cabinetPostId    String?   // Lien vers le poste du Planning Board
maxCandidates    Int       @default(10) // Mode ouvert
singleSlot       Boolean   @default(false) // Mode "une annonce par poste"
```

---

### Tray supérieur — dernières annonces consultées

Dans le header ou en haut de la page /annonces :
- Liste horizontale des 5 dernières annonces consultées
- Cliquable → rouvre directement la fiche annonce
- Persisté en localStorage (pas en base — légèreté)
- Remis à zéro si déconnexion

---

### Bouton "Mon compte" dans le header

À côté de "+ Annonce" dans le header :
```
[ Soignect ]  [ badge rôle ]  [ + Annonce ]  [ Mon compte ]  [ Déconnexion ]
```

Page /compte :
- Modifier ses informations (nom, commune, RPPS, spécialités)
- Modifier son BioTinder
- Gérer ses disponibilités (remplaçant)
- Gérer ses postes (titulaire)
- Voir son abonnement et factures
- Supprimer son compte

---

### Ordre d'implémentation

```
Sprint 7   → Modèle CabinetPost + migration
             Page /compte (informations + BioTinder)
             Tray supérieur "dernières annonces" (localStorage)
             Bouton "Mon compte" dans le header

Sprint 8   → Timeline simple remplaçant (page /compte)
             Planning Board titulaire (multi-postes)
             Interactions au clic (panneaux latéraux)

Sprint 9   → Gestion candidats multiples
             Mode "une annonce par poste"
             Alertes préavis automatiques
```

---

## 29. APL maison depuis RPPS — architecture données

### Source : Annuaire Santé ANS (Agence du Numérique en Santé)

URL de téléchargement :
https://annuaire.sante.fr/web/site-pro/extractions-publiques

Trois fichiers CSV en libre accès, mis à jour quotidiennement :
- PS_LibreAcces_Personne_activite — identité, profession, commune d'exercice
- PS_LibreAcces_Dipl_AutExerc — diplômes et autorisations
- PS_LibreAcces_SavoirFaire — spécialités médicales

Licence : Licence Ouverte v2.0 — réutilisation libre

### Ce qu'on calcule

Pour chaque commune × spécialité :
1. Compter les praticiens actifs dans un rayon de 20 km
   (pondéré par la distance — praticiens proches comptent plus)
2. Rapporter à la population de la commune (source INSEE)
3. Calculer la densité pondérée par spécialité
4. Comparer à la médiane départementale → score de boost 0-3

### Spécialités à couvrir (priorités)
```
Phase 1 (MVP étendu) :
  Médecins généralistes
  Cardiologues
  Psychiatres / Pédopsychiatres
  Pédiatres
  Gynécologues-obstétriciens

Phase 2 :
  Orthophonistes
  Ophtalmologues
  Rhumatologues
  Neurologues
  Dermatologues

Phase 3 :
  Toutes spécialités (40+)
```

### Table CommuneAPL — extension par spécialité

La table actuelle (kiné, infirmier, médecin généraliste, sage-femme)
sera étendue avec des colonnes par spécialité :

```sql
ALTER TABLE "CommuneAPL" ADD COLUMN "aplCardiologie" FLOAT;
ALTER TABLE "CommuneAPL" ADD COLUMN "boostCardiologie" INT DEFAULT 0;
ALTER TABLE "CommuneAPL" ADD COLUMN "aplPsychiatrie" FLOAT;
ALTER TABLE "CommuneAPL" ADD COLUMN "boostPsychiatrie" INT DEFAULT 0;
-- etc.
```

### Script à créer : scripts/compute_apl_rpps.py

```python
# Entrées :
# - PS_LibreAcces_Personne_activite.csv (RPPS)
# - Populations communes INSEE (csv)
# - Liste communes avec coordonnées GPS

# Algorithme :
# Pour chaque commune C et spécialité S :
#   praticiens_ponderes = sum(praticiens_dans_rayon_20km / distance_km)
#   apl = praticiens_ponderes / (population_C / 100000)
#   boost = calcul_par_departement(apl, P25_dept, P50_dept)

# Sortie :
# UPDATE CommuneAPL SET aplCardiologie=X, boostCardiologie=Y
# WHERE codeInsee='97XXX'
```

### Fréquence de mise à jour recommandée
- RPPS : mensuelle (données stables, peu de changements rapides)
- Cron : 1er de chaque mois à 5h du matin (Vercel cron)
- Log des changements significatifs (boost qui change d'une commune)

### Priorité d'implémentation
À faire après le MVP — ne bloque pas le lancement.
Les données APL DREES existantes couvrent le besoin immédiat.
Le script RPPS sera le chantier data du Sprint 10+.

---

## 30. API FHIR Annuaire Santé — architecture révisée

### Révision de la section 29 — on utilise l'API, pas les CSV

L'API FHIR ANS est gratuite, temps réel, et plus précise que les CSV.
Elle remplace le script de téléchargement mensuel.

### Accès

```
Portail : https://portail.openfhir.annuaire.sante.fr/
Gateway : https://gateway.api.esante.gouv.fr/fhir/v2/
Auth    : clé API dans le header GRAVITEE-API-KEY (gratuit après inscription)
```

### Deux usages dans Soignect

#### Usage 1 — Vérification RPPS à l'inscription (immédiat)
Quand un professionnel s'inscrit, on vérifie son numéro RPPS en temps réel :

```typescript
// Vérification RPPS à l'inscription
const res = await fetch(
  `https://gateway.api.esante.gouv.fr/fhir/v2/Practitioner?identifier=${rpps}`,
  { headers: { 'GRAVITEE-API-KEY': process.env.ANS_API_KEY } }
)
const data = await res.json()
const praticien = data.entry?.[0]?.resource
const actif = praticien?.active === true
const profession = praticien?.qualification?.[0]?.code?.coding?.[0]?.display
```

#### Usage 2 — Calcul APL par spécialité (cron mensuel)
Pour chaque commune × spécialité, on interroge l'API pour compter
les praticiens dans un rayon de 20 km :

```typescript
// Requête PractitionerRole par spécialité et département
const res = await fetch(
  `https://gateway.api.esante.gouv.fr/fhir/v2/PractitionerRole
   ?specialty=https://mos.esante.gouv.fr/NOS/TRE_R38-SpecialiteOrdinale/FHIR/TRE-R38-SpecialiteOrdinale|SM26
   &location.address-postalcode=971
   &_count=1000`,
  { headers: { 'GRAVITEE-API-KEY': process.env.ANS_API_KEY } }
)
// SM26 = Cardiologie, adapter selon la spécialité
```

### Codes spécialités clés (TRE-R38)
```
Médecine générale      SM53
Cardiologie            SM26
Psychiatrie            SM44
Pédiatrie              SM70
Gynécologie-Obstétrique SM41
Ophtalmologie          SM55
Rhumatologie           SM47
Neurologie             SM54
Orthophonie            → profession, pas spécialité (code profession 40)
Kinésithérapie         → profession (code 60)
Infirmier              → profession (code 50)
```

### Variables d'environnement à ajouter
```
ANS_API_KEY=votre-clé-gravitee
```

### Nouveau flow de calcul APL

```
Cron mensuel (1er du mois, 5h)
  ↓
Pour chaque département (971, 972, 973, 974...)
  Pour chaque spécialité prioritaire
    → Appel API FHIR PractitionerRole
    → Récupère liste praticiens + communes
    → Calcule densité pondérée par commune
    → Compare à médiane départementale
    → Met à jour CommuneAPL.boost[Specialite]
  ↓
Log des changements significatifs
```

### Bonus — vérification RPPS comme feature produit

La vérification RPPS à l'inscription devient un **badge "Vérifié"**
sur le profil — visible dans les cartes swipe.
C'est un argument de confiance fort, notamment pour les DRH d'hôpitaux.

```
✓ Profil vérifié RPPS — Ordre des MK — Actif
```

---

## 31. Module Cession & Association — feature premium avancée

### Cadre juridique
On ne parle PAS de "cession de conventionnement" — interdit.
On parle de :
- **Cession de droit d'accès à la patientèle** (conventionnée ou non)
- **Cession d'activité libérale** (matériel, bail, clientèle)
- **Entrée en association** (SCM, SEL, SCP)

### Trois cas de figure couverts

#### Cas 1 — Cession complète d'activité
Le titulaire part à la retraite ou change de vie.
Il cède l'ensemble : patientèle, bail, matériel, fichier patients.

**Informations à renseigner :**
- Localisation (commune + zone APL)
- Nombre de postes actuels
- Volume d'activité moyen sur 3 ans (en euros ou en actes)
- Surface et équipements (plateau technique, appareils)
- Bail (durée restante, loyer mensuel)
- Clientèle (nb patients actifs, âge moyen, pathologies dominantes)
- Prix demandé (indicatif, négociable)
- Opportunités de développement (zone en croissance, patientèle captive)

**Prix indicatif calculé automatiquement :**
```typescript
function estimerCession(data: CessionData): number {
  // Base : CA moyen 3 ans × coefficient (1.5 à 2.5 selon zone APL)
  const coefZone = {
    TRES_SOUS_DOTEE: 2.5,
    SOUS_DOTEE: 2.0,
    INTERMEDIAIRE: 1.7,
    NON_PRIORITAIRE: 1.5,
  }[data.zonage] ?? 1.5

  const base = data.caMoyen3ans * coefZone

  // Bonus équipements (plateau technique bien équipé)
  const bonusEquipement = data.valeurMateriel * 0.6

  // Bonus bail avantageux
  const bonusBail = data.loyerMensuel < 800 ? 15000 : 0

  return Math.round((base + bonusEquipement + bonusBail) / 1000) * 1000
}
```

#### Cas 2 — Poste d'associé (remplace un poste d'assistant)
Le titulaire cherche un associé plutôt qu'un assistant.
Plus de rétrocession — participation aux frais + droit d'entrée négociable.

**Différence avec l'assistanat :**
```
Assistant          Associé
─────────────────────────────────────────
Rétrocession %     Participation aux frais
Pas de capital     Droit d'entrée (capital)
Subordonné         Indépendant
Contrat assistanat Statut SCM / SEL / SCP
```

**Informations spécifiques :**
- Structure juridique proposée (SCM, SEL, SCP)
- Quote-part proposée (% des parts)
- Droit d'entrée demandé (négociable)
- Charges communes mensuelles (loyer, charges, secrétariat)
- Conditions de sortie (clause de rachat, préavis)

#### Cas 3 — Cession partielle d'activité
Le titulaire cède une partie de sa patientèle
(ex : il réduit son activité, garde 50% de ses patients).

---

### UI — page /cession

Accessible depuis le dashboard titulaire :
- Onglet "Cession" ou "Succession" dans le menu

**Formulaire en 4 étapes :**
```
Étape 1 : Type (Cession complète / Associé / Cession partielle)
Étape 2 : Informations cabinet (localisation, activité, équipements)
Étape 3 : Conditions financières (prix, droit d'entrée, charges)
Étape 4 : Aperçu annonce + publication
```

**Estimation automatique :**
- Après l'étape 2, afficher une fourchette de prix indicative
- "Estimation ParaBoard : 85 000 € — 120 000 €"
- Mention : "Estimation indicative — faites valider par un expert-comptable"

**Visibilité de l'annonce :**
- Visible uniquement des remplaçants/assistants connectés (pas publique)
- Option : visible uniquement des profils avec RPPS vérifié
- Option : annonce confidentielle (pas de nom de cabinet, juste la zone)

---

### Modèle de données

```prisma
model Cession {
  id              String      @id @default(cuid())
  createdAt       DateTime    @default(now())
  
  cabinetId       String
  cabinet         Profile     @relation(fields: [cabinetId], references: [id])
  
  cessionType     CessionType
  
  // Activité
  nbPostes        Int
  caMoyen3ans     Float?      // CA moyen 3 dernières années
  nbPatientsActifs Int?
  
  // Structure
  surfaceM2       Float?
  valeurMateriel  Float?
  loyerMensuel    Float?
  bailDureeRestante Int?      // en mois
  
  // Financier
  prixDemande     Float?
  prixEstime      Float?      // calculé automatiquement
  droitEntree     Float?      // pour les associations
  chargesMensuelles Float?    // pour les associations
  structureJuridique String?  // SCM, SEL, SCP
  quotePart       Float?      // % des parts pour les associations
  
  // Visibilité
  isConfidentiel  Boolean     @default(false)
  rppsRequis      Boolean     @default(true)
  
  isActive        Boolean     @default(true)
  description     String?     @db.VarChar(1000)
  opportunites    String?     @db.VarChar(500)
}

enum CessionType {
  CESSION_COMPLETE      // Cession complète d'activité
  ASSOCIATION           // Entrée en association (SCM/SEL/SCP)
  CESSION_PARTIELLE     // Cession partielle de patientèle
}
```

---

### Accès par plan
```
Gratuit    → Peut voir les annonces de cession
Premium    → Peut publier 1 annonce de cession
Boost      → Annonces illimitées + estimation automatique + mise en avant
```

---

### Mentions légales obligatoires
Sur chaque annonce de cession :
> "Cette annonce concerne la cession de droit d'accès à la patientèle
> et/ou du matériel professionnel. Elle ne constitue pas une cession
> de conventionnement au sens du Code de la Sécurité Sociale.
> Les conditions financières sont indicatives et font l'objet
> d'une négociation entre les parties.
> Faites valider les conditions par un expert-comptable et
> votre Ordre professionnel avant tout engagement."

---

### Ordre d'implémentation
- Sprint 11 : modèle Cession + migration + formulaire
- Sprint 12 : estimation automatique + page /cession
- Sprint 13 : matching cession (proposer aux remplaçants cherchant à s'installer)

---

## 32. Correction section 31 — logique économique des cessions

### La vraie logique du marché kiné (correction importante)

**ERREUR corrigée dans la section 31 :**
Le coefficient de valorisation est INVERSE à ce qui était écrit.

**Zone non prioritaire (zone 4) = valeur de cession LA PLUS HAUTE**

Raison : le conventionnement kiné est soumis à un système de
régulation à l'installation (numerus clausus géographique).
En zone non prioritaire (sur-dotée), le seul moyen légal de
s'installer est de reprendre un conventionnement existant
en remplacement 1 pour 1 d'un praticien qui cesse.

Ce mécanisme crée une rareté artificielle qui fait monter les prix.
Des collègues ont délibérément monté des activités en zone 4
dans le seul but de les revendre à des cabinets demandeurs.

**Nouveau tableau de coefficients corrigé :**
```typescript
function estimerCession(data: CessionData): number {
  const coefZone = {
    // Zone sur-dotée = conventionnement rare = prix ÉLEVÉ
    NON_PRIORITAIRE: 2.5,   // ← valeur maximale (numerus clausus)
    INTERMEDIAIRE:   1.8,   // ← valeur intermédiaire
    SOUS_DOTEE:      1.3,   // ← installation libre, moins de pression
    TRES_SOUS_DOTEE: 1.0,   // ← installation très libre, valeur minimale
  }[data.zonage] ?? 1.5

  const base = data.caMoyen3ans * coefZone
  // ... reste du calcul identique
}
```

### Impact sur l'affichage des annonces de cession

Sur les annonces de cession en zone non prioritaire :
- Badge "Conventionnement inclus" — argument de vente principal
- Mention : "Zone non prioritaire — conventionnement 1 pour 1 requis"
- Tooltip : "En zone non prioritaire, ce conventionnement est nécessaire
  pour exercer. Il constitue la valeur principale de cette cession."

Sur les annonces en zone sous-dotée :
- Pas de badge conventionnement
- Mise en avant des autres atouts : patientèle, matériel, opportunités
- Mention : "Installation libre dans cette zone — valeur patientèle et équipements"

### Wording légal adapté par zone

**Zone non prioritaire :**
> "Cession de droit d'accès à la patientèle conventionnée.
> En zone à offre élevée, ce droit d'accès constitue
> la valeur principale de la cession. Installation conditionnée
> au départ du cédant (système 1 pour 1)."

**Zone sous-dotée :**
> "Cession de patientèle et d'équipements professionnels.
> Installation libre dans cette zone — aucune condition
> de remplacement 1 pour 1 n'est requise."

---

## 33. Gestion manuelle des statuts sur le Planning Board

### Principe
Le titulaire peut modifier manuellement le statut de chaque brique
sur sa timeline, sans passer par l'admin.
C'est son outil de pilotage RH au quotidien.

### Statuts disponibles par type de poste

#### Poste du titulaire lui-même (Poste 1 auto)
```
PRESENT          → Occupé (défaut) — bleu foncé
ABSENT_CONGE     → Congé / absence planifiée — gris
ABSENT_MALADIE   → Arrêt maladie — gris haché
ABSENT_FORMATION → Formation / DPC — gris clair
```

#### Poste assistant / collaborateur
```
OCCUPE           → Occupé (défaut) — bleu moyen
PREAVIS          → En préavis — gris haché
RECHERCHE        → Recrutement en cours (annonce active) — orange
NON_COUVERT      → Poste ouvert non couvert — rouge
FERME            → Poste fermé (suspendu) — gris foncé
```

#### Brique remplaçant ponctuel
```
CONFIRME         → Remplaçant confirmé — vert
EN_ATTENTE       → Match en attente de confirmation — orange clair
ANNULE           → Mission annulée — rouge clair
```

### UI — modification du statut

**Au clic sur une brique existante :**
- Ouvre un menu contextuel (dropdown ou bottom sheet mobile)
- Options selon le type de brique
- Confirmation requise pour :
  - "Fermer ce poste" → modale "Êtes-vous sûr ? Cette action suspend le poste."
  - "Passer en préavis" → modale "Confirmer le départ de [nom] ?"
  - "Marquer comme non couvert" → pas de confirmation (action réversible)

**Au clic sur une zone vide (futur) :**
- Option "Marquer une absence" → sélecteur de dates + type d'absence
- Option "Ouvrir un poste de remplacement" → crée une annonce pré-remplie

### Statut par défaut à la création

```
Poste titulaire créé    → PRESENT automatiquement
Poste assistant créé    → OCCUPE automatiquement (à confirmer avec les dates)
Match confirmé          → CONFIRME automatiquement
Annonce publiée         → RECHERCHE automatiquement
Aucune annonce          → NON_COUVERT automatiquement
```

### Modifications base de données

```prisma
enum BriqueStatus {
  // Titulaire
  PRESENT
  ABSENT_CONGE
  ABSENT_MALADIE
  ABSENT_FORMATION
  // Assistant / Collaborateur
  OCCUPE
  PREAVIS
  RECHERCHE
  NON_COUVERT
  FERME
  // Remplaçant ponctuel
  CONFIRME
  EN_ATTENTE
  ANNULE
}

// Sur Mission — ajouter :
briqueStatus    BriqueStatus  @default(RECHERCHE)
statusUpdatedAt DateTime?     // Date du dernier changement de statut
statusNote      String?       // Note optionnelle (ex: "Congé maternité")
```

### Ouverture / fermeture d'un poste

**Fermer un poste (avec confirmation) :**
- Modale : "Vous êtes sûr de vouloir fermer ce poste ?"
- Si annonce active → propose de la désactiver en même temps
- Si match en attente → propose de notifier le remplaçant
- CabinetPost.isActive = false
- Toutes les missions liées passent en ANNULE

**Réouvrir un poste :**
- Bouton "Réactiver ce poste" dans le panel latéral
- CabinetPost.isActive = true
- Statut repassé à NON_COUVERT automatiquement

### Sprint d'implémentation
Sprint 9 — après les corrections P0/P1 en cours

---

## 34. Layout responsive Planning Board et trays

### Principe général
Le Planning Board doit être utilisable sans scroll horizontal
sur desktop ET sur mobile. Les timelines s'adaptent à l'orientation
de l'écran.

### Desktop (≥ 768px) — timelines HORIZONTALES

```
┌─────────────────────────────────────────────────────┐
│ TRAY SUPÉRIEUR — 5 dernières annonces consultées    │
├─────────────────────────────────────────────────────┤
│ Zoom [Mois] [Trimestre] [Année]    [+ Ajouter poste]│
├──────────────┬──────────────────────────────────────┤
│ Titulaire    │████████████████████████████████████  │
├──────────────┼──────────────────────────────────────┤
│ Poste 2      │████████░░░░░░░░░░[NON COUVERT]░░░░░  │
├──────────────┼──────────────────────────────────────┤
│ Poste 3      │░░░[RECHERCHE]░░░░████████████████░░  │
├──────────────┴──────────────────────────────────────┤
│ TRAY INFÉRIEUR — matchs triés par affinité          │
└─────────────────────────────────────────────────────┘
```

Règles desktop :
- La timeline tient dans la largeur de la fenêtre (pas de scroll horizontal)
- Le zoom s'ajuste automatiquement pour que 1 an tienne dans la fenêtre
- Label poste fixe à gauche (120px), timeline occupe le reste
- Scroll vertical si beaucoup de postes

### Mobile (< 768px) — timelines VERTICALES

```
┌─────────────────────┐
│ TRAY SUPÉRIEUR      │
│ [annonce] [annonce] │ ← scroll horizontal léger
├─────────────────────┤
│ ← Jan  Fév  Mar  → │ ← navigation mois (boutons prev/next)
├─────────────────────┤
│ Titulaire           │
│ [████████████████]  │ ← brique pleine largeur
├─────────────────────┤
│ Poste 2             │
│ [████][  vide  ]    │
├─────────────────────┤
│ Poste 3             │
│ [recrutement...]    │
├─────────────────────┤
│ TRAY INFÉRIEUR      │
│ [match] [match]     │ ← scroll horizontal
└─────────────────────┘
```

Règles mobile :
- Une timeline par poste, empilées verticalement
- Navigation mois par mois (boutons ← →) au lieu du zoom
- Chaque brique occupe toute la largeur proportionnellement au mois affiché
- Tap sur une brique → bottom sheet (pas de panel latéral)
- Pas de scroll horizontal — jamais

### Composant à adapter : PlanningBoard.tsx

```typescript
// Détecter le breakpoint
const isMobile = useWindowSize().width < 768

// Desktop : rendu actuel avec timelines horizontales
// Mobile : nouveau rendu avec timelines verticales empilées
return isMobile
  ? <PlanningBoardMobile posts={allRows} ... />
  : <PlanningBoardDesktop posts={allRows} ... />
```

### Tray supérieur — comportement

**Desktop :**
- Barre horizontale sous le header, au-dessus du board
- 5 items max, scrollable horizontalement si besoin
- Chaque item : nom de l'annonce + ville + date

**Mobile :**
- Même barre mais items plus compacts
- Scroll horizontal avec momentum (overflow-x: auto, -webkit-overflow-scrolling: touch)

### Tray inférieur (matchs) — comportement

**Desktop :**
- Barre horizontale fixée en bas du Planning Board
- Items triés par affinité, les meilleurs à gauche
- Hauteur 80px

**Mobile :**
- Même barre en bas de l'écran
- Items encore plus compacts (avatar + score uniquement)
- Hauteur 64px

### Ordre d'implémentation
Sprint 10 — après correction des bugs CSS et feed

---

## 35. Photo de profil — système d'upload obligatoire

### Principe
Chaque profil (cabinet ET remplaçant) doit avoir une et une seule photo.
Sans photo, le profil est incomplet et moins visible dans le feed.

### Photo cabinet (titulaire)
- Photo du cabinet de préférence (façade, salle de soin, plateau technique)
- OU photo du titulaire en situation professionnelle
- Format : carré ou portrait — recadrage automatique en carré
- Affichée sur la carte swipe côté gauche (grand format)

### Photo remplaçant
- Photo professionnelle du remplaçant
- Format : portrait — recadrage automatique en carré
- Affichée sur la fiche profil et dans le tray des matchs

### Méthodes d'import (les deux disponibles)

#### Import depuis la galerie
- Bouton "Choisir une photo" → input file classique
- Formats acceptés : JPG, PNG, WEBP
- Taille max : 5 MB avant compression

#### Prise de photo directe (mobile)
- Bouton "Prendre une photo" → input file avec capture="user"
- Ouvre la caméra frontale sur mobile
- Fonctionne nativement sur iOS et Android via le navigateur

### Traitement côté client avant upload
- Recadrage en carré avec un sélecteur visuel (crop)
- Compression automatique à 800×800px max
- Qualité JPEG : 85%
- Prévisualisation avant validation

### Stack technique
- Upload vers Supabase Storage (bucket "avatars")
- URL publique stockée dans Profile.photoUrl
- Pas de CDN externe nécessaire — Supabase Storage suffit au MVP

### Configuration Supabase Storage
```sql
-- Créer le bucket avatars (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true);

-- Politique : lecture publique
CREATE POLICY "Lecture publique avatars"
ON storage.objects FOR SELECT
TO public USING (bucket_id = 'avatars');

-- Politique : upload par utilisateur authentifié
CREATE POLICY "Upload avatar authentifié"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- Politique : remplacement par le propriétaire
CREATE POLICY "Update avatar propriétaire"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars');
```

### Variables d'environnement nécessaires
```
NEXT_PUBLIC_SUPABASE_URL=https://rwonzjbulmfegwmdaebn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### UI — composant PhotoUpload

Utilisé dans :
- Onboarding écran 2 (inscription)
- Page /compte (modification)

```tsx
// Comportement
// 1. Affiche la photo actuelle ou un placeholder avec initiales
// 2. Au clic → ouvre le sélecteur (galerie ou caméra)
// 3. Affiche un crop square interactif
// 4. Bouton "Valider" → compresse + upload → met à jour Profile.photoUrl
// 5. Feedback : loader pendant upload, toast "Photo mise à jour"
```

### Affichage si pas de photo
- Cercle coloré avec les initiales du cabinet/remplaçant
- Couleur déterminée par le hash du nom (toujours la même pour le même profil)
- Mention discrète "Ajoutez une photo pour plus de visibilité"

### Ordre d'implémentation
Sprint 10 — priorité haute (bloque la qualité visuelle du swipe)

---

## 36. Photo de profil — distinction cabinet vs remplaçant

### Remplaçant / Assistant
- **Une photo de lui/elle** — photo professionnelle
- Placeholder : "Votre photo professionnelle"
- Conseil affiché : "Une photo de vous en situation professionnelle 
  rassure les cabinets et augmente vos chances de match"
- Affiché sur : carte swipe, tray des matchs, fiche profil

### Titulaire (cabinet)
- **Une photo de son cabinet** — pas de sa tête
- Placeholder : "La photo de votre cabinet"  
- Conseil affiché : "Une photo de votre salle de soin ou plateau technique
  montre votre sérieux et attire les bons remplaçants"
- Affiché sur : carte swipe vue remplaçant, fiche cabinet publique

### Wording dans l'UI selon le profil

```
REMPLACANT / ASSISTANT :
  Label : "Ma photo professionnelle"
  Bouton : "Ajouter ma photo"
  Conseil : "Une photo de vous rassure les cabinets"

CABINET / TITULAIRE :
  Label : "Photo de mon cabinet"
  Bouton : "Ajouter la photo du cabinet"
  Conseil : "Montrez votre plateau technique ou salle de soin"
```

### Impact sur le composant PhotoUpload
Le composant reçoit une prop `profileType` et adapte
le wording en conséquence — pas de logique métier différente,
juste le texte qui change.

---

## 37. Point d'étape — logique d'interaction unifiée Planning Board

### Vision consolidée

Le Planning Board fonctionne comme un système de réservation type Booking,
dans les deux sens : le titulaire ouvre des périodes à pourvoir,
le remplaçant ouvre ses périodes de disponibilité. Les deux se rencontrent
via le matching, avec une latitude sur les dates qui entre dans le score.

---

### A. Côté TITULAIRE — clic sur une zone de la timeline

#### Cas 1 — Zone NON COUVERTE (rouge)
Clic → modale : **"Voulez-vous proposer une annonce pour cette période ?"**

```
[Oui, créer une annonce]  →  Formulaire annonce + BioTinder pré-rempli
                              avec les dates de la zone cliquée
                              Type pré-sélectionné selon le poste
                              (assistanat / remplacement / CDI / CDD)

[Non, fermer cette période] →  Modale confirmation
                                "Cette période sera marquée non disponible
                                 à la réservation. Confirmer ?"
                                → briqueStatus = FERME
```

#### Cas 2 — Zone COUVERTE (vert/bleu)
Clic → ouvre directement la fiche du remplaçant/assistant en poste
(comportement déjà existant — pas de modale de choix ici)

#### Cas 3 — Zone du TITULAIRE lui-même non couverte
Même logique que Cas 1 — il peut proposer un remplacement ponctuel
sur ses propres absences (congés, formation, maladie)

---

### B. Terminologie adaptable — libéral vs salarié

Si le titulaire est un **chef d'équipe avec salariés** (établissement),
la terminologie change automatiquement :

```
Contexte LIBÉRAL          Contexte SALARIÉ (établissement)
─────────────────────────────────────────────────────────
Remplacement              Vacation / CDD court
Assistanat                CDD
Collaboration             CDI
"Proposer une annonce"    "Ouvrir un poste"
```

**Champ à ajouter sur Profile (titulaire) :**
```prisma
isEmployeur Boolean @default(false) // true = établissement/salarié, false = libéral
```

Ce booléen détermine quel jeu de labels afficher partout dans l'UI
(formulaires, badges, Planning Board) sans dupliquer la logique.

---

### C. Côté REMPLAÇANT / ASSISTANT — sa propre timeline façon Booking

#### Nouvelle page ou section : "Mes disponibilités"
Le remplaçant a sa propre timeline (comme le titulaire) où il peut :

**Clic sur une zone non bloquée (libre) :**
Modale : **"Ouvrir cette période à la réservation ?"**
```
[Oui, je suis disponible] → Formulaire disponibilité + BioTinder
                             pré-rempli avec les dates cliquées
                             → Visible dans le feed des cabinets

[Non, bloquer ces dates]  → briqueStatus = INDISPONIBLE
                             (vacances, formation, vie perso)
                             N'apparaît jamais dans le feed cabinet
```

#### Différence remplaçant vs assistant
```
REMPLACANT : zone libre = n'importe quelle durée
ASSISTANT  : zone proposée = MINIMUM 3 MOIS
             (cohérent avec la nature longue durée du poste)
```

---

### D. Latitude sur les dates — déjà partiellement fait (section 25)

Rappel et précision : la latitude s'applique des DEUX côtés
et son croisement améliore le score :

```
Titulaire propose : 15 juin → 15 juillet, flexibilité ±1 semaine
Remplaçant dispo  : 20 juin → 20 juillet, flexibilité ±2 semaines

→ Overlap réel élargi par la flexibilité cumulée des deux parties
→ Score de dates plus généreux qu'un matching strict
```

Cette logique existe déjà dans `scoreDates()` (section 25) —
confirmé fonctionnel après correction du bug B1 de l'audit.

---

### E. Minimum 3 mois pour assistanat et CDD/CDI salarié

```prisma
// Validation côté formulaire ET API
if (missionType === "ASSISTANAT" || missionType === "POSTE_SALARIE") {
  const dureeJours = (endDate - startDate) / (1000*60*60*24)
  if (dureeJours < 90) {
    throw new Error("Un poste d'assistanat ou CDD/CDI nécessite minimum 3 mois")
  }
}
```

Affiché dans le formulaire :
> "Les postes d'assistanat ou contrats longs nécessitent 
>  une durée minimale de 3 mois"

---

### F. Modèle économique — confirmation et clarification

```
GRATUIT À VIE :
  - Remplaçant : timeline + ouverture dispo + matching
  - Assistant  : timeline + ouverture dispo + matching

PAYANT (Premium/Boost) :
  - Titulaire / Structure : Planning Board complet
    + création annonces illimitée
    + alertes préavis automatiques
    + accès aux scores remplaçants
```

Cette règle était déjà actée (section 11) — ce point d'étape
la confirme et l'étend explicitement au Planning Board lui-même :
**le Planning Board en lecture/usage basique pourrait être gratuit
pour découvrir, mais la création d'annonces depuis le board
et les fonctionnalités avancées (alertes, auto-publish) restent Premium/Boost.**

---

### G. Modèle de données — récapitulatif des ajouts nécessaires

```prisma
// Sur Profile (titulaire) — ajouter :
isEmployeur Boolean @default(false)

// Sur Mission — déjà existant (briqueStatus, dateFlexibility)
// Ajouter si besoin :
isBookingOpen Boolean @default(false) // Période ouverte à la réservation
                                        // par le remplaçant lui-même

// Validation métier (pas de nouveau champ, juste règle applicative) :
// minDuration = 90 jours si missionType IN (ASSISTANAT, POSTE_SALARIE)
```

---

### Ordre d'implémentation — Sprint 11

```
1. Modale "Proposer une annonce ?" sur clic zone non couverte (titulaire)
2. Modale "Fermer cette période ?" en alternative
3. Page/section "Mes disponibilités" timeline pour REMPLACANT/ASSISTANT
4. Modale "Ouvrir à la réservation ?" côté remplaçant
5. Toggle isEmployeur + adaptation terminologie CDI/CDD/Vacation
6. Validation minimum 3 mois pour ASSISTANAT/POSTE_SALARIE
7. Confirmation des règles d'accès gratuit/payant déjà en place
```

---

## 38. Résolution multi-missions simultanées sur l'écran swipe

### Le problème
Un titulaire peut avoir plusieurs missions ouvertes en même temps
(ex: 2 assistanats + 2 remplacements aux dates qui se chevauchent).
Le swipe classique "1 carte à la fois" devient ambigu :
sur quelle mission le swipe s'applique-t-il ?

### La solution — sélecteur de mission active

Au-dessus de la pile de cartes swipe (côté titulaire), un sélecteur
horizontal de "chips" affiche toutes les missions ouvertes :

```
[Assistanat · Dès oct. · 3 candidats] [Assistanat · Dès sept. · 1] 
[Remplacement · 5-15 oct · 2] [Remplacement · 8-30 oct · 4]
        ↑ active (bordure colorée)
```

Chaque chip affiche :
- Type de mission (Assistanat/Remplacement/Collaboration)
- Date de début (ou plage si remplacement court)
- Nombre de candidats déjà swipés à droite (badge rouge si > 0)

### Règle absolue
**Le swipe ne s'applique TOUJOURS qu'à la mission sélectionnée
dans le chip actif.** Pas d'ambiguïté possible — un swipe = 
une mission précise, jamais "toutes les missions en même temps".

### Affichage de la compatibilité sur la carte

Sur chaque carte candidat, une barre de compatibilité dates :
```
📅 Dispo 28 sept. → 15 nov.  [████████░░] Compatible
```
Calculée en temps réel entre la disponibilité du candidat
et la mission active sélectionnée (utilise scoreDates() section 25).

### Cas du candidat compatible avec plusieurs missions
Si le candidat affiché correspond aussi à une autre mission ouverte
(dates qui se chevauchent avec plusieurs missions), un badge discret
apparaît sur la carte :
```
ℹ️ Compatible aussi avec "Remplacement 8-30 oct"
```
Cliquable → bascule le sélecteur sur cette autre mission tout en
restant sur la carte du même candidat (évite de le perdre du feed).

### Le swipe RIGHT associe explicitement
```typescript
// POST /api/swipe — payload enrichi
{
  swipedProfileId: "candidat_id",
  targetMissionId: "mission_active_id", // ← la mission du chip actif
  direction: "RIGHT"
}
```

Le Swipe.swipedMissionId existant prend la valeur de la mission
sélectionnée dans le chip actif au moment du clic — pas une mission
par défaut ou ambiguë.

### Vue REMPLAÇANT — symétrie (rappel section 37)
Côté remplaçant, le principe est inversé : il swipe les annonces
des cabinets, chaque annonce appartient à une mission précise,
pas d'ambiguïté de ce côté (un remplaçant n'a qu'une seule
disponibilité ouverte à la fois, sauf cas avancé multi-créneaux V2).

### Ordre d'implémentation
Sprint 12 — composant MissionSelector + adaptation SwipeStack

---

## 39. Templates de contrats — basés sur les modèles officiels CNOMK

### Source officielle
Trois contrats-types du Conseil National de l'Ordre des Masseurs-Kinésithérapeutes :
- Contrat-type de remplacement (version 28/03/2023)
- Contrat-type d'assistanat libéral (version 15/11/2024)
- Contrat-type de collaboration libérale (version 15/11/2024)

Ces documents servent de référence structurelle pour nos templates PDF générés.
Les articles en violet dans les originaux sont des clauses à caractère réglementaire
obligatoire — ils doivent toujours apparaître dans le PDF généré.

### Contrat de remplacement — articles clés à intégrer

```
Art. 1  — Objet : identité remplacé/remplaçant + nature temporaire
Art. 2  — Durée : date début, date fin
Art. 3  — Respect des règles professionnelles (clause réglementaire)
Art. 4  — Mise à disposition des locaux et installations
Art. 5  — Indépendance / responsabilité / assurance (réglementaire)
Art. 6  — Rétrocession (% à préciser, modalités de versement)
Art. 7  — Obligations fiscales et sociales
Art. 8  — Fin du contrat (réglementaire)
Art. 9  — CLAUSE DE NON-INSTALLATION (réglementaire) —
          rayon en km + durée 2 ans (fixée par R.4321-130, non négociable)
Art. 10 — Conciliation (réglementaire, art. R.4321-99 al.2)
Art. 11 — Contentieux
Art. 12 — Absence de contre-lettre
Art. 13 — Communication à l'Ordre (réglementaire)
```

Particularité validée : le rayon (km) de la clause de non-installation est
un champ demandé dans le formulaire de contrat. La durée de 2 ans est fixée
par le code de la santé publique — non modifiable. Cette clause ne s'applique
que si le remplacement a duré au moins 3 mois consécutifs ou non.

### Contrat d'assistanat libéral — articles clés à intégrer

```
Art. 1  — Objet : exclusif de toute clientèle personnelle pour l'assistant
Art. 5  — Renégociation à 4 ans (réglementaire)
Art. 9  — Assurance / responsabilité (réglementaire)
Art. 13 — Continuité des soins (réglementaire)
Art. 15 — Cessation d'activité du titulaire : priorité de succession
Art. 16 — Association du titulaire : priorité proposée à l'assistant
Art. 17 — Résiliation : préavis 2 semaines (3 premiers mois) puis 3 mois
Art. 19 — Non-concurrence (durée + rayon paramétrables) avec dérogation
          explicite pour les remplacements dans la zone
```

### Contrat de collaboration libérale — articles clés à intégrer

```
Art. 2  — Développement de clientèle personnelle (réglementaire —
          différence fondamentale avec l'assistanat)
Art. 8  — Renégociation à 4 ans (réglementaire)
Art. 18 — Cessation d'activité du titulaire : priorité de succession
Art. 19 — Association du titulaire : priorité proposée
Art. 22 — Liberté d'établissement — rayon + durée, uniquement opposable
          en cas de rachat de la clientèle personnelle du collaborateur
          (nuance importante vs assistanat), dérogation remplacements
```

---

## 40. Correction Sprint 13 — retrait période d'essai, ajout clause non-concurrence

### Modifications demandées

Retirer la période d'essai automatique de 3 mois des templates générés.
Le contrat-type CNOMK la mentionne par défaut mais elle reste négociable —
notre génération ne doit pas l'imposer silencieusement. Elle devient un
champ optionnel à cocher, décoché par défaut.

Ajouter la clause de zone de non-concurrence paramétrable sur les trois
types de contrats : champ rayon en km, champ durée en années (suggestion
2 ans pour remplacement conformément à R.4321-130, libre pour les deux
autres types), et mention automatique de la dérogation remplacement.

### Champs de formulaire à ajouter

```
periodeEssai: boolean (false par défaut)
nonConcurrenceRayonKm: number
nonConcurrenceDureeAns: number
nonConcurrenceDerogationRemplacement: boolean (true par défaut)
```

### Mapping missionType vers template

```
REMPLACEMENT  -> Template CNOMK 28/03/2023 + clause non-installation
                 (2 ans légal, rayon paramétrable), pas de période d'essai

ASSISTANAT    -> Template CNOMK 15/11/2024 assistanat + clause
                 non-concurrence paramétrable, période d'essai optionnelle

COLLABORATION -> Template CNOMK 15/11/2024 collaboration + clause
                 liberté d'établissement, période d'essai optionnelle
```

### Ordre d'implémentation
Sprint 13 révisé — templates fidèles aux contrats CNOMK plutôt qu'un PDF
générique simplifié comme prévu initialement.

---

## 41. Séquence complète match → contrat → blocage timeline

### Vue d'ensemble du parcours

```
1. Match créé (swipe réciproque)
2. Discussion chat rapide (messagerie existante)
3. Titulaire envoie le contrat (édité depuis le template, encore modifiable)
4. Remplaçant/Assistant contre-signe le contrat
5. Titulaire coche "Réception confirmée" sur la fiche match
6. → Blocage automatique de la période dans les deux timelines
```

### Étape 3 — Envoi du contrat éditable

Le titulaire génère le contrat (section 39/40) puis peut encore l'éditer
avant envoi — ce n'est pas un PDF figé immédiatement.

```
État du contrat : BROUILLON → ENVOYE → SIGNE → CONFIRME
```

**UI sur /match/[id] :**
- Bouton "Générer le contrat" → ouvre un éditeur avec les champs pré-remplis
- Le titulaire peut modifier : taux, dates, clause non-concurrence, etc.
- Bouton "Envoyer au remplaçant" → passe l'état à ENVOYE
- Le remplaçant reçoit une notification + voit le contrat sur sa fiche match

### Étape 4 — Contre-signature

Le remplaçant/assistant voit le contrat envoyé sur /match/[id] :
- Lecture du PDF généré
- Bouton "Signer électroniquement" (signature simple V1 — nom + date + checkbox
  "J'ai lu et j'approuve", pas de signature électronique qualifiée pour le MVP)
- État passe à SIGNE

### Étape 5 — Confirmation de réception (titulaire)

Sur la fiche match, le titulaire voit un toggle :
```
[ ] Contrat reçu et confirmé
```
Quand il coche cette case :
- État passe à CONFIRME
- Déclenche le blocage automatique de la timeline (étape 6)

### Étape 6 — Blocage automatique des timelines

**Gestion des dates incomplètes ou non concordantes :**

Cas A — Dates parfaitement concordantes (mission = disponibilité)
→ Blocage automatique direct, aucune action requise

Cas B — Dates partiellement concordantes (chevauchement partiel)
→ Modale de choix pour le titulaire AU MOMENT de la confirmation :

```
"Les dates ne correspondent pas exactement.

Disponibilité du remplaçant : 20 sept. → 20 oct.
Votre mission proposée :      1 oct.  → 30 oct.

Comment voulez-vous procéder ?"

[Option 1] Couvrir toute la période demandée (1 oct. → 30 oct.)
           — bloque la timeline sur la mission complète

[Option 2] Couvrir uniquement la période confirmée (1 oct. → 20 oct.)
           — retire les semaines qui dépassent la disponibilité du remplaçant
           — la fin (21-30 oct.) reste NON COUVERT sur la timeline titulaire

[Option 3] Modifier manuellement les dates
           — ouvre des champs date début/fin éditables
```

### Modèle de données — état du contrat et blocage

```prisma
enum ContratStatus {
  AUCUN
  BROUILLON
  ENVOYE
  SIGNE
  CONFIRME
}

// Sur Match — ajouter :
contratStatus      ContratStatus @default(AUCUN)
contratData         Json?         // Paramètres du contrat (rayon, durée, etc.)
contratEnvoyeAt      DateTime?
contratSigneAt       DateTime?
contratConfirmeAt    DateTime?

// Dates effectivement bloquées (peuvent différer de mission.startDate/endDate
// si choix Option 2 ci-dessus)
blockedStartDate    DateTime?
blockedEndDate       DateTime?
```

### Impact sur les timelines après confirmation

**Timeline titulaire (Planning Board) :**
- La brique correspondante passe au statut CONFIRME (vert)
- Les dates affichées sont `blockedStartDate` → `blockedEndDate`
- Si Option 2 choisie : la portion non couverte reste visible en rouge
  juste après/avant la portion confirmée

**Timeline remplaçant/assistant (Disponibilités) :**
- La période bloquée disparaît du pool "disponible"
- Si Option 2 : le reste de sa disponibilité initiale reste ouvert
  aux autres propositions (ex: 21-31 oct. reste disponible pour un autre match)

### Notification déclenchées

```
Contrat envoyé        → notif remplaçant : "Contrat à signer disponible"
Contrat signé          → notif titulaire : "Contrat signé, confirmez la réception"
Contrat confirmé        → notif aux deux : "Mission confirmée et bloquée"
Dates partielles        → notif titulaire au moment de cocher la case (modale)
```

### Ordre d'implémentation

```
Sprint 13 (révisé) → Templates contrat + génération PDF (déjà spécifié)

Sprint 14 → Workflow contrat complet :
  - États BROUILLON/ENVOYE/SIGNE/CONFIRME sur Match
  - UI éditeur de contrat avant envoi
  - UI signature simple côté remplaçant
  - Toggle confirmation réception côté titulaire
  - Modale de résolution des dates non concordantes
  - Blocage effectif des timelines (CabinetPost + disponibilités)
```

---

## 42. Correction section 41 — double validation symétrique

### Révision de la séquence contrat

**Décisions actées après réflexion :**
- Pas de signature SVG préenregistrée — aucune valeur probante, fausse
  impression de sécurité. La case à cocher horodatée + IP est plus honnête.
- Yousign reste une feature V2/Boost (déjà actée section 19) — pas justifié
  pour le volume du MVP (coût par signature, complexité d'intégration).
- Double validation symétrique retenue — remplaçant ET titulaire valident
  activement les termes finaux, pas seulement "réception confirmée".

### Séquence corrigée

```
1. Match créé (swipe réciproque)
2. Discussion chat rapide
3. Titulaire génère et envoie le contrat (éditable avant envoi)
4. Remplaçant/Assistant SIGNE :
   case "J'ai lu et j'approuve" + nom + date + IP horodatée
   → contratStatus = SIGNE
5. Titulaire VALIDE :
   case "Je confirme les termes de ce contrat"
   (et non plus simplement "réception confirmée")
   → Si les deux cases sont cochées (remplaçant SIGNE + titulaire validé)
     → contratStatus = CONFIRME automatiquement, sans étape manuelle de plus
6. Gestion des dates non concordantes déclenchée à l'étape 5
   (modale 3 options, inchangée — voir section 41)
7. Blocage automatique des deux timelines
```

### Ce qui change par rapport à la section 41 initiale

- Suppression de la notion de "réception" — remplacée par "validation des termes"
- Les deux parties ont une responsabilité symétrique et explicite
- Le passage à CONFIRME est automatique dès que les deux validations
  sont réunies — pas de 3ème clic requis

### Modèle de données — précision

```prisma
// Sur Match — champs identiques à section 41, avec clarification :
contratStatus       ContratStatus @default(AUCUN)
contratData         Json?
contratEnvoyeAt     DateTime?

// Validation remplaçant
contratSigneAt      DateTime?
contratSigneIp      String?       // Horodatage + IP pour traçabilité

// Validation titulaire  
contratValideAt     DateTime?     // Renommé : valide, pas confirme
contratValideIp     String?

// Dates effectivement bloquées
blockedStartDate    DateTime?
blockedEndDate      DateTime?
```

### Logique de calcul du statut

```typescript
function computeContratStatus(match: Match): ContratStatus {
  if (!match.contratEnvoyeAt) return "AUCUN"
  if (!match.contratSigneAt) return "ENVOYE"
  if (!match.contratValideAt) return "SIGNE"
  return "CONFIRME"  // Les deux validations sont réunies
}
```

### Wording UI

**Côté remplaçant (étape 4) :**
> "☐ J'ai lu et j'approuve les termes de ce contrat"
> Bouton : "Signer"

**Côté titulaire (étape 5) :**
> "☐ Je confirme les termes de ce contrat"
> Bouton : "Valider"
> (n'apparaît que si le remplaçant a déjà signé)

**Une fois les deux validées — message commun affiché aux deux parties :**
> "✓ Contrat confirmé par les deux parties — la période est bloquée"

---

## 43. Correction critique — déclaration de vacance avant ouverture de poste

### Le bug de logique actuel

La brique "Présence titulaire" couvre toute la période par défaut et n'est
jamais cliquable pour créer un trou. Or la vraie logique métier est :

```
Par défaut : le titulaire/assistant est PRÉSENT en continu
              (aucune action requise, c'est l'état normal)

Pour ouvrir un remplacement : il faut D'ABORD déclarer une vacance
              (congé, formation, maladie) sur une période précise
              
Une fois la vacance déclarée : cette période devient automatiquement
              une zone "NON COUVERT" cliquable, sur laquelle on peut
              alors proposer une annonce de remplacement
```

### Flux correct en deux temps

**Temps 1 — Déclarer une vacance**

Clic sur la brique "Présence titulaire" (ou "Présence assistant") elle-même
→ ouvre un panneau "Déclarer une absence" :

```
Type d'absence :
[ ] Congés
[ ] Formation
[ ] Arrêt maladie
[ ] Autre

Période :
Du [date début] au [date fin]

[Confirmer la vacance]
```

À la confirmation :
- La période sélectionnée bascule en statut ABSENT_CONGE / ABSENT_FORMATION
  / ABSENT_MALADIE (déjà dans l'enum BriqueStatus, section 33)
- Visuellement, cette portion de la brique titulaire devient grise/hachurée
- **Cette même portion devient simultanément une zone NON_COUVERT cliquable**
  juste en dessous ou en remplacement visuel, ouvrant la possibilité
  de proposer un remplacement sur cette période précise

**Temps 2 — Proposer un remplacement sur la vacance déclarée**

Clic sur la zone NON_COUVERT créée par la vacance
→ ouvre la modale déjà spécifiée (section 37/41) :
"Voulez-vous proposer une annonce pour cette période ?"
avec les dates pré-remplies = exactement les dates de la vacance déclarée

### Correction du rendu visuel

```
Avant déclaration de vacance :
[████████████ Présence titulaire ████████████████████████]
 (brique pleine, bloc unique, cliquable pour déclarer une absence)

Après déclaration d'une vacance du 10 au 20 août :
[████ Présence ████][ NON COUVERT ][████ Présence ████████]
                     ↑ zone rouge cliquable → proposer annonce

Après qu'une annonce ait trouvé un remplaçant confirmé :
[████ Présence ████][  CONFIRMÉ   ][████ Présence ████████]
                     ↑ vert, clic ouvre la fiche remplaçant
```

### Modèle de données — précision

La brique "Présence titulaire" n'est plus une Mission unique couvrant
toute la plage — elle doit être segmentée en plusieurs Mission/blocs
quand une vacance est déclarée :

```prisma
// Le poste "self" (titulaire lui-même) génère plusieurs segments
// au lieu d'un seul bloc statique couvrant 24 mois

model Mission {
  // ... champs existants ...
  isSelfPresence  Boolean  @default(false)  // true = bloc de présence du titulaire/assistant
  // Quand isSelfPresence=true ET briqueStatus=RECHERCHE (vacance déclarée sans
  // remplaçant encore trouvé), la brique est traitée comme NON_COUVERT cliquable
}
```

### Logique de génération des segments de présence

Au lieu de générer un seul bloc statique "Présence titulaire" sur toute
la période affichée, le système doit :

1. Partir du principe : présence continue par défaut (pas de Mission stockée
   pour les périodes de présence simple — c'est l'état implicite)
2. Chercher toutes les vacances déclarées (Mission avec isSelfPresence=true)
   pour ce profil, triées par date
3. Découper visuellement la ligne en segments :
   - Segments sans vacance déclarée → bleu foncé "Présence" (non cliquable
     directement, sauf pour ouvrir le formulaire "Déclarer une absence")
   - Segments avec vacance déclarée et sans match → rouge "NON COUVERT"
     (cliquable → proposer annonce)
   - Segments avec vacance déclarée et match confirmé → vert "CONFIRMÉ"

### UI — bouton explicite pour déclarer une vacance

Pour plus de clarté que le simple clic sur la brique bleue, ajouter
aussi un bouton visible dans l'en-tête du Planning Board :

```
[+ Déclarer une absence]
```

Ce bouton ouvre directement le même panneau "Déclarer une absence"
décrit ci-dessus, sans avoir à viser précisément un clic sur la timeline.

### Ordre d'implémentation

```
Sprint 15 (nouveau, priorité haute — corrige un bug de logique fondamental) :

1. Schema : ajouter Mission.isSelfPresence Boolean @default(false)
   Migration additive

2. Logique de segmentation dans PlanningBoard.tsx :
   - Retirer le bloc statique unique "Présence titulaire" sur toute la plage
   - Calculer les segments réels depuis les vacances déclarées
   - Rendre chaque segment avec le bon statut visuel

3. Bouton "+ Déclarer une absence" dans l'en-tête
   + Panneau de formulaire (type absence + dates)
   + POST crée une Mission avec isSelfPresence=true, briqueStatus selon type

4. Clic sur un segment NON_COUVERT (issu d'une vacance) 
   → modale "Proposer une annonce ?" avec dates pré-remplies (déjà existant)

5. Appliquer la même logique sur la ligne "assistant" du Planning Board
   (un assistant peut aussi déclarer ses propres absences, visibles
   par le titulaire sur son board)
```

---

## 44. Refonte architecture — le Booking devient l'écran d'accueil

### Principe directeur

Pour le TITULAIRE, le Planning Board (`/planning`) devient l'écran
d'atterrissage après connexion — pas `/annonces`. C'est sa tour de
contrôle : il voit en un coup d'œil l'état de tout son cabinet.

Pour le REMPLAÇANT/ASSISTANT, `/disponibilites` devient symétriquement
son écran d'atterrissage.

### Ce que le titulaire doit voir immédiatement au login

```
1. Timeline complète (déjà existante)
2. État des contrats en cours — NOUVEAU
   Pour chaque poste avec un contrat en cours de processus :
   "Contrat envoyé à Kevin L. — il y a 8 jours — [Relancer]"
   "Contrat signé par Marie D. — en attente de votre validation"
3. Périodes manquantes à traiter (zones NON_COUVERT) — déjà existant
   Pour chaque zone non couverte :
   - Si une annonce existe déjà → badge "Annonce active" + 
     accès direct au swipe filtré sur cette mission
   - Si aucune annonce → bouton "Créer une fiche" 
4. Suivi des candidatures en cours (qui j'ai déjà swipé) — NOUVEAU
```

### Nouveau composant — Bandeau "Contrats en cours"

En haut du Planning Board, au-dessus de la timeline :

```
┌─────────────────────────────────────────────────────────┐
│ CONTRATS EN COURS (2)                                    │
├─────────────────────────────────────────────────────────┤
│ 🟡 Kevin L. — Contrat envoyé il y a 8 jours              │
│    [Relancer]  [Voir le contrat]                          │
├─────────────────────────────────────────────────────────┤
│ 🟢 Marie D. — A signé, en attente de votre validation     │
│    [Valider maintenant]                                   │
└─────────────────────────────────────────────────────────┘
```

### Règle de relance automatique

```
Contrat envoyé, pas de réponse après 7 jours
  → Le bandeau affiche le bouton [Relancer] en évidence (couleur warning)
  → Optionnel V2 : notification automatique au remplaçant à J+7

Contrat envoyé, pas de réponse après 30 jours
  → Proposition d'annulation automatique du match
  → Bouton [Annuler ce match] devient visible, [Relancer] reste disponible
  → Le poste redevient visible comme NON_COUVERT si annulé
```

### Modèle de données — champs de suivi

```prisma
// Sur Match — ajouter (en complément des champs section 41/42) :
derniereRelanceAt   DateTime?   // Date du dernier clic sur "Relancer"
relanceCount        Int        @default(0)

// Calcul du statut d'alerte (pas stocké, calculé à l'affichage) :
function getAlertStatus(match: Match): "ok" | "relance_conseillee" | "annulation_proposee" {
  if (!match.contratEnvoyeAt || match.contratStatus === "CONFIRME") return "ok"
  const joursDepuisEnvoi = diffEnJours(match.contratEnvoyeAt, now())
  if (joursDepuisEnvoi >= 30) return "annulation_proposee"
  if (joursDepuisEnvoi >= 7) return "relance_conseillee"
  return "ok"
}
```

### Flux complet revu — vue titulaire

```
1. Connexion → /planning (nouvel écran d'accueil)
2. Bandeau contrats en cours visible immédiatement
   → Relancer / Valider / Annuler selon le statut
3. Timeline avec zones à traiter :
   a. Zone avec annonce déjà créée
      → clic → ouvre /annonces?missionId=X (swipe filtré sur cette mission précise,
        réutilise le sélecteur de mission de la section 38, présélectionné)
   b. Zone sans annonce
      → clic → modale "Créer une fiche" → formulaire d'annonce
4. Sur l'écran swipe filtré :
   - Visible : qui j'ai déjà swipé à droite pour cette mission (tray du haut)
   - Swipe sur nouveaux profils → match ou pas
5. Si match → chat → contrat → résultat remonte automatiquement
   dans le bandeau "Contrats en cours" du Planning Board
6. Si contrat signé + validé → timeline se recolore en CONFIRME automatiquement
```

### Flux complet revu — vue remplaçant/assistant (symétrique)

```
1. Connexion → /disponibilites (nouvel écran d'accueil)
2. Bandeau "Mes candidatures en cours" :
   "Cabinet des Salines — contrat reçu, à signer"
   "Cabinet Dubien — en attente de réponse depuis 5 jours"
3. Timeline personnelle avec périodes ouvertes/bloquées
4. Clic sur une période libre → swipe les annonces compatibles
```

### Changements de routing

```
Avant :                          Après :
/ → /annonces (par défaut)       / → /planning (TITULAIRE)
                                  / → /disponibilites (REMPLACANT/ASSISTANT)

/annonces reste accessible       /annonces devient une vue secondaire,
mais n'est plus la page          accessible depuis le Planning Board
d'accueil                        avec un filtre de mission pré-appliqué
```

### Header — navigation mise à jour

```
TITULAIRE :
[Soignect] [Planning (accueil)] [+ Annonce] [Mon compte] [Déconnexion]

REMPLACANT/ASSISTANT :
[Soignect] [Disponibilités (accueil)] [Swiper les annonces] [Mon compte] [Déconnexion]
```

### Ordre d'implémentation

```
Sprint 16 (nouveau, après Sprint 15 vacances/présence) :

1. Rediriger la connexion vers /planning ou /disponibilites 
   selon profileType (au lieu de /annonces)

2. Bandeau "Contrats en cours" sur /planning et /disponibilites
   - Requête : tous les Match du profil avec contratStatus != CONFIRME
   - Calcul getAlertStatus pour chaque
   - Boutons Relancer / Valider / Annuler selon contexte

3. Bouton Relancer → met à jour derniereRelanceAt, relanceCount++
   (notification V2 — pour le MVP juste le tracking + relance manuelle 
   via le chat existant)

4. Bouton Annuler ce match → confirmation → Match supprimé ou archivé,
   statut de la Mission associée repasse à RECHERCHE ou NON_COUVERT

5. Lien depuis zone "Annonce active" du Planning Board vers 
   /annonces?missionId=X qui présélectionne ce chip dans le 
   MissionSelector existant (section 38)

6. Mise à jour navigation header selon section 44
```

---

## 45. Périmètre figé pour la suite immédiate — le tunnel complet

### Décision de cadrage

On arrête d'empiler des features. Le périmètre à finir, et UNIQUEMENT
celui-là, avant tout test utilisateur réel :

```
Connexion → Booking (Planning/Disponibilités) → clic sur zone
→ Écran swipe (Tinder) → Match → Score d'affinité DeepSeek visible
→ Proposition de contrat modifiable → envoi
```

Rien d'autre n'est prioritaire pour l'instant :
- PAS de bandeau de relance automatique (section 44, mis en pause)
- PAS de refonte de navigation globale (section 44, mis en pause)
- PAS de segmentation fine présence/vacance (section 43, mis en pause)
- PAS de double validation/signature complexe (section 42, simplifié ci-dessous)

### Le tunnel exact, étape par étape

```
1. CONNEXION
   Login → redirige vers le Booking (Planning si TITULAIRE,
   Disponibilités si REMPLACANT/ASSISTANT) — déjà fonctionnel

2. BOOKING
   Le titulaire voit sa timeline (déjà fonctionnel)
   Clic sur une zone (couverte ou non) → déjà fonctionnel,
   ouvre soit la modale "proposer une annonce", soit la fiche du
   remplaçant en poste

3. ÉCRAN SWIPE
   Depuis le Booking, clic mène à /annonces avec la mission
   présélectionnée dans le sélecteur (déjà fonctionnel — Sprint 12)
   Le titulaire swipe les profils candidats

4. MATCH
   Swipe réciproque → écran "C'est un match !" (déjà fonctionnel)
   AFFICHER CLAIREMENT le score d'affinité DeepSeek sur cet écran
   (déjà calculé en base — Swipe.affinityScore — vérifier qu'il
   est bien lu et affiché ici, pas Match.aiScore qui est l'ancien
   système, cf anomalie M1 de l'audit)

5. PROPOSITION DE CONTRAT MODIFIABLE
   Depuis /match/[id], bouton "Générer le contrat" (déjà fonctionnel
   — Sprint 13, templates CNOMK)
   Le titulaire édite les paramètres (rayon, durée, taux) avant
   de générer le PDF (déjà fonctionnel)
   
   SIMPLIFICATION pour ce périmètre : pas de workflow de signature
   complexe pour l'instant. Le bouton génère et télécharge le PDF.
   Le titulaire l'envoie par le moyen de son choix (email, WhatsApp,
   impression) en dehors de l'app pour l'instant.
   L'envoi/signature in-app (section 41/42) attendra la validation
   du tunnel de base par de vrais utilisateurs.
```

### Ce qui doit être vérifié/corrigé avant de considérer ce tunnel "fini"

```
[ ] Le score d'affinité DeepSeek (Swipe.affinityScore, 0-100) est bien
    celui affiché sur l'écran "C'est un match !" — pas Match.aiScore
    (corriger l'anomalie M1 de l'audit si pas déjà fait)

[ ] Le sélecteur de mission (section 38) fonctionne correctement
    quand on clique depuis une zone du Booking — la mission cliquée
    doit être celle présélectionnée dans le swipe

[ ] La génération de contrat fonctionne de bout en bout en conditions
    réelles (déjà testé visuellement — à reconfirmer après les derniers
    correctifs AUTH_SECRET)

[ ] Aucune étape du tunnel ne casse sur une page blanche ou un 404
```

### Prochaine étape après validation de ce tunnel

Une fois ce tunnel testé par 2-3 vrais cabinets pilotes (toi inclus),
on revient avec des retours d'usage réels pour décider si les sections
41-44 (workflow contrat avancé, relances, navigation Booking-first)
sont vraiment nécessaires ou si le tunnel simple suffit pour convertir.

**Pas de nouveau sprint de fonctionnalité tant que ce test n'est pas fait.**

---

## 46. Direction design — timeline du Planning Board

### Périmètre
Cette passe design concerne UNIQUEMENT la timeline (PlanningBoard.tsx,
SelfTimelineRow, TimelineRow et leurs briques). Ne pas toucher au reste
de l'application (swipe, formulaires, header) dans ce sprint.

### Palette (tokens nommés)
```
--lagon-profond:  #0B3D5C   /* ligne "aujourd'hui", ancrage temporel */
--sable-chaud:    #F2E8D5   /* fond de la timeline, pas blanc clinique */
--corail-signal:  #E8633D   /* statut NON_COUVERT — alerte douce */
--vert-palme:     #3D7A5C   /* statut CONFIRME */
--bleu-marine:    #1B3A5C   /* statut PRESENT (titulaire) */
--ambre:          #D9A441   /* statut PREAVIS / RECHERCHE */
```

### Typographie
- Labels de mois (déc. 25, janv. 26...) : police condensée à fort
  contraste, espacement large entre lettres — évoque une plaque
  gravée de cabinet médical, pas un calendrier générique
- Libellés de statut sur les briques (Présence, Confirmé...) :
  face utilitaire légère, taille réduite, lettres bien lisibles
  même sur petites briques

### Signature element — la ligne "aujourd'hui" comme repère vivant
Au lieu d'un simple trait rouge statique vertical :
- Ligne fine en lagon profond avec une légère animation de pulsation
  douce (opacity 0.6 → 1 → 0.6, durée ~3s, infinie, easing doux)
- Petit marqueur circulaire qui flotte verticalement de quelques px
  au niveau de la ligne (référence discrète à la marée/l'eau,
  jamais littérale — pas d'icône vague ou palmier)
- Au survol de la ligne : tooltip "Aujourd'hui — [date complète]"
- Cette ligne reste l'élément le plus visuellement chargé de l'écran,
  tout le reste de la timeline doit rester sobre en comparaison

### Briques de statut — révision visuelle
- Coins arrondis légers (pas le rounded-lg Tailwind par défaut —
  rayon spécifique 6px, cohérent avec l'esprit "carnet" pas "app SaaS")
- Transition douce au survol (légère élévation + assombrissement 5%)
- Le statut NON_COUVERT n'utilise PAS de rouge alarmant — le corail
  signal est une alerte qui invite à l'action, pas une erreur

### Ce qui reste inchangé (restraint)
- La structure de la grille (LABEL_WIDTH, TRACK_HEIGHT) ne change pas
- Les interactions au clic restent identiques (déjà fonctionnelles)
- Pas de nouvelle animation sur les briques elles-mêmes — la
  signature est uniquement la ligne "aujourd'hui"
- Le reste de l'application (header, swipe, formulaires) garde
  sa palette Tailwind actuelle pour cette passe

### Accessibilité
- Contraste vérifié : sable chaud (#F2E8D5) sur lagon profond (#0B3D5C)
  et inversement — ratio AA minimum
- Focus clavier visible sur chaque brique cliquable
- L'animation de pulsation respecte prefers-reduced-motion

---

## 47. Timeline — système d'urgence temporelle et pilotage proactif

### Principe : la timeline comme outil d'action, pas de décoration

Chaque zone de la timeline doit communiquer simultanément :
1. Quel est l'état actuel de ce poste/créneau ?
2. Est-ce que quelque chose doit être fait, et quand ?

### Graduation d'urgence visuelle — zones non couvertes

L'intensité visuelle d'une zone NON COUVERTE augmente
proportionnellement à la proximité dans le temps :

```
Non couvert dans > 3 mois   → Orange pâle, discret
                                "Pas urgent, mais à surveiller"

Non couvert dans 1-3 mois   → Orange vif, bordure plus marquée
                                "À traiter dans les prochaines semaines"

Non couvert dans < 1 mois   → Rouge corail, bordure pulsante légère
                                "Critique — agir maintenant"

Non couvert ET date passée  → Rouge foncé hachuré
                                "Découvert — rupture de couverture"
```

### Code couleur complet et lisible

```
Bleu marine foncé  → Présence confirmée (titulaire lui-même)
Vert palme         → Remplaçant/assistant CONFIRMÉ (contrat signé)
Orange doux        → En cours de recrutement (annonce active, pas encore de match)
Orange vif         → Match en attente de signature (contrat envoyé)
Orange pâle        → Non couvert > 3 mois (anticiper)
Orange vif         → Non couvert 1-3 mois (agir bientôt)
Rouge corail pulsant → Non couvert < 1 mois (urgent)
Gris hachuré       → Fermé volontairement (vacances déclarées)
Gris foncé         → Poste fermé définitivement
```

### Signature "aujourd'hui" comme flèche de progression

La ligne "aujourd'hui" n'est pas un séparateur passif — c'est une
FLÈCHE DE PROGRESSION stylisée qui sépare le passé du futur :

```
Passé (à gauche)           │▶  Futur (à droite)
────────────────────────── │▶ ──────────────────────────
[██ Présence ███][ Fermé ] │▶ [NON COUVERT !!!][CONFIRMÉ]
                           │▶
                     Aujourd'hui
```

Visuellement :
- Trait vertical fin en lagon profond (#0B3D5C)
- Petit triangle/flèche pointant vers la droite au centre de la ligne
- Label "auj." flottant au-dessus, discret mais distinct
- Animation : pulsation très légère (pas clignotant — doux)
- prefers-reduced-motion : animation désactivée, trait statique

### Échelles de zoom et densité d'information

```
Vue 3 mois  → Briques larges, libellés complets visibles,
               dates exactes affichées sur chaque brique
               Idéal : pilotage opérationnel immédiat

Vue 1 an    → Briques condensées, libellés abrégés,
               la graduation d'urgence (couleurs) prime
               Idéal : vision stratégique de l'année

Vue 3 ans   → Très condensé, juste les couleurs et les grandes masses
               Idéal : planification long terme (assistanats)
```

### Système de rappel — alertes dans l'interface (pas email)

Pas de notification automatique pour le MVP — à la place,
un bandeau d'alerte contextuel en haut du Planning Board
qui se calcule au chargement de la page :

```
Si une zone non couverte se trouve dans < 30 jours :
→ Bandeau rouge discret en haut : 
  "⚠ Poste [label] non couvert dans [N] jours — Trouver un remplaçant"
  [Voir le poste]

Si une zone non couverte se trouve dans < 90 jours :
→ Bandeau orange :
  "📅 Poste [label] sans couverture confirmée dans [N] semaines"
  [Voir le poste]

Si tout est couvert :
→ Pas de bandeau (ne pas afficher du vert inutilement)
```

Ce bandeau est calculé côté client au chargement, pas en base de données.
Pas de table "alertes", pas de cron — juste un calcul sur les données
déjà présentes dans les posts et missions.

### Cas du cabinet avec plusieurs kinés (4 postes)

Si 2 assistants sur 4 finissent leur contrat en même temps :
- Les deux postes passent en NON_COUVERT avec graduation d'urgence
- Le bandeau d'alerte en liste les deux :
  "⚠ 2 postes non couverts dans moins de 3 mois"
- La vue "1 an" permet de voir d'un coup d'œil que la moitié
  du cabinet est en rouge — signal immédiat, impossible à rater

### Remplaçant — même logique, vue personnelle

Sur /disponibilites, le remplaçant voit sa propre timeline avec :
- Ses vacances déclarées (gris hachuré)
- Ses périodes confirmées (vert palme)
- Ses périodes ouvertes sans réponse (orange → rouge selon délai)
- Une alerte si une période ouverte > 3 semaines sans match :
  "📅 Toujours sans réponse pour [période] — Voir les annonces compatibles"
  [Voir les annonces]

### Ordre d'implémentation

Ce sprint (design + logique d'alerte) s'applique sur :
1. PlanningBoard.tsx — graduation couleurs + flèche "aujourd'hui"
   + bandeau d'alerte calculé côté client
2. DisponibilitesBoard.tsx — même logique pour le remplaçant
3. Zoom 3 ans à ajouter en option (en plus de Mois/Trimestre/Année)

Attendre que l'audit Opus soit terminé et le CSS stabilisé
avant de lancer ce sprint.

---

## 48. Annulation unilatérale d'un match depuis le tray

### Principe
Un match ne vaut pas engagement. Avant qu'un contrat soit confirmé
(contratStatus = CONFIRME), chacune des deux parties peut annuler
le match unilatéralement, sans avoir à se justifier.

### UI — dans le tray du bas (MatchTray)

Au clic sur un avatar dans le tray → ouvre la fiche du match.
En bas de cette fiche, ajouter :

```
[Envoyer un message]  [Voir le contrat]
[Annuler ce match]  ← bouton discret, texte rouge, pas rouge vif
```

Confirmation avant annulation :
"Êtes-vous sûr de vouloir annuler ce match ?
Cette action est irréversible. Vous pourrez re-swiper ce profil plus tard."
[Annuler]  [Confirmer l'annulation]

### Règles métier

- Annulation possible UNIQUEMENT si contratStatus != CONFIRME
  Si le contrat est déjà confirmé → bouton masqué, pas juste désactivé
  (on ne peut pas défaire un engagement contractuel depuis l'app)

- Quand le match est annulé :
  * Le Swipe correspondant est supprimé ou marqué annulé
  * Le Match est supprimé
  * La Mission/période redevient disponible dans les deux timelines
  * L'autre partie reçoit une notification discrète :
    "Un match a été annulé — le poste est à nouveau disponible"
    (pas de nom affiché, juste l'information)

### API

```
DELETE /api/match/[matchId]
- Vérifie que l'utilisateur fait partie du match
- Vérifie que contratStatus != CONFIRME
- Supprime le Match
- Remet briqueStatus = RECHERCHE sur la Mission associée si elle existe
- Retourne 200
```

### Ordre d'implémentation
Sprint suivant — simple et rapide (1 route DELETE + UI dans le tray)

---

## 49. Architecture notifications — roadmap

### Décision actée

L'architecture Next.js actuelle supporte les notifications
sans réécriture. On procède par paliers.

### Palier 1 — Email (MVP, avant lancement)

Outil : Resend (gratuit jusqu'à 3 000 emails/mois)
Sprint estimé : 3-4h

Événements à notifier par email :
- Nouveau match reçu
- Contrat envoyé par le titulaire (→ remplaçant)
- Contrat signé par le remplaçant (→ titulaire)
- Relance manuelle depuis le tray (→ autre partie)
- Match annulé (→ autre partie)
- Rappel J+7 : contrat envoyé sans réponse
- Rappel J+30 : zone non couverte sans annonce

### Palier 2 — PWA + Push Notifications (post-pilots)

Next.js supporte nativement les Progressive Web Apps.
L'utilisateur installe l'app depuis le navigateur mobile
(sans passer par le Play Store) et reçoit des push
notifications comme une app native.

Ce qu'il faut ajouter :
- manifest.json (icône, nom, couleurs)
- Service worker (next-pwa ou custom)
- Clé VAPID pour les Web Push
- Table Subscription en DB (endpoint + keys par device)
- Route POST /api/push/subscribe

Aucune réécriture de l'app existante.
Délai estimé : 1-2 sprints dédiés.

### Palier 3 — App native (si besoin avéré)

React Native ou capacitor.js (wrapper de l'app web).
Justifié uniquement si les pilotes se plaignent
massivement de la PWA.
Ne pas anticiper — décider sur retour d'usage réel.

### Types de notifications par priorité

```
CRITIQUE (immédiat) :
  Nouveau match
  Contrat signé → validation requise
  Zone non couverte dans < 7 jours

IMPORTANT (dans la journée) :
  Contrat envoyé → à signer
  Match annulé
  Nouveau message reçu

RAPPEL (hebdomadaire) :
  Zone non couverte dans < 30 jours sans annonce
  Contrat envoyé depuis > 7 jours sans réponse
  Profil incomplet (pas de photo, pas de bioTinder)
```

### Ordre d'implémentation recommandé

```
Avant lancement Vercel  → Rien (pas bloquant pour les tests pilotes)
Après premiers retours  → Email Resend (Palier 1)
Après 50 utilisateurs   → PWA + Push (Palier 2)
Jamais par défaut       → App native (Palier 3)
```

---

## 50. Numéro de téléphone à l'inscription + canal WhatsApp

### Décision actée

Ajouter le numéro de téléphone portable (avec indicatif pays)
comme champ obligatoire à l'inscription, dès le MVP.

Raisons :
- Canal WhatsApp Business API pour les notifications
- Identification fiable des professionnels de santé
- Cohérent avec l'usage réel en Guadeloupe
  (WhatsApp = outil pro principal des kinés)

### Champ à ajouter

```prisma
// Sur User — ajouter :
phone        String?   // format E.164 : +590696XXXXXX
phoneCountry String?   // code pays ISO : "GP", "FR", "MQ"...
phoneVerified Boolean  @default(false)
```

### UI à l'inscription (écran 2 — identité)

Champ téléphone avec sélecteur d'indicatif pays :
```
[🇬🇵 +590] [696 XX XX XX]
```

Indicatifs pré-sélectionnés en priorité :
+590 Guadeloupe (défaut)
+596 Martinique
+594 Guyane
+262 Réunion/Mayotte
+33  France métropolitaine
+ Autres (liste complète)

Format stocké : E.164 international
Exemple : +590696123456

Validation : regex E.164, 8-15 chiffres après l'indicatif

### Canal WhatsApp Business API

Outil recommandé : Twilio WhatsApp API ou Meta Cloud API directe

Cas d'usage MVP :
- Nouveau match → "Vous avez un nouveau match sur Soignect !"
- Contrat à signer → "Un contrat vous attend, signez-le ici"
- Relance → "Votre zone est non couverte dans X jours"

Coût Twilio WhatsApp : ~0.05€ par message envoyé
Pour 100 utilisateurs actifs, 5 messages/mois = 25€/mois

### Ordre d'implémentation

```
Sprint prochain  → Ajouter phone + phoneCountry sur User
                   Champ téléphone dans le formulaire d'inscription
                   et dans /compte
                   Migration : npx prisma db push

Après pilots     → Intégration WhatsApp Business API (Twilio)
                   Templates de messages pré-approuvés par Meta
```

### Note importante

Les messages WhatsApp Business doivent utiliser des templates
approuvés par Meta pour les messages initiés par l'entreprise
(notifications). La procédure d'approbation prend 1-3 jours.
Les messages en réponse à un message de l'utilisateur sont libres.

---

## 50b. Correction section 50 — SMS prioritaire sur WhatsApp

### Canal retenu pour le MVP : SMS

Taux d'ouverture SMS : 98% dans les 3 minutes.
Supérieur à WhatsApp (70%) et email (20-30%).
Natif sur tout téléphone, sans app requise.
Pas d'approbation Meta nécessaire.

Outil : Twilio SMS (ou Vonage/OVH SMS pour tarifs DOM)
Coût estimé : ~0.07€/SMS

### WhatsApp — relégué au Palier 2

WhatsApp Business API reste pertinent à terme
(canal déjà utilisé par les syndicats et groupes pro)
mais la complexité d'approbation Meta le rend moins
adapté au MVP. À intégrer après les premiers pilotes.

### Variables d'environnement à ajouter

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
```

### Messages SMS prioritaires (MVP)

```
Nouveau match :
"[Soignect] Nouveau match ! Connectez-vous pour voir le profil."

Contrat à signer :
"[Soignect] Un contrat vous attend. Signez-le sur soignect.fr"

Relance J+7 :
"[Soignect] Votre zone est non couverte dans X jours. 
Voir les candidats : soignect.fr"

Match annulé :
"[Soignect] Un match a été annulé. 
Le poste est à nouveau disponible."
```

Tous les SMS incluent un lien direct vers l'app.
Pas de réponse attendue (SMS unidirectionnel pour le MVP).

---

## 51. Canal de notification — double canal WhatsApp + Email

### Décision finale

Double canal complémentaire :

```
WhatsApp  → Notifications urgentes, temps réel
            Gratuit si l'utilisateur initie le contact
            Taux d'ouverture ~70%, immédiat

Email     → Récapitulatifs, documents, traçabilité
            Resend gratuit jusqu'à 3 000 emails/mois
            Taux d'ouverture ~25%, moins urgent
```

### Répartition par type d'événement

```
WhatsApp (urgent/temps réel) :
  - Nouveau match reçu
  - Contrat envoyé → à signer
  - Match annulé
  - Zone non couverte dans < 7 jours
  - Relance manuelle

Email (récapitulatif/document) :
  - Confirmation d'inscription
  - Contrat PDF en pièce jointe
  - Récapitulatif hebdomadaire des matchs
  - Rappel J+7 contrat sans réponse
  - Rappel J+30 zone non couverte
```

### Flow WhatsApp gratuit — utilisateur initie

Pour rester dans la fenêtre gratuite de 24h :
1. À l'inscription, inviter l'utilisateur à envoyer
   "Bonjour" au numéro WhatsApp Business de Soignect
   (QR code ou lien wa.me/+590XXXXXXX)
2. Cette fenêtre de 24h est gratuite
3. Elle se renouvelle à chaque message entrant
4. Les templates approuvés Meta (payants) uniquement
   pour les notifications sortantes sans message entrant récent

### Champs à ajouter à l'inscription

```
Sur User :
  phone           String?   // numéro E.164 : +590696XXXXXX
  phoneCountry    String?   // "GP", "FR", "MQ"...
  whatsappOptIn   Boolean   @default(false)  // consentement explicite
  emailOptIn      Boolean   @default(true)   // coché par défaut

Sur Profile :
  notifWhatsapp   Boolean   @default(true)
  notifEmail      Boolean   @default(true)
```

### Outils

```
WhatsApp  → Meta Cloud API (gratuit, direct)
            ou Twilio WhatsApp (plus simple à coder)
Email     → Resend (gratuit 3 000/mois, API simple)
```

### Ordre d'implémentation

```
Sprint prochain  → Champ téléphone + consentement à l'inscription
                   Email de confirmation via Resend (1h)

Post-pilots      → WhatsApp Business API
                   Templates approuvés Meta
                   Flow QR code à l'inscription
```

---

## 55. Clic sur un poste — menu à trois choix + attribution post-signature

### Menu au clic sur un poste (Planning Board titulaire)

Actuellement le clic ouvre une modale binaire (créer annonce / fermer).
Il faut un menu à trois choix clair :

```
Clic sur un poste (occupé ou vide) →

[1] Poser une annonce
    → Ouvre le formulaire de création d'annonce
    → Pré-rempli avec les dates de la zone cliquée

[2] Déclarer une présence confirmée
    → Le kiné actuellement en poste est présent sur une plage
      donnée, sans passer par le système d'absence
    → Utile quand on veut simplement enregistrer qui est là
      sans notion de vacance ni de recherche de remplaçant
    → Champs : nom du praticien en poste (si pas encore lié),
      date début, date fin
    → Statut : CONFIRME directement, sans passer par un match

[3] Retirer ce poste
    → Supprime le CabinetPost (avec confirmation)
    → Le poste disparaît du Planning Board
    → Différent de "Fermer cette période" — ici c'est
      la suppression définitive de la ligne entière
```

### Attribution automatique post-signature

Quand un contrat est signé (contratStatus = CONFIRME, section 41-42),
le système doit automatiquement proposer d'attribuer la période
négociée à l'un des plannings disponibles du titulaire — pas
seulement au poste d'origine de l'annonce.

**Cas d'usage concret :**
Le titulaire a 3 postes (lui-même, Assistant A, Assistant B).
Il publie une annonce liée au poste "Assistant A" en vacances.
Un remplaçant matche et signe. Mais entre-temps, c'est finalement
le poste "Assistant B" qui a une période libre plus urgente,
ou le titulaire préfère affecter ce remplaçant ailleurleurs.

**Flow proposé :**

```
1. Contrat signé (les deux parties ont validé — section 42)
2. Modale automatique s'affiche au titulaire :
   "Contrat signé avec [Nom] pour la période [dates].
    À quel planning souhaitez-vous l'attribuer ?"
   
   Liste de tous les CabinetPost du titulaire, y compris :
   - Le poste d'origine de l'annonce (présélectionné par défaut)
   - Les autres postes, QU'ILS AIENT une absence déclarée ou non
   - Un poste sans absence déclarée mais compatible en dates
     affiche un avertissement : "Ce poste n'a pas de vacance
     déclarée sur cette période — confirmer l'attribution
     créera un remplacement ponctuel à cet endroit"

3. Le titulaire choisit → le contrat/mission est rattaché
   à ce CabinetPost précis
4. La timeline du poste choisi se recolore en CONFIRME
   sur la période concernée
```

### Modèle de données

```prisma
// Sur Mission — déjà existant cabinetPostId, le réutiliser :
// Le rattachement se fait/modifie à ce moment précis,
// pas uniquement à la création de l'annonce

// Nouvelle info sur Match ou Mission pour tracer le choix :
attributedPostId String?  // CabinetPost choisi après signature
                          // (peut différer du poste d'origine)
```

### UI — modale d'attribution

```
┌─────────────────────────────────────────┐
│ Contrat signé avec Kevin L.              │
│ Période : 15 juil. → 30 juil. 2026       │
│                                          │
│ Attribuer à quel poste ?                │
│                                          │
│ ○ Poste "Assistant A" (poste d'origine) │
│   Vacance déclarée sur cette période ✓  │
│                                          │
│ ○ Poste "Assistant B"                   │
│   ⚠ Pas de vacance déclarée ici          │
│                                          │
│ ○ Ma propre présence (titulaire)        │
│   ⚠ Pas de vacance déclarée ici          │
│                                          │
│ [Confirmer l'attribution]                │
└─────────────────────────────────────────┘
```

### Ordre d'implémentation

```
Sprint suivant :
1. Menu à 3 choix au clic sur un poste (remplace la modale binaire actuelle)
2. Formulaire "Déclarer une présence confirmée"
3. Bouton "Retirer ce poste" avec confirmation
4. Modale d'attribution automatique déclenchée à contratStatus=CONFIRME
   (dépend du workflow contrat complet — sections 41-42,
   à vérifier si déjà codé ou encore à faire)
```

---

## 56. Création de poste — date d'occupation manuelle

### Problème actuel

Quand un titulaire crée un poste (assistant/collaborateur), 
le système semble forcer la période de présence à démarrer 
à la date du jour de création. Cela ne reflète pas la réalité :
un assistant peut être en poste depuis plusieurs mois déjà 
au moment où le titulaire configure enfin son Planning Board 
sur Soignect.

### Correction demandée

Lors de la création d'un poste (formulaire "Ajouter un poste"),
ajouter un champ pour préciser la date de début d'occupation
réelle, qui peut être dans le passé :

```
Ajouter un poste

Libellé du poste : [Marion]
Type : [Assistanat (long terme)]

Depuis quand ce poste est-il occupé ? 
[Date début] — peut être antérieure à aujourd'hui
  Exemple : le poste existe depuis le 1er janvier 2025,
  même si on le configure dans Soignect en juillet 2026

Jusqu'à quand (si connu) ?
[Date fin] — optionnel, laisser vide si indéterminée
```

### Impact sur le modèle de données

```prisma
// Sur CabinetPost — le poste lui-même n'a pas de dates
// C'est la Mission liée (isSelfPresence ou standard) 
// qui porte les dates réelles d'occupation

// Au moment de la création du poste, créer automatiquement
// une Mission "présence" avec :
startDate: <date choisie par l'utilisateur, peut être passée>
endDate: null (indéterminée) ou date choisie
briqueStatus: CONFIRME (le poste est occupé, pas en recherche)
```

### Comportement attendu sur la timeline

Si le titulaire déclare qu'un assistant est en poste depuis 
le 1er janvier 2025 :
- La timeline affiche une brique CONFIRME (verte) démarrant 
  au 1er janvier 2025, pas à la date de création dans l'app
- Si l'utilisateur navigue vers les mois passés (zoom Année/2ans), 
  il voit l'historique réel du poste, pas un vide artificiel

### Ordre d'implémentation

```
Sprint suivant :
1. Ajouter les champs "Date de début d'occupation" et 
   "Date de fin (optionnelle)" dans AddPostForm
2. À la création du poste, créer automatiquement la Mission 
   de présence associée avec ces dates et briqueStatus=CONFIRME
3. Vérifier que la timeline affiche correctement cette période, 
   y compris si elle est antérieure à la date du jour
```

---

## 57. Correction section 56 — trois modes de fin de poste + gestion du préavis

### Trois modes de déclaration de la fin d'occupation

Lors de la création d'un poste occupé (section 56), au lieu 
d'un simple champ "date de fin optionnelle", proposer 3 modes 
clairs :

```
Comment se termine cette occupation ?

[Mode A] Date de fin connue
         → Sélecteur de date : "01/09/2026"

[Mode B] Durée prévue
         → Champ numérique + unité : "6 mois" / "3 semaines"
         → Calcule automatiquement la date de fin depuis 
           la date de début

[Mode C] Durée indéterminée
         → Pas de date de fin pour l'instant
         → La brique reste CONFIRME sans fin visible
         → Un mécanisme de préavis se déclenche plus tard 
           (voir ci-dessous)
```

### Déclaration du préavis en mode "Durée indéterminée"

Quand un poste est en Mode C (indéterminé), le titulaire doit 
pouvoir, PLUS TARD, cliquer sur la brique CONFIRME et déclarer 
que l'assistant/collaborateur a posé son préavis :

```
Clic sur une brique CONFIRME (poste en durée indéterminée)
→ Menu contextuel :
  "Cette personne a posé son préavis"
  → Sélectionner la durée de préavis :
    [3 mois] (standard assistanat/collaboration)
    [1 mois] (standard remplacement)
    [Personnalisé] → champ libre en jours/semaines/mois
  → Date de départ du préavis = aujourd'hui (ou date à préciser)
  → Calcule automatiquement : date de fin = départ + durée préavis
  → La brique se scinde : CONFIRME jusqu'à la date de fin 
    du préavis, puis PREAVIS (gris hachuré) sur la période 
    de préavis elle-même, puis NON_COUVERT après
```

### Nuance sur la durée du préavis standard

```
Assistanat / Collaboration : préavis standard 3 mois
Remplacement               : préavis standard 1 mois
Période d'essai (si applicable) : préavis réduit 2 semaines à 1 mois,
  selon ce qui est stipulé dans le contrat CNOMK (section 39 —
  déjà documenté : 2 semaines dans les 3 premiers mois du contrat,
  puis 3 mois au-delà pour l'assistanat/collaboration)
```

Cette règle rejoint ce qui est déjà spécifié dans les templates 
de contrat CNOMK (section 39) — la cohérence entre le Planning 
Board et les contrats générés doit être vérifiée : le préavis 
déclaré sur la timeline devrait correspondre à celui écrit 
dans le contrat signé, si un contrat existe pour ce poste.

### Modèle de données — extension

```prisma
// Sur Mission (ou un nouveau champ dédié) — ajouter :
preavisDeclareAt   DateTime?  // Date à laquelle le préavis a été déclaré
preavisDureeJours  Int?       // Durée du préavis en jours
// endDate est recalculée automatiquement = preavisDeclareAt + preavisDureeJours
```

### UI récapitulative — les 3 modes au clic sur un poste vide/à créer

```
[Mode A] "Date de fin connue" → date picker
[Mode B] "Durée prévue" → nombre + unité (jours/semaines/mois)
[Mode C] "Durée indéterminée" → pas de fin, préavis déclarable plus tard
```

### Ordre d'implémentation

```
Sprint suivant (fusionné avec section 56) :
1. Formulaire "Ajouter un poste" avec les 3 modes de fin
2. Menu contextuel "Poser un préavis" sur une brique CONFIRME 
   en durée indéterminée
3. Calcul automatique de la scission CONFIRME → PREAVIS → NON_COUVERT
4. Cohérence à vérifier avec les durées de préavis des contrats 
   CNOMK générés (section 39)
```

---

## 58. Attribution candidat à slot — annonces multi-postes

### Problème identifié

Une annonce peut concerner plusieurs personnes simultanément
(ex: "Rempla pour deux personnes août 2026"). Actuellement,
rien ne permet d'attribuer précisément quel candidat va sur
quel slot disponible au sein de cette même annonce.

### Modèle actuel (rappel)

```
Mission.maxCandidates : Int @default(10)  // déjà existant
```

Ce champ existe mais ne structure pas les slots individuellement —
il limite juste le nombre de candidatures possibles sur l'annonce,
sans notion de slot nommé ou distinct.

### Correction proposée

Quand une annonce a `maxCandidates > 1`, elle doit se comporter
comme plusieurs slots identifiés, pas un pool indifférencié :

```
Annonce "Rempla pour deux personnes août 2026"
  maxCandidates = 2
  
  → Slot 1 : [à pourvoir]
  → Slot 2 : [à pourvoir]

Quand un match est confirmé pour cette annonce :
  → Le titulaire choisit à quel slot (1 ou 2) attribuer 
    le candidat confirmé
  → Le slot passe à "pourvu"
  → L'annonce reste visible/active pour le(s) slot(s) 
    restant(s) tant que tous ne sont pas pourvus
```

### Modèle de données — extension

```prisma
// Nouveau modèle pour gérer les slots d'une annonce multi-postes
model MissionSlot {
  id          String   @id @default(cuid())
  missionId   String
  mission     Mission  @relation(fields: [missionId], references: [id])
  slotNumber  Int      // 1, 2, 3...
  label       String?  // Optionnel : "Matin" / "Après-midi" / nom du praticien
  matchId     String?  // Match attribué à ce slot, si pourvu
  match       Match?   @relation(fields: [matchId], references: [id])
  status      SlotStatus @default(OUVERT)
}

enum SlotStatus {
  OUVERT
  POURVU
}
```

À la création d'une Mission avec maxCandidates > 1, générer
automatiquement N MissionSlot (N = maxCandidates).

### UI — attribution du slot

Quand un match passe à contratStatus=CONFIRME sur une annonce
multi-slots, une modale s'affiche :

```
┌─────────────────────────────────────────┐
│ Contrat signé avec Kevin L.              │
│ Annonce : "Rempla pour deux personnes"   │
│                                          │
│ À quel emplacement l'affecter ?         │
│                                          │
│ ○ Slot 1 — encore disponible            │
│ ○ Slot 2 — encore disponible            │
│                                          │
│ [Confirmer]                              │
└─────────────────────────────────────────┘
```

Une fois tous les slots pourvus, l'annonce se désactive
automatiquement (isActive = false) et disparaît du feed.

### Affichage du statut sur la carte swipe

```
"Rempla pour deux personnes août 2026"
1 poste pourvu · 1 poste disponible
```

### Ordre d'implémentation

```
Sprint suivant :
1. Ajouter le modèle MissionSlot (migration additive)
2. Génération automatique des slots à la création d'annonce 
   multi-postes
3. Modale d'attribution de slot au moment de la confirmation 
   de contrat
4. Affichage "N pourvus / M disponibles" sur la carte annonce
5. Désactivation automatique de l'annonce quand tous les slots 
   sont pourvus
```

---

## 59. Internationalisation — roadmap future (i18n)

### Décision de principe

Prévoir l'architecture pour l'internationalisation, mais 
NE PAS l'implémenter maintenant. C'est un chantier post-MVP,
après validation du produit en français avec les premiers 
utilisateurs réels.

### Langues cibles identifiées

```
Français   → langue principale (MVP actuel)
Anglais    → international, Caraïbes anglophones
Espagnol   → Caraïbes hispanophones (Cuba, Rép. Dominicaine, 
              proximité Guadeloupe/Martinique)
Roumain    → diaspora médicale roumaine en France
Portugais  → Guyane (frontière Brésil), diaspora
Italien    → diaspora médicale italienne en France
```

### Pourquoi ces langues précisément

Les professionnels de santé européens (roumains, italiens, 
portugais) sont statistiquement nombreux à venir exercer 
en France, y compris dans les DOM-TOM. L'espagnol et le 
portugais ont une pertinence géographique directe pour 
la Guyane et les Caraïbes voisines.

### Préparation technique (à faire dès maintenant, léger)

Pour ne pas avoir à tout refactorer plus tard, adopter 
dès maintenant de bonnes pratiques peu coûteuses :

```
- Centraliser tous les textes UI dans des fichiers de 
  traduction (même si un seul fichier fr.json existe pour 
  l'instant) plutôt que des strings en dur dans le JSX
- Éviter les concaténations de strings qui compliquent 
  la traduction (ex: "Vous avez " + n + " messages" 
  plutôt qu'un template i18n-friendly)
- Utiliser next-intl ou next-i18next comme librairie cible 
  (compatible Next.js App Router)
```

### Ce qui n'est PAS à faire maintenant

```
- Ne pas traduire l'interface dans les 6 langues
- Ne pas mettre en place next-intl tout de suite 
  (coût d'intégration non négligeable)
- Ne pas adapter le matching DeepSeek au multilingue 
  (les prompts DeepSeek restent en français pour l'instant)
```

### Quand lancer ce chantier

```
Déclencheur : après validation du MVP français par les 
premiers cabinets pilotes ET expression d'un besoin réel 
(ex: un remplaçant non-francophone s'intéresse à la 
plateforme, ou une CPTS confirme un besoin identifié)

Ne pas anticiper sans signal utilisateur concret — 
c'est un investissement lourd (traduction, maintenance 
de N versions de contenu, tests) qui n'a de sens qu'une 
fois le produit stabilisé.
```

---

## 60. Principe architectural — remplissage automatique toujours corrigible à la main

### Le principe fondamental

Un match qui aboutit à un contrat signé remplit automatiquement 
la timeline (côté titulaire ET côté remplaçant). Mais ce 
remplissage automatique n'est JAMAIS définitif ou figé — 
l'utilisateur doit toujours pouvoir le corriger manuellement 
après coup, des deux côtés du match.

Ce principe généralise et relie les sections 55 et 58 déjà 
documentées — il s'applique à TOUTE timeline, TOUT profil.

### Scénario 1 — Titulaire avec plusieurs postes

**Les deux problèmes concrets du titulaire :**

```
Problème A — Couvrir chaque absence prévue
  Le titulaire doit pouvoir mettre un remplaçant sur CHAQUE 
  absence prévue : les siennes propres ET celles de chacun 
  de ses assistants/collaborateurs. Chaque ligne de la 
  timeline (self + chaque poste) doit pouvoir recevoir 
  une annonce et un match indépendamment.

Problème B — Anticiper le remplacement d'un partant
  Dès que le titulaire connaît la date de fin d'un assistant/
  collaborateur (démission, fin de contrat, préavis posé — 
  section 57), il doit pouvoir anticiper la recherche du 
  remplaçant qui prendra la suite, AVANT que le poste ne 
  devienne réellement vacant.
```

**La règle de correction manuelle pour le titulaire :**

```
Quand une annonce matche → le contrat se signe → le système 
propose une attribution automatique (poste d'origine par défaut,
section 55).

Mais le titulaire peut TOUJOURS, après coup, corriger :
- Réattribuer ce match à un autre poste que celui d'origine
- Attribuer un match à deux endroits différents si le match 
  concerne une double absence (ex: un même remplaçant couvre
  deux périodes courtes sur deux postes distincts)
- Défaire une attribution automatique et la refaire manuellement
```

### Scénario 2 — Remplaçant qui cherche des cabinets

**Symétrie côté remplaçant :**

```
Le remplaçant swipe des annonces de cabinets. Quand un match 
aboutit à un contrat signé, ça remplit automatiquement SA 
propre timeline personnelle (/disponibilites).

Mais lui aussi doit pouvoir, après coup, corriger manuellement :
- Modifier les dates réellement retenues sur sa timeline 
  si elles diffèrent légèrement de ce que le match avait 
  calculé automatiquement
- Réajuster si un cabinet a finalement besoin de lui sur 
  une période différente de celle négociée initialement
- Détacher un remplissage automatique erroné et le recréer 
  manuellement
```

### Scénario 3 — à préciser

Jean-Charles a mentionné "trois scénarios" — les deux premiers 
sont détaillés ci-dessus (titulaire multi-postes, remplaçant 
cherchant des cabinets). Le troisième reste à clarifier lors 
d'un prochain échange.

### Implication technique générale

Sur TOUTE brique de timeline (PlanningBoard ET DisponibilitesBoard),
même une brique CONFIRME issue d'un match automatique doit 
rester cliquable pour :

```
- Voir le détail du match/contrat à l'origine du remplissage
- Modifier manuellement les dates de cette brique
- Détacher cette brique de son match d'origine et la 
  transformer en statut libre (NON_COUVERT, PRESENT, etc.)
- Réattribuer ce contenu à un autre poste/une autre période
```

C'est une extension du menu contextuel déjà existant sur 
les briques (section 33, StatusDropdown) — il doit être 
enrichi d'options de réattribution, pas seulement de 
changement de statut simple.

### Ordre d'implémentation

```
Ce principe doit être vérifié et appliqué en priorité 
sur toute nouvelle fonctionnalité touchant aux timelines.

Sprint dédié à prévoir :
1. Enrichir le menu contextuel des briques CONFIRME issues 
   d'un match : ajouter "Réattribuer" et "Modifier les dates"
2. Vérifier que ces actions sont possibles à la fois sur 
   PlanningBoard.tsx (titulaire) et DisponibilitesBoard.tsx 
   (remplaçant)
3. S'assurer qu'aucune action de remplissage automatique 
   (section 55, 58) ne verrouille définitivement une brique 
   sans possibilité de correction manuelle ultérieure
```

---

## 61. Tunnel match complet — modale, chat stocké, contrat, signature photo

### Cette section consolide et précise les sections 41, 42, 48

### Étape 1 — Le match arrive dans le tray

Dans chaque scénario (titulaire ET remplaçant), un match 
confirmé (swipe réciproque) apparaît dans le tray du bas.

### Étape 2 — Clic sur le match → modale de détail

Au clic sur un élément du tray, une modale s'ouvre avec :
- Détail des scores (dates, géo, spécialités, bio, désirabilité 
  — déjà existant)
- Trois boutons d'action (call-to-action) :

```
[Annuler le match]      [Commencer un chat]      [Envoyer un contrat]
```

Le bouton "Envoyer un contrat" n'est visible que côté 
TITULAIRE ou ASSISTANT (celui qui recrute/propose le poste),
pas côté remplaçant qui candidate.

### Étape 3 — Comportement selon le bouton cliqué

**[Annuler le match]**
→ Le match est retiré du tray (déjà spécifié section 48)
→ DELETE /api/match/[matchId]

**[Commencer un chat]**
→ Ouvre l'interface de messagerie
→ Le transcript de la conversation DOIT être stocké en base 
  (persistance complète, pas éphémère)
→ Dans l'interface de chat, un bouton "Envoyer un contrat" 
  est visible en permanence (si titulaire/assistant) pour 
  basculer vers l'étape suivante sans quitter le fil

**[Envoyer un contrat]** (depuis la modale OU depuis le chat)
→ Bascule vers un nouvel écran dédié
→ Contrat pré-rempli automatiquement avec les données connues 
  (dates, RPPS, taux — déjà existant section 39/40)
→ TOUS les champs restent éditables à la main dans l'interface 
  avant envoi définitif (déjà spécifié section 41, confirmé ici)

### Étape 4 — Signature par photo (NOUVEAU — précise/remplace 
la section 42 qui prévoyait une case à cocher)

Au lieu d'une simple case "J'ai lu et j'approuve" (section 42),
le système demande à CHACUNE DES PARTIES CONCERNÉES de fournir
une photo de sa signature manuscrite :

```
Les trois types d'utilisateurs concernés :
- TITULAIRE
- ASSISTANT (si signataire d'un contrat de collaboration/
  sous-traitance dans certains montages)
- REMPLACANT

Chaque partie prend en photo sa signature manuscrite 
(sur papier, via la caméra du téléphone) au moment de 
valider le contrat de son côté.
```

**Flow de capture :**

```
1. Le contrat final (tous champs remplis, relu) est affiché
2. Bouton "Signer avec ma signature" 
   → Ouvre l'appareil photo (input capture="environment" 
     ou "user" selon praticité)
   → L'utilisateur prend en photo sa signature manuscrite 
     (sur une feuille blanche, ou directement sur un support dédié)
3. La photo est recadrée/nettoyée automatiquement si possible 
   (fond blanc, contraste)
4. La signature capturée est apposée en bas du contrat PDF, 
   à l'emplacement prévu pour cette partie
5. Une fois les DEUX parties signées (photo capturée des deux 
   côtés), le contrat passe au statut CONFIRME
```

### Révision du modèle de données (remplace/étend section 42)

```prisma
model Match {
  // ... champs existants ...
  
  contratStatus       ContratStatus @default(AUCUN)
  contratData         Json?
  contratEnvoyeAt     DateTime?
  
  // Signature PHOTO au lieu de simple validation checkbox
  signatureTitulaireUrl    String?   // URL Supabase Storage de la photo
  signatureTitulaireAt     DateTime?
  signatureRemplacantUrl   String?
  signatureRemplacantAt    DateTime?
  
  blockedStartDate    DateTime?
  blockedEndDate      DateTime?
}
```

### Storage — bucket dédié aux signatures

```sql
-- Nouveau bucket Supabase Storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('signatures', 'signatures', false);
-- Non public : accessible uniquement aux deux parties du contrat 
-- concerné + admin, pas en lecture publique comme les avatars
```

### Transcript de chat — stockage

```prisma
model Message {
  // Modèle déjà existant — vérifier qu'il persiste bien 
  // l'intégralité du fil, pas seulement les derniers messages
  // Aucune suppression automatique du transcript
}
```

### Ordre d'implémentation

```
Sprint suivant (prioritaire) :
1. Modale de match : ajouter les 3 boutons CTA 
   (Annuler / Chat / Contrat)
2. Vérifier que le transcript de chat est bien stocké 
   intégralement (audit du modèle Message existant)
3. Bouton "Envoyer un contrat" visible dans l'interface de chat
4. Écran de signature par photo :
   - Capture photo (input file avec capture)
   - Upload vers bucket "signatures" (non public)
   - Association au Match (signatureTitulaireUrl / 
     signatureRemplacantUrl)
5. Apposition de la signature capturée en bas du PDF généré 
   (modifier les templates de contrat pour inclure l'image 
   de signature à la position prévue)
6. contratStatus passe à CONFIRME uniquement quand LES DEUX 
   signatures photo sont présentes
```

### Point de vigilance juridique

Une photo de signature manuscrite n'a pas la valeur d'une 
signature électronique qualifiée (eIDAS). C'est un consentement 
visuel informel, comparable à une signature scannée — suffisant 
pour un MVP entre professionnels de confiance, mais à mentionner 
clairement dans les mentions légales du contrat généré (déjà 
prévu section 39/40) :

```
"Ce document a été signé électroniquement par apposition 
d'une image de signature manuscrite. Il ne constitue pas 
une signature électronique qualifiée au sens du règlement 
eIDAS. Les parties reconnaissent la validité de ce mode 
de signature pour les besoins de ce contrat."
```

---

## 62. Scénario 3 — Assistant/Collaborateur autonome + badge de statut

### Scénario 3 (complète la section 60)

**Assistant ou collaborateur cherchant pour son propre compte,
en autonomie, dissocié de son titulaire.**

Un assistant ou collaborateur peut avoir besoin de trouver 
lui-même un remplaçant pour couvrir sa propre absence, sans 
passer par le titulaire du cabinet où il exerce. C'est cohérent 
avec la réalité du terrain : un assistant en vacances doit 
parfois organiser lui-même sa couverture (cf. contrats CNOMK 
section 39 — clause "le remplaçant qu'il choisit doit être 
agréé par le titulaire").

**Comportement UI spécifique à ce profil :**

```
Assistant/Collaborateur autonome (pas de rôle titulaire) :
  → Une SEULE timeline : la sienne
  → PAS de bouton "Ajouter un poste" (il n'a qu'un seul poste : 
    le sien, déjà existant de fait)
  → Peut déclarer ses propres absences (comme le titulaire 
    sur sa ligne "self" — section 43)
  → Peut publier une annonce de remplacement sur ses propres 
    absences déclarées
  → Reçoit des matchs, chat, envoie un contrat de remplacement 
    (pas d'assistanat/collaboration, puisqu'il n'est pas 
    titulaire d'un poste à pourvoir — juste un remplacement 
    ponctuel de lui-même)
```

Ce comportement existe potentiellement déjà en partie via 
le profil ASSISTANT sur /disponibilites, mais il faut vérifier 
que la timeline de l'assistant autonome fonctionne bien comme 
décrit ci-dessus (une ligne, pas de gestion multi-postes).

### Badge de statut — visible en évidence

Ajouter un badge de rôle bien visible (en haut du tray ou 
du header, selon ce qui est le plus lisible) affichant 
précisément le statut de l'utilisateur connecté :

```
Rôles libéraux :
  REMPLAÇANT
  ASSISTANT
  COLLABORATEUR
  TITULAIRE

Rôles salariés (rappel section 26 — cible hospitalière) :
  DRH (salarié)
  DIRECTEUR (salarié)
  SALARIÉ CDD (salarié)
  SALARIÉ CDI (salarié)
```

**Design du badge :**
- Pill/badge coloré, positionné en évidence (header ou 
  au-dessus du tray du bas)
- Une couleur distincte par grande catégorie :
  - Libéraux (remplaçant/assistant/collaborateur/titulaire) 
    → teinte bleu marine/lagon
  - Salariés (DRH/directeur/CDD/CDI) → teinte distincte 
    (ambre ou vert, à définir en cohérence avec la palette 
    section 46)

### Modèle de données — précision du statut

```prisma
// Sur Profile — le champ type existant (ProfileType) couvre 
// TITULAIRE/REMPLACANT/ASSISTANT. Pour les rôles salariés,
// réutiliser isEmployeur (section 37) + ajouter une précision :

enum SalarieRole {
  DRH
  DIRECTEUR
  SALARIE_CDD
  SALARIE_CDI
}

// Sur Profile — ajouter (nullable, uniquement si isEmployeur=true 
// ET profileType pertinent) :
salarieRole  SalarieRole?
```

### Ordre d'implémentation

```
Sprint suivant :
1. Vérifier/corriger le comportement de la timeline pour 
   un ASSISTANT autonome (une seule ligne, pas de multi-postes)
2. Ajouter le badge de statut visible (header ou au-dessus 
   du tray)
3. Étendre le modèle Profile avec salarieRole pour les cas 
   salariés (DRH/Directeur/CDD/CDI)
4. Adapter l'affichage du badge selon isEmployeur + salarieRole
```

---

## 63. Cartes swipe — largeur maximale sur desktop

### Correction

Sur desktop (largeur d'écran >= 1024px), les cartes swipe 
(style Tinder, écran /annonces) ne doivent jamais dépasser 
2/3 de la largeur totale de l'écran disponible.

```
Mobile (< 768px)     → carte pleine largeur (comportement actuel)
Tablette (768-1024px) → carte centrée, max-width ~600px
Desktop (>= 1024px)   → carte centrée, max-width = 66% de la 
                        largeur de la zone de contenu, 
                        jamais plus large que ça
```

### Implémentation

```css
/* Sur le conteneur de la pile de cartes (SwipeStack) */
.swipe-card-container {
  max-width: 100%;           /* mobile par défaut */
}

@media (min-width: 1024px) {
  .swipe-card-container {
    max-width: 66.666%;      /* 2/3 sur desktop */
    margin-left: auto;
    margin-right: auto;
  }
}
```

Ou en Tailwind : `w-full lg:max-w-[66%] mx-auto`

### Ordre d'implémentation

À inclure dans le sprint responsive (déjà en partie traité — 
section 32/33, comportement mobile-first des timelines). 
Ce point concerne spécifiquement l'écran swipe, pas les timelines.

---

## 64. Consolidation définitive — clic universel sur toute brique de timeline

### Cette section prime sur les sections 55, 56, 57 et 60 en cas 
### de contradiction — c'est la spec de référence finale du comportement clic.

### Constat au recettage

Malgré les sprints précédents, le clic sur une brique de timeline 
ne propose pas encore le menu complet attendu, et le padding 
des timelines est revenu bord à bord (régression possible du 
sprint responsive).

### RÉGRESSION À CORRIGER — padding timeline

```
Les timelines (PlanningBoard ET DisponibilitesBoard) sont 
de nouveau collées au bord d'écran, sans marge visible.
→ Revérifier le padding-right (pr-4 minimum) sur le conteneur 
  scrollable de chaque timeline
→ Vérifier qu'aucun sprint ultérieur n'a supprimé ce padding 
  par inadvertance (conflit de classes Tailwind, override CSS)
```

### LE MENU UNIVERSEL — clic sur n'importe quelle brique/période

Que ce soit une zone vide (NON_COUVERT), une brique occupée 
(CONFIRME, PRESENT...), ou une zone de préavis, le clic doit 
TOUJOURS ouvrir un menu avec les options pertinentes parmi :

```
[1] Poser une annonce
    → Sur cette période précise, ouvre le formulaire pré-rempli 
      avec les dates de la zone cliquée

[2] Modifier la période
    → Édite les dates de début/fin de l'occupation actuelle 
      (ex: corriger la durée réelle d'un remplacement en cours, 
      ou allonger/raccourcir une présence déclarée)

[3] Déclarer une absence
    → Marque cette période comme vacance (section 43)
    → Devient une zone NON_COUVERT cliquable pour proposer 
      une annonce

[4] Indiquer que je suis finalement présent
    → Annule une absence déclarée par erreur (section 43, 
      déjà spécifié — vérifier que ce bouton est bien 
      accessible depuis CE menu unifié, pas seulement 
      depuis un chemin séparé)

[5] Fermer temporairement ce poste
    → Le poste reste configuré mais est marqué FERME 
      sur la période choisie (pas de recherche possible 
      pendant ce temps)

[6] Indiquer une occupation externe (hors Soignect)
    → Le titulaire déclare que le poste est occupé par 
      un assistant/collaborateur nommé, recruté par un 
      autre biais que Soignect (bouche à oreille, autre 
      plateforme, connaissance personnelle)
    → Champs : nom de la personne, date début, 
      date de fin (définie OU indéterminée — les 3 modes 
      de la section 57 s'appliquent ici aussi)
    → Statut résultant : CONFIRME, sans lien à un Match 
      Soignect (matchId = null)
```

### Distinction pré-rempli vs modifiable — règle absolue

```
SI la période provient d'un match Soignect (un contrat a été 
signé via la plateforme) :
  → Les champs sont PRÉ-REMPLIS automatiquement avec les 
    données du match (nom du remplaçant, dates négociées)
  → MAIS restent 100% modifiables manuellement à tout moment
  → Aucune donnée issue d'un match n'est en lecture seule

SI la période est déclarée manuellement (hors Soignect, 
via l'option [6] ci-dessus) :
  → Champs vides à remplir par le titulaire
  → Modifiables à tout moment également
```

Ce principe rejoint et confirme la section 60 (remplissage 
automatique toujours corrigible) — ici précisé : y compris 
le nom de la personne et les dates exactes, pas seulement 
la réattribution à un autre poste.

### Le menu s'adapte selon le contexte de la brique cliquée

```
Brique NON_COUVERT (vide)     → options [1] [3 n/a] [5] [6]
Brique CONFIRME (via Soignect) → options [2] [3] [5] (pré-rempli, modifiable)
Brique CONFIRME (externe)      → options [2] [3] [5] [6-modifier]
Brique PRESENT (soi-même)      → options [3] [5 n/a]
Brique ABSENT_* (vacance)      → options [1] [4] [3-modifier dates]
Brique PREAVIS                 → options [1] [2] (voir dates préavis)
```

### Ordre d'implémentation — priorité immédiate

```
Sprint suivant, avant toute autre feature :

1. CORRIGER LA RÉGRESSION de padding (rapide, prioritaire)

2. Construire LE MENU UNIVERSEL unique (StatusDropdown enrichi, 
   section 33) qui remplace tous les chemins de clic actuellement 
   dispersés (modale binaire section 37, menu section 33, 
   modale vacance section 43...) — un seul point d'entrée cohérent

3. Ajouter l'option [6] "Occupation externe hors Soignect" 
   qui n'existe pas encore du tout

4. Vérifier que TOUTE brique CONFIRME (qu'elle vienne d'un 
   match ou d'une déclaration manuelle) reste éditable via 
   ce même menu

5. Appliquer la même logique sur DisponibilitesBoard.tsx 
   côté remplaçant (les briques de sa propre timeline doivent 
   aussi être éditables selon les mêmes principes, adaptés 
   à son contexte)
```

---

## 65. Renommage de poste + flow guidé libéral/salarié

### Point 1 — Renommer un poste depuis le menu de sa timeline

Le menu universel (section 64) doit aussi permettre de modifier 
le LABEL du poste lui-même, pas seulement son occupation.

```
Ajout au menu universel — option toujours présente en haut :
[✎] Renommer ce poste
    → Champ texte pré-rempli avec le libellé actuel ("matheo")
    → Permet de corriger : ex. si la personne s'appelle en 
      réalité Jean-Claude et pas Matheo (erreur de saisie 
      initiale, ou changement de titulaire du poste)
    → Sauvegarde : PATCH sur CabinetPost.label
```

Cette option doit être accessible en permanence sur le menu 
de n'importe quelle brique de ce poste, pas seulement à 
la création.

### Point 2 — Flow guidé pour basculer libéral/salarié

Actuellement (section 37), le passage libéral/salarié est 
un simple toggle "isEmployeur" dans /compte. Cette proposition 
l'enrichit : au lieu d'un interrupteur brut, proposer un 
petit flow de questions qui détermine précisément la bonne 
terminologie et configuration.

```
Sur /compte, remplacer le toggle simple par :
"Modifier le type de structure" → ouvre un mini-questionnaire

Question 1 : "Comment décririez-vous votre structure ?"
  ○ Cabinet libéral (moi-même + éventuels assistants/collaborateurs)
  ○ Établissement employeur (clinique, EHPAD, centre de santé...)

Si "Établissement employeur" sélectionné :
Question 2 : "Quel type de contrats proposez-vous principalement ?"
  ○ CDI uniquement
  ○ CDD et vacations
  ○ Un mélange des deux

→ Ajuste automatiquement isEmployeur = true
→ Les libellés s'adaptent selon les réponses (pas juste un 
  binaire Vacation/CDD/CDI générique, mais orienté vers 
  ce qui est réellement pratiqué)
```

### Modèle de données — précision

```prisma
// Sur Profile — déjà existant isEmployeur, ajouter en complément :
contractPreference String?  // "CDI_ONLY" | "CDD_VACATION" | "MIXTE"
                            // Affine l'affichage des types de 
                            // postes proposés dans "Ajouter un poste"
```

### Ordre d'implémentation

```
Sprint suivant :
1. Option "Renommer ce poste" dans le menu universel (rapide, 
   à fusionner avec le sprint du menu universel section 64 
   s'il n'est pas encore lancé)
2. Flow guidé 2 questions sur /compte pour remplacer le toggle 
   simple isEmployeur
```

---

## 66. Favicon et icônes d'application

### Besoin

Ajouter un favicon professionnel pour Soignect — actuellement 
absent ou générique, ce qui nuit à la crédibilité perçue 
(onglet navigateur, favoris, écran d'accueil mobile).

### Éléments à fournir

```
favicon.ico          → 32x32 et 16x16 (multi-résolution classique)
icon-192.png         → pour Android / PWA (192x192)
icon-512.png         → pour Android / PWA haute résolution (512x512)
apple-touch-icon.png → pour iOS "Ajouter à l'écran d'accueil" (180x180)
```

### Design suggéré

Cohérent avec l'identité déjà en place (section 46/47) :
- Fond lagon profond (#0B3D5C) ou sable chaud (#F2E8D5)
- Symbole simple et reconnaissable même en petit format 
  (16x16px doit rester lisible) — éviter le logo texte complet 
  "Soignect", privilégier une version simplifiée (ex: juste 
  le "S" stylisé, ou un pictogramme lié au soin/mise en relation)

### Emplacement technique (Next.js App Router)

```
src/app/favicon.ico
src/app/icon.png          (192x192, généré automatiquement 
                            par Next.js dans le <head>)
src/app/apple-icon.png    (180x180)
```

Next.js 13+ App Router détecte automatiquement ces fichiers 
s'ils sont nommés ainsi dans le dossier app/ — pas besoin 
de configuration manuelle dans le layout.

### Ordre d'implémentation

Sprint léger, peut être fait rapidement — pas de logique 
métier, juste des assets à créer et placer au bon endroit. 
Peut être fusionné avec n'importe quel autre sprint sans risque.

---

## 67. Score géographique graduel + ciblage multi-communes

### Problème actuel

Le score géographique (composante du calcul d'affinité, 
section 25) est probablement binaire ou trop grossier — 
pas de graduation réelle selon la distance kilométrique.

### Correction 1 — Score de proximité graduel (pas binaire)

Remplacer le calcul actuel par une vraie graduation basée 
sur la distance réelle entre les deux communes :

```typescript
function scoreGeo(distanceKm: number): number {
  if (distanceKm === 0)   return 20  // Même commune
  if (distanceKm <= 10)   return 18  // Très proche (ex: Pointe-à-Pitre/Gosier)
  if (distanceKm <= 20)   return 14
  if (distanceKm <= 35)   return 10
  if (distanceKm <= 50)   return 6
  if (distanceKm <= 80)   return 3
  return 0                            // Très loin (ex: Saint-François/Pointe-Noire, ~100km)
}
```

Nécessite une table de distances entre communes (ou calcul 
via coordonnées GPS + formule de Haversine) plutôt qu'une 
simple comparaison de nom de commune identique/différent.

### Table des coordonnées communes (à constituer)

```prisma
// Sur CommuneAPL (déjà existant) ou nouvelle table dédiée :
// Ajouter latitude/longitude par commune pour calculer 
// les distances réelles

model CommuneAPL {
  // ... champs existants ...
  latitude   Float?
  longitude  Float?
}
```

Calcul de distance (formule de Haversine, standard pour 
des distances courtes comme en Guadeloupe) :

```typescript
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // rayon terre en km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * 
            Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}
```

### Correction 2 — Ciblage multi-communes pour le remplaçant

Un remplaçant doit pouvoir cibler sa recherche sur PLUSIEURS 
communes à la fois (pas une seule zone unique), par exemple 
"je suis mobile entre Pointe-à-Pitre, Le Gosier et Sainte-Anne".

```prisma
// Sur Profile (remplaçant) — remplacer la commune unique par :
communesCiblees String[]  // Array de communes, au lieu d'une 
                          // seule commune de résidence
// Garder la commune de résidence principale séparément si besoin
```

**UI — sélection multi-communes dans le profil remplaçant :**

```
Zones de mobilité (plusieurs communes possibles)
[x] Pointe-à-Pitre
[x] Le Gosier  
[x] Sainte-Anne
[ ] Saint-François
[+ Ajouter une commune]
```

### Calcul du score géo avec ciblage multi-communes

```typescript
function scoreGeoMultiCommunes(missionCommune: string, remplacantCommunes: string[]): number {
  // Prendre la MEILLEURE distance parmi toutes les communes ciblées 
  // par le remplaçant vs la commune de la mission
  const distances = remplacantCommunes.map(c => 
    distanceKm(coordsOf(c), coordsOf(missionCommune))
  )
  const minDistance = Math.min(...distances)
  return scoreGeo(minDistance)
}
```

### Ordre d'implémentation

```
Sprint dédié (nécessite données géographiques — plus lourd) :
1. Ajouter latitude/longitude sur CommuneAPL pour toutes 
   les communes déjà en base (112 communes DOM, section 15)
2. Implémenter le calcul de distance Haversine
3. Remplacer scoreGeo binaire par la version graduelle
4. Ajouter communesCiblees[] sur Profile (remplaçant)
5. UI de sélection multi-communes dans /compte et à l'inscription
6. Adapter computeAffinityScore pour utiliser le nouveau 
   calcul multi-communes
```

### Priorité

Sprint à part entière, pas urgent pour les tout premiers 
bêta testeurs (le score géo actuel fonctionne, juste de façon 
moins précise) — mais important avant un déploiement plus large, 
car la précision géographique est un argument de qualité fort 
du matching Soignect.

---

## 68. Correction section 66 — logo réel fourni + déclinaisons

### Logo fourni par Jean-Charles

Concept : deux croix médicales entrelacées (bleu + vert/teal) 
avec une flèche montante teal traversant le point de jonction, 
texte "SOIGNECT" en bas de la croix verte. Fond blanc.

### Déclinaisons nécessaires selon l'usage

```
Logo complet (fourni)          → Utiliser tel quel pour :
                                  - Écran de connexion (déjà 
                                    utilisé en texte "Soig/nect", 
                                    remplacer par ce logo visuel)
                                  - icon-512.png (icône app haute 
                                    résolution)
                                  - apple-touch-icon.png (180x180, 
                                    lisible à cette taille)

Version simplifiée (à créer)   → Pour favicon.ico (16x16, 32x32) :
                                  - Retirer le texte "SOIGNECT" 
                                    (illisible en si petit)
                                  - Ne garder que les deux croix 
                                    entrelacées + flèche, 
                                    éventuellement juste la 
                                    silhouette simplifiée
                                  - Tester la lisibilité à 16px 
                                    avant de valider

icon-192.png                   → Version intermédiaire : logo 
                                  complet mais peut nécessiter 
                                  un léger nettoyage si le texte 
                                  devient trop petit à cette taille
```

### Action recommandée

Demander à Claude Code de :
1. Utiliser le logo fourni tel quel pour icon-512.png et 
   apple-touch-icon.png
2. Générer une version simplifiée sans texte pour favicon.ico 
   et icon-192.png (garder uniquement les 2 croix + flèche, 
   sans le mot "SOIGNECT")
3. Remplacer le logo texte "Soig/nect" actuel sur l'écran de 
   connexion par ce logo visuel réel

---

## 69. Retrait des cases à cocher "Spécialités" — matching via DeepSeek uniquement

### Correction

Retirer le champ "Spécialités pratiquées au cabinet" (liste 
de cases à cocher : Orthopédique, Neurologique, Pédiatrique...) 
de l'interface utilisateur, à la fois :
- Dans le formulaire "Publier un poste" (création d'annonce)
- Dans les écrans de recherche/filtrage

Cette liste manuelle ajoute de la friction au formulaire 
(cohérent avec la simplification déjà actée — section du 
recettage initial, point 2 : supprimer les champs redondants).

### Ce qui est conservé

La notion de spécialités reste utilisée EN INTERNE pour :
- Le matching DeepSeek (scoreSpecialties dans le calcul 
  d'affinité, section 25)
- Toute logique de recherche/filtrage pertinente

Mais elle n'est plus saisie via une liste de cases à cocher 
explicite. À la place, la pertinence des spécialités est 
déduite automatiquement par DeepSeek à partir du texte libre 
de l'accroche (BioTinder, section 24) — le modèle analyse 
sémantiquement "orientation généraliste, sport, gériatrie" 
écrit en texte libre, sans que l'utilisateur ait à cocher 
une liste séparée qui répète la même information.

### Impact technique

```
Mission.specialties : String[]  
  → Le champ reste dans le schéma (pas de migration destructive)
  → Mais n'est plus rempli via une UI de cases à cocher
  → Peut soit rester vide (non utilisé), soit être calculé 
    automatiquement en arrière-plan si on veut extraire 
    des mots-clés depuis le texte de l'accroche (optionnel, 
    pas prioritaire)

scoreSpecialties() dans deepseek.ts
  → Si Mission.specialties reste vide, cette composante du 
    score peut soit être neutralisée (score par défaut), 
    soit être remplacée par une analyse DeepSeek du texte 
    de l'accroche en plus de l'analyse bio déjà existante
```

### UI — ce qui disparaît

```
AVANT (formulaire Publier un poste) :
"Spécialités pratiquées au cabinet"
[Orthopédique] [Neurologique] [Pédiatrique] [Respiratoire]
[Gériatrique] [Sportif] [Rééducation vestibulaire]
[Lymphœdème] [Obstétrique/Périnéal] [Oncologie]

APRÈS :
Ce bloc de cases à cocher est retiré. La pertinence des 
spécialités est portée par le champ "En une phrase, ce que 
vous proposez" (accroche 280 signes) déjà existant, analysé 
par DeepSeek.
```

### Ordre d'implémentation

```
Sprint léger :
1. Retirer le bloc UI "Spécialités pratiquées au cabinet" 
   du formulaire de création d'annonce (missions/create)
2. Retirer tout bloc similaire dans les écrans de recherche/
   filtrage s'il en existe
3. Vérifier que scoreSpecialties() ne casse pas si 
   Mission.specialties est systématiquement vide 
   (fallback neutre plutôt qu'une erreur)
4. Ne pas toucher au schéma Prisma (pas de migration)
```

---

## 70. Correction section 8 — préserver le formulaire lors de la redirection photo obligatoire

### Problème identifié

Quand un titulaire tente de publier une annonce sans avoir 
de photo, le système redirige vers /compte (comportement 
attendu, section 8). Mais après avoir ajouté la photo, 
il n'y a aucun moyen de revenir au formulaire de création 
d'annonce — tout ce qui avait été rempli (titre, type de 
besoin, accroche, dates...) est perdu. L'utilisateur doit 
tout ressaisir depuis zéro.

### Corrections possibles — retenir l'option la plus simple

**Option retenue : bouton de retour + sauvegarde locale du brouillon**

```
1. Avant la redirection vers /compte, sauvegarder l'état 
   actuel du formulaire dans le localStorage du navigateur 
   (clé : "soignect_draft_mission")

2. Sur /compte, après ajout réussi de la photo, afficher 
   un bandeau : "Photo ajoutée ! Continuer la publication 
   de votre annonce" avec un bouton qui ramène vers 
   /missions/create

3. Sur /missions/create, au chargement, vérifier si un 
   brouillon existe dans localStorage :
   - Si oui, restaurer automatiquement tous les champs 
     déjà remplis
   - Supprimer le brouillon du localStorage une fois 
     l'annonce publiée avec succès (ou si l'utilisateur 
     l'annule explicitement)
```

### Alternative plus simple (fallback si trop complexe)

Si la sauvegarde de brouillon est jugée trop lourde pour 
ce sprint, au minimum :

```
Un bouton "← Retour à mon annonce en cours" visible sur 
/compte quand l'utilisateur y a été redirigé depuis 
/missions/create (via un paramètre d'URL ?returnTo=/missions/create)
```

Cette alternative ne restaure pas les données saisies mais 
évite au moins de perdre complètement le fil et de devoir 
chercher comment revenir en arrière.

### Recommandation

Privilégier l'option 1 (sauvegarde localStorage) — c'est 
l'expérience la plus fluide et évite la frustration réelle 
que Jean-Charles a rencontrée en testant.

### Ordre d'implémentation

Sprint léger à fusionner avec d'autres corrections du soir :

```
1. Dans missions/create/page.tsx : sauvegarder le state du 
   formulaire dans localStorage à chaque changement significatif 
   (ou au moment de la redirection vers /compte spécifiquement)
2. Rediriger vers /compte avec ?returnTo=/missions/create
3. Sur /compte, après upload photo réussi, si returnTo est 
   présent dans l'URL, afficher le bandeau de retour
4. Sur missions/create, restaurer le brouillon localStorage 
   au chargement si présent
5. Nettoyer le brouillon après publication réussie
```

---

## 71. Accroche 280 signes — passage en champ obligatoire

### Correction immédiate

Le champ "En une phrase, ce que vous proposez" (accroche, 
280 signes, actuellement marqué "optionnel") devient 
OBLIGATOIRE. C'est le cœur du matching DeepSeek — d'autant 
plus depuis le retrait des cases à cocher spécialités 
(section 69), qui reportait déjà la charge du matching sur 
ce texte libre.

```
AVANT : "En une phrase, ce que vous proposez (optionnel · 280 signes)"
APRÈS : "En une phrase, ce que vous proposez (280 signes)"
        Champ requis, formulaire non soumissible sans ce texte
```

### Application

```
- Formulaire "Publier un poste" (missions/create)
- Formulaire "Mes disponibilités" (côté remplaçant)
- BioTinder/accroche sur /compte (déjà quasi-obligatoire 
  dans l'esprit, à confirmer requis aussi)
```

### Validation

```typescript
// zod schema — retirer .optional() sur bioTinder/accroche
bioTinder: z.string().min(20, "Décrivez en quelques mots ce que 
  vous proposez (20 caractères minimum)").max(280)
```

Un minimum de caractères (ex: 20) évite qu'un utilisateur 
contourne l'obligation avec un texte vide de sens ("."). 
280 reste le maximum déjà en place.

---

## 72. Roadmap matching — vision territoriale en 3 temps (contexte stratégique)

### Rappel du principe fondamental (maintenant)

Le cœur du matching repose sur :
1. Commune(s) ciblée(s) + score de proximité graduel (section 67)
2. Accroche 280 signes obligatoire (section 71), analysée par 
   DeepSeek pour la compatibilité de valeurs/projet

### Phase 2 — Notations (déjà partiellement actée)

Système de recommandation binaire (section 4, section 25) — 
déjà spécifié, à terminer d'implémenter si pas encore fait 
(vérifier l'état des modèles CabinetRating/RemplacantRating).

### Phase 3 — Vente aux CPTS : pondération territoriale du score

Nouvelle brique business à ne PAS implémenter maintenant, 
mais à garder en tête comme axe de monétisation institutionnelle 
avancé (rejoint et enrichit la section 53 — CPTS × Soignect) :

```
Concept : une CPTS partenaire (payante, au-delà du statut 
"partenaire fondateur" gratuit de la CPTS Nord Basse-Terre) 
pourrait acheter la capacité de RÉORIENTER le score de 
désirabilité/matching en fonction des besoins réels de 
son territoire.

Exemple concret :
  Une CPTS identifie que la commune de Trois-Rivières manque 
  cruellement de kinés depuis 6 mois. Elle "booste" 
  artificiellement le score des annonces situées à 
  Trois-Rivières (ou dans un rayon donné) pour les rendre 
  plus visibles aux remplaçants qui swipent, au-delà du 
  score de désirabilité standard déjà existant (section 23).

Ce n'est pas juste un boost commercial (comme le plan 
Premium/Boost déjà existant) — c'est un boost À VOCATION 
DE SANTÉ PUBLIQUE, piloté par une institution qui a une 
vision fine et réelle des besoins de son territoire, 
au-delà de ce que les données APL peuvent capter.
```

**Ce concept est distinct de la désirabilité standard (section 23)** :
```
Désirabilité standard    → payée par le cabinet lui-même 
                           (Premium/Boost), boost commercial
Pondération territoriale → payée par la CPTS/institution, 
                           boost à vocation de santé publique, 
                           applicable à TOUS les cabinets 
                           d'une zone identifiée comme prioritaire
```

### Ordre d'implémentation

```
MAINTENANT : section 71 (accroche obligatoire) — sprint léger

Sprint dédié ultérieur : section 67 (score géo graduel + 
multi-communes) — prérequis technique nécessaire avant 
d'envisager la phase 3

Phase business à ne pas coder avant : vente CPTS pondération 
territoriale (section 72) — nécessite d'abord des CPTS payantes 
réelles et un besoin confirmé, pas à anticiper en code
```

---

## 73. BUG BLOQUANT — bouton "Publier" grisé sur annonce Assistanat

### Problème

Sur le formulaire de publication d'annonce type Assistanat, 
le bouton "Publier le poste" reste grisé (désactivé) quelle 
que soit la durée sélectionnée. Suspicion : la validation 
de durée minimale (section 37.E — 90 jours pour ASSISTANAT) 
ne gère pas correctement tous les cas, notamment "durée 
non définie".

### Toutes les options de durée doivent fonctionner

```
- Non définie (indéterminée)
- 3 mois minimum
- 6 mois minimum  
- 12 mois
- 24 mois
```

### Hypothèse du bug

La validation JS calcule probablement `dureeJours` à partir 
de `endDate - startDate`. Si l'utilisateur choisit "non définie" 
(pas de date de fin), `endDate` est `null` ou `undefined` → 
le calcul `dureeJours < 90` peut retourner `NaN < 90` qui 
vaut... à vérifier, mais le comportement est probablement 
incorrect (bloque le bouton alors que "non défini" devrait 
être valide, ou l'inverse selon l'implémentation).

### Correction attendue

```typescript
// Validation à corriger
const missionDays = form.startDate && form.endDate
  ? Math.floor((new Date(form.endDate).getTime() - 
                new Date(form.startDate).getTime()) / 86400000)
  : null  // Explicitement null si pas de date de fin

const needs90Days = needType === "assistant"
const under90Days = needs90Days && 
  missionDays !== null &&  // Si null (durée indéterminée), 
                            // ne PAS bloquer
  missionDays < 90

// Le bouton "Publier" doit être actif si :
// - durée indéterminée (missionDays === null) → OK, pas de blocage
// - durée définie ET >= 90 jours → OK
// - durée définie ET < 90 jours → bloqué (correct)
```

### Vérification nécessaire

Tester chacun des 5 cas listés ci-dessus et confirmer que 
le bouton "Publier" devient actif dans tous les cas valides.

---

## 74. Transparence — afficher l'analyse DeepSeek du texte accroche

### Idée proposée

Comme l'accroche 280 signes devient LE cœur du matching 
(section 71), il serait utile que la personne qui reçoit 
un match puisse voir un résumé de ce que DeepSeek a compris/
analysé dans le profil de l'autre partie — pas juste le score 
final, mais une explication de la compatibilité perçue.

### Exemple de ce que ça pourrait donner

```
Sur la modale de match ou la fiche de match, en plus du 
score d'affinité (déjà affiché) :

"Ce que Soignect a identifié en commun :
Vous recherchez tous les deux un cadre professionnel 
axé sur la gériatrie et la prévention, avec une approche 
détendue du travail en équipe."
```

Cette explication serait générée par un appel DeepSeek 
supplémentaire (ou intégrée dans le même appel que le 
scoring), demandant explicitement un résumé en une phrase 
des points de convergence entre les deux accroches.

### Prompt DeepSeek à ajouter (exemple)

```typescript
const explanationPrompt = `
Tu es un algorithme de matching professionnel.
Voici deux descriptions professionnelles qui ont été 
mises en relation :

Profil A : "${bioA}"
Profil B : "${bioB}"

Résume en UNE phrase (30 mots maximum) ce qui rend ces 
deux profils compatibles, du point de vue des valeurs, 
du projet professionnel ou de l'ambiance recherchée.
Réponds uniquement avec cette phrase, sans préambule.
`
```

### Stockage

```prisma
// Sur Match ou Swipe — ajouter :
matchExplanation String? @db.VarChar(300)  
  // Généré une fois au moment du swipe RIGHT réciproque, 
  // pas recalculé à chaque affichage
```

### Ordre d'implémentation

```
Sprint à part entière (pas urgent, mais bonne feature de 
confiance/transparence pour les utilisateurs) :

1. Ajouter matchExplanation au modèle Match
2. Générer l'explication au moment de la création du match 
   (appel DeepSeek supplémentaire, fire-and-forget pour ne 
   pas bloquer le flow)
3. Afficher cette explication sur la modale "C'est un match !" 
   et/ou sur la fiche de match dans le tray
```

### Priorité

Section 73 (bug bouton grisé) est BLOQUANTE — à corriger 
immédiatement ce soir.
Section 74 (transparence DeepSeek) est une amélioration — 
peut attendre un sprint dédié plus tard.

---

## 75. Retours test multi-profils — notification email, tray, score d'affinité

### A. Notification email sur mise en relation — VÉRIFIER/CORRIGER

Le code envoie déjà un email "nouvelle mise en relation" via 
Resend (section 51, déjà implémenté selon l'audit Sprint B). 
Mais en test réel, aucun email n'est reçu.

**Cause la plus probable : RESEND_API_KEY absente des variables 
d'environnement Vercel** (déjà signalée comme point de vigilance 
lors du sprint durcissement).

```
Action immédiate (pas du code, une vérification) :
1. Aller sur Vercel → Settings → Environment Variables
2. Vérifier si RESEND_API_KEY est présente
3. Si absente, créer un compte sur resend.com, générer une 
   clé API, l'ajouter dans Vercel (scope Production)
4. Redéployer
5. Retester : un swipe réciproque doit déclencher l'email
```

Si la clé est bien présente et que l'email ne part toujours 
pas, demander à Claude Code d'ajouter un log explicite sur 
l'appel `sendNewRelationEmail` pour diagnostiquer.

### B. Bouton contrat masqué en Premium — reconsidérer l'affichage

Actuellement, le bouton "Envoyer un contrat" est totalement 
invisible si le titulaire n'est pas Premium/Boost. Ça manque 
de transparence — l'utilisateur ne comprend pas pourquoi 
il n'y a pas de bouton du tout.

```
Correction : afficher le bouton "Envoyer un contrat" TOUJOURS,
mais visuellement grisé/verrouillé si le profil n'est pas 
Premium, avec un badge "Premium" et au clic, une redirection 
vers /premium plutôt qu'une absence totale du bouton.

(Ce comportement était déjà spécifié plus tôt dans le 
projet — section sur /match/[id] — vérifier qu'il est bien 
appliqué aussi dans la modale du tray, pas seulement sur 
la page /match/[id] dédiée.)
```

### C. Structure du tray — séparer "vos choix" des "mises en relation"

**Problème de fond identifié :** tout ce qui apparaît dans 
le tray du bas est actuellement traité comme équivalent, 
mélangé dans une seule liste. Or il y a une vraie différence 
conceptuelle :

```
"Vos choix"              = tout ce sur quoi VOUS avez swipé 
                           à droite (unilatéral, pas encore 
                           forcément réciproque)

"Vos mises en relation"  = uniquement les choix RÉCIPROQUES 
                           (l'autre partie a aussi swipé à 
                           droite) — c'est la vraie notion 
                           de "match"
```

**Correction structurelle demandée :**

```
Le tray doit distinguer visuellement/structurellement :

1. Une zone "Vos choix" — tout ce que l'utilisateur a swipé 
   à droite, en attente de réciprocité
   
2. Une zone DÉDIÉE "Vos mises en relation" — mise en évidence 
   (couleur, position en premier, badge distinct), contenant 
   UNIQUEMENT les swipes réciproques confirmés

Actuellement tout s'affiche à la suite, sans cette distinction 
claire — seul le premier élément semble mis en avant, mais 
pas structurellement séparé.
```

Cette correction touche le composant MatchTray (et 
potentiellement une refonte de layout : deux sections 
distinctes plutôt qu'une liste unique).

### D. Redistribution du score d'affinité (les spécialités disparaissent)

Suite au retrait des cases à cocher spécialités (section 69), 
la composante "Spécialités" du score (actuellement 20 pts, 
toujours à 0 en pratique) doit être redistribuée.

**Nouvelle pondération proposée :**

```
AVANT (section 25, avec spécialités actives) :
Dates + flexibilité    35 pts
Bio DeepSeek            25 pts
Proximité géo           20 pts
Spécialités             10 pts  ← à retirer/redistribuer
Désirabilité            10 pts

APRÈS (spécialités retirées) :
Dates + flexibilité    35 pts
Bio DeepSeek            30 pts  (+5, le texte libre porte 
                                 maintenant toute la charge 
                                 sémantique, spécialités incluses)
Proximité géo           25 pts  (+5, cohérent avec le passage 
                                 au score gradué section 67)
Désirabilité            10 pts
TOTAL                  100 pts
```

### E. Expliquer le critère "Visibilité" aux utilisateurs

Le score détaillé affiche une composante "Visibilité" (0-10) 
sans explication — l'utilisateur ne comprend pas ce que ça 
représente (c'est en réalité le score de désirabilité, 
section 23 : boost admin/abonnement/zone).

```
Ajouter un petit texte d'aide (tooltip ou sous-texte) :
"Visibilité : mise en avant du profil selon son abonnement 
et sa localisation (zones prioritaires)"

Renommer éventuellement "Visibilité" en quelque chose de 
plus clair pour l'utilisateur final, ex: "Mise en avant" 
ou garder "Visibilité" mais avec l'explication toujours visible.
```

### F. Confirmation — score géo gradué (déjà spécifié section 67)

Confirmé par ce test : le score "Lieu" doit passer d'un calcul 
actuel probablement binaire à un calcul gradué selon la distance 
réelle commune à commune (déjà détaillé section 67 — Haversine, 
latitude/longitude). Pas de nouveauté ici, juste confirmation 
de la priorité.

### G. Score "Dates" — correspondance graduelle, pas binaire

Le score de dates doit refléter une correspondance graduelle : 
exactitude parfaite = score maximal, correspondance approximative 
= score partiel proportionnel à l'écart. Ce comportement existe 
déjà en théorie (section 25, scoreDates avec flexibilité) — 
à vérifier que le calcul actuel produit bien un score cohérent 
avec cette logique (17/30 dans l'exemple montré semble déjà 
graduel, à confirmer que c'est bien voulu et pas un bug).

### Ordre d'implémentation

```
Sprint A (urgent, ce soir) :
1. Vérifier RESEND_API_KEY sur Vercel (action manuelle, pas 
   de code)
2. Bouton contrat visible mais grisé si non-Premium (au lieu 
   d'absent), y compris dans la modale du tray

Sprint B (structurel, peut attendre un peu) :
3. Séparer "Vos choix" et "Vos mises en relation" dans le tray 
   — refonte de layout
4. Redistribuer le score : Bio 30pts, Géo 25pts, Dates 35pts, 
   Désirabilité 10pts (retirer complètement Spécialités)
5. Ajouter l'explication du critère "Visibilité"

Déjà planifié séparément :
6. Score géo gradué → section 67 (sprint dédié, plus lourd)
```

---

## 76. Protection juridique et association d'un partenaire — points de vigilance

### Sur la protection de l'idée (rappel factuel, pas un conseil juridique)

- Une idée/concept n'est pas brevetable en tant que tel
- Le code est protégé automatiquement par le droit d'auteur 
  dès sa création (pas de dépôt nécessaire)
- Le nom "Soignect" peut être déposé comme marque à l'INPI 
  (~190€/classe) — protège le nom, pas le concept
- L'horodatage du PRODUCT_SPEC et des commits Git constitue 
  une preuve d'antériorité utile en cas de litige, sans être 
  une protection légale formelle

### Avant d'associer un partenaire (marketing/business)

Points à clarifier AVANT tout partage de code ou d'accès, 
à documenter par écrit (même simplement) :

```
- Répartition de propriété (parts, pourcentages) si société 
  créée à terme
- Qui apporte quoi : Jean-Charles apporte le concept, le code 
  existant, la légitimité métier (SNMKR, CPTS) ; le partenaire 
  apporte marketing/business — valoriser les deux apports
- Clause de non-concurrence si le partenaire quitte le projet
- Qui détient le nom de domaine, le repo GitHub, le compte 
  Vercel/Supabase (actuellement tout est au nom de Jean-Charles 
  — décider si ça reste ainsi ou si ça doit être transféré 
  à une structure commune)
- Accord de confidentialité (NDA) simple avant de montrer 
  le produit en détail, même à quelqu'un de confiance
```

### Recommandation pratique

Avant de donner accès au code ou aux identifiants (Vercel, 
Supabase, GitHub), rédiger un document simple d'une page 
(pas besoin d'un avocat à ce stade) qui acte :
- Qui a initié le projet et quand (déjà tracé par ce PRODUCT_SPEC)
- Les rôles de chacun
- Ce qui se passe si l'association ne fonctionne pas

Un avocat spécialisé en propriété intellectuelle/startups 
devient pertinent seulement si le projet prend une vraie 
dimension commerciale (levée de fonds, société formalisée) — 
pas nécessaire pour cette étape de test avec un partenaire 
de confiance.

---

## 77. Acquisition d'utilisateurs — invitation légale, pas création automatique

### Ce qui est à proscrire

Créer automatiquement des comptes (avec mot de passe généré) 
pour des personnes dont les coordonnées ont été récupérées 
sur des sites tiers (Facebook, petites annonces) sans leur 
consentement. Violation RGPD directe + risque réputationnel 
majeur pour un produit basé sur la confiance professionnelle.

### Alternative légale et efficace — le système d'invitation

```
1. Constituer une liste de PROSPECTS (pas de comptes) :
   nom, email, source (où trouvé), statut (invité/inscrit)
   → Table séparée, PAS la table User/Profile

2. Envoyer un email d'invitation personnalisé (pas un compte 
   déjà créé) :
   "Bonjour [Nom], je vous invite à découvrir Soignect, 
   une plateforme de mise en relation des professionnels 
   de santé en Guadeloupe. [Lien d'inscription]"
   
3. La personne clique et s'inscrit ELLE-MÊME, avec son propre 
   email et mot de passe — jamais de compte pré-créé
```

### Modèle de données — table Prospect (distincte de User)

```prisma
model Prospect {
  id          String   @id @default(cuid())
  name        String
  email       String   @unique
  source      String?  // "Facebook groupe kiné", "SNMKR", etc.
  invitedAt   DateTime?
  convertedAt DateTime?  // Rempli si devenu un vrai User
  createdAt   DateTime @default(now())
}
```

### Sourcing légal des emails de prospects

```
✅ Légal :
- Ton propre réseau professionnel (SNMKR, CPTS) — tu as 
  déjà une relation légitime
- Annuaires professionnels publics (Ordre des kinés, 
  RPPS public) — usage professionnel B2B généralement toléré 
  sous RGPD si finalité légitime et opt-out proposé
- Emails collectés via un formulaire "Être prévenu du 
  lancement" sur une landing page
- Parrainage : un utilisateur existant invite un confrère 
  (lui-même envoie l'email, pas toi)

❌ Illégal ou risqué :
- Scraping Facebook/Instagram de noms et emails
- Achat de bases de données email non qualifiées
- Extraction automatisée de sites de petites annonces
```

### Feature produit — parrainage (bien plus efficace)

Plutôt que le scraping, construire une feature de parrainage 
intégrée au produit :

```
Sur /compte : "Inviter un confrère"
→ Champ email + message personnalisable
→ Envoi d'un email d'invitation depuis Soignect 
  (via Resend, template dédié)
→ Tracking : qui a invité qui, taux de conversion
→ Éventuel bonus (ex: badge, boost temporaire de visibilité) 
  pour les parrains actifs
```

C'est légal, plus efficace (recommandation par un pair = 
confiance immédiate), et cohérent avec ton positionnement 
professionnel (SNMKR, CPTS).

### Ordre d'implémentation

```
Sprint futur (pas urgent pour les tout premiers bêta testeurs) :
1. Feature "Inviter un confrère" sur /compte
2. Email d'invitation via Resend avec lien d'inscription
3. Tracking basique des invitations/conversions
```

### Priorité immédiate pour Jean-Charles

Pour le lancement initial, le canal le plus efficace reste 
celui déjà identifié : poster dans le groupe Facebook des 
10 000 kinés de Guadeloupe (que tu rejoins légitimement en 
tant que membre), pas du scraping automatisé.

---

## 78. BUG — recommandation affichée prématurément, avant toute mission réalisée

### Problème identifié

Sur la page "Mes mises en relation", la question "Recommandez-vous 
ce cabinet ?" (Oui/Non) apparaît dès la phase de mise en relation 
initiale — avant même d'avoir ouvert le chat, avant tout contrat 
signé, avant que la mission ait eu lieu. C'est une incohérence 
logique totale : on ne peut pas recommander une expérience qui 
n'a pas encore eu lieu.

Cette règle était pourtant déjà spécifiée dès les premières 
sections du projet (section sur /match/[id] — bouton "Noter" 
grisé avec tooltip jusqu'à la date de fin de mission) mais 
n'est visiblement pas appliquée sur cette page "Mes mises 
en relation".

### Règle à respecter — séquence complète

```
1. Mise en relation créée (swipe réciproque)
   → PAS de recommandation possible
   → Actions disponibles : Ouvrir le chat, Confirmer, Décliner

2. Chat en cours, contrat éventuellement envoyé/signé
   → PAS de recommandation possible
   → La mission n'a pas encore eu lieu

3. Contrat confirmé (double signature), mission en cours
   → PAS de recommandation possible
   → On ne peut pas juger une collaboration en cours

4. Date de fin de mission dépassée
   → SEULEMENT MAINTENANT la recommandation devient possible
   → "Recommanderiez-vous ce cabinet à un confrère ?" Oui/Non
```

### Correction à appliquer

```
Sur la page "Mes mises en relation" (et partout où ce bloc 
apparaît — tray, fiche match), la question de recommandation 
ne doit s'afficher QUE SI :

- Un contrat a été confirmé (contratStatus = CONFIRME) ET
- La date de fin de la mission (blockedEndDate ou endDate 
  de la Mission liée) est dans le passé (< aujourd'hui)

Sinon, ce bloc est totalement absent (pas grisé, absent) 
tant que ces deux conditions ne sont pas remplies.
```

### Code de vérification

```typescript
function canShowRecommendation(match: Match): boolean {
  if (match.contratStatus !== "CONFIRME") return false
  const endDate = match.blockedEndDate ?? mission.endDate
  if (!endDate) return false  // Durée indéterminée : jamais 
                                // de recommandation tant que 
                                // pas de date de fin connue/passée
  return new Date(endDate) < new Date()
}
```

### Ordre d'implémentation

Correction urgente à ajouter au prochain sprint — c'est un 
bug de logique métier visible immédiatement par tout testeur, 
qui nuit à la crédibilité du système de notation (déjà pensé 
comme un argument de confiance fort du produit, section 4).

```
1. Retirer l'affichage de "Recommandez-vous ce cabinet ?" 
   sur la page "Mes mises en relation" pour toute mise en 
   relation qui n'a pas encore de contrat confirmé ET 
   date de fin passée
2. Vérifier que cette même règle est appliquée partout 
   ailleurs où la recommandation pourrait apparaître 
   (tray, fiche match individuelle)
```

---

## 79. Correction section 78 — système dédié de notation post-mission (façon Airbnb)

### Le vrai besoin — pas un simple correctif d'affichage

Il ne s'agit pas juste de cacher/griser la recommandation sur 
l'écran actuel de mise en relation. Il faut un SYSTÈME SÉPARÉ 
qui se déclenche automatiquement le lendemain de la fin de 
mission, symétrique entre les deux parties (comme Airbnb : 
le voyageur note l'hôte ET l'hôte note le voyageur, chacun 
sans voir la note de l'autre avant d'avoir soumis la sienne).

### Déclenchement du système

```
Jour J = date de fin de mission (blockedEndDate ou endDate)
Jour J+1 = déclenchement automatique de la demande de notation

Les DEUX parties reçoivent la même sollicitation en parallèle :
- Le remplaçant/assistant est invité à noter le cabinet
- Le cabinet est invité à noter le remplaçant/assistant
```

### Relances itératives en cas de non-complétion

```
J+1   : Première sollicitation (email + notification in-app)
J+8   : Relance si pas encore répondu
J+15  : Relance si pas encore répondu
J+22  : Relance si pas encore répondu
J+30  : Dernière relance, puis abandon (la notation reste 
        possible manuellement plus tard depuis /matches, 
        mais plus de relance automatique après un mois)
```

### Où vit cette notation — nouvel espace dédié

Plutôt que d'apparaître sur la fiche de mise en relation 
initiale (qui reste focalisée sur le processus match → chat 
→ contrat), créer un espace dédié :

```
Nouvelle section : "Missions terminées — à évaluer"
Accessible depuis /matches ou une page dédiée /evaluations

Affiche uniquement les missions dont la date de fin est 
passée ET qui n'ont pas encore été évaluées par l'utilisateur 
courant.

Pour chaque mission terminée non évaluée :
"Comment s'est passée votre mission avec [Nom] ?"
[Recommanderiez-vous cette personne/ce cabinet à un confrère ?]
  ✓ Oui    ✗ Non
[Critères détaillés optionnels — section 4]
```

### Principe de symétrie sans visibilité croisée immédiate

```
Comme sur Airbnb : chaque partie note l'autre indépendamment.
La note n'est révélée aux deux parties (ou publiée si c'est 
une note publique côté cabinet, section 4) qu'une fois que 
LES DEUX ont soumis leur évaluation, OU après un délai 
(ex: 14 jours), pour éviter les notations de représailles 
(l'un attend de voir la note de l'autre avant de noter 
en retour).
```

### Modèle de données

```prisma
// Sur CabinetRating et RemplacantRating (déjà existants, 
// section 4) — ajouter :

model CabinetRating {
  // ... champs existants ...
  missionEndDate    DateTime  // Date de fin de la mission concernée
  sollicitedAt      DateTime  // J+1, date de première sollicitation
  lastReminderAt    DateTime? // Date de la dernière relance envoyée
  reminderCount     Int       @default(0)
  isPublished       Boolean   @default(false) // Déjà existant
}

// Idem pour RemplacantRating
```

### Job de relance automatique

```
Un cron (ou tâche planifiée) qui tourne quotidiennement :
1. Cherche les missions dont blockedEndDate = hier (J+1)
   → Crée les sollicitations initiales pour les deux parties
2. Cherche les sollicitations non complétées dont 
   lastReminderAt date de plus de 7 jours ET reminderCount < 4
   → Envoie une relance (email via Resend)
   → Incrémente reminderCount, met à jour lastReminderAt
3. Au-delà de reminderCount = 4 (soit J+30), arrête les relances 
   automatiques — la notation reste possible manuellement
```

### Emails de sollicitation/relance (via Resend, section 51)

```
Sollicitation initiale (J+1) :
Sujet : "Comment s'est passée votre mission avec [Nom] ?"
Corps : "Votre mission du [dates] est terminée. 
         Donnez votre avis en 10 secondes."
[Bouton → lien direct vers l'évaluation]

Relance (J+8, J+15, J+22, J+30) :
Sujet : "N'oubliez pas d'évaluer votre dernière mission"
Corps : plus bref, rappel simple avec le lien
```

### Ordre d'implémentation

```
Sprint dédié (plus conséquent que section 78 initiale) :
1. Nouvelle page/section "Missions terminées à évaluer"
2. Vérifier/étendre le modèle CabinetRating/RemplacantRating 
   avec les champs de tracking (sollicitedAt, lastReminderAt, 
   reminderCount)
3. Job quotidien de détection des missions terminées J+1 
   → création des sollicitations
4. Job quotidien de relance (email Resend) selon le calendrier 
   J+8/15/22/30
5. Retirer complètement le bloc "Recommandez-vous ?" de l'écran 
   de mise en relation initiale (correction section 78 — 
   ce n'est PAS le bon endroit, quelle que soit la condition)
6. Symétrie de visibilité : ne révéler les notes qu'une fois 
   les deux parties ayant répondu, ou après délai de 14 jours
```

### Priorité

Ce sprint est plus lourd qu'un simple correctif d'affichage — 
à traiter après le cœur du tunnel (menu universel, bugs 
bloquants du jour), pas ce soir. Mais RETIRER le bloc 
prématuré de l'écran actuel (partie simple de la section 78) 
reste à faire dès ce soir pour éviter la confusion immédiate.

---

## 80. Deux éléments nouveaux issus de la synthèse orale

### Nouveau 1 — Éditeur de contrat en texte enrichi embarqué

Contrairement à ce qui était spécifié jusqu'ici (formulaire 
avec champs séparés : rayon km, durée ans, taux %, checkbox 
période d'essai), Jean-Charles précise que TOUS les détails 
économiques et légaux doivent être éditables directement dans 
un éditeur de texte enrichi embarqué — pas une collection 
de champs de formulaire séparés.

```
AVANT (spécifié sections 39/40) :
Formulaire avec champs distincts :
- Rayon non-concurrence (input number)
- Durée non-concurrence (input number)
- Taux rétrocession (input number)
- Checkbox période d'essai

APRÈS (précision demandée) :
Le contrat généré (texte CNOMK complet) s'affiche dans un 
éditeur de texte enrichi (type WYSIWYG léger) où l'utilisateur 
peut cliquer directement dans le texte et modifier n'importe 
quelle valeur inline — les rayons, durées, taux, clauses — 
sans passer par des champs de formulaire séparés en dehors 
du texte.
```

Cela change l'approche technique : au lieu de générer le PDF 
depuis des données structurées uniquement, il faut un éditeur 
de texte riche (ex: TipTap, Slate, ou solution similaire 
compatible React) qui permette l'édition directe du contenu 
avant génération finale du PDF.

### Nouveau 2 — Limite absolue de 10 échanges de chat avant décision

Sur le fil de discussion d'un match, un maximum de 10 échanges 
(messages) est autorisé avant que le système impose une 
décision : soit l'édition d'un contrat, soit l'annulation 
du match. Objectif : éviter les discussions interminables 
sans engagement, forcer la décisivité.

```
Comportement à implémenter :
- Compter les messages échangés sur un match (les deux 
  parties confondues)
- À l'approche de la limite (ex: après 8 messages), afficher 
  un bandeau d'alerte dans le chat : 
  "Il vous reste 2 échanges avant de devoir statuer 
  (contrat ou annulation)"
- Au 10ème message, bloquer l'envoi de nouveaux messages 
  tant qu'une décision n'est pas prise (bouton contrat 
  ou bouton annuler devient obligatoire pour continuer)
```

Cette contrainte est cohérente avec la philosophie du produit : 
un outil de pilotage rapide, pas un espace de discussion 
prolongée sans finalité.

### Ordre d'implémentation

```
Ces deux éléments sont substantiels — sprints dédiés séparés, 
après stabilisation du cœur du tunnel (menu universel, bugs 
du jour) :

1. Éditeur de texte enrichi pour le contrat — nécessite le 
   choix d'une librairie (TipTap recommandé pour React/Next.js), 
   intégration avec la génération PDF finale
2. Limite de 10 échanges — plus simple, un compteur + une 
   contrainte UI sur ChatModal.tsx
```

---

## 81. Récapitulatif consolidé — confrontation vision orale vs spec écrite

### Ce qui est CONFIRMÉ et déjà correctement documenté

```
✅ Booking comme écran d'accueil (section 44)
✅ Timeline centrée sur "aujourd'hui", navigable dans le temps 
   (section 46/47 — flèche aujourd'hui, zooms Mois/Trimestre/
   Année/2ans)
✅ Timeline unique pour remplaçant (disponibilites board)
✅ Timeline unique pour assistant autonome cherchant ses 
   propres remplaçants (section 62, scénario 3)
✅ Timelines multiples pour titulaire avec plusieurs postes 
   (section 60, scénario 1)
✅ Clic sur timeline → déclarer une vacance → proposer une 
   annonce pré-remplie avec les dates de la zone (sections 
   43, 55, 64 — menu universel)
✅ Matching sur critères géo + bio DeepSeek (section 25, 
   révisé section 75 : Dates 35/Bio 30/Géo 25/Désirabilité 10)
✅ Score géographique gradué par distance réelle (section 67)
✅ Bonus de pertinence territoriale pour vente CPTS (section 
   72 — MAIS Jean-Charles souhaite l'avancer dans le temps, 
   pas le repousser après traction commerciale confirmée — 
   à rediscuter la priorité)
✅ Portefeuille remplaçant : distinction entre "mes vacances 
   déclarées" et "zones restant à pourvoir" (disponibilites 
   board, section 43 appliqué symétriquement)
✅ Système de notation post-mission avec relances hebdomadaires 
   jusqu'à un mois, respect de la confraternité (section 79 
   — déjà aligné avec cette demande)
✅ Interface épurée, minimum de cases à cocher (sections 69, 
   71 — retrait spécialités, simplification formulaires)
```

### Ce qui est NOUVEAU et à ajouter (section 80 ci-dessus)

```
🆕 Éditeur de contrat en texte enrichi embarqué (pas des 
   champs de formulaire séparés)
🆕 Limite de 10 échanges de chat avant décision obligatoire 
   (contrat ou annulation)
```

### Point à clarifier — priorité de la pertinence territoriale

Jean-Charles semble vouloir avancer la section 72 (bonus 
territorial pour vente CPTS) plus tôt que ce qui était 
initialement cadré ("pas à coder avant traction commerciale 
confirmée"). Cela dépend du score géo gradué (section 67) 
comme prérequis technique — donc la vraie question est : 
veut-on prioriser le sprint section 67 (score géo gradué + 
données GPS communes) plus tôt dans la roadmap, sachant 
qu'il permettrait ensuite d'implémenter plus vite le bonus 
territorial ?

### Ce qui reste flou ou à préciser davantage

```
? La "projection temporelle adaptable" — navigation vers 
  les dates passées : est-ce déjà couvert par les zooms 
  existants (Mois/Trimestre/Année/2ans) qui montrent une 
  fenêtre glissante autour d'aujourd'hui, ou faut-il un 
  contrôle de navigation supplémentaire (boutons ← → pour 
  se déplacer dans le temps librement, y compris très loin 
  dans le passé) ?
```

### Priorité immédiate (rappel, inchangée par cette synthèse)

Les bugs bloquants et le menu universel (sections 64, 73, 
78/79 partie simple) restent la priorité de ce soir. Les 
deux nouveaux éléments (section 80) et la question de 
priorité territoriale sont à traiter dans les sprints suivants, 
une fois le tunnel de base stabilisé et testé par de vrais 
utilisateurs.

---

## 82. Algorithme territorial — penser correctement, pas juste interroger l'IA sur du flou

### L'exigence formulée par Jean-Charles

Ne pas se contenter d'un appel DeepSeek qui "devine" la 
pertinence territoriale à partir de texte flou. Construire 
un vrai algorithme structuré, avec des données réelles et 
un calcul reproductible, où l'IA (DeepSeek) intervient là 
où elle apporte une vraie valeur (analyse sémantique du texte 
libre), et où le calcul géographique/statistique repose sur 
des données factuelles, pas sur une estimation du modèle.

### Distinction claire des deux couches

```
COUCHE 1 — Calcul déterministe (PAS d'IA, données factuelles)
  - Distance géographique réelle (Haversine, section 67)
  - Indice APL par profession et par commune (sections 15, 29, 30)
  - Densité de professionnels par territoire (RPPS, section 30)
  - Historique des postes non couverts sur une zone donnée 
    (données internes Soignect — combien de temps un poste 
    reste vacant dans telle commune)

COUCHE 2 — Analyse sémantique (IA DeepSeek, pertinente ici)
  - Compatibilité de valeurs/projet entre deux textes libres 
    (bioTinder/accroche) — c'est LE bon usage de l'IA dans 
    ce produit, pas le calcul géographique
```

L'erreur à éviter : demander à DeepSeek "quelle est la 
pertinence géographique de cette annonce" en lui donnant 
du texte flou — ça donnerait un résultat non reproductible, 
non auditable, et difficile à justifier commercialement 
face à une CPTS qui paierait pour ce service.

### Vers un vrai indice de tension territoriale (à construire)

```
Pour chaque commune × profession, calculer un score de 
tension composite basé sur des données vérifiables :

TensionScore = f(
  APL_actuel,                    // Section 15/29 — donnée DREES
  nb_postes_non_couverts_30j,    // Donnée interne Soignect, 
                                   // calculée en continu
  duree_moyenne_vacance_poste,   // Donnée interne Soignect
  ratio_offre_demande_zone       // Nb annonces actives / 
                                   // Nb remplaçants disponibles 
                                   // dans un rayon donné
)
```

Ce score est un CALCUL, pas une estimation IA — reproductible, 
explicable, et défendable commercialement devant une CPTS 
qui voudrait comprendre pourquoi elle paie pour tel niveau 
de boost.

### Facturation du bonus territorial — modèle par points

Jean-Charles précise un point important : le bonus de 
pertinence géographique doit être QUANTIFIABLE et FACTURABLE 
par tranche, pas un boost binaire tout-ou-rien.

```
Modèle de facturation par points de boost territorial :

Une CPTS ou maison de santé peut acheter un nombre de POINTS 
de boost territorial à appliquer sur les annonces de sa zone :

  +5 points de boost territorial  → tarif A €/mois
  +10 points de boost territorial → tarif B €/mois  
  +20 points de boost territorial → tarif C €/mois

Ces points s'ADDITIONNENT au score de désirabilité standard 
existant (section 23), mais sont comptabilisés et facturés 
séparément — traçabilité claire de ce qui est acheté et 
pourquoi.
```

### Modèle de données

```prisma
model TerritorialBoost {
  id              String   @id @default(cuid())
  institutionId   String   // CPTS ou MSP acheteuse
  institution     Profile  @relation(fields: [institutionId], references: [id])
  targetCommunes  String[] // Communes concernées par ce boost
  targetProfession Profession?  // null = toutes professions
  pointsAllocated Int      // Nombre de points achetés
  pricePerMonth   Float    // Tarif payé
  activeFrom      DateTime
  activeUntil     DateTime?
  createdAt       DateTime @default(now())
}
```

Le calcul du score de désirabilité (section 23) intègre 
ensuite ce boost territorial comme composante additionnelle, 
distincte et traçable :

```typescript
function calcDesirability(profile: Profile, mission: Mission, commune: CommuneAPL): number {
  let score = /* calcul standard existant, section 23 */
  
  // Boost territorial acheté par une institution (nouveau)
  const territorialBoost = getActiveTerritorialBoost(commune, mission.profession)
  score += territorialBoost?.pointsAllocated ?? 0
  
  return Math.min(score, 20) // plafond à ajuster si le boost 
                               // territorial doit dépasser le 
                               // plafond standard de 10
}
```

### Pourquoi ce modèle est commercialement fort

```
Un cabinet paie pour SA propre visibilité (Premium/Boost, 
section 11) — logique individuelle.

Une CPTS paie pour la visibilité DE TOUTE UNE ZONE — logique 
de santé publique. C'est un produit différent, avec une 
justification différente (données de tension réelle, pas 
juste "je veux être vu plus"), qui légitime un tarif 
institutionnel plus élevé et un argumentaire commercial 
factuel : "voici les données qui montrent que cette zone 
est sous-tension, voici combien coûte le boost pour 
compenser cet écart."
```

### Ordre d'implémentation — séquence technique nécessaire

```
Prérequis absolu (à faire avant tout le reste) :
1. Score géographique gradué (section 67) — distance réelle 
   Haversine + coordonnées GPS des communes

Ensuite, construction de l'indice de tension :
2. Table de suivi des postes non couverts dans le temps 
   (déjà en partie disponible via briqueStatus + historique 
   des Mission, à agréger)
3. Calcul du TensionScore par commune × profession (job 
   périodique, ex: recalcul hebdomadaire)
4. Stockage du TensionScore dans CommuneAPL ou table dédiée

Puis la brique commerciale :
5. Modèle TerritorialBoost (achat de points par une institution)
6. Interface admin pour qu'une CPTS (ou Jean-Charles en son 
   nom au début) configure et active un boost territorial
7. Intégration dans le calcul de désirabilité final
```

### Priorité réelle

Cette brique est ambitieuse et représente un vrai axe de 
différenciation face à Macasaa (section 54) et un axe de 
revenu institutionnel fort (section 53). Mais elle a une 
dépendance technique claire : le score géo gradué (section 67) 
doit être fait EN PREMIER, sinon toute la couche territoriale 
n'a pas de fondation solide.

**Recommandation d'ordre** : après stabilisation du tunnel 
de base (bugs du jour, menu universel), faire du score géo 
gradué (section 67) la PROCHAINE priorité de fond, précisément 
parce qu'il conditionne cette vision territoriale que 
Jean-Charles veut avancer dans le temps.

---

## 83. Correction méthodologique — vraie formule APL, à reprendre demain

### Ce qu'on avait implémenté (trop simpliste)

Notre calcul actuel (sections 15, 29) était une densité 
simplifiée (nombre de professionnels / population), avec 
une distance à vol d'oiseau (Haversine, section 67) — 
proche de ce que la vraie méthodologie DREES appelle 
justement la limite des indicateurs classiques à éviter.

### Ce que la vraie APL DREES fait réellement

```
1. Distance en TEMPS DE TRAJET RÉEL (pas à vol d'oiseau)
   Source officielle : distancier Metric de l'Insee, qui 
   calcule le temps moyen de parcours en voiture d'une 
   commune à une autre, en tenant compte du type de route, 
   de la sinuosité et de l'altimétrie.
   → Pertinent pour la Guadeloupe : le relief (Basse-Terre 
     montagneuse vs Grande-Terre plate) rend la distance à 
     vol d'oiseau très trompeuse localement.

2. Prise en compte des COMMUNES VOISINES
   L'offre et la demande des communes environnantes sont 
   intégrées, pas seulement la commune elle-même — c'est 
   ce qui corrige la limite de la simple densité communale.

3. Pondération par ACTIVITÉ RÉELLE du professionnel
   Un professionnel à mi-temps ne compte pas comme un 
   équivalent temps plein — l'offre est mesurée en ETP 
   (équivalent temps plein), calculé à partir du volume 
   d'actes réalisés, pas juste "présent ou pas".

4. Seuils de temps DIFFÉRENTS selon la profession
   Ex: 30 minutes pour les médecins généralistes — d'autres 
   seuils existent pour d'autres professions/services.

5. Formules DIFFÉRENTES médecins vs paramédicaux
   Confirmé : la DREES publie des jeux de données et 
   méthodologies séparés pour médecins généralistes, 
   infirmiers, sages-femmes, kinésithérapeutes, chirurgiens-
   dentistes — pas une formule unique.
```

### Nouvelle question soulevée — échelle CPTS plutôt que commune

Jean-Charles propose de réfléchir à un découpage par CPTS 
plutôt que par commune, avec l'ambition de calculer cet 
indice pour TOUTES les CPTS de France, en le confrontant 
à l'indice APL officiel actuel/futur.

```
Question ouverte à trancher lors de la reprise :
- Le découpage géographique administratif (commune, EPCI, 
  CPTS) n'est effectivement pas homogène sur le territoire 
  français — les périmètres CPTS varient en taille et en 
  logique de regroupement selon les régions.
- Faut-il calculer l'indice à l'échelle commune (comme la 
  DREES) puis l'agréger à l'échelle CPTS pour la vente 
  institutionnelle, plutôt que de recalculer un découpage 
  CPTS distinct ?
- Existe-t-il une donnée publique officielle du découpage 
  des CPTS (liste des communes membres par CPTS) à récupérer, 
  similaire à ce qui existe pour les zones ARS (déjà utilisé, 
  section 14-16) ?
```

### Ce que ça implique pour la suite (à reprendre, pas ce soir)

```
Avant de coder quoi que ce soit sur le score géo gradué 
(section 67) et la couche territoriale (section 82), 
il faut clarifier :

1. Reste-t-on sur une distance à vol d'oiseau simplifiée 
   (Haversine, rapide à implémenter) pour le MVP, en 
   assumant que c'est une approximation raisonnable en 
   Guadeloupe vu la taille du territoire, OU vise-t-on 
   d'emblée un vrai temps de trajet routier (nécessite 
   une API de calcul d'itinéraire, ex: Google Maps 
   Distance Matrix, OSRM, ou équivalent) ?

2. Le distancier Metric de l'Insee est-il exploitable / 
   accessible en API pour un usage comme Soignect, ou 
   est-ce réservé à un usage interne DREES ?

3. Faut-il répliquer la vraie formule APL (avec ETP, seuils 
   par profession) ou construire un indice DÉLIBÉRÉMENT 
   plus simple mais TRANSPARENT et adapté à l'usage Soignect 
   (pas nécessairement identique à l'APL officiel, mais 
   cohérent et défendable) ?

4. Rechercher l'existence d'un découpage géographique 
   officiel des CPTS (liste des communes par CPTS) 
   disponible en open data.
```

### Décision de méthode pour la session de reprise

Cette question mérite une vraie session de travail dédiée, 
pas une décision précipitée en fin de journée. À reprendre 
avec calme, en confrontant les options ci-dessus, avant 
de lancer le sprint technique du score géo gradué (section 67).

Le sprint des bugs bloquants et du menu universel (priorité 
de ce soir) n'est pas impacté par cette question — il peut 
avancer indépendamment.

---

## 84. Distinction critique — tension inter-territoriale vs intra-territoriale

### Le problème identifié par Jean-Charles

Selon les critères NATIONAUX, la Guadeloupe dans son ensemble 
n'est pas en zone sous-dotée en kinésithérapie (rappel : 
confirmé sections 14-16, arrêté ARS — pas de zone "sous-dotée" 
kiné en Guadeloupe au sens national/ARS).

MAIS à l'échelle INTRA-département ou INTRA-CPTS, il existe 
de vraies disparités : certaines communes (ex: Pointe-Noire, 
déjà identifiée zone intermédiaire) ont un besoin réel plus 
fort que d'autres communes du même département qui sont 
déjà bien dotées (ex: Le Lamentin, cité en exemple).

**Le risque à éviter absolument** : un algorithme de boost 
territorial qui se base uniquement sur des seuils nationaux 
(ARS, DREES) ne détecterait AUCUNE tension en Guadeloupe, 
puisque le département entier est classé "non prioritaire" 
au niveau national — alors qu'il existe une vraie hétérogénéité 
interne qui mérite d'être valorisée.

### La bonne échelle de calcul — RELATIVE, pas ABSOLUE

```
ERREUR À NE PAS FAIRE :
Comparer chaque commune à un seuil NATIONAL fixe 
(ex: "sous-doté si APL < X au niveau France entière")
→ Résultat : la Guadeloupe entière serait "non prioritaire", 
  aucune commune ne ressortirait comme nécessitant un boost.

BONNE APPROCHE (déjà pressentie section 15, à confirmer/
renforcer) :
Comparer chaque commune à la MÉDIANE ou aux QUARTILES de 
son propre territoire de référence (département ou CPTS), 
PAS à un seuil national absolu.
→ Résultat : même si toute la Guadeloupe est "bien dotée" 
  au sens national, Pointe-Noire ressort comme relativement 
  moins dotée que Le Lamentin AU SEIN du même département — 
  et c'est CETTE tension relative qui doit générer le boost.
```

### Ce qui était déjà bien pensé (à confirmer/consolider)

Le calcul de boost déjà spécifié section 15 utilisait bien 
une logique de comparaison PAR DÉPARTEMENT (P25/médiane 
départementale), pas un seuil national — c'est la bonne 
direction. Cette section 84 vient confirmer et renforcer 
ce principe comme RÈGLE ABSOLUE à ne jamais casser, y compris 
quand on construira la couche CPTS (section 82/83) : 

```
RÈGLE ABSOLUE pour tout calcul de tension territoriale 
dans Soignect :

Le score de tension d'une commune (ou d'une zone CPTS) 
se calcule TOUJOURS relativement à son territoire de 
référence immédiat (département, ou CPTS si le découpage 
CPTS est retenu) — JAMAIS par rapport à un seuil national 
absolu.

Ça permet de révéler les tensions INTRA-territoriales même 
dans des régions globalement bien dotées au niveau national — 
c'est précisément ce qui rend Soignect utile là où les 
indicateurs nationaux (ARS) sont trop grossiers pour capter 
la réalité de terrain.
```

### Pourquoi c'est un vrai argument de vente CPTS

C'est exactement l'argument qui justifie que Soignect apporte 
une valeur que l'ARS/DREES n'apporte pas à cette échelle fine :

```
"Au niveau national, votre département n'est pas prioritaire. 
Mais AU SEIN de votre CPTS, telle commune est structurellement 
moins bien couverte que ses voisines. Soignect peut orienter 
la visibilité des annonces de remplacement vers cette zone 
précise, alors que les dispositifs nationaux ne peuvent pas 
descendre à cette granularité."
```

C'est un angle mort des dispositifs publics existants (ARS, 
zonage national) que Soignect peut occuper.

### Impact sur le calcul du TensionScore (section 82)

```typescript
// Correction du principe de calcul (section 82) — 
// toujours relatif au territoire de référence, jamais absolu

function calcTensionScore(
  commune: CommuneAPL, 
  toutesLesCommunesDuMemeTerritoire: CommuneAPL[]  
  // = même département, ou même CPTS selon le découpage retenu
): number {
  const valeursDuTerritoire = toutesLesCommunesDuMemeTerritoire
    .map(c => c.aplKine) // ou profession concernée
    .sort((a, b) => a - b)
  
  const mediane = valeursDuTerritoire[Math.floor(valeursDuTerritoire.length / 2)]
  const p25 = valeursDuTerritoire[Math.floor(valeursDuTerritoire.length * 0.25)]
  
  // Comparaison RELATIVE à ce territoire, jamais à un seuil national
  if (commune.aplKine < p25) return 3      // Tension forte relative
  if (commune.aplKine < mediane) return 1  // Tension modérée relative
  return 0                                  // Bien doté relativement
}
```

### Ordre d'implémentation

Cette clarification s'intègre directement dans le sprint 
du score géo gradué + couche territoriale (sections 67, 82, 
83) déjà planifié pour la reprise. Pas de nouveau sprint 
séparé — c'est une précision de PRINCIPE à respecter dans 
l'implémentation de ces sections, particulièrement importante 
à ne pas perdre de vue.

### Point à trancher également à la reprise

Le territoire de référence pour ce calcul relatif doit-il 
être :
```
- Le département (comme actuellement, section 15) — plus 
  simple, données déjà structurées ainsi
- La CPTS (nouvelle idée, section 83) — plus fin et plus 
  vendable commercialement, mais nécessite le découpage 
  CPTS en données, à rechercher
- Les deux niveaux, avec le département comme fallback 
  si le découpage CPTS n'est pas disponible pour une zone donnée
```

---

## 85. Clients institutionnels — CPTS, MSP, ARS, CGSS : logiques distinctes

### Le problème à trancher — ce ne sont pas les mêmes acheteurs

```
CPTS (Communauté Professionnelle Territoriale de Santé)
  Logique  : coordination locale entre professionnels d'un 
             territoire, structure de terrain, budget limité 
             mais décision rapide (Jean-Charles en est 
             secrétaire — accès direct)
  Besoin   : combler des trous de planning concrets sur SON 
             territoire, argument très opérationnel
  Budget   : modeste (structure associative, financement 
             conventionnel limité)
  Décideur : bureau CPTS, décision relativement rapide

MSP (Maison de Santé Pluriprofessionnelle)
  Logique  : structure d'exercice coordonné, plus proche 
             d'un "gros cabinet" que d'une institution
  Besoin   : identique à un cabinet, mais à plus grande échelle 
             (plusieurs professions sous un même toit)
  Budget   : intermédiaire, décision portée par le gérant/
             coordinateur MSP
  Décideur : rapide, un peu comme un cabinet

ARS (Agence Régionale de Santé)
  Logique  : pilotage RÉGIONAL de l'offre de soins, enjeu 
             de politique publique, pas de gestion 
             opérationnelle directe de plannings
  Besoin   : VISION AGRÉGÉE de la tension territoriale 
             (tableaux de bord, cartographie), pas 
             l'outil de matching lui-même
  Budget   : potentiellement important (marché public), 
             mais process d'achat long et complexe 
             (appels d'offres, cahier des charges)
  Décideur : administration, cycle de décision long 
             (plusieurs mois, voire années)

CGSS (Caisse Générale de Sécurité Sociale — équivalent CPAM 
       dans les DOM)
  Logique  : gestion de l'Assurance Maladie dans les DOM, 
             intérêt pour la maîtrise des dépenses de santé 
             et la lutte contre les déserts médicaux
  Besoin   : proche de l'ARS — vision agrégée, pas l'outil 
             opérationnel
  Budget   : institutionnel, process d'achat public complexe
  Décideur : administration, cycle long
```

### Ce que ça implique — deux produits différents, pas un seul

```
PRODUIT A — "Soignect Territoire" (déjà en germe, sections 
82-84)
  Vendu à : CPTS et MSP
  Nature  : boost de visibilité ciblé sur leur zone, 
            fonctionnalité intégrée à la plateforme existante
  Prix    : modeste (cohérent avec budget CPTS/MSP), 
            ex: 99-199€/mois déjà évoqué section 26
  Vente   : directe, rapide, toi-même en tant que secrétaire 
            CPTS peux ouvrir des portes

PRODUIT B — "Soignect Observatoire" (nouveau, à explorer)
  Vendu à : ARS, CGSS, voire Conseil Départemental
  Nature  : PAS l'outil de matching lui-même, mais un 
            TABLEAU DE BORD / RAPPORT AGRÉGÉ anonymisé 
            sur les tensions de recrutement observées via 
            Soignect (durée moyenne de vacance de poste par 
            zone, taux de couverture, évolution dans le temps)
  Prix    : plus élevé (budget institutionnel), mais process 
            d'achat public long — pas pour maintenant
  Vente   : nécessite une vraie donnée agrégée sur plusieurs 
            mois/années d'usage Soignect avant d'être crédible 
            — pas vendable avant d'avoir du volume réel
```

### "L'un n'empêche pas l'autre" — confirmé, mais pas en même temps

```
Séquence réaliste :
1. MAINTENANT → Produit A (CPTS/MSP), ton accès direct 
   via ton réseau, prix modeste, vente rapide
2. DANS 12-24 MOIS → Produit B (ARS/CGSS), une fois que 
   Soignect a accumulé assez de données réelles sur plusieurs 
   territoires pour produire un observatoire crédible et 
   vendable à un acheteur institutionnel exigeant
```

Vendre à une ARS/CGSS AVANT d'avoir des données solides serait 
prématuré — ils achèteront une preuve de valeur (données 
réelles accumulées), pas une promesse. Le Produit A sert 
justement à accumuler cette légitimité et ces données.

### Sur le prix du Produit A — à trancher, pas urgent ce soir

```
Déjà évoqué (section 26) : 99€/mois ou 990€/an pour CPTS/MSP.
Reste à valider :
- Est-ce trop cher pour une petite CPTS comme celle de 
  Jean-Charles (test réel avec sa propre structure, 
  actuellement gratuite en tant que partenaire fondateur, 
  section 53) ?
- Faut-il un tarif dégressif selon la taille de la CPTS 
  (nombre de communes, nombre de professionnels couverts) ?
```

### Ordre d'implémentation

```
Produit A (CPTS/MSP) : suite logique directe des sections 
82-84 déjà en cours de réflexion — pas de nouveau développement 
séparé, c'est la même brique technique.

Produit B (ARS/CGSS/Observatoire) : à ne PAS développer 
maintenant. Noter l'idée, la garder en réserve stratégique 
pour dans 12-24 mois, une fois que Soignect aura assez 
d'historique de données réelles pour construire un vrai 
observatoire crédible.
```

---

## 86. Back-office de traçabilité — collecter la preuve dès maintenant

### Principe fondamental

Sans collecte structurée dès le premier jour d'usage réel, 
Soignect ne pourra JAMAIS produire de preuve crédible pour 
un pitch ARS/CGSS dans 18 mois — on ne peut pas reconstruire 
un historique après coup. La collecte doit commencer 
MAINTENANT, même si elle n'est exploitée que plus tard.

### Ce qu'il faut tracer — inventaire des données probantes

```
NIVEAU 1 — Traçabilité des annonces et couverture
- Chaque annonce publiée : commune, profession, type de poste, 
  date de publication
- Délai entre publication et premier swipe reçu
- Délai entre publication et match confirmé
- Délai entre match et contrat signé
- Délai TOTAL entre "poste devient non couvert" et "poste 
  redevient couvert" — LA métrique clé de preuve d'utilité
- Si un poste reste non couvert au-delà d'un seuil (30j, 90j) 
  → tracer cette vacance prolongée comme donnée de tension

NIVEAU 2 — Traçabilité des échanges (déjà en partie acquis)
- Nombre de messages échangés avant décision (contrat ou 
  annulation) — déjà lié à la limite de 10 échanges, section 80
- Taux de conversion : swipe → match → chat → contrat → 
  signature (funnel complet)
- Taux d'annulation de match et à quelle étape

NIVEAU 3 — Traçabilité géographique agrégée
- Répartition des annonces par commune dans le temps
- Évolution du taux de couverture par commune (mois par mois)
- Corrélation entre le score de tension calculé (section 82) 
  et le temps réel de couverture observé — CECI EST LA PREUVE 
  ULTIME : si Soignect prédit qu'une commune est tendue ET 
  que les données confirment que les postes y restent plus 
  longtemps non couverts, c'est une preuve statistique solide

NIVEAU 4 — Traçabilité de la valeur ajoutée
- Nombre total de mises en relation confirmées depuis le 
  lancement
- Nombre de contrats effectivement signés
- Répartition par profession, par type de contrat 
  (remplacement/assistanat/collaboration)
- Anonymisé : jamais de données nominatives dans un rapport 
  destiné à une administration
```

### Modèle de données dédié — table d'événements horodatés

Plutôt que de recalculer ces métriques a posteriori depuis 
les tables métier (Mission, Match, Swipe), créer une table 
d'événements dédiée, écrite en continu, pensée pour l'analyse 
statistique future :

```prisma
model TraceEvent {
  id            String   @id @default(cuid())
  eventType     String   // "MISSION_PUBLISHED", "SWIPE_RIGHT", 
                          // "MATCH_CREATED", "CONTRACT_SIGNED",
                          // "MISSION_COVERED", "MISSION_EXPIRED_UNCOVERED"
  missionId     String?
  matchId       String?
  commune       String?  // Dénormalisé pour faciliter l'agrégation 
                         // géographique sans jointures lourdes
  profession    String?
  missionType   String?
  occurredAt    DateTime @default(now())
  metadata      Json?    // Données contextuelles additionnelles 
                         // selon le type d'événement
  
  @@index([eventType, commune, occurredAt])
  @@index([commune, profession, occurredAt])
}
```

Cette table est écrite en PARALLÈLE des tables métier normales 
(Mission, Match...) à chaque événement clé — un simple insert 
supplémentaire dans chaque route API concernée, sans impact 
sur la logique métier existante.

### Rapport agrégé — structure du futur pitch ARS/CGSS

À terme (dans 12-18 mois, section 85), ce back-office 
permettra de générer un rapport type :

```
"Sur les 18 derniers mois, Soignect a permis de couvrir 
X postes de remplacement/assistanat en Guadeloupe.

Le délai moyen de couverture d'un poste est passé de 
Y jours (zones bien dotées) à Z jours (zones tendues 
identifiées par notre indice de tension).

Dans les communes identifiées comme tendues par notre 
algorithme (Pointe-Noire, etc.), le taux de couverture 
à 30 jours est de X%, contre Y% dans les communes bien 
dotées — confirmant statistiquement la pertinence de 
notre indice de tension intra-territorial (section 84).

Ce système a permis d'éviter N ruptures de continuité 
des soins sur le territoire."
```

C'est ce type de phrase, appuyée sur des vraies données 
longitudinales, qui rend un pitch ARS crédible — pas une 
promesse ni un concept.

### Interface admin — dashboard de suivi (pour toi, dès maintenant)

Avant même de penser au pitch ARS, ce back-office sert 
D'ABORD à Jean-Charles lui-même pour piloter le produit :

```
Nouvelle section /admin/observatoire (ou équivalent) :
- Délai moyen de couverture par commune (carte ou tableau)
- Évolution du nombre de mises en relation dans le temps 
  (graphe)
- Taux de conversion du funnel complet
- Liste des postes restés non couverts au-delà de 30/60/90 jours 
  (alerte visuelle pour identifier les zones vraiment en tension)
```

### Ordre d'implémentation

```
PRIORITÉ HAUTE — à intégrer TRÈS TÔT, avant même le sprint 
territorial complet (sections 67, 82-84), car chaque jour 
sans collecte est une donnée perdue à jamais :

1. Créer le modèle TraceEvent (migration additive, simple)
2. Instrumenter les points clés déjà existants dans le code :
   - Publication d'annonce (déjà dans /api/missions POST)
   - Swipe RIGHT (déjà dans /api/swipe POST)
   - Création de match (déjà dans /api/swipe POST)
   - Signature de contrat (déjà dans /api/match/[id]/signature)
   - Détection de mission restée non couverte au-delà d'un 
     seuil (nouveau job périodique à créer, ex: quotidien)
3. Dashboard admin basique /admin/observatoire pour visualiser 
   ces données au fil de l'eau

Ce sprint est TECHNIQUEMENT LÉGER (ajouter des inserts dans 
des routes déjà existantes) mais STRATÉGIQUEMENT CRITIQUE — 
à prioriser dès que possible, idéalement avant même de finir 
tous les correctifs UX du menu universel, car c'est la 
donnée qui ne peut jamais être rattrapée rétroactivement.
```

### Recommandation de priorité réelle

Compte tenu de l'importance de ne rien perdre, ce sprint 
(instrumentation TraceEvent) devrait passer AVANT le score 
géo gradué (section 67) dans l'ordre des priorités de reprise — 
un score géo imparfait peut être amélioré plus tard sans 
perte, mais un mois d'usage réel non tracé est perdu 
définitivement.

---

## 87. Timeline — largeur 90% et positionnement "aujourd'hui" décalé à gauche

### Correction du positionnement temporel

Actuellement, la ligne "aujourd'hui" est centrée dans la 
fenêtre de la timeline, ce qui donne autant de place au passé 
qu'au futur. Or c'est le FUTUR qui intéresse l'utilisateur 
(planifier, couvrir les postes à venir) — le passé n'est 
qu'une référence occasionnelle.

```
AVANT : passé 50% ←──────── aujourd'hui ────────→ 50% futur
APRÈS : passé 10% ←── aujourd'hui ────────────→ 90% futur
```

### Correction de la largeur de la timeline

La timeline (zone scrollable après la colonne de labels) 
doit occuper 90% de la largeur disponible de l'écran, pas 
une largeur calculée arbitrairement.

### Implémentation

```typescript
// Dans PlanningBoard.tsx et DisponibilitesBoard.tsx

// 1. Largeur de la piste = 90% de l'espace disponible 
//    (après la colonne labels)
const containerWidth = Math.min((winW - labelWidth) * 0.9, 900)

// 2. Position du scroll initial : "aujourd'hui" doit être 
//    positionné à 10% depuis la gauche de la fenêtre visible, 
//    pas au centre

useEffect(() => {
  const el = rowsScrollRef.current
  if (!el) return
  // Au lieu de centrer (todayOff - clientWidth/2), 
  // positionner aujourd'hui à 10% de la largeur visible
  const target = Math.max(0, todayOff - el.clientWidth * 0.1)
  el.scrollLeft = target
}, [zoom, labelWidth])
```

### Résultat attendu visuellement

```
[Label] |←10%→| AUJOURD'HUI |←──────── 90% futur ────────→|
                    ▶
```

L'utilisateur voit un léger contexte de passé récent (10%) 
pour comprendre où il se situe, mais la grande majorité de 
l'espace visible est consacrée à ce qui reste à planifier.

### Ordre d'implémentation

Sprint léger, ajustement de calcul sur les deux boards 
(PlanningBoard.tsx et DisponibilitesBoard.tsx) — cohérent 
avec le sprint responsive déjà fait (section 33), juste 
un réglage du ratio passé/futur et de la largeur globale.

---

## 88. Corrections formulaire disponibilités remplaçant

### Point 1 — Modale d'ouverture de période : pas de date de fin présupposée

Actuellement, au clic sur une zone libre de sa timeline, le 
remplaçant voit une modale qui présuppose déjà une durée fixe 
(ex: "31 août 2026 → 30 sept. 2026, 30 jours"). C'est trop 
prescriptif — la durée n'est pas encore décidée à ce stade.

```
AVANT :
"Ouvrir cette période à la réservation ?"
Période sélectionnée
31 août 2026 → 30 sept. 2026
30 jours
[Oui, je suis disponible →] [Non, bloquer ces dates] [Annuler]

APRÈS :
"Ouvrir cette période à la réservation ?"
Disponible à partir du 31 août 2026
[Oui, je suis disponible →] [Non, bloquer ces dates] [Annuler]
```

La date de fin réelle sera précisée sur l'écran suivant 
(le formulaire "Mes dates de disponibilité" avec Du/Au, 
déjà existant). Le calcul de "date de début du dernier bloc 
libre" remplace la logique actuelle qui propose une plage 
de 30 jours par défaut.

### Point 2 — Reconsidérer le minimum de 20 caractères

Le minimum actuel de 20 caractères sur l'accroche (section 71) 
semble trop bas pour garantir un texte réellement exploitable 
par DeepSeek pour le matching sémantique. À reconsidérer : 
augmenter ce minimum (ex: 40-50 caractères) pour s'assurer 
que le texte soit substantiel, tout en restant simple à 
remplir rapidement.

```
Proposition : passer le minimum de 20 à 40 caractères
Message d'aide ajusté en conséquence : 
"Présentez-vous en quelques mots (40 caractères minimum)"
```

### Point 3 — Retirer le champ "Taux de rétrocession souhaité"

Cohérent avec la philosophie de simplification déjà actée 
(sections 69, 71) : retirer ce champ du formulaire de création 
de disponibilité. Le taux de rétrocession se négocie dans 
la discussion/le contrat (section 61), pas comme un critère 
de filtrage rigide dès la création de l'annonce.

```
Retirer le champ "Taux de rétrocession souhaité" de 
disponibilites/create/page.tsx
```

### Point 4 — Correction grammaticale du placeholder

```
AVANT : "Je suis kiné passionné, disponible pour remplacements 
         courts en Guadeloupe..."
APRÈS : "Je suis un kiné passionné, disponible pour remplacements 
         courts en Guadeloupe..."
```

Simple ajout de l'article "un" manquant.

### Ordre d'implémentation

Sprint léger, 4 corrections ciblées sur disponibilites/create/page.tsx 
et le composant de modale d'ouverture de période (FreeZoneModal 
ou équivalent).

---

## 89. BUG — labels de mois illisibles en zoom "2 ans"

### Problème confirmé sur le côté remplaçant (DisponibilitesBoard)

En vue "2 ans", les labels de mois se chevauchent complètement 
et deviennent illisibles : "JUIN 2JUIL. 2AOÛT 2SEPT. 2OCT. 2NOV. 
2DÉC. 2JANV.FÉVR.MARS..." — un texte totalement fusionné, 
sans espacement.

C'était déjà identifié comme problème (point 7 de la liste 
originale) et corrigé pour les zooms Mois/Trimestre/Année, 
mais le zoom "2 ans" spécifiquement n'a pas la même gestion — 
essayer d'afficher 24 labels de mois individuels dans la même 
largeur ne peut pas fonctionner visuellement.

### Correction nécessaire — spécifique au zoom 2 ans

```
En vue "2 ans", ne PAS essayer d'afficher chaque mois 
individuellement. Deux options :

Option A (recommandée) : afficher un label tous les 3 mois 
(un par trimestre) : "T3 2026", "T4 2026", "T1 2027"...

Option B : afficher uniquement les changements d'année 
("2026", "2027") avec des graduations mineures non labellisées 
entre les deux

Réutiliser la logique déjà en place pour le zoom "Année" 
(qui gère bien l'espacement) mais avec un pas encore plus 
large, adapté spécifiquement à 24 mois de largeur.
```

### Vérifier aussi côté PlanningBoard (titulaire)

Ce bug a été identifié côté DisponibilitesBoard (remplaçant), 
mais il faut vérifier si le même problème existe sur 
PlanningBoard.tsx en zoom "2 ans" — les deux composants 
partagent probablement la même logique de calcul des labels 
de mois (monthLabels), donc la correction doit s'appliquer 
aux deux.

### Point positif à noter (pas un bug)

Le positionnement de la ligne "aujourd'hui" à environ 10% 
depuis la gauche (au lieu du centre) fonctionne bien en vue 
Trimestre (image 1) — confirmation que la correction 
section 87 a été appliquée avec succès.

### Ordre d'implémentation

Sprint léger, correction ciblée sur le calcul des labels 
de mois (fonction monthLabels ou équivalent) spécifiquement 
pour le cas zoom = "2 ans" (triennial dans le code), à 
appliquer sur PlanningBoard.tsx ET DisponibilitesBoard.tsx.

---

## 90. BUG — label de poste/personne visible uniquement en zoom "2 ans"

### Problème

La colonne fixe à gauche affichant le nom (ex: "Julien MORISOT" 
côté remplaçant, ou le nom d'un poste côté titulaire) n'apparaît 
que sur le zoom "2 ans". Sur les zooms Mois/Trimestre/Année, 
cette colonne de label est absente ou non visible.

### Comportement attendu

La colonne de label (nom du poste ou de la personne) doit 
être visible de façon IDENTIQUE et cohérente sur TOUS les 
niveaux de zoom (Mois, Trimestre, Année, 2 ans) — ce n'est 
pas une information qui dépend du zoom temporel, elle identifie 
la ligne elle-même.

### Correction

```
Vérifier le rendu de la colonne labelWidth (section 33/64) 
sur chaque zoom :
- Mois → label doit être visible
- Trimestre → label doit être visible (déjà confirmé OK 
  d'après les captures précédentes)
- Année → label doit être visible
- 2 ans → label déjà visible (confirmé fonctionnel)

Identifier pourquoi le label ne s'affiche pas sur certains 
zooms — probablement un problème de largeur de conteneur ou 
de calcul de containerWidth qui écrase la colonne label sur 
certains ratios d'écran/zoom, ou un CSS conditionnel mal ciblé.
```

### Ordre d'implémentation

Sprint léger, à regrouper avec la correction section 89 
(même zone de code, PlanningBoard.tsx et DisponibilitesBoard.tsx) 
— probablement liées techniquement puisque les deux concernent 
le rendu de l'en-tête/colonne label selon le zoom sélectionné.

---

## 91. Corrections mobile — zoom non fonctionnel, navigation Planning manquante

### Point 1 — BUG : le zoom ne fonctionne pas sur mobile

Sur mobile, les boutons de zoom (Mois/Trimestre/Année/2 ans) 
ne semblent pas répondre correctement — à diagnostiquer et 
corriger sur PlanningBoard.tsx et DisponibilitesBoard.tsx.

```
Vérifier :
- Les boutons de zoom sont-ils bien cliquables/tappables 
  sur mobile (taille de zone de tap suffisante, pas de 
  chevauchement avec un autre élément) ?
- Le state zoom se met-il à jour correctement au tap ?
- Le recalcul de containerWidth/dayWidth se déclenche-t-il 
  bien après un changement de zoom sur mobile (peut être lié 
  au listener resize, section responsive déjà fait) ?
```

### Point 2 — Ciblage multi-communes pour le remplaçant (rappel section 67)

Confirmation du besoin déjà documenté (section 67) : un 
remplaçant doit pouvoir cibler sa recherche sur plusieurs 
communes simultanément, pas une seule zone unique. Ce point 
reste dans le sprint dédié section 67 (score géo gradué + 
multi-communes), pas une correction isolée ce soir — mais 
Jean-Charles le remonte car il l'a identifié en testant 
concrètement le manque.

### Point 3 — BUG NAVIGATION : accès à "Planning"/"Disponibilités" 
manquant sur mobile

Sur mobile, il n'existe aucun lien explicite vers /planning 
(titulaire) ou /disponibilites (remplaçant) dans la navigation 
mobile — le seul moyen d'y accéder est de taper sur le logo 
"Soignect" en haut à gauche, ce qui n'est pas du tout intuitif.

**Correction : ajouter ce lien dans la barre de navigation 
mobile du bas (bottom nav)**, entre "Compte" et "Relations".

```
Navigation mobile actuelle (bottom nav) :
[Annonces] [+ Annonce] [Compte] [Relations]

Navigation mobile corrigée :
[Annonces] [+ Annonce] [Planning/Disponibilités] [Compte] [Relations]
```

Le libellé et l'icône s'adaptent selon le profil :
```
TITULAIRE/CABINET      → "Planning" (icône calendrier/tableau)
REMPLACANT/ASSISTANT   → "Disponibilités" (même icône ou 
                          variante cohérente)
```

### Ordre d'implémentation

```
Sprint prioritaire (navigation cassée sur mobile = bloquant 
pour l'usage réel) :

1. Ajouter le lien Planning/Disponibilités dans la bottom nav 
   mobile (layout.tsx), entre Compte et Relations
2. Diagnostiquer et corriger le bug de zoom non fonctionnel 
   sur mobile (PlanningBoard.tsx, DisponibilitesBoard.tsx)
3. Le point multi-communes reste dans le sprint section 67, 
   pas ce soir
```

---

## 92. BUG/MANQUE — clic sur zone vide d'un poste assistant/collaborateur ne propose pas la publication

### Problème identifié

Sur le Planning Board titulaire, quand la ligne d'un poste 
assistant/collaborateur a une zone NON_COUVERT (le poste 
n'est plus occupé, ex: l'assistant précédent est parti), 
le clic sur cette zone ne permet pas de publier une offre 
pour trouver un successeur sur CE poste précis.

C'est le cas d'usage réel exact de Jean-Charles : deux de 
ses postes vont se libérer dans un mois, il doit pouvoir 
publier une annonce d'assistanat/collaboration ciblée sur 
ce poste précis depuis la timeline.

### Comportement attendu

```
Clic sur une zone NON_COUVERT d'un poste assistant/collaborateur
→ Menu universel (section 64) doit proposer :
  [1] Poser une annonce
      → Pré-remplit le TYPE de l'annonce selon le postType 
        du CabinetPost concerné :
        - Si CabinetPost.postType = ASSISTANT 
          → missionType pré-sélectionné = ASSISTANAT
        - Si CabinetPost.postType = COLLABORATION 
          → missionType pré-sélectionné = COLLABORATION
      → Pré-remplit les dates de début (à partir de la fin 
        du poste précédent ou de la date cliquée)
      → Le titre peut suggérer : "Succession poste [nom]" 
        ou similaire
      → cabinetPostId pré-lié à ce poste précis (pour que 
        le futur match s'attribue automatiquement à cette 
        ligne, cohérent avec section 55)
```

### Vérification nécessaire

Il est possible que ce comportement existe déjà partiellement 
(via computeUncoveredGaps et onUncoveredClick, section 64) 
mais qu'il ne pré-remplisse pas correctement le TYPE de 
mission selon le postType du poste concerné — à vérifier 
et corriger si le type n'est pas repris automatiquement.

### Ordre d'implémentation

Priorité haute — cas d'usage réel immédiat pour Jean-Charles. 
À intégrer dans le sprint du menu universel (section 64) 
s'il n'est pas déjà lancé, ou en correction immédiate si 
le menu universel existe déjà mais ne gère pas cette 
pré-sélection de type.
