-- Stage 2 seed scaffold for location_aliases.db
INSERT INTO location_aliases (alias, normalized_alias, canonical_name, entity_type, source) VALUES
  ('Baker St', 'baker st', 'Baker Street', 'station', 'generated-alias'),
  ('Baker Street', 'baker street', 'Baker Street', 'station', 'canonical-seed'),
  ('Bank', 'bank', 'Bank', 'station', 'canonical-seed'),
  ('Canary Wharf', 'canary wharf', 'Canary Wharf', 'station', 'canonical-seed'),
  ('Euston', 'euston', 'Euston', 'station', 'canonical-seed'),
  ('Green Park', 'green park', 'Green Park', 'station', 'canonical-seed'),
  ('King''s Cross', 'king s cross', 'King''s Cross St Pancras', 'station', 'generated-alias'),
  ('King''s Cross St Pancras', 'king s cross st pancras', 'King''s Cross St Pancras', 'station', 'canonical-seed'),
  ('Kings Cross', 'kings cross', 'King''s Cross St Pancras', 'station', 'generated-alias'),
  ('Leicester Square', 'leicester square', 'Leicester Square', 'station', 'canonical-seed'),
  ('Liverpool St', 'liverpool st', 'Liverpool Street', 'station', 'generated-alias'),
  ('Liverpool Street', 'liverpool street', 'Liverpool Street', 'station', 'canonical-seed'),
  ('Oxford Circus', 'oxford circus', 'Oxford Circus', 'station', 'canonical-seed'),
  ('Paddington', 'paddington', 'Paddington', 'station', 'canonical-seed'),
  ('Piccadilly Circus', 'piccadilly circus', 'Piccadilly Circus', 'station', 'canonical-seed'),
  ('St Pancras', 'st pancras', 'King''s Cross St Pancras', 'station', 'generated-alias'),
  ('Victoria', 'victoria', 'Victoria', 'station', 'canonical-seed'),
  ('Waterloo', 'waterloo', 'Waterloo', 'station', 'canonical-seed'),
  ('Westminster', 'westminster', 'Westminster', 'station', 'canonical-seed');

