-- ============================================
-- 007_add_attachment_activity_id.sql
-- Link attachments to activity log entries so they
-- display grouped with the comment they belong to
-- ============================================

ALTER TABLE case_attachments ADD COLUMN IF NOT EXISTS activity_id UUID REFERENCES case_activity_log(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_attachments_activity ON case_attachments(activity_id);
