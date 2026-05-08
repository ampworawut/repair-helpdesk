-- Add category column to repair_cases for automatic problem classification
ALTER TABLE repair_cases
ADD COLUMN IF NOT EXISTS category text;

-- Add index for filtering by category
CREATE INDEX IF NOT EXISTS idx_repair_cases_category ON repair_cases(category);

COMMENT ON COLUMN repair_cases.category IS 'Problem category: hardware, software, network, printer, peripheral, account, other';
