-- Macro-zones géographiques Guadeloupe (section 138) — palier intermédiaire.

-- CreateEnum ZoneGeographique (idempotent)
DO $$ BEGIN
  CREATE TYPE "ZoneGeographique" AS ENUM (
    'CENTRE_CAP_EXCELLENCE',
    'SUD_GRANDE_TERRE',
    'NORD_GRANDE_TERRE',
    'SUD_BASSE_TERRE',
    'NORD_BASSE_TERRE',
    'MARIE_GALANTE',
    'LES_SAINTES',
    'LA_DESIRADE',
    'SAINT_MARTIN',
    'SAINT_BARTHELEMY'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AlterTable Mission — macro-zones souhaitées/couvertes (multi), en plus de la commune (ancre)
ALTER TABLE "Mission"
  ADD COLUMN IF NOT EXISTS "zones" "ZoneGeographique"[] NOT NULL DEFAULT ARRAY[]::"ZoneGeographique"[];

-- CreateTable CommuneZone — mapping figé commune → zone
CREATE TABLE IF NOT EXISTS "CommuneZone" (
  "commune" TEXT NOT NULL,
  "zone" "ZoneGeographique" NOT NULL,
  CONSTRAINT "CommuneZone_pkey" PRIMARY KEY ("commune")
);

-- Seed du mapping (idempotent — rejeu met à jour la zone)
INSERT INTO "CommuneZone" ("commune", "zone") VALUES
  ('Pointe-à-Pitre',              'CENTRE_CAP_EXCELLENCE'),
  ('Les Abymes',                  'CENTRE_CAP_EXCELLENCE'),
  ('Baie-Mahault',                'CENTRE_CAP_EXCELLENCE'),
  ('Le Gosier',                   'CENTRE_CAP_EXCELLENCE'),
  ('Petit-Bourg',                 'CENTRE_CAP_EXCELLENCE'),
  ('Goyave',                      'CENTRE_CAP_EXCELLENCE'),
  ('Sainte-Anne',                 'SUD_GRANDE_TERRE'),
  ('Saint-François',              'SUD_GRANDE_TERRE'),
  ('Le Moule',                    'SUD_GRANDE_TERRE'),
  ('Morne-à-l''Eau',              'SUD_GRANDE_TERRE'),
  ('Anse-Bertrand',               'NORD_GRANDE_TERRE'),
  ('Port-Louis',                  'NORD_GRANDE_TERRE'),
  ('Petit-Canal',                 'NORD_GRANDE_TERRE'),
  ('Basse-Terre',                 'SUD_BASSE_TERRE'),
  ('Gourbeyre',                   'SUD_BASSE_TERRE'),
  ('Baillif',                     'SUD_BASSE_TERRE'),
  ('Saint-Claude',                'SUD_BASSE_TERRE'),
  ('Vieux-Fort',                  'SUD_BASSE_TERRE'),
  ('Capesterre-Belle-Eau',        'SUD_BASSE_TERRE'),
  ('Trois-Rivières',              'SUD_BASSE_TERRE'),
  ('Vieux-Habitants',             'SUD_BASSE_TERRE'),
  ('Bouillante',                  'SUD_BASSE_TERRE'),
  ('Pointe-Noire',                'NORD_BASSE_TERRE'),
  ('Deshaies',                    'NORD_BASSE_TERRE'),
  ('Sainte-Rose',                 'NORD_BASSE_TERRE'),
  ('Lamentin',                    'NORD_BASSE_TERRE'),
  ('Grand-Bourg (Marie-Galante)', 'MARIE_GALANTE'),
  ('Capesterre-de-Marie-Galante', 'MARIE_GALANTE'),
  ('Saint-Louis (Marie-Galante)', 'MARIE_GALANTE'),
  ('La Désirade',                 'LA_DESIRADE'),
  ('Terre-de-Haut (Les Saintes)', 'LES_SAINTES'),
  ('Terre-de-Bas (Les Saintes)',  'LES_SAINTES'),
  ('Marigot (Saint-Martin)',      'SAINT_MARTIN'),
  ('Grand Case (Saint-Martin)',   'SAINT_MARTIN'),
  ('Gustavia (Saint-Barth)',      'SAINT_BARTHELEMY')
ON CONFLICT ("commune") DO UPDATE SET "zone" = EXCLUDED."zone";
