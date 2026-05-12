-- Fix for vendor_groups table - add missing line_group_id column
ALTER TABLE vendor_groups ADD COLUMN IF NOT EXISTS line_group_id TEXT;

-- Optional: Add index for better performance
CREATE INDEX IF NOT EXISTS idx_vendor_groups_line_group_id ON vendor_groups(line_group_id);