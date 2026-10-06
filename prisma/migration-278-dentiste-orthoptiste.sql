-- Section 278 — DENTISTE et ORTHOPTISTE entrent dans l'enum Profession.
--
-- Simple ADD VALUE, contrairement à la 277 : on n'enlève rien cette fois, et Postgres sait
-- ajouter. `IF NOT EXISTS` rend le script rejouable — une migration manuelle se rejoue toujours
-- au moins une fois dans ce dépôt (reset, nouvelle base).
ALTER TYPE "Profession" ADD VALUE IF NOT EXISTS 'DENTISTE';
ALTER TYPE "Profession" ADD VALUE IF NOT EXISTS 'ORTHOPTISTE';
