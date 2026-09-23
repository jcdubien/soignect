-- Section 262 — Le salariat devient un type de poste proposable à la publication.
--
-- Purement additif et rejouable. À appliquer AVANT le déploiement du code correspondant :
-- les colonnes portent des valeurs par défaut, une annonce existante reste donc libérale.
--
-- POURQUOI DEUX COLONNES ET PAS UNE VALEUR D'ENUM `MissionType`. Mesuré le 23/09 : 45 fichiers
-- touchent `MissionType`, dont 47 comparaisons littérales et seulement DEUX `Record<MissionType,…>`.
-- Ajouter `SALARIAT` à l'enum n'aurait donc cassé la compilation que sur 2 sites sur 47 — les 45
-- autres auraient continué de compiler en traitant un salariat comme « autre chose », et un
-- contrat de travail serait ressorti en collaboration libérale par un `else` final. C'est le
-- refus déjà posé en section 217, et la mesure le confirme.
--
-- `natureSalariat` n'est PAS un enum Postgres : les trois valeurs vivent déjà dans le type
-- TypeScript `NatureSalariat`, et un second enum en base aurait créé deux sources à tenir
-- d'accord. La colonne est contrainte plutôt que typée.

ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "estSalariat" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "natureSalariat" TEXT;

-- Une annonce salariée DOIT porter sa nature ; une annonce libérale ne doit pas en porter.
-- La contrainte interdit les deux incohérences plutôt que de compter sur les appelants.
--
-- ⚠️ LE `IS NOT NULL` N'EST PAS REDONDANT, il est LA CORRECTION. Première rédaction posée sans
-- lui : elle n'a rien refusé du tout, et un INSERT volontairement incohérent est passé.
--
-- En SQL, une contrainte CHECK n'échoue que si son expression vaut FALSE — quand elle vaut NULL,
-- la ligne est ACCEPTÉE. Or avec `natureSalariat` à NULL :
--
--   ("estSalariat" = true)  AND  (NULL IN ('CDI', …))   →   TRUE AND NULL   →   NULL
--   FALSE  OR  NULL                                      →   NULL           →   acceptée
--
-- Le cas même que la contrainte devait attraper était le seul qu'elle laissait passer. Vérifié
-- par exécution, pas par relecture : la définition paraît juste à l'œil.
ALTER TABLE "Mission" DROP CONSTRAINT IF EXISTS "Mission_natureSalariat_coherente";
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_natureSalariat_coherente" CHECK (
  ("estSalariat" = false AND "natureSalariat" IS NULL)
  OR
  ("estSalariat" = true  AND "natureSalariat" IS NOT NULL
                         AND "natureSalariat" IN ('CDI', 'CDD_TERME', 'CDD_SANS_TERME'))
);
