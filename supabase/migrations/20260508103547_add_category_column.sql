-- Add category column to repair_cases for auto-classification
ALTER TABLE repair_cases ADD COLUMN IF NOT EXISTS category TEXT;

-- Set default category for existing cases
UPDATE repair_cases SET category = 'other' WHERE category IS NULL;

COMMENT ON COLUMN repair_cases.category IS 'Problem category: hardware, software, network, printer, peripheral, account, other';
