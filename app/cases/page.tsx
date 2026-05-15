'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { RepairCase, UserProfile, STATUS_LABELS, PRIORITY_LABELS, STATUS_COLORS, PRIORITY_COLORS } from '@/types'
import { CATEGORY_LABELS, CATEGORY_COLORS, type CaseCategory, getMainLabel, getMainColor, type CaseMainCategory } from '@/lib/categories'
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
    let q = supabase.from('repair_cases').select('*')

    if (statusFilter !== 'all') q = q.eq('status', statusFilter)
    if (priorityFilter !== 'all') q = q.eq('priority', priorityFilter)

    const { data } = await q.order('created_at', { ascending: false }).limit(100)
    const casesData = data as unknown as RepairCase[] || []

    // Fetch assets and profiles separately
    if (casesData.length > 0) {
      const assetIds = casesData.map(c => c.asset_id).filter(Boolean) as string[]
      const userIds = casesData.map(c => c.created_by).filter(Boolean) as string[]

      const [assetResult, profileResult] = await Promise.all([
        assetIds.length > 0
          ? supabase.from('assets').select('id, asset_code, model, vendor_id').in('id', assetIds)
          : Promise.resolve({ data: [] }),
        userIds.length > 0
          ? supabase.from('user_profiles').select('display_name, id').in('id', userIds)
          : Promise.resolve({ data: [] }),
      ])

      const assetMap = new Map((assetResult.data || []).map(a => [a.id, a]))
      const profileMap = new Map((profileResult.data || []).map(p => [p.id, p]))

      // Fetch vendors for assets
      const vendorIds = [...new Set((assetResult.data || []).map(a => (a as any).vendor_id).filter(Boolean))] as string[]
      let vendorMap = new Map()
      if (vendorIds.length > 0) {
        const { data: vendors } = await supabase.from('vendors').select('id, name').in('id', vendorIds)
        if (vendors) {
          vendorMap = new Map(vendors.map(v => [v.id, v]))
        }
      }

      // Attach to cases
      for (const c of casesData) {
        const asset = assetMap.get(c.asset_id) || null
        if (asset && vendorMap.has((asset as any).vendor_id)) {
          (asset as any).vendor = vendorMap.get((asset as any).vendor_id)
        }
        ;(c as any).asset = asset
        ;(c as any).created_by_profile = profileMap.get(c.created_by) || null
      }
    }

    setCases(casesData)
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
            <option value="in_progress">ช่างเข้าดำเนินการ</option>
            <option value="on_hold">พักการดำเนินการ</option>
            <option value="resolved">ดำเนินการเสร็จสิ้น</option>
            <option value="closed">ปิดรายการ</option>
            <option value="cancelled">ยกเลิก</option>
          </select>
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="px-4 py-2.5 border rounded-lg text-sm bg-white"
          >
            <option value="all">ทุกความเร่งด่วน</option>
            <option value="low">ปกติ</option>
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
                  <th className="px-5 py-3 font-medium hidden lg:table-cell">ผู้ให้เช่า</th>
                  <th className="px-5 py-3 font-medium hidden md:table-cell">ผู้แจ้ง</th>
                  <th className="px-5 py-3 font-medium">สถานะ</th>
                  <th className="px-5 py-3 font-medium">ความเร่งด่วน</th>
                  <th className="px-5 py-3 font-medium hidden lg:table-cell">วันที่</th>
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
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', getMainColor((c.category as CaseMainCategory) || 'other'))}>
                        {getMainLabel((c.category as CaseMainCategory) || 'other')}
                        {(c as any).sub_category ? ` › ${(c as any).sub_category}` : ''}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs font-mono">{(c as any).asset?.asset_code || '-'}</td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      {(c as any).asset?.vendor ? (
                        <span className="text-sm text-gray-900">{(c as any).asset.vendor.name}</span>
                      ) : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 hidden md:table-cell">{(c as any).created_by_profile?.display_name || '-'}</td>
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
                  <tr><td colSpan={9} className="px-5 py-12 text-center text-gray-400">ไม่พบเคส</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
