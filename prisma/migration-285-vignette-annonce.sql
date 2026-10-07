-- Section 285 — vignette de partage générée à la publication plutôt qu'à chaque scrape.
--
-- Colonne NULLABLE, sans valeur par défaut : toute annonce existante démarre à `null`, donc
-- sur le repli dynamique, exactement comme avant. La bascule se fait annonce par annonce, à
-- mesure que les vignettes sont générées — aucune n'attend les autres.
--
-- `IF NOT EXISTS` : les migrations de ce dépôt sont jouées à la main et se rejouent toujours
-- au moins une fois (reset, nouvelle base).
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "vignetteAt" TIMESTAMP(3);
