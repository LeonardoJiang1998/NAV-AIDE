-- Stage 2 scaffold for pois.db
CREATE TABLE IF NOT EXISTS pois (
  id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  category TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  zone INTEGER,
  search_terms TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pois_category ON pois(category);
CREATE INDEX IF NOT EXISTS idx_pois_zone ON pois(zone);
-- Future native assembly step: project search_terms into an SQLite FTS5 table without changing the Node-first schema contract.

