-- ============================================
-- 005_line_webhook_logs.sql
-- Create table for LINE webhook logging and detection
-- ============================================

-- Table for logging LINE webhook events
CREATE TABLE IF NOT EXISTS line_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  group_id TEXT,
  user_id TEXT,
  message_type TEXT,
  message_text TEXT,
  received_at TIMESTAMPTZ DEFAULT now(),
  processed BOOLEAN DEFAULT false
);

-- Index for faster group detection
CREATE INDEX IF NOT EXISTS idx_line_webhook_logs_group_id ON line_webhook_logs(group_id);
CREATE INDEX IF NOT EXISTS idx_line_webhook_logs_received_at ON line_webhook_logs(received_at);
CREATE INDEX IF NOT EXISTS idx_line_webhook_logs_processed ON line_webhook_logs(processed);

-- Function to clean up old logs
CREATE OR REPLACE FUNCTION cleanup_old_line_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM line_webhook_logs 
  WHERE received_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- RLS policies
ALTER TABLE line_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY line_webhook_logs_admin_all ON line_webhook_logs 
  FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY line_webhook_logs_select_own ON line_webhook_logs 
  FOR SELECT USING (true);

-- Comment for documentation
COMMENT ON TABLE line_webhook_logs IS 'Stores LINE webhook events for group detection and debugging';
COMMENT ON COLUMN line_webhook_logs.group_id IS 'LINE group ID for detection purposes';
COMMENT ON COLUMN line_webhook_logs.processed IS 'Whether the event has been processed for group detection';

-- Insert sample data for testing (optional)
-- INSERT INTO line_webhook_logs (event_type, group_id, user_id, message_type, message_text)
-- VALUES 
--   ('message', 'C1234567890', 'U1234567890', 'text', 'test message'),
--   ('message', 'C0987654321', 'U1234567890', 'text', 'register');