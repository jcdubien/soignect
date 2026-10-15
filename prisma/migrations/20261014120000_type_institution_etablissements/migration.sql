-- Offre partenaire (section 303) : une structure qui paie doit pouvoir être enregistrée pour ce
-- qu'elle est. Jusqu'ici un hôpital ou un EHPAD tombait dans AUTRE.
-- Ajouts seuls, aucune valeur existante modifiée : sûr sur une table peuplée.
ALTER TYPE "TypeInstitution" ADD VALUE IF NOT EXISTS 'HOPITAL';
ALTER TYPE "TypeInstitution" ADD VALUE IF NOT EXISTS 'EHPAD';
ALTER TYPE "TypeInstitution" ADD VALUE IF NOT EXISTS 'SSR';
ALTER TYPE "TypeInstitution" ADD VALUE IF NOT EXISTS 'CLINIQUE';
