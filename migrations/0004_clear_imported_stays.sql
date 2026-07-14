-- Imported spreadsheet stay counts had no dates. Clear them so the diary only counts dated entries.
UPDATE sites SET legacy_stay_count = 0;
