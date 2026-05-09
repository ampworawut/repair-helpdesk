// types/index.ts — v2.2 schema

// ── LINE integration types ─────────────────────────────────────────

export type LineNotifyEvent =
  | 'case_created' | 'case_assigned' | 'case_in_progress' | 'case_on_hold'
  | 'case_resolved' | 'case_closed' | 'case_cancelled'
  | 'new_comment' | 'new_attachment'
  | 'sla_warning' | 'sla_breached' | 'confirmation_requested';

export const LINE_NOTIFY_EVENT_LABELS: Record<LineNotifyEvent, string> = {
  case_created: 'มีเคสใหม่',
  case_assigned: 'มอบหมายช่างแล้ว',
  case_in_progress: 'เริ่มดำเนินการ',
  case_on_hold: 'พักเคส',
  case_resolved: 'แก้ไขแล้ว',
  case_closed: 'ปิดเคส',
  case_cancelled: 'ยกเลิกเคส',
  new_comment: 'ความคิดเห็นใหม่',
  new_attachment: 'แนบไฟล์ใหม่',
  sla_warning: '⚠️ เตือน SLA ใกล้หมด',
  sla_breached: '🚨 เกิน SLA แล้ว',
  confirmation_requested: 'ขอยืนยันการแก้ไข',
};

export type LineNotifyConfig = Record<LineNotifyEvent, boolean>;

export type UserRole = 'admin' | 'supervisor' | 'helpdesk' | 'vendor_staff';

export type CaseStatus = 'pending' | 'responded' | 'in_progress' | 'on_hold' | 'resolved' | 'closed' | 'cancelled';

export type CasePriority = 'low' | 'medium' | 'high' | 'critical';

export type AssetStatus = 'available' | 'in_use' | 'pending' | 'under_repair' | 'retired';

export type CaseCategory = 'hardware' | 'software' | 'network' | 'printer' | 'peripheral' | 'account' | 'other';

export type NotificationType =
  | 'new_case'
  | 'sla_warning'
  | 'sla_breached'
  | 'case_update'
  | 'case_closed'
  | 'owner_changed'
  | 'technician_assigned'
  | 'escalation'
  | 'confirmation_required';

export type AutoAssignStrategy = 'round_robin' | 'least_tickets' | 'random';

export type ConfirmationStatus = 'pending' | 'confirmed' | 'rejected';

export type VendorType = 'company' | 'subsidiary' | 'alias';

// ── Interfaces ───────────────────────────────────────────────────────

export interface VendorGroup {
  id: string;
  name: string;
  description: string | null;
  line_group_id: string | null;
  line_notify_config: LineNotifyConfig | null;
  vendors?: Vendor[];
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  display_name: string;
  role: UserRole;
  vendor_id: string | null;
  vendor_group_id: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  password_changed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Vendor {
  id: string;
  name: string;
  code: string | null;
  contact: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  group_id: string | null;
  vendor_type: VendorType;
  auto_assign_enabled: boolean;
  max_active_tickets: number;
  auto_assign_strategy: AutoAssignStrategy | null;
  escalation_chain: EscalationChainEntry[] | null;
  vendor_group?: VendorGroup;
  created_at: string;
  updated_at: string;
}

export interface EscalationChainEntry {
  role: UserRole;
  user_id?: string;
  wait_minutes?: number;
}

export interface Location {
  id: string;
  name: string;
  building: string | null;
  floor: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: string;
  asset_code: string;
  serial_number: string | null;
  model: string | null;
  mac_lan: string | null;
  mac_wlan: string | null;
  vendor_id: string | null;
  vendor?: Vendor;
  monthly_rent: number | null;
  location: string | null;
  assigned_to: string | null;
  status: AssetStatus;
  description: string | null;
  contract_start: string | null;
  contract_end: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RepairCase {
  id: string;
  case_no: string;
  asset_id: string | null;
  asset?: Asset;
  title: string;
  description: string | null;
  priority: CasePriority;
  status: CaseStatus;
  confirmation_status: ConfirmationStatus;
  category: CaseCategory | null;
  service_location: string | null;
  created_by: string | null;
  created_by_profile?: UserProfile;
  assigned_to: string | null;
  assigned_to_profile?: UserProfile;
  responded_at: string | null;
  onsite_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  closed_by: string | null;
  closed_by_profile?: UserProfile;
  sla_response_dl: string | null;
  sla_onsite_dl: string | null;
  sla_paused_total_seconds: number;
  sla_paused_at: string | null;
  escalation_level: number;
  batch_id: string | null;
  owner_change_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaseAttachment {
  id: string;
  case_id: string;
  file_path: string;
  file_name: string;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface CaseActivity {
  id: string;
  case_id: string;
  user_id: string | null;
  user_profile?: UserProfile;
  action: string;
  old_value: string | null;
  new_value: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  case_id: string | null;
  type: NotificationType;
  message: string;
  is_read: boolean;
  created_at: string;
}

// ── New v2.2 tables ──────────────────────────────────────────────────

export interface VendorStaffSkill {
  id: string;
  staff_id: string;
  skill_category: string;
  skill_name: string;
  proficiency_level: string | null;
  certified: boolean;
  created_at: string;
  updated_at: string;
}

export interface TicketTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  priority: CasePriority | null;
  title_template: string | null;
  description_template: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketComment {
  id: string;
  case_id: string;
  author_id: string;
  author_profile?: UserProfile;
  content: string;
  is_internal: boolean;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

// ── Thai labels ──────────────────────────────────────────────────────

export const STATUS_LABELS: Record<CaseStatus, string> = {
  pending: 'รอตอบรับ',
  responded: 'รับเรื่องแล้ว',
  in_progress: 'กำลังดำเนินการ',
  on_hold: 'พักเคส',
  resolved: 'แก้ไขแล้ว',
  closed: 'ปิดเคส',
  cancelled: 'ยกเลิก',
};

export const PRIORITY_LABELS: Record<CasePriority, string> = {
  low: 'ปกติ',
  medium: 'ปานกลาง',
  high: 'สูง',
  critical: 'ด่วนมาก',
};

export const PRIORITY_COLORS: Record<CasePriority, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

export const STATUS_COLORS: Record<CaseStatus, string> = {
  pending: 'bg-blue-100 text-blue-800',
  responded: 'bg-indigo-100 text-indigo-800',
  in_progress: 'bg-purple-100 text-purple-800',
  on_hold: 'bg-amber-100 text-amber-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-400',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'ผู้ดูแลระบบ',
  supervisor: 'หัวหน้างาน',
  helpdesk: 'เจ้าหน้าที่แจ้งซ่อม',
  vendor_staff: 'เจ้าหน้าที่ผู้ให้เช่า',
};

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  available: 'ว่าง',
  in_use: 'ใช้งาน',
  pending: 'รอดำเนินการ',
  under_repair: 'ส่งซ่อม',
  retired: 'รอทำลาย',
};

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  new_case: 'เคสใหม่',
  sla_warning: 'แจ้งเตือน SLA',
  sla_breached: 'เกิน SLA',
  case_update: 'อัปเดตเคส',
  case_closed: 'ปิดเคส',
  owner_changed: 'เปลี่ยนผู้รับผิดชอบ',
  technician_assigned: 'มอบหมายช่าง',
  escalation: 'ยกระดับเรื่อง',
  confirmation_required: 'รอยืนยัน',
};

export const AUTO_ASSIGN_STRATEGY_LABELS: Record<AutoAssignStrategy, string> = {
  round_robin: 'หมุนเวียน',
  least_tickets: 'น้อยที่สุด',
  random: 'สุ่ม',
};

export const CONFIRMATION_STATUS_LABELS: Record<ConfirmationStatus, string> = {
  pending: 'รอยืนยัน',
  confirmed: 'ยืนยันแล้ว',
  rejected: 'ปฏิเสธ',
};

export const VENDOR_TYPE_LABELS: Record<VendorType, string> = {
  company: 'บริษัทหลัก',
  subsidiary: 'บริษัทย่อย',
  alias: 'ชื่ออื่น/พิมพ์ผิด',
};