'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'

const LABELS: Record<string, string> = {
  cases: 'เคสซ่อมทั้งหมด',
  new: 'แจ้งซ่อมใหม่',
  batch: 'สร้างหลายเคส',
  admin: 'จัดการระบบ',
  users: 'ผู้ใช้งาน',
  vendors: 'ผู้ให้เช่า',
  'vendor-groups': 'กลุ่มบริษัท',
  assets: 'เครื่องคอมพิวเตอร์',
  locations: 'สถานที่',
  templates: 'เทมเพลต',
  sla: 'ตั้งค่า SLA',
  holidays: 'วันหยุด',
  export: 'ส่งออกข้อมูล',
  email: 'ตั้งค่าอีเมล',
  reports: 'รายงาน',
  profile: 'โปรไฟล์',
}

export default function Breadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length <= 1) return null

  return (
    <nav className="flex items-center gap-1 text-sm text-gray-500 mb-4">
      <Link href="/" className="hover:text-blue-600"><Home className="w-4 h-4" /></Link>
      {segments.map((seg, i) => {
        const href = '/' + segments.slice(0, i + 1).join('/')
        const isLast = i === segments.length - 1
        const label = LABELS[seg] || seg
        return (
          <span key={seg} className="flex items-center gap-1">
            <ChevronRight className="w-3 h-3" />
            {isLast ? (
              <span className="text-gray-900 font-medium">{label}</span>
            ) : (
              <Link href={href} className="hover:text-blue-600">{label}</Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
