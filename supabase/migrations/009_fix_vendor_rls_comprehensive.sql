-- ============================================
-- 009_fix_vendor_rls_comprehensive.sql
-- Replace complex inline RLS subqueries with a single SECURITY DEFINER function
-- to avoid RLS recursion issues on joined tables
-- ============================================

-- Comprehensive case access check function (bypasses all RLS)
CREATE OR REPLACE FUNCTION can_access_case(case_record repair_cases)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  user_vendor_id UUID;
  user_vendor_group_id UUID;
  asset_vendor_id UUID;
  asset_vendor_group_id UUID;
BEGIN
  -- Get user info (SECURITY DEFINER bypasses RLS)
  SELECT up.role, up.vendor_id, up.vendor_group_id
  INTO user_role, user_vendor_id, user_vendor_group_id
  FROM user_profiles up WHERE up.id = auth.uid();

  -- Admin and supervisor see everything
  IF user_role IN ('admin', 'supervisor') THEN
    RETURN true;
  END IF;

  -- Helpdesk sees own cases
  IF user_role = 'helpdesk' THEN
    RETURN case_record.created_by = auth.uid();
  END IF;

  -- Vendor staff: check asset's vendor/group
  IF user_role = 'vendor_staff' AND case_record.asset_id IS NOT NULL THEN
    -- Get asset's vendor and group
    SELECT a.vendor_id, v.group_id
    INTO asset_vendor_id, asset_vendor_group_id
    FROM assets a
    LEFT JOIN vendors v ON a.vendor_id = v.id
    WHERE a.id = case_record.asset_id;

    -- Resolve user's effective group (fallback from vendor if group not set)
    IF user_vendor_group_id IS NULL AND user_vendor_id IS NOT NULL THEN
      SELECT v.group_id INTO user_vendor_group_id
      FROM vendors v WHERE v.id = user_vendor_id;
    END IF;

    -- Match: same vendor OR same vendor group
    RETURN (asset_vendor_id IS NOT NULL AND asset_vendor_id = user_vendor_id)
        OR (asset_vendor_group_id IS NOT NULL AND asset_vendor_group_id = user_vendor_group_id);
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Drop old policies
DROP POLICY IF EXISTS cases_admin_all ON repair_cases;
DROP POLICY IF EXISTS cases_supervisor_all ON repair_cases;
DROP POLICY IF EXISTS cases_supervisor_update ON repair_cases;
DROP POLICY IF EXISTS cases_helpdesk_select ON repair_cases;
DROP POLICY IF EXISTS cases_helpdesk_insert ON repair_cases;
DROP POLICY IF EXISTS cases_helpdesk_update ON repair_cases;
DROP POLICY IF EXISTS cases_vendor_select ON repair_cases;
DROP POLICY IF EXISTS cases_vendor_update ON repair_cases;

-- New simplified policies using the function
CREATE POLICY cases_select ON repair_cases FOR SELECT
  USING (can_access_case(repair_cases));

CREATE POLICY cases_insert ON repair_cases FOR INSERT
  WITH CHECK (get_user_role() IN ('helpdesk', 'supervisor', 'admin'));

CREATE POLICY cases_update ON repair_cases FOR UPDATE
  USING (can_access_case(repair_cases));

CREATE POLICY cases_admin_all ON repair_cases FOR DELETE
  USING (get_user_role() = 'admin');
