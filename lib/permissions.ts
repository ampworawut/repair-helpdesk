import { UserRole } from '@/types'

// ─── Permission checks (ใช้ทั้ง client และ server) ───

export function canViewAllCases(role: UserRole | null): boolean {
  if (!role) return false
  return ['admin', 'supervisor'].includes(role)
}

export function canCreateNewCase(role: UserRole | null): boolean {
  if (!role) return false
  return role !== 'vendor_staff'
}

export function canUpdateCase(role: UserRole | null, caseCreatedBy: string, userId: string, vendorMatches: boolean): boolean {
  if (!role || !userId) return false
  if (role === 'admin' || role === 'supervisor') return true
  if (role === 'helpdesk' && caseCreatedBy === userId) return true
  if (role === 'vendor_staff' && vendorMatches) return true
  return false
}

export function canCloseCase(role: UserRole | null, caseCreatedBy: string, userId: string): boolean {
  if (!role || !userId) return false
  if (role === 'admin' || role === 'supervisor') return true
  if (role === 'helpdesk' && caseCreatedBy === userId) return true
  return false
}

export function canChangeCaseOwner(role: UserRole | null): boolean {
  return role === 'admin' || role === 'supervisor'
}

export function canAssignTechnician(role: UserRole | null): boolean {
  if (!role) return false
  return ['admin', 'supervisor'].includes(role)
}

export function canAccessAdmin(role: UserRole | null): boolean {
  return role === 'admin'
}

export function canAccessReports(role: UserRole | null): boolean {
  if (!role) return false
  return ['admin', 'supervisor'].includes(role)
}

// ─── v2.2 Permission checks ───

export function canPauseResumeSLA(role: UserRole | null): boolean {
  if (!role) return false
  return ['admin', 'supervisor'].includes(role)
}

export function canConfirmResolution(role: UserRole | null, caseCreatedBy: string, userId: string): boolean {
  if (!role || !userId) return false
  if (role === 'admin' || role === 'supervisor') return true
  if (role === 'helpdesk' && caseCreatedBy === userId) return true
  return false
}

export function canManageTemplates(role: UserRole | null): boolean {
  return role === 'admin'
}

export function canManageEscalation(role: UserRole | null): boolean {
  return role === 'admin'
}

export function canBulkCreateTickets(role: UserRole | null): boolean {
  return role === 'admin'
}

export function canManageAssets(role: UserRole | null): boolean {
  return role === 'admin'
}

export function canManageSkills(role: UserRole | null, skillOwnerId?: string, userId?: string): boolean {
  if (!role) return false
  if (role === 'admin') return true
  if (role === 'vendor_staff' && skillOwnerId && userId && skillOwnerId === userId) return true
  return false
}

// ─── Navigation permissions ───

export interface NavItem {
  href: string
  label: string
  icon: string
  roles: UserRole[]
  children?: NavItem[]
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'แดชบอร์ด', icon: 'LayoutDashboard', roles: ['admin', 'supervisor', 'helpdesk', 'vendor_staff'] },
  { href: '/cases', label: 'เคสซ่อมทั้งหมด', icon: 'ClipboardList', roles: ['admin', 'supervisor', 'helpdesk', 'vendor_staff'] },
  { href: '/cases/new', label: 'แจ้งซ่อมใหม่', icon: 'PlusCircle', roles: ['admin', 'supervisor', 'helpdesk'] },
  { href: '/cases/batch', label: 'สร้างหลายเคส', icon: 'Layers', roles: ['admin'] },
  {
    href: '#', label: 'จัดการระบบ', icon: 'Settings',
    roles: ['admin'],
    children: [
      { href: '/admin/users', label: 'ผู้ใช้งาน', icon: 'Users', roles: ['admin'] },
      { href: '/admin/vendors', label: 'ผู้ให้เช่า', icon: 'Building2', roles: ['admin'] },
      { href: '/admin/vendor-groups', label: 'กลุ่มบริษัท', icon: 'Network', roles: ['admin'] },
      { href: '/admin/assets', label: 'เครื่องคอมพิวเตอร์', icon: 'Monitor', roles: ['admin'] },
      { href: '/admin/locations', label: 'สถานที่', icon: 'MapPin', roles: ['admin'] },
      { href: '/admin/templates', label: 'เทมเพลต', icon: 'FileText', roles: ['admin'] },
    ],
  },
  { href: '/reports', label: 'รายงาน', icon: 'BarChart3', roles: ['admin', 'supervisor'] },
]
