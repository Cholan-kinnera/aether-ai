-- AETHER PostGIS & Extensions Initialization Script
-- Executed on initial container bootstrap

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Confirm PostGIS version
DO $$
BEGIN
    RAISE NOTICE 'PostGIS Extension initialized successfully: %', PostGIS_Full_Version();
END $$;
