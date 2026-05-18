-- ============================================
-- 017_email_config.sql
-- Email notification settings
-- ============================================

CREATE TABLE IF NOT EXISTS email_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT false,
  provider TEXT NOT NULL DEFAULT 'resend',
  from_address TEXT NOT NULL DEFAULT 'RepairDesk <noreply@repairdesk.app>',
  resend_api_key TEXT DEFAULT '',
  smtp_host TEXT DEFAULT '',
  smtp_port INTEGER DEFAULT 587,
  smtp_user TEXT DEFAULT '',
  smtp_pass TEXT DEFAULT '',
  notify_on_create BOOLEAN NOT NULL DEFAULT true,
  notify_on_assign BOOLEAN NOT NULL DEFAULT true,
  notify_on_resolve BOOLEAN NOT NULL DEFAULT true,
  notify_on_close BOOLEAN NOT NULL DEFAULT true,
  notify_on_sla_breach BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

INSERT INTO email_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE email_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_config_select ON email_config FOR SELECT USING (true);
CREATE POLICY email_config_admin ON email_config FOR UPDATE USING (get_user_role() = 'admin');
CREATE POLICY email_config_admin_insert ON email_config FOR INSERT WITH CHECK (get_user_role() = 'admin');
