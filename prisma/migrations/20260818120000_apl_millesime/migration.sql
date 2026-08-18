-- Millésime et provenance de la donnée APL — prérequis de scripts/sync-commune-apl.mjs.
--
-- POURQUOI CES TROIS COLONNES
-- `CommuneAPL` ne portait que `updatedAt`, qui dit QUAND la ligne a bougé, jamais DE QUELLE
-- ANNÉE sont les chiffres. Les 112 lignes existantes partagent un updatedAt à la milliseconde
-- (2026-06-28T18:16:37.780Z) : trace d'un import unique dont le millésime est aujourd'hui
-- indéterminable. Sans ces colonnes, un import 2024 serait indistinguable de celui de 2026 —
-- c'est exactement ce que le script refuse de laisser arriver.
--   • aplAnnee      — l'année des CHIFFRES (feuille « APL 2024 » du classeur DREES), pas de l'import ;
--   • aplSource     — le jeu et le millésime en clair, pour qu'une ligne se justifie seule ;
--   • aplImportedAt — la date de l'import, distincte d'`updatedAt` que toute écriture déplace.
--
-- NULL EST LA BONNE VALEUR PAR DÉFAUT, ET ELLE EST VOLONTAIRE
-- Aucun backfill : les 112 lignes déjà là resteront à NULL tant que le script n'aura pas tourné.
-- Leur inventer un millésime serait affirmer ce que personne ne sait. NULL se lit « millésime
-- inconnu », ce qui est la vérité, et le premier `--apply` le remplacera par un fait vérifié.
--
-- CE QUE CETTE MIGRATION NE TOUCHE PAS
-- Les colonnes boost* ne sont ni ajoutées, ni modifiées, ni réinitialisées. Elles portent la
-- priorité territoriale que le feed applique déjà (src/lib/territoire.ts) : de la donnée
-- PRODUIT, qui n'a rien à voir avec le millésime DREES et qui doit lui survivre.
--
-- Additive et rejouable (IF NOT EXISTS). Aucune réécriture de ligne existante, donc aucun
-- déplacement d'`updatedAt` : appliquer cette migration ne fait pas mentir la table.
ALTER TABLE "CommuneAPL" ADD COLUMN IF NOT EXISTS "aplAnnee"      INTEGER;
ALTER TABLE "CommuneAPL" ADD COLUMN IF NOT EXISTS "aplSource"     TEXT;
ALTER TABLE "CommuneAPL" ADD COLUMN IF NOT EXISTS "aplImportedAt" TIMESTAMP(3);
