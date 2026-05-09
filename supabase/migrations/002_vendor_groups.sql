-- ============================================
-- 002_vendor_groups.sql
-- Vendor Groups: group multiple vendors under one parent
-- ============================================

-- ============ vendor_groups ============
CREATE TABLE vendor_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ============ Alter vendors: add group_id + vendor_type ============
ALTER TABLE vendors ADD COLUMN group_id UUID REFERENCES vendor_groups(id);
ALTER TABLE vendors ADD COLUMN vendor_type TEXT DEFAULT 'company'
  CHECK (vendor_type IN ('company', 'subsidiary', 'alias'));

-- ============ Alter user_profiles: add vendor_group_id ============
ALTER TABLE user_profiles ADD COLUMN vendor_group_id UUID REFERENCES vendor_groups(id);

-- ============ Migrate existing data ============
-- For each existing vendor, create a vendor_group with the same name
-- Then link vendor and vendor_staff to that group
INSERT INTO vendor_groups (id, name)
SELECT id, name FROM vendors;

UPDATE vendors SET group_id = id, vendor_type = 'company';

UPDATE user_profiles SET vendor_group_id = vendor_id WHERE vendor_id IS NOT NULL;

-- ============ Indexes ============
CREATE INDEX idx_vendors_group ON vendors(group_id);
CREATE INDEX idx_vendor_groups_name ON vendor_groups(name);
CREATE INDEX idx_profiles_vendor_group ON user_profiles(vendor_group_id);

-- ============ RLS for vendor_groups ============
ALTER TABLE vendor_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY vendor_groups_admin_all ON vendor_groups FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY vendor_groups_select_active ON vendor_groups FOR SELECT USING (true);

-- ============ Update vendor RLS ============
-- Remove old select policies and recreate with group awareness
DROP POLICY IF EXISTS vendors_select_active ON vendors;

-- vendor_staff can now see vendors in their group
CREATE POLICY vendors_select_active ON vendors FOR SELECT USING (
  is_active = true
  OR get_user_role() = 'admin'
  OR (
    get_user_role() = 'vendor_staff'
    AND group_id = (SELECT vendor_group_id FROM user_profiles WHERE id = auth.uid())
  )
);

-- ============ Update case RLS for vendor_group access ============
DROP POLICY IF EXISTS cases_vendor_select ON repair_cases;
DROP POLICY IF EXISTS cases_vendor_update ON repair_cases;

-- Helper function: get user vendor group
CREATE OR REPLACE FUNCTION get_user_vendor_group()
RETURNS UUID AS $$
  SELECT vendor_group_id FROM user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- vendor_staff can see/update cases where asset belongs to ANY vendor in their group
CREATE POLICY cases_vendor_select ON repair_cases FOR SELECT USING (
  get_user_role() = 'vendor_staff'
  AND asset_id IN (
    SELECT a.id FROM assets a
    JOIN vendors v ON a.vendor_id = v.id
    WHERE v.group_id = get_user_vendor_group()
  )
);

CREATE POLICY cases_vendor_update ON repair_cases FOR UPDATE USING (
  get_user_role() = 'vendor_staff'
  AND asset_id IN (
    SELECT a.id FROM assets a
    JOIN vendors v ON a.vendor_id = v.id
    WHERE v.group_id = get_user_vendor_group()
  )
);

-- ============ Update trigger for vendor_groups ============
CREATE TRIGGER trg_vendor_groups_updated BEFORE UPDATE ON vendor_groups FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============ Seed: group existing vendors ============
-- The migration above already auto-creates one group per existing vendor.
-- Admin can later merge them by updating group_id on vendors.