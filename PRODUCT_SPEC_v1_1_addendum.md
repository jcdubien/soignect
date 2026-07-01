# ParaBoard — PRODUCT_SPEC Addendum v1.1
> Complète PRODUCT_SPEC.md v1.0. Lire les deux fichiers avant toute intervention.
> Dernière mise à jour : juin 2026

---

## A. Champ "Bio Tinder" 280 caractères

### Principe
Chaque profil (cabinet ET remplaçant) dispose d'un champ texte libre de 280 caractères max,
structuré autour de trois axes :
- "Je suis…" — identité professionnelle et humaine
- "Je cherche…" — ce que je veux trouver dans cette relation de travail
- "J'aspire à…" — valeurs, projet professionnel, ambition

Ce champ est utilisé par DeepSeek pour affiner le score d'affinité (analyse sémantique des valeurs communes).

### Modifications base de données (additives)
```prisma
// Dans le modèle Profile — ajouter :
bioTinder        String?   @db.VarChar(280)  // "Je suis / Je cherche / J'aspire à"

// Dans le modèle Mission — ajouter :
bioTinder        String?   @db.VarChar(280)  // Bio spécifique à cette annonce
```

### UI
- Compteur de caractères en temps réel (280 - n restants)
- Placeholder : "Je suis kiné passionné de sport, je cherche un cabinet avec plateau technique, j'aspire à une collaboration durable…"
- Affiché sur la carte swipe comme accroche principale sous le titre

---

## B. Interface Swipe — expérience Tinder

### Comportement des cartes
- Stack de cartes visuelles (3 cartes empilées visibles en perspective)
- Swipe gauche = PASS, swipe droit = INTÉRESSÉ
- Support tactile mobile + boutons desktop (← →)
- Animation de rejet (rouge, rotation gauche) et d'intérêt (vert, rotation droite)

### Tray "sélectionnés" en bas
- Barre horizontale scrollable en bas de l'écran
- Affiche les annonces/profils sur lesquels l'utilisateur a swipé DROITE
- Chaque élément du tray est cliquable → ouvre la fiche complète
- **Trié par score d'affinité DeepSeek décroissant** (le meilleur match en premier à gauche)

### Score d'affinité DeepSeek — algorithme
Le score est calculé côté serveur à chaque swipe RIGHT et stocké dans la table `Swipe`.

**Composantes du score (total 100 points) :**

| Critère | Poids | Calcul |
|---------|-------|--------|
| Correspondance exacte des dates | 30 pts | Overlap parfait = 30, partiel = prorata |
| Proximité géographique | 20 pts | < 5km = 20, < 20km = 15, < 50km = 10, > 50km = 0 |
| Spécialités communes | 20 pts | Chaque spécialité en commun = +5 pts, max 20 |
| Affinité bio Tinder (DeepSeek) | 20 pts | Analyse sémantique des deux champs bioTinder |
| Score de désirabilité (voir § C) | 10 pts | Boost admin configurable |

**Appel DeepSeek pour l'affinité bio :**
```typescript
// Prompt envoyé à DeepSeek
const prompt = `
Tu es un algorithme de matching professionnel.
Compare ces deux descriptions professionnelles et donne un score de 0 à 20
basé sur la compatibilité des valeurs, aspirations et recherches.
Réponds uniquement avec un entier entre 0 et 20, sans explication.

Profil A : "${profileA.bioTinder}"
Profil B : "${profileB.bioTinder}"
`
```

### Modifications base de données
```prisma
// Dans le modèle Swipe — ajouter :
affinityScore    Float?   // Score total 0-100 calculé par DeepSeek
scoreDetails     Json?    // Détail des composantes {dates, geo, specialty, bio, desirability}
```

---

## C. Score de désirabilité — interface admin

### Principe
Le score de désirabilité est un multiplicateur de visibilité géré depuis l'interface admin.
Il ajoute jusqu'à 10 points au score d'affinité d'un profil/annonce.

Il sert à :
1. **Mettre en avant le cabinet de Jean-Charles Dubien** — boost permanent configurable
2. **Valoriser les cabinets abonnés premium** — boost automatique selon le plan
3. **Campagnes ponctuelles** — boost manuel temporaire

### Interface admin — page `/admin/desirability`
- Liste de tous les profils cabinets avec leur score actuel
- Curseur (slider) de 0 à 10 par profil
- Champ "expiration" optionnel (date de fin du boost)
- Historique des modifications

### Calcul automatique selon abonnement
```
Plan gratuit     → desirabilityScore = 0
Plan Premium     → desirabilityScore = +5 (automatique)
Plan Boost       → desirabilityScore = +8 (automatique)
Override admin   → desirabilityScore = valeur du curseur (priorité absolue)
Cabinet fondateur (JCD) → desirabilityScore = 10 (fixe, non modifiable par erreur)
```

### Modifications base de données
```prisma
// Dans le modèle Profile — ajouter :
desirabilityScore     Float    @default(0)    // 0 à 10
desirabilityOverride  Float?                  // Override admin manuel
desirabilityExpiry    DateTime?               // Expiration du boost manuel
subscriptionPlan      SubscriptionPlan @default(FREE)
isFounding            Boolean  @default(false) // Cabinet fondateur = score 10 permanent

enum SubscriptionPlan {
  FREE
  PREMIUM    // 39-49€/mois
  BOOST      // 79€/mois
}
```

---

## D. Interface de paiement — Stripe

### Plans tarifaires V1
| Plan | Prix | Avantages |
|------|------|-----------|
| Gratuit | 0€ | 1 annonce active, pas de boost |
| Premium | 39€/mois | Annonces illimitées, boost +5, accès scores remplaçants |
| Boost | 79€/mois | Tout Premium + boost +8, badge prioritaire, stats avancées |

### Pages à créer
- `/premium` — page de comparaison des plans avec CTA Stripe
- `/api/stripe/checkout` — création session Stripe Checkout
- `/api/stripe/webhook` — webhook Stripe pour activer/désactiver plans
- `/dashboard/billing` — gestion abonnement, factures

### Webhook Stripe — comportement
À la réception d'un événement `customer.subscription.created` ou `updated` :
1. Mettre à jour `Profile.subscriptionPlan`
2. Recalculer `Profile.desirabilityScore` selon le plan
3. Si annulation → repasser en FREE, desirabilityScore = 0

### Variables d'environnement à ajouter dans `.env`
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PREMIUM=price_...
STRIPE_PRICE_BOOST=price_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

---

## E. Ordre d'implémentation recommandé

### Sprint 2 — Base de données (ne pas modifier ce qui existe)
1. Ajouter `bioTinder` sur `Profile` et `Mission`
2. Ajouter `affinityScore` et `scoreDetails` sur `Swipe`
3. Ajouter `desirabilityScore`, `subscriptionPlan`, `isFounding` sur `Profile`
4. Ajouter enum `SubscriptionPlan`
5. Migration : `npx prisma migrate dev --name add_matching_and_desirability`

### Sprint 3 — API matching
1. Route `POST /api/swipe` — enregistre le swipe + calcule score DeepSeek
2. Route `GET /api/feed` — retourne les annonces triées par score
3. Route `GET /api/tray` — retourne les swipes RIGHT triés par affinityScore

### Sprint 4 — UI Swipe
1. Composant `SwipeStack` — cartes empilées avec animations
2. Composant `MatchTray` — barre du bas avec scroll horizontal
3. Page `/annonces` — assemble SwipeStack + MatchTray

### Sprint 5 — Admin + Paiement
1. Page `/admin/desirability` — interface curseurs
2. Intégration Stripe Checkout
3. Webhook Stripe

---

## F. Règles absolues pour Claude Code sur ce sprint

- Ne PAS modifier `Mission`, `Swipe`, `Match`, `Message` autrement que par ajout de champs
- Ne PAS changer la logique d'authentification
- Toute modification du schema = nouvelle migration nommée explicitement
- L'appel DeepSeek se fait UNIQUEMENT côté serveur (API route), jamais côté client
- Le `desirabilityScore` du cabinet fondateur (isFounding = true) ne peut pas descendre sous 10
- Tester `npm run build` après chaque sprint
