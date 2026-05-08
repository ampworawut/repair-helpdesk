'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useProfile } from '@/contexts/profile-context'
import { RepairCase, STATUS_LABELS, PRIORITY_LABELS, PRIORITY_COLORS, STATUS_COLORS } from '@/types'
import { cn, formatDateTime, timeAgo } from '@/lib/utils'
import Link from 'next/link'
import { PlusCircle, AlertTriangle, Clock, CheckCircle2, TrendingUp, PauseCircle } from 'lucide-react'

export default function DashboardPage() {
  const [cases, setCases] = useState<RepairCase[]>([])
  const { profile } = useProfile()
  const [counts, setCounts] = useState({ total: 0, pending: 0, slaWarning: 0, breached: 0, onHold: 0 })
  const supabase = createClient()

  useEffect(() => {
    loadCases()
  }, [])

  async function loadCases() {
    const { data } = await supabase
      .from('repair_cases')
      .select('*, asset:assets(asset_code, model)')
      .order('created_at', { ascending: false })
      .limit(20)

    if (!data) return

    setCases(data as unknown as RepairCase[])

    const now = new Date()
    let pending = 0, slaWarn = 0, breached = 0, onHold = 0
    data.forEach(c => {
      if (['pending', 'responded', 'in_progress', 'on_hold'].includes(c.status)) pending++
      if (c.status === 'on_hold') onHold++
      if (c.sla_response_dl && c.status === 'pending') {
        const dl = new Date(c.sla_response_dl)
        const diff = dl.getTime() - now.getTime()
        if (diff <= 0) breached++
        else if (diff < 3600000) slaWarn++
      }
      if (c.sla_onsite_dl && ['responded', 'in_progress'].includes(c.status)) {
        const dl = new Date(c.sla_onsite_dl)
        if (dl.getTime() - now.getTime() <= 0) breached++
      }
    })

    setCounts({ total: data.length, pending, slaWarning: slaWarn, breached, onHold })
  }

  const statCards = [
    { label: 'เปิดอยู่', value: counts.pending, icon: Clock, color: 'bg-blue-50 text-blue-700' },
    { label: 'SLA ใกล้หมด', value: counts.slaWarning, icon: AlertTriangle, color: 'bg-yellow-50 text-yellow-700' },
    { label: 'เกินกำหนด', value: counts.breached, icon: TrendingUp, color: 'bg-red-50 text-red-700' },
    { label: 'พักเคส', value: counts.onHold, icon: PauseCircle, color: 'bg-purple-50 text-purple-700' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">แดชบอร์ด</h1>
          <p className="text-gray-500 mt-1">สวัสดี, {profile?.display_name || '...'}</p>
        </div>
        {profile?.role !== 'vendor_staff' && (
          <Link
            href="/cases/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm"
          >
            <PlusCircle className="w-4 h-4" />
            แจ้งซ่อมใหม่
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map(card => (
          <div key={card.label} className="bg-white rounded-xl border p-5 flex items-center gap-4">
            <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center', card.color)}>
              <card.icon className="w-6 h-6" />
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900">{card.value}</div>
              <div className="text-sm text-gray-500">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent cases */}
      <div className="bg-white rounded-xl border">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">เคสล่าสุด</h2>
          <Link href="/cases" className="text-sm text-blue-600 hover:underline">ดูทั้งหมด</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-5 py-3 font-medium">เลขเคส</th>
                <th className="px-5 py-3 font-medium">หัวข้อ</th>
                <th className="px-5 py-3 font-medium">เครื่อง</th>
                <th className="px-5 py-3 font-medium">สถานะ</th>
                <th className="px-5 py-3 font-medium">ความเร่งด่วน</th>
                <th className="px-5 py-3 font-medium hidden md:table-cell">วันที่</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cases.slice(0, 10).map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <Link href={`/cases/${c.id}`} className="text-blue-600 font-medium hover:underline">
                      {c.case_no}
                    </Link>
                  </td>
                  <td className="px-5 py-3 font-medium text-gray-900 max-w-[200px] truncate">{c.title}</td>
                  <td className="px-5 py-3 text-gray-600 text-xs font-mono">{(c as any).asset?.asset_code || '-'}</td>
                  <td className="px-5 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[c.status])}>
                      {STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', PRIORITY_COLORS[c.priority])}>
                      {PRIORITY_LABELS[c.priority]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500 hidden md:table-cell">{timeAgo(c.created_at)}</td>
                </tr>
              ))}
              {cases.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">ยังไม่มีเคส</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
