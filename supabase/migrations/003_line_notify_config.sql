-- ============================================
-- 003_line_notify_config.sql
-- LINE notification configuration per vendor_group
-- ============================================

-- JSONB config: { event_name: true/false }
-- Default: only push critical events to stay within 200/month
ALTER TABLE vendor_groups ADD COLUMN line_notify_config JSONB DEFAULT '{
  "case_created": true,
  "case_assigned": true,
  "case_in_progress": false,
  "case_on_hold": false,
  "case_resolved": true,
  "case_closed": true,
  "case_cancelled": false,
  "new_comment": false,
  "new_attachment": false,
  "sla_warning": true,
  "sla_breached": true,
  "confirmation_requested": true
}'::JSONB;
