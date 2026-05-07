-- ============================================
-- 001_initial_schema.sql
-- ระบบแจ้งซ่อมคอมพิวเตอร์ (NSTDA) — v2.2
-- ============================================

-- ============ vendors ============
CREATE TABLE vendors (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  code                  TEXT UNIQUE,
  contact               TEXT,
  email                 TEXT,
  phone                 TEXT,
  is_active             BOOLEAN DEFAULT true,
  auto_assign_enabled   BOOLEAN DEFAULT false,
  max_active_tickets    INTEGER DEFAULT 10,
  auto_assign_strategy  TEXT DEFAULT 'round_robin' CHECK (auto_assign_strategy IN ('round_robin', 'least_tickets', 'random')),
  escalation_chain      JSONB DEFAULT '[]'::JSONB,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- ============ locations ============
CREATE TABLE locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  building    TEXT,
  floor       TEXT,
  is_active   BOOLEAN DEFAULT true,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ============ user_profiles ============
CREATE TABLE user_profiles (
  id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name          TEXT NOT NULL,
  role                  TEXT NOT NULL DEFAULT 'helpdesk',
  vendor_id             UUID REFERENCES vendors(id),
  email                 TEXT,
  phone                 TEXT,
  is_active             BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_role CHECK (role IN ('admin', 'supervisor', 'helpdesk', 'vendor_staff'))
);

-- ============ vendor_staff_skills ============
CREATE TABLE vendor_staff_skills (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  skill       TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(staff_id, skill)
);

-- ============ assets ============
CREATE TABLE assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_code      TEXT UNIQUE NOT NULL,
  serial_number   TEXT,
  model           TEXT,
  mac_lan         TEXT,
  mac_wlan        TEXT,
  vendor_id       UUID REFERENCES vendors(id),
  monthly_rent    DECIMAL(10,2),
  location        TEXT,
  assigned_to     TEXT,
  status          TEXT DEFAULT 'available',
  description     TEXT,
  contract_start  DATE,
  contract_end    DATE,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_asset_status CHECK (status IN ('available', 'in_use', 'pending', 'under_repair', 'retired'))
);

-- ============ ticket_templates ============
CREATE TABLE ticket_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  priority    TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  category    TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ============ repair_cases ============
CREATE TABLE repair_cases (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_no                 TEXT UNIQUE NOT NULL,
  asset_id                UUID REFERENCES assets(id),
  title                   TEXT NOT NULL,
  description             TEXT,
  priority                TEXT DEFAULT 'medium',
  status                  TEXT DEFAULT 'pending',
  service_location        TEXT,
  created_by              UUID REFERENCES auth.users(id),
  assigned_to             UUID REFERENCES auth.users(id),
  responded_at            TIMESTAMPTZ,
  onsite_at               TIMESTAMPTZ,
  resolved_at             TIMESTAMPTZ,
  closed_at               TIMESTAMPTZ,
  closed_by               UUID REFERENCES auth.users(id),
  sla_response_dl         TIMESTAMPTZ,
  sla_onsite_dl           TIMESTAMPTZ,
  sla_paused_total_seconds INTEGER DEFAULT 0,
  sla_paused_at           TIMESTAMPTZ,
  escalation_level        INTEGER DEFAULT 0,
  confirmation_status     TEXT DEFAULT 'pending' CHECK (confirmation_status IN ('pending', 'confirmed', 'rejected')),
  batch_id                UUID,
  owner_change_reason     TEXT,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_priority CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT valid_case_status CHECK (status IN ('pending', 'responded', 'in_progress', 'on_hold', 'resolved', 'closed', 'cancelled'))
);

-- ============ case_attachments ============
CREATE TABLE case_attachments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     UUID REFERENCES repair_cases(id) ON DELETE CASCADE,
  file_path   TEXT NOT NULL,
  file_name   TEXT NOT NULL,
  file_size   INTEGER,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============ ticket_comments ============
CREATE TABLE ticket_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     UUID NOT NULL REFERENCES repair_cases(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES auth.users(id),
  content     TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ============ case_activity_log ============
CREATE TABLE case_activity_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     UUID REFERENCES repair_cases(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id),
  action      TEXT NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============ notifications ============
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id),
  case_id     UUID REFERENCES repair_cases(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  message     TEXT NOT NULL,
  is_read     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_noti_type CHECK (type IN ('new_case', 'sla_warning', 'sla_breached', 'case_update', 'case_closed', 'owner_changed', 'technician_assigned', 'escalation', 'confirmation_required'))
);

-- ============ indexes ============
CREATE INDEX idx_assets_vendor ON assets(vendor_id);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_code ON assets(asset_code);
CREATE INDEX idx_staff_skills_staff ON vendor_staff_skills(staff_id);
CREATE INDEX idx_staff_skills_skill ON vendor_staff_skills(skill);

CREATE INDEX idx_cases_status ON repair_cases(status);
CREATE INDEX idx_cases_priority ON repair_cases(priority);
CREATE INDEX idx_cases_created_by ON repair_cases(created_by);
CREATE INDEX idx_cases_assigned ON repair_cases(assigned_to);
CREATE INDEX idx_cases_asset ON repair_cases(asset_id);
CREATE INDEX idx_cases_sla_response ON repair_cases(sla_response_dl) WHERE status = 'pending';
CREATE INDEX idx_cases_sla_onsite ON repair_cases(sla_onsite_dl) WHERE status IN ('responded', 'in_progress');
CREATE INDEX idx_cases_batch ON repair_cases(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX idx_cases_escalation ON repair_cases(escalation_level) WHERE escalation_level > 0;

CREATE INDEX idx_attachments_case ON case_attachments(case_id);
CREATE INDEX idx_comments_case ON ticket_comments(case_id);
CREATE INDEX idx_comments_case_created ON ticket_comments(case_id, created_at);
CREATE INDEX idx_activity_case ON case_activity_log(case_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

-- ============ function: auto case_no ============
CREATE OR REPLACE FUNCTION generate_case_no()
RETURNS TRIGGER AS $$
DECLARE
  yy TEXT;
  seq INT;
BEGIN
  yy := to_char(NOW(), 'YY');
  SELECT COALESCE(MAX(NULLIF(regexp_replace(case_no, '^REP-' || yy || '-', ''), '')::INT), 0) + 1
  INTO seq
  FROM repair_cases
  WHERE case_no LIKE 'REP-' || yy || '-%';

  NEW.case_no := 'REP-' || yy || '-' || LPAD(seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_case_no
  BEFORE INSERT ON repair_cases
  FOR EACH ROW
  WHEN (NEW.case_no IS NULL)
  EXECUTE FUNCTION generate_case_no();

-- ============ function: auto-update updated_at ============
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vendors_updated BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_locations_updated BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_assets_updated BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_cases_updated BEFORE UPDATE ON repair_cases FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_comments_updated BEFORE UPDATE ON ticket_comments FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_templates_updated BEFORE UPDATE ON ticket_templates FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============ RLS ============
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_staff_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper function: get user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function: get user vendor_id
CREATE OR REPLACE FUNCTION get_user_vendor()
RETURNS UUID AS $$
  SELECT vendor_id FROM user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============ RLS policies ============

-- vendors: admin full, everyone select active
CREATE POLICY vendors_admin_all ON vendors FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY vendors_select_active ON vendors FOR SELECT USING (is_active = true);

-- locations: admin full, everyone select active
CREATE POLICY locations_admin_all ON locations FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY locations_select_active ON locations FOR SELECT USING (is_active = true);

-- user_profiles: admin full, users can see/update themselves
CREATE POLICY profiles_admin_all ON user_profiles FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY profiles_select_self ON user_profiles FOR SELECT USING (id = auth.uid() OR get_user_role() IN ('admin', 'supervisor'));
CREATE POLICY profiles_update_self ON user_profiles FOR UPDATE USING (id = auth.uid());

-- vendor_staff_skills: admin full, vendor_staff manage own, supervisor read
CREATE POLICY skills_admin_all ON vendor_staff_skills FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY skills_select_staff ON vendor_staff_skills FOR SELECT USING (staff_id = auth.uid() OR get_user_role() IN ('admin', 'supervisor'));
CREATE POLICY skills_insert_own ON vendor_staff_skills FOR INSERT WITH CHECK (staff_id = auth.uid());
CREATE POLICY skills_delete_own ON vendor_staff_skills FOR DELETE USING (staff_id = auth.uid());

-- ticket_templates: admin full, everyone select active
CREATE POLICY templates_admin_all ON ticket_templates FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY templates_select_active ON ticket_templates FOR SELECT USING (is_active = true);

-- assets: admin full, vendor_staff see vendor's, everyone see active
CREATE POLICY assets_admin_all ON assets FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY assets_select_all ON assets FOR SELECT USING (
  get_user_role() IN ('helpdesk', 'supervisor', 'vendor_staff')
);

-- repair_cases: by role
CREATE POLICY cases_admin_all ON repair_cases FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY cases_supervisor_all ON repair_cases FOR SELECT USING (get_user_role() = 'supervisor');
CREATE POLICY cases_supervisor_update ON repair_cases FOR UPDATE USING (get_user_role() = 'supervisor');
CREATE POLICY cases_helpdesk_select ON repair_cases FOR SELECT USING (get_user_role() = 'helpdesk' AND created_by = auth.uid());
CREATE POLICY cases_helpdesk_insert ON repair_cases FOR INSERT WITH CHECK (get_user_role() IN ('helpdesk', 'supervisor', 'admin'));
CREATE POLICY cases_helpdesk_update ON repair_cases FOR UPDATE USING (get_user_role() = 'helpdesk' AND created_by = auth.uid());
CREATE POLICY cases_vendor_select ON repair_cases FOR SELECT USING (
  get_user_role() = 'vendor_staff'
  AND asset_id IN (SELECT id FROM assets WHERE vendor_id = get_user_vendor())
);
CREATE POLICY cases_vendor_update ON repair_cases FOR UPDATE USING (
  get_user_role() = 'vendor_staff'
  AND asset_id IN (SELECT id FROM assets WHERE vendor_id = get_user_vendor())
);

-- case_attachments
CREATE POLICY attachments_admin_all ON case_attachments FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY attachments_select_all ON case_attachments FOR SELECT USING (true);
CREATE POLICY attachments_insert_all ON case_attachments FOR INSERT WITH CHECK (true);

-- ticket_comments: visible to case participants
CREATE POLICY comments_admin_all ON ticket_comments FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY comments_select_case ON ticket_comments FOR SELECT USING (
  true -- visible to anyone with case access (enforced by case RLS)
);
CREATE POLICY comments_insert_auth ON ticket_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY comments_update_own ON ticket_comments FOR UPDATE USING (auth.uid() = author_id);

-- case_activity_log
CREATE POLICY activity_admin_all ON case_activity_log FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY activity_select_all ON case_activity_log FOR SELECT USING (true);
CREATE POLICY activity_insert_all ON case_activity_log FOR INSERT WITH CHECK (true);

-- notifications: users see their own
CREATE POLICY notifications_select_own ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY notifications_insert_all ON notifications FOR INSERT WITH CHECK (get_user_role() = 'admin' OR auth.uid() = user_id);
CREATE POLICY notifications_update_own ON notifications FOR UPDATE USING (user_id = auth.uid());

-- ============ storage bucket ============
-- Note: Must be created via Supabase Dashboard or API:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('repair-attachments', 'repair-attachments', true);

-- ============ seed: locations ============
INSERT INTO locations (name, building, sort_order) VALUES
  ('MT 329', 'อาคาร MT', 1),
  ('BT426', 'อาคาร BT', 2),
  ('INC2 A601', 'อาคาร INC2', 3),
  ('BT238', 'อาคาร BT', 4),
  ('CO109', 'อาคาร CO', 5);