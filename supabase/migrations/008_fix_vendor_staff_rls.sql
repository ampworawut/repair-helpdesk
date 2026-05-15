-- ============================================
-- 008_fix_vendor_staff_rls.sql
-- Fix: vendor_staff can see cases by vendor_id OR vendor_group_id
-- ============================================

-- Update helper to fallback to vendor's group if vendor_group_id is null
CREATE OR REPLACE FUNCTION get_user_vendor_group()
RETURNS UUID AS $$
  SELECT COALESCE(
    vendor_group_id,
    (SELECT v.group_id FROM vendors v WHERE v.id = vendor_id)
  )
  FROM user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Drop and recreate vendor select/update policies
DROP POLICY IF EXISTS cases_vendor_select ON repair_cases;
DROP POLICY IF EXISTS cases_vendor_update ON repair_cases;

-- vendor_staff can see cases where asset belongs to their vendor OR their vendor group
CREATE POLICY cases_vendor_select ON repair_cases FOR SELECT USING (
  get_user_role() = 'vendor_staff'
  AND (
    asset_id IN (
      SELECT a.id FROM assets a
      JOIN vendors v ON a.vendor_id = v.id
      WHERE v.group_id = get_user_vendor_group()
    )
    OR asset_id IN (
      SELECT a.id FROM assets a
      WHERE a.vendor_id = (SELECT vendor_id FROM user_profiles WHERE id = auth.uid())
    )
  )
);

CREATE POLICY cases_vendor_update ON repair_cases FOR UPDATE USING (
  get_user_role() = 'vendor_staff'
  AND (
    asset_id IN (
      SELECT a.id FROM assets a
      JOIN vendors v ON a.vendor_id = v.id
      WHERE v.group_id = get_user_vendor_group()
    )
    OR asset_id IN (
      SELECT a.id FROM assets a
      WHERE a.vendor_id = (SELECT vendor_id FROM user_profiles WHERE id = auth.uid())
    )
  )
);
