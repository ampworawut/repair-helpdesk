-- ============================================
-- 018_fix_case_no_race.sql
-- Replace MAX-based case_no generation with atomic sequence table
-- to prevent duplicate key errors on concurrent inserts
-- ============================================

-- Create atomic sequence table
CREATE TABLE IF NOT EXISTS case_number_seq (
  year_prefix TEXT PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

-- Seed with current max for this year
INSERT INTO case_number_seq (year_prefix, last_number)
SELECT to_char(NOW(), 'YY'), COALESCE(MAX(NULLIF(regexp_replace(case_no, '^REP-\d{2}-', ''), '')::INT), 0)
FROM repair_cases
WHERE case_no LIKE 'REP-' || to_char(NOW(), 'YY') || '-%'
ON CONFLICT (year_prefix) DO NOTHING;

-- Replace the old trigger function with atomic version
CREATE OR REPLACE FUNCTION generate_case_no()
RETURNS TRIGGER AS $$
DECLARE
  yy TEXT;
  seq INT;
BEGIN
  yy := to_char(NOW(), 'YY');

  -- Atomic increment using UPSERT
  INSERT INTO case_number_seq (year_prefix, last_number)
  VALUES (yy, 1)
  ON CONFLICT (year_prefix)
  DO UPDATE SET last_number = case_number_seq.last_number + 1
  RETURNING last_number INTO seq;

  NEW.case_no := 'REP-' || yy || '-' || LPAD(seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- RLS for sequence table (admin only)
ALTER TABLE case_number_seq ENABLE ROW LEVEL SECURITY;
CREATE POLICY case_number_seq_admin ON case_number_seq FOR ALL USING (get_user_role() = 'admin');
