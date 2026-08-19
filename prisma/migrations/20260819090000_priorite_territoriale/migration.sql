-- Priorité territoriale déclarée (section 214, B3) — le canal que `CommuneAPL.boost*` ne
-- pouvait pas être.
--
-- POURQUOI UNE TABLE PLUTÔT QU'UNE COLONNE DE PLUS
-- Les `boost*` non nuls n'ont jamais été saisis par personne : ils dérivent de l'indicateur APL
-- et sont entrés avec l'import du 28/06/2026 (112 lignes, un seul `updatedAt` à la milliseconde).
-- Le produit affichait pourtant « commune déclarée prioritaire par sa CPTS ». Le défaut n'était
-- pas la valeur mais le support : un entier nu ne dit ni qui a déclaré, ni quand. Cette table
-- rend l'attribution possible, donc vérifiable — aucune ligne ne peut exister sans nommer son
-- institution, sa date et l'administrateur qui l'a co-saisie.
--
-- AUCUNE REPRISE DES `boost*` — VOLONTAIRE ET CENTRAL
-- La tentation serait d'amorcer la table avec les 56 communes à `boost != 0`. Ce serait
-- fabriquer 56 déclarations que personne n'a faites, et signer d'une institution un chiffre
-- calculé : exactement la faute qu'on est en train de réparer. La table démarre VIDE. Le levier
-- territorial est donc inerte jusqu'à la première déclaration réelle, et c'est l'état correct.
--
-- `CommuneAPL` n'est pas touchée : ni ses `apl*`, ni ses `boost*`, qui restent éditables en
-- admin. Le feed cesse simplement de les lire (src/lib/territoire.ts).
CREATE TABLE IF NOT EXISTS "PrioriteTerritoriale" (
    "id"          TEXT         NOT NULL,
    "codeInsee"   TEXT         NOT NULL,
    "commune"     TEXT         NOT NULL,
    "profession"  "Profession" NOT NULL,
    "niveau"      INTEGER      NOT NULL,
    "institution" TEXT         NOT NULL,
    "declareLe"   TIMESTAMP(3) NOT NULL,
    "saisiParId"  TEXT         NOT NULL,
    "note"        VARCHAR(500),
    "expireLe"    TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrioriteTerritoriale_pkey" PRIMARY KEY ("id")
);

-- Une seule déclaration vivante par commune ET par profession : deux lignes concurrentes
-- poseraient la question « laquelle gagne ? », à laquelle aucune réponse ne serait honnête.
CREATE UNIQUE INDEX IF NOT EXISTS "PrioriteTerritoriale_codeInsee_profession_key"
    ON "PrioriteTerritoriale" ("codeInsee", "profession");

CREATE INDEX IF NOT EXISTS "PrioriteTerritoriale_profession_idx"
    ON "PrioriteTerritoriale" ("profession");

-- L'auteur de la saisie est une vraie clé étrangère, pas un nom recopié : une déclaration doit
-- rester rattachable à un compte existant. RESTRICT plutôt que CASCADE — supprimer un
-- administrateur ne doit pas faire disparaître en silence les déclarations d'une institution.
ALTER TABLE "PrioriteTerritoriale"
    DROP CONSTRAINT IF EXISTS "PrioriteTerritoriale_saisiParId_fkey";
ALTER TABLE "PrioriteTerritoriale"
    ADD CONSTRAINT "PrioriteTerritoriale_saisiParId_fkey"
    FOREIGN KEY ("saisiParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS — les migrations Prisma ne la gèrent pas, et une table `public` sans RLS est lisible par
-- la clé anon exposée au navigateur. Activée ici ET dans prisma/enable-rls.sql, pour qu'un
-- `migrate reset` suivi du script ne laisse aucun trou.
ALTER TABLE "public"."PrioriteTerritoriale" ENABLE ROW LEVEL SECURITY;
