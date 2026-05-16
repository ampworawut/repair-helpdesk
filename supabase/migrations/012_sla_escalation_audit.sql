-- ============================================
-- 012_sla_auto_escalation.sql
-- Auto-escalate cases when SLA is breached
-- Run via pg_cron or scheduled edge function
-- ============================================

CREATE OR REPLACE FUNCTION auto_escalate_cases()
RETURNS TABLE(case_id UUID, new_level INT) AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT rc.id, rc.escalation_level, rc.status,
           rc.sla_response_dl, rc.sla_onsite_dl,
           v.escalation_chain
    FROM repair_cases rc
    JOIN assets a ON rc.asset_id = a.id
    JOIN vendors v ON a.vendor_id = v.id
    WHERE rc.status NOT IN ('closed', 'cancelled', 'resolved')
      AND rc.escalation_level < 3
      AND (
        (rc.status = 'pending' AND rc.sla_response_dl IS NOT NULL AND rc.sla_response_dl < NOW())
        OR (rc.status IN ('responded', 'in_progress') AND rc.sla_onsite_dl IS NOT NULL AND rc.sla_onsite_dl < NOW())
      )
  LOOP
    -- Increment escalation level
    UPDATE repair_cases
    SET escalation_level = escalation_level + 1,
        updated_at = NOW()
    WHERE id = r.id;

    -- Log escalation
    INSERT INTO case_activity_log (case_id, user_id, action, metadata)
    VALUES (r.id, NULL, 'escalation',
            jsonb_build_object('escalation_level', r.escalation_level + 1, 'auto', true));

    -- Create notification for supervisors
    INSERT INTO notifications (user_id, case_id, type, message)
    SELECT up.id, r.id, 'escalation',
           '🚨 เคส ' || (SELECT case_no FROM repair_cases WHERE id = r.id) || ' ถูกยกระดับเป็นระดับ ' || (r.escalation_level + 1)
    FROM user_profiles up
    WHERE up.role IN ('admin', 'supervisor') AND up.is_active = true;

    case_id := r.id;
    new_level := r.escalation_level + 1;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 013_audit_log.sql
-- Track admin actions for security audit
-- ============================================

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_user ON admin_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_admin_all ON admin_audit_log FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY audit_select_none ON admin_audit_log FOR SELECT USING (false);

-- Function to log admin actions
CREATE OR REPLACE FUNCTION log_admin_action(
  p_user_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT DEFAULT NULL,
  p_details JSONB DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO admin_audit_log (user_id, action, entity_type, entity_id, details)
  VALUES (p_user_id, p_action, p_entity_type, p_entity_id, p_details);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
