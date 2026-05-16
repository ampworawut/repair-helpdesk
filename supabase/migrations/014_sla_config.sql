-- ============================================
-- 014_sla_config.sql
-- Configurable SLA settings table
-- ============================================

CREATE TABLE IF NOT EXISTS sla_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- singleton row
  response_hours NUMERIC(5,2) NOT NULL DEFAULT 4,
  onsite_hours NUMERIC(5,2) NOT NULL DEFAULT 18,
  work_start_hour INTEGER NOT NULL DEFAULT 8,
  work_start_min INTEGER NOT NULL DEFAULT 30,
  work_end_hour INTEGER NOT NULL DEFAULT 17,
  work_end_min INTEGER NOT NULL DEFAULT 30,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default row if not exists
INSERT INTO sla_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE sla_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY sla_config_select ON sla_config FOR SELECT USING (true);
CREATE POLICY sla_config_admin ON sla_config FOR UPDATE USING (get_user_role() = 'admin');
CREATE POLICY sla_config_admin_insert ON sla_config FOR INSERT WITH CHECK (get_user_role() = 'admin');
