-- ============================================
-- 010_add_sub_category.sql
-- Add sub_category column for 2-level classification
-- ============================================

ALTER TABLE repair_cases ADD COLUMN IF NOT EXISTS sub_category TEXT;

CREATE INDEX IF NOT EXISTS idx_repair_cases_sub_category ON repair_cases(sub_category);

COMMENT ON COLUMN repair_cases.sub_category IS 'Sub-category for detailed problem classification';
