'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { RepairCase, UserProfile, STATUS_LABELS, PRIORITY_LABELS, STATUS_COLORS, PRIORITY_COLORS } from '@/types'
import { CATEGORY_LABELS, CATEGORY_COLORS, type CaseCategory } from '@/lib/categories'
import { cn, formatDateTime, timeAgo } from '@/lib/utils'
import Link from 'next/link'
import { Search, Filter } from 'lucide-react'

export default function CasesListPage() {
  const [cases, setCases] = useState<RepairCase[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      supabase.from('user_profiles').select('*').eq('id', session.user.id).single()
        .then(({ data }) => setProfile(data as UserProfile))
    })
  }, [])

  useEffect(() => { loadCases() }, [statusFilter, priorityFilter])

  async function loadCases() {
    setLoading(true)
    let q = supabase.from('repair_cases').select('*, asset:assets(asset_code, model), created_by_profile:user_profiles!repair_cases_created_by_fkey(display_name)')

    if (statusFilter !== 'all') q = q.eq('status', statusFilter)
    if (priorityFilter !== 'all') q = q.eq('priority', priorityFilter)

    const { data } = await q.order('created_at', { ascending: false }).limit(100)
    setCases(data as unknown as RepairCase[] || [])
    setLoading(false)
  }

  const filtered = cases.filter(c =>
    search === '' ||
    c.case_no.toLowerCase().includes(search.toLowerCase()) ||
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    (c as any).asset?.asset_code?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">เคสซ่อมทั้งหมด</h1>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหาเลขเคส, หัวข้อ, รหัสเครื่อง..."
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border rounded-lg text-sm bg-white"
          >
            <option value="all">ทุกสถานะ</option>
            <option value="pending">รอตอบรับ</option>
            <option value="responded">รับเรื่องแล้ว</option>
            <option value="in_progress">กำลังดำเนินการ</option>
            <option value="on_hold">พักเคส</option>
            <option value="resolved">แก้ไขแล้ว</option>
            <option value="closed">ปิดเคส</option>
            <option value="cancelled">ยกเลิก</option>
          </select>
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="px-4 py-2.5 border rounded-lg text-sm bg-white"
          >
            <option value="all">ทุกความเร่งด่วน</option>
            <option value="low">ปกติ</option>
            <option value="medium">ปานกลาง</option>
            <option value="high">สูง</option>
            <option value="critical">ด่วนมาก</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">กำลังโหลด...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  <th className="px-5 py-3 font-medium">เลขเคส</th>
                  <th className="px-5 py-3 font-medium">หัวข้อ</th>
                  <th className="px-5 py-3 font-medium">หมวดหมู่</th>
                  <th className="px-5 py-3 font-medium">เครื่อง</th>
                  <th className="px-5 py-3 font-medium">ผู้แจ้ง</th>
                  <th className="px-5 py-3 font-medium">สถานะ</th>
                  <th className="px-5 py-3 font-medium">ความเร่งด่วน</th>
                  <th className="px-5 py-3 font-medium hidden md:table-cell">วันที่</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link href={`/cases/${c.id}`} className="text-blue-600 font-medium hover:underline">
                        {c.case_no}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-gray-900 max-w-[250px] truncate">{c.title}</td>
                    <td className="px-5 py-3.5">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', CATEGORY_COLORS[(c.category as CaseCategory) || 'other'])}>
                        {CATEGORY_LABELS[(c.category as CaseCategory) || 'other']}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs font-mono">{(c as any).asset?.asset_code || '-'}</td>
                    <td className="px-5 py-3.5 text-gray-600">{(c as any).created_by_profile?.display_name || '-'}</td>
                    <td className="px-5 py-3.5">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[c.status])}>
                        {STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', PRIORITY_COLORS[c.priority])}>
                        {PRIORITY_LABELS[c.priority]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 hidden md:table-cell">
                      {timeAgo(c.created_at)}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-5 py-12 text-center text-gray-400">ไม่พบเคส</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
