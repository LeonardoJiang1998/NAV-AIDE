-- Stage 2 scaffold for location_aliases.db
CREATE TABLE IF NOT EXISTS location_aliases (
  alias TEXT PRIMARY KEY,
  normalized_alias TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  source TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_location_aliases_normalized ON location_aliases(normalized_alias);

