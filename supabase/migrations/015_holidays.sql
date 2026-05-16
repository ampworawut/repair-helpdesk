-- ============================================
-- 015_holidays.sql
-- Holiday calendar for accurate SLA calculation
-- ============================================

CREATE TABLE IF NOT EXISTS holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);

ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY holidays_select ON holidays FOR SELECT USING (true);
CREATE POLICY holidays_admin_all ON holidays FOR ALL USING (get_user_role() = 'admin');

-- Seed Thai public holidays 2026
INSERT INTO holidays (date, name) VALUES
  ('2026-01-01', 'วันขึ้นปีใหม่'),
  ('2026-01-02', 'วันหยุดชดเชยปีใหม่'),
  ('2026-02-09', 'วันมาฆบูชา'),
  ('2026-04-06', 'วันจักรี'),
  ('2026-04-13', 'วันสงกรานต์'),
  ('2026-04-14', 'วันสงกรานต์'),
  ('2026-04-15', 'วันสงกรานต์'),
  ('2026-05-01', 'วันแรงงานแห่งชาติ'),
  ('2026-05-04', 'วันฉัตรมงคล'),
  ('2026-05-13', 'วันพืชมงคล'),
  ('2026-06-03', 'วันเฉลิมพระชนมพรรษาสมเด็จพระราชินี'),
  ('2026-07-28', 'วันเฉลิมพระชนมพรรษา ร.10'),
  ('2026-08-12', 'วันแม่แห่งชาติ'),
  ('2026-10-13', 'วันคล้ายวันสวรรคต ร.9'),
  ('2026-10-23', 'วันปิยมหาราช'),
  ('2026-12-07', 'วันพ่อแห่งชาติ'),
  ('2026-12-10', 'วันรัฐธรรมนูญ'),
  ('2026-12-31', 'วันสิ้นปี')
ON CONFLICT (date) DO NOTHING;
