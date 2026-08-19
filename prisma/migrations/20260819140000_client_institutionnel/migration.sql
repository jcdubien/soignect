-- Gating du levier territorial par relation client (section 214) — principe ferme du 19/08
-- (STRATEGIE_MARKETING_BUSINESS.md §4) : le boost territorial est activé par une relation client
-- réelle, jamais une option ambiante. Sans ce gating, le produit distribuerait gratuitement, à
-- toute commune saisie, ce qu'il est censé vendre comme service institutionnel.
--
-- SÛRE À APPLIQUER : `PrioriteTerritoriale` compte 0 ligne (vérifié avant écriture). La colonne
-- `institution` (texte libre) est donc remplacée par une clé étrangère NOT NULL sans reprise ni
-- perte — ce qui ne serait pas vrai sur une table peuplée.

CREATE TYPE "NatureRelationInstitutionnelle" AS ENUM ('POC_GRATUIT', 'CLIENT_PAYANT', 'GRATUITE_NEGOCIEE');
CREATE TYPE "TypeInstitution" AS ENUM ('CPTS', 'MSP', 'ARS', 'CGSS', 'COLLECTIVITE', 'AUTRE');

-- `revueLe` EST UNE DATE DE REVUE, PAS UNE PREUVE DE FONCTION ACTIVE.
-- La gratuité CPTS est conditionnée à une fonction (« tant que Jean-Charles en est secrétaire »).
-- Un rôle institutionnel ne s'interroge par aucune API : le produit ne peut pas constater qu'il
-- est toujours exercé, et un champ nommé `fonctionActive` affirmerait ce qu'il ne peut pas
-- savoir — la faute exacte déjà commise avec `boost*`. Ce que la colonne garantit est plus
-- modeste et vrai : la relation n'est jamais silencieusement permanente. NOT NULL, donc aucune
-- relation ne peut naître sans échéance de revue.
CREATE TABLE "ClientInstitutionnel" (
    "id"        TEXT         NOT NULL,
    "nom"       TEXT         NOT NULL,
    "type"      "TypeInstitution" NOT NULL,
    "nature"    "NatureRelationInstitutionnelle" NOT NULL,
    "debutLe"   TIMESTAMP(3) NOT NULL,
    "revueLe"   TIMESTAMP(3) NOT NULL,
    "clotureLe" TIMESTAMP(3),
    "note"      VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientInstitutionnel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientInstitutionnel_nom_key" ON "ClientInstitutionnel" ("nom");

-- `institution` (texte libre) → `clientId` (clé étrangère). C'est tout l'objet de la migration :
-- un nom tapé à la main ne dit pas si une relation client existe.
ALTER TABLE "PrioriteTerritoriale" DROP COLUMN "institution";
ALTER TABLE "PrioriteTerritoriale" ADD COLUMN "clientId" TEXT NOT NULL;

CREATE INDEX "PrioriteTerritoriale_clientId_idx" ON "PrioriteTerritoriale" ("clientId");

-- RESTRICT : supprimer un client ne doit pas faire disparaître en silence les déclarations qui
-- s'y adossent. On clôt une relation (`clotureLe`), on ne l'efface pas.
ALTER TABLE "PrioriteTerritoriale"
    ADD CONSTRAINT "PrioriteTerritoriale_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "ClientInstitutionnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS — les migrations Prisma ne la gèrent pas, et une table `public` sans RLS est lisible avec
-- la clé anon exposée au navigateur. Une relation client nomme une institution et la nature
-- commerciale du lien : rien qui ait à sortir par PostgREST.
ALTER TABLE "public"."ClientInstitutionnel" ENABLE ROW LEVEL SECURITY;
