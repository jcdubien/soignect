-- Aides-soignants (section 304) : profession salariée seulement, premier besoin des EHPAD.
-- Ajout seul, aucune valeur existante modifiée : sûr sur une table peuplée.
ALTER TYPE "Profession" ADD VALUE IF NOT EXISTS 'AIDE_SOIGNANT';
