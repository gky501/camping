ALTER TABLE sites ADD COLUMN area TEXT NOT NULL DEFAULT '';
ALTER TABLE stays ADD COLUMN site_snapshot_json TEXT;

UPDATE sites
SET area = 'Crystal Springs', loop = 'C', updated_at = CURRENT_TIMESTAMP
WHERE id = 'lake-ouachita-crystal-springs-c-55'
  AND loop = 'Crystal Springs C';
