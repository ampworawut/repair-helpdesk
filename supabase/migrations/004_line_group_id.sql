-- Add line_group_id column to vendor_groups table
ALTER TABLE vendor_groups ADD COLUMN IF NOT EXISTS line_group_id TEXT;

-- Add comment for documentation
COMMENT ON COLUMN vendor_groups.line_group_id IS 'LINE group ID for sending notifications to specific LINE groups';

-- Create index for faster lookups by LINE group ID
CREATE INDEX IF NOT EXISTS idx_vendor_groups_line_group_id ON vendor_groups(line_group_id);