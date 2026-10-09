-- Section 293 — modes de rétrocession (fixe, plafonnée).
--
-- `POURCENTAGE` par défaut : les 80 annonces existantes gardent exactement le sens qu'elles
-- avaient. Aucune ne change de comportement, aucun contrat déjà signé n'est réinterprété.
--
-- Les deux colonnes de montant restent NULL hors de leur mode : un plafond sur une annonce au
-- pourcentage n'aurait pas de sens, et le laisser traîner le ferait un jour imprimer.
DO $$ BEGIN
  CREATE TYPE "RetrocessionMode" AS ENUM ('POURCENTAGE', 'FIXE', 'PLAFONNEE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Mission"
  ADD COLUMN IF NOT EXISTS "retrocessionMode" "RetrocessionMode" NOT NULL DEFAULT 'POURCENTAGE',
  ADD COLUMN IF NOT EXISTS "retrocessionFixeEuros" INTEGER,
  ADD COLUMN IF NOT EXISTS "retrocessionPlafondEuros" INTEGER;
