# Instructions Claude Code — Migration base de données
> À exécuter dans l'ordre strict. Ne pas sauter d'étape.

## Contexte
Lire PRODUCT_SPEC.md en premier. Cette migration est ADDITIVE uniquement.
On ne supprime rien. On ajoute les tables et champs manquants.

---

## Étape 1 — Enrichir le modèle Profile

Dans `prisma/schema.prisma`, ajouter dans le modèle `Profile` :

```prisma
enum ProfileType {
  CABINET
  REMPLACANT
}
```

Et dans le modèle `Profile`, ajouter ces champs (sans toucher aux champs existants) :
```
profileType         ProfileType          @default(REMPLACANT)
rppsNumber          String?
specialty           String?
region              String?
isPremium           Boolean              @default(false)
isVerified          Boolean              @default(false)
cabinetRatingsReceived   CabinetRating[] @relation("CabinetRated")
remplacantRatingsReceived RemplacantRating[] @relation("RemplacantRated")
cabinetRatingsGiven      CabinetRating[] @relation("CabinetRater")
remplacantRatingsGiven   RemplacantRating[] @relation("RemplacantRater")
```

---

## Étape 2 — Créer le modèle CabinetRating

Ajouter ce nouveau modèle dans `prisma/schema.prisma` :

```prisma
model CabinetRating {
  id              String   @id @default(cuid())
  createdAt       DateTime @default(now())

  cabinetId       String
  cabinet         Profile  @relation("CabinetRated", fields: [cabinetId], references: [id])

  authorId        String
  author          Profile  @relation("CabinetRater", fields: [authorId], references: [id])

  matchId         String   @unique

  scoreAccueil    Int
  scoreMateriel   Int
  scoreContrat    Int
  scoreAmbiance   Int
  scoreGlobal     Float

  commentaire     String?
  isPublished     Boolean  @default(false)
  cabinetResponse String?

  @@unique([matchId, authorId])
}
```

---

## Étape 3 — Créer le modèle RemplacantRating

Ajouter ce nouveau modèle dans `prisma/schema.prisma` :

```prisma
model RemplacantRating {
  id              String   @id @default(cuid())
  createdAt       DateTime @default(now())

  remplacantId    String
  remplacant      Profile  @relation("RemplacantRated", fields: [remplacantId], references: [id])

  authorId        String
  author          Profile  @relation("RemplacantRater", fields: [authorId], references: [id])

  matchId         String

  scorePonctualite    Int
  scoreQualiteSoins   Int
  scoreDossierPatient Int
  scoreCommunication  Int
  scoreGlobal         Float

  visibleToCabinets   Boolean @default(true)
  visibleToRemplacant Boolean @default(false)

  @@unique([matchId, authorId])
}
```

---

## Étape 4 — Lancer la migration

```bash
npx prisma migrate dev --name add_ratings_and_profile_type
```

Si erreur de connexion : vérifier que `.env` contient bien les deux variables :
```
DATABASE_URL="postgresql://postgres.rwonzjbulmfegwmdaebn:Matouba%23%23971@aws-0-eu-west-3.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.rwonzjbulmfegwmdaebn:Matouba%23%23971@aws-0-eu-west-3.pooler.supabase.com:5432/postgres"
```

---

## Étape 5 — Vérification

```bash
npx prisma studio
```

Vérifier que les tables `CabinetRating` et `RemplacantRating` apparaissent.
Vérifier que `Profile` a les nouveaux champs.
Vérifier que les tables `User`, `Mission`, `Swipe`, `Match`, `Message` sont INTACTES.

---

## Étape 6 — NE PAS FAIRE pour l'instant

- Ne pas supprimer la table `Rating` existante (garder pour compatibilité)
- Ne pas modifier les routes API existantes
- Ne pas toucher à l'authentification
- Ne pas modifier Mission, Swipe, Match, Message

---

## Après la migration — prochaines instructions UI

Une fois la migration validée, les prochaines tâches UI seront données séparément :
1. Page `/noter/cabinet/[matchId]` — formulaire CabinetRating
2. Page `/noter/remplacant/[matchId]` — formulaire RemplacantRating  
3. Composant score public sur fiche cabinet
4. Onboarding — choix CABINET / REMPLACANT
