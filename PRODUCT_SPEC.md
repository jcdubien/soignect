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
