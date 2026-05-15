'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { RepairCase, STATUS_LABELS, PRIORITY_LABELS } from '@/types'
import { formatDateTime } from '@/lib/utils'
import { getMainLabel, getMainColor, type CaseMainCategory, MAIN_CATEGORIES } from '@/lib/categories'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts'
import { Download, TrendingUp, Clock, AlertTriangle, CheckCircle2, MessageCircle, AlertCircle } from 'lucide-react'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function ReportsPage() {
  const [cases, setCases] = useState<RepairCase[]>([])
  const [lineMessages, setLineMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [casesResult, lineMessagesResult] = await Promise.all([
      supabase
        .from('repair_cases')
        .select('*, asset:assets(asset_code, vendor_id)')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('line_webhook_logs')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(1000)
    ])

    setCases(casesResult.data as unknown as RepairCase[] || [])
    setLineMessages(lineMessagesResult.data || [])
    setLoading(false)
  }

  /* ─── Report 1: สรุปเคสรายเดือน ─── */
  function monthlySummary() {
    const map: Record<string, { opened: number; closed: number }> = {}
    cases.forEach(c => {
      const m = new Date(c.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit' })
      if (!map[m]) map[m] = { opened: 0, closed: 0 }
      map[m].opened++
      if (c.status === 'closed') map[m].closed++
    })
    return Object.entries(map).sort().map(([month, v]) => ({ month, ...v }))
  }

  /* ─── Report 2: SLA Compliance ─── */
  function slaCompliance() {
    let met = 0, breached = 0, pending = 0
    cases.forEach(c => {
      if (c.status === 'pending' && c.sla_response_dl) {
        if (new Date(c.sla_response_dl) < new Date()) breached++
        else pending++
      } else if (c.responded_at) {
        met++
      }
    })
    return [
      { name: 'ทันกำหนด', value: met, color: '#10b981' },
      { name: 'เกินกำหนด', value: breached, color: '#ef4444' },
      { name: 'รอดำเนินการ', value: pending, color: '#f59e0b' },
    ]
  }

  /* ─── Report 3: MTTR (Mean Time To Repair) ─── */
  function mttrTrend() {
    const resolved = cases
      .filter(c => c.closed_at && c.created_at)
      .sort((a, b) => new Date(a.closed_at!).getTime() - new Date(b.closed_at!).getTime())

    const map: Record<string, { total: number; count: number }> = {}
    resolved.forEach(c => {
      const m = new Date(c.closed_at!).toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit' })
      const hours = (new Date(c.resolved_at || c.closed_at!).getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60)
      if (!map[m]) map[m] = { total: 0, count: 0 }
      map[m].total += hours
      map[m].count++
    })

    return Object.entries(map).sort().map(([month, v]) => ({
      month,
      hours: Math.round(v.total / v.count * 10) / 10,
    }))
  }

  /* ─── Report 4: Vendor Performance ─── */
  function vendorPerf() {
    const map: Record<string, { total: number; breached: number }> = {}
    cases.forEach(c => {
      const vendorName = (c as any).asset?.vendor_id || 'ไม่ระบุ'
      if (!map[vendorName]) map[vendorName] = { total: 0, breached: 0 }
      map[vendorName].total++
      if (c.sla_response_dl && c.status === 'pending' && new Date(c.sla_response_dl) < new Date()) map[vendorName].breached++
    })
    return Object.entries(map).map(([name, v]) => ({
      name: name.length > 25 ? name.slice(0, 22) + '...' : name,
      ทั้งหมด: v.total,
      เกินกำหนด: v.breached,
    }))
  }

  /* ─── Status Summary ─── */
  function statusSummary() {
    const map: Record<string, number> = {}
    cases.forEach(c => { map[c.status] = (map[c.status] || 0) + 1 })
    return Object.entries(map).map(([k, v]) => ({ name: STATUS_LABELS[k as keyof typeof STATUS_LABELS] || k, value: v }))
  }

  /* ─── Category Breakdown ─── */
  function categoryBreakdown() {
    const map: Record<string, number> = {}
    cases.forEach(c => {
      const main = (c as any).category || 'other'
      const label = getMainLabel(main as CaseMainCategory)
      map[label] = (map[label] || 0) + 1
    })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }

  /* ─── LINE Message Statistics ─── */
  function lineMessageStats() {
    const currentMonth = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit' })

    // Count outgoing push messages for current month (free account limit applies to outgoing)
    const monthlyMessages = lineMessages.filter(msg => {
      const msgMonth = new Date(msg.received_at).toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit' })
      return msgMonth === currentMonth && msg.event_type === 'outgoing_message'
    }).length

    // Free account limit (200 messages/month for LINE)
    const FREE_MESSAGE_LIMIT = 200
    const remainingMessages = Math.max(0, FREE_MESSAGE_LIMIT - monthlyMessages)
    const usagePercentage = Math.min(100, (monthlyMessages / FREE_MESSAGE_LIMIT) * 100)

    // Count by event type
    const eventCounts: Record<string, number> = {}
    lineMessages.forEach(msg => {
      eventCounts[msg.event_type] = (eventCounts[msg.event_type] || 0) + 1
    })

    return {
      monthlyMessages,
      freeLimit: FREE_MESSAGE_LIMIT,
      remainingMessages,
      usagePercentage,
      eventCounts,
      totalMessages: lineMessages.length
    }
  }

  /* ─── LINE Message Trend ─── */
  function lineMessageTrend() {
    const map: Record<string, number> = {}
    lineMessages.forEach(msg => {
      const month = new Date(msg.received_at).toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit' })
      map[month] = (map[month] || 0) + 1
    })
    
    return Object.entries(map)
      .sort()
      .map(([month, count]) => ({ month, count }))
      .slice(-12) // Last 12 months
  }

  /* ─── Export CSV ─── */
  function exportCSV() {
    const header = 'เลขเคส,หัวข้อ,สถานะ,ความเร่งด่วน,เครื่อง,ผู้ให้เช่า,วันที่สร้าง,วันที่ปิด\n'
    const rows = cases.map(c => {
      const vendorName = (c as any).asset?.vendor_id || ''
      return [c.case_no, `"${c.title}"`, STATUS_LABELS[c.status], PRIORITY_LABELS[c.priority],
        (c as any).asset?.asset_code || '', vendorName, formatDateTime(c.created_at), formatDateTime(c.closed_at)]
        .join(',')
    }).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `repair-cases-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  /* ─── Stat Cards ─── */
  const totalCases = cases.length
  const openCases = cases.filter(c => ['pending', 'responded', 'in_progress'].includes(c.status)).length
  const closedCases = cases.filter(c => c.status === 'closed').length
  const breachedCases = cases.filter(c => c.sla_response_dl && c.status === 'pending' && new Date(c.sla_response_dl) < new Date()).length
  const lineStats = lineMessageStats()

  const statCards = [
    { label: 'เคสทั้งหมด', value: totalCases, icon: TrendingUp, color: 'bg-blue-50 text-blue-700' },
    { label: 'เปิดอยู่', value: openCases, icon: Clock, color: 'bg-yellow-50 text-yellow-700' },
    { label: 'ปิดแล้ว', value: closedCases, icon: CheckCircle2, color: 'bg-green-50 text-green-700' },
    { label: 'เกิน SLA', value: breachedCases, icon: AlertTriangle, color: 'bg-red-50 text-red-700' },
    { 
      label: 'LINE Messages', 
      value: lineStats.monthlyMessages, 
      icon: MessageCircle, 
      color: 'bg-indigo-50 text-indigo-700',
      subtext: `${lineStats.remainingMessages} remaining` 
    },
    { 
      label: 'LINE Limit', 
      value: `${Math.round(lineStats.usagePercentage)}%`, 
      icon: AlertCircle, 
      color: lineStats.usagePercentage > 80 ? 'bg-orange-50 text-orange-700' : 'bg-gray-50 text-gray-700',
      subtext: `${lineStats.monthlyMessages}/${lineStats.freeLimit} messages` 
    },
  ]

  if (loading) {
    return <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
    </div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">รายงาน</h1>
          <p className="text-sm text-gray-500 mt-1">สรุปสถิติการซ่อมและ SLA</p>
        </div>
        <button onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium text-sm">
          <Download className="w-4 h-4" /> ส่งออก CSV
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map(card => (
          <div key={card.label} className="bg-white rounded-xl border p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color}`}>
              <card.icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-2xl font-bold text-gray-900">{card.value}</div>
              <div className="text-xs text-gray-500">{card.label}</div>
              {card.subtext && (
                <div className="text-[10px] text-gray-400 mt-0.5">{card.subtext}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* LINE Message Progress Bar */}
      {lineStats.monthlyMessages > 0 && (
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-900 mb-4">📊 LINE Message Usage ({new Date().toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })})</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm text-gray-600">
              <span>{lineStats.monthlyMessages} / {lineStats.freeLimit} messages used</span>
              <span>{lineStats.remainingMessages} remaining</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className={`h-3 rounded-full ${
                  lineStats.usagePercentage < 70 ? 'bg-green-500' :
                  lineStats.usagePercentage < 90 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${lineStats.usagePercentage}%` }}
              />
            </div>
            <div className="text-xs text-gray-500">
              {lineStats.usagePercentage >= 90 && (
                <div className="flex items-center gap-1 text-red-600">
                  <AlertCircle className="w-3 h-3" />
                  <strong>ใกล้ถึงขีดจำกัด:</strong> คุณกำลังจะใช้ข้อความ LINE หมด
                </div>
              )}
              {lineStats.usagePercentage < 90 && lineStats.usagePercentage > 70 && (
                <div className="flex items-center gap-1 text-yellow-600">
                  <AlertCircle className="w-3 h-3" />
                  <strong>คำเตือน:</strong> กำลังเข้าใกล้ขีดจำกัดข้อความ
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid lg:grid-cols-2 gap-5">

        {/* 1. LINE Message Trend */}
        {lineMessageTrend().length > 0 && (
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold text-gray-900 mb-4">📈 LINE Message Trend</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={lineMessageTrend()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" name="Messages Sent" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="text-xs text-gray-500 mt-2 text-center">
              Free account limit: 200 messages/month
            </div>
          </div>
        )}

        {/* Category Breakdown */}
        {categoryBreakdown().length > 0 && (
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold text-gray-900 mb-4">📂 หมวดหมู่ปัญหา</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={categoryBreakdown()} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {categoryBreakdown().map((entry, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 2. สรุปเคสรายเดือน */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-900 mb-4">📊 สรุปเคสรายเดือน</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlySummary().slice(-12)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="opened" name="เปิดใหม่" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="closed" name="ปิดแล้ว" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 2. SLA Compliance */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-900 mb-4">🥧 SLA Compliance</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={slaCompliance()} dataKey="value" nameKey="name" cx="50%" cy="50%"
                outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {slaCompliance().map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 3. MTTR Trend */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-900 mb-4">📈 เวลาซ่อมเฉลี่ย (MTTR)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={mttrTrend().slice(-12)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} unit=" ชม." />
              <Tooltip formatter={(v: number) => [`${v} ชั่วโมง`, 'MTTR']} />
              <Line type="monotone" dataKey="hours" stroke="#8b5cf6" strokeWidth={2}
                dot={{ r: 3 }} name="ชั่วโมงเฉลี่ย" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 4. Vendor Performance */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-900 mb-4">🏢 ประสิทธิภาพผู้ให้เช่า</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={vendorPerf()} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={150} />
              <Tooltip />
              <Legend />
              <Bar dataKey="ทั้งหมด" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              <Bar dataKey="เกินกำหนด" fill="#ef4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Status Summary Table */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-gray-900 mb-4">📋 สรุปตามสถานะ</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {statusSummary().map(s => (
            <div key={s.name} className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
