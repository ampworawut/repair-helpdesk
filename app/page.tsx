'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useProfile } from '@/contexts/profile-context'
import { RepairCase, STATUS_LABELS, PRIORITY_LABELS, PRIORITY_COLORS, STATUS_COLORS } from '@/types'
import { cn, formatDateTime, timeAgo } from '@/lib/utils'
import { getMainLabel, type CaseMainCategory } from '@/lib/categories'
import Link from 'next/link'
import { PlusCircle, AlertTriangle, Clock, CheckCircle2, TrendingUp, PauseCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

export default function DashboardPage() {
  const [cases, setCases] = useState<RepairCase[]>([])
  const [allCases, setAllCases] = useState<RepairCase[]>([])
  const { profile } = useProfile()
  const [counts, setCounts] = useState({ total: 0, pending: 0, slaWarning: 0, breached: 0, onHold: 0 })
  const supabase = createClient()

  useEffect(() => { loadCases() }, [])

  async function loadCases() {
    const [recentRes, allRes] = await Promise.all([
      supabase.from('repair_cases').select('*, asset:assets(asset_code, model)').order('created_at', { ascending: false }).limit(20),
      supabase.from('repair_cases').select('*, asset:assets(asset_code, model)').order('created_at', { ascending: false }).limit(200),
    ])

    const data = recentRes.data as unknown as RepairCase[] || []
    setCases(data)
    setAllCases(allRes.data as unknown as RepairCase[] || [])

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

  // Weekly trend
  function weeklyTrend() {
    const map: Record<string, { created: number; closed: number }> = {}
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toLocaleDateString('th-TH', { weekday: 'short' })
      map[key] = { created: 0, closed: 0 }
    }
    allCases.forEach(c => {
      const createdKey = new Date(c.created_at).toLocaleDateString('th-TH', { weekday: 'short' })
      if (map[createdKey]) map[createdKey].created++
      if (c.closed_at) {
        const closedKey = new Date(c.closed_at).toLocaleDateString('th-TH', { weekday: 'short' })
        if (map[closedKey]) map[closedKey].closed++
      }
    })
    return Object.entries(map).map(([day, v]) => ({ day, ...v }))
  }

  // Category distribution
  function categoryDist() {
    const map: Record<string, number> = {}
    allCases.forEach(c => {
      const label = getMainLabel((c as any).category as CaseMainCategory || 'other')
      map[label] = (map[label] || 0) + 1
    })
    return Object.entries(map).map(([name, count]) => ({ name, count }))
  }

  const statCards = [
    { label: 'เปิดอยู่', value: counts.pending, icon: Clock, color: 'bg-blue-50 text-blue-700' },
    { label: 'SLA ใกล้หมด', value: counts.slaWarning, icon: AlertTriangle, color: 'bg-yellow-50 text-yellow-700' },
    { label: 'เกินกำหนด', value: counts.breached, icon: TrendingUp, color: 'bg-red-50 text-red-700' },
    { label: 'พักการดำเนินการ', value: counts.onHold, icon: PauseCircle, color: 'bg-purple-50 text-purple-700' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">แดชบอร์ด</h1>
          <p className="text-gray-500 mt-1">สวัสดี, {profile?.display_name || '...'}</p>
        </div>
        {profile?.role !== 'vendor_staff' && (
          <Link href="/cases/new" className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm">
            <PlusCircle className="w-4 h-4" /> แจ้งซ่อมใหม่
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

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Weekly Trend */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-900 mb-4">📊 เคสรายสัปดาห์</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={weeklyTrend()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip />
              <Bar dataKey="created" name="เปิดใหม่" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="closed" name="ปิดแล้ว" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category Distribution */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-900 mb-4">📂 หมวดหมู่ปัญหา</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={categoryDist()} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={120} />
              <Tooltip />
              <Bar dataKey="count" name="จำนวน" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
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
                    <Link href={`/cases/${c.id}`} className="text-blue-600 font-medium hover:underline">{c.case_no}</Link>
                  </td>
                  <td className="px-5 py-3 font-medium text-gray-900 max-w-[200px] truncate">{c.title}</td>
                  <td className="px-5 py-3 text-gray-600 text-xs font-mono">{(c as any).asset?.asset_code || '-'}</td>
                  <td className="px-5 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[c.status])}>{STATUS_LABELS[c.status]}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', PRIORITY_COLORS[c.priority])}>{PRIORITY_LABELS[c.priority]}</span>
                  </td>
                  <td className="px-5 py-3 text-gray-500 hidden md:table-cell">{timeAgo(c.created_at)}</td>
                </tr>
              ))}
              {cases.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">ยังไม่มีเคส</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
