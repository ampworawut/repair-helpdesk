-- ============================================
-- 011_fix_vendor_cancel_rls.sql
-- Prevent vendor_staff from setting status to 'cancelled' via RLS
-- ============================================

-- Drop existing update policy
DROP POLICY IF EXISTS cases_update ON repair_cases;

-- Recreate with WITH CHECK to block vendor_staff from cancelling
CREATE POLICY cases_update ON repair_cases FOR UPDATE
  USING (can_access_case(repair_cases))
  WITH CHECK (
    -- Admin/supervisor can set any status
    (get_user_role() IN ('admin', 'supervisor'))
    OR
    -- Vendor staff cannot cancel
    (get_user_role() = 'vendor_staff' AND status != 'cancelled')
    OR
    -- Helpdesk cannot cancel (only update own cases)
    (get_user_role() = 'helpdesk' AND status != 'cancelled')
  );
