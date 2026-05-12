-- First drop the trigger
DROP TRIGGER IF EXISTS trg_case_no ON repair_cases;

-- Then drop the function
DROP FUNCTION IF EXISTS generate_case_no();

-- Recreate the function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION generate_case_no()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  yy TEXT;
  seq INT;
BEGIN
  yy := to_char(NOW(), 'YY');
  SELECT COALESCE(MAX(NULLIF(regexp_replace(case_no, '^REP-' || yy || '-', ''), '')::INT), 0) + 1
  INTO seq
  FROM repair_cases
  WHERE case_no LIKE 'REP-' || yy || '-%';

  NEW.case_no := 'REP-' || yy || '-' || LPAD(seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER trg_case_no
  BEFORE INSERT ON repair_cases
  FOR EACH ROW
  WHEN (NEW.case_no IS NULL)
  EXECUTE FUNCTION generate_case_no();