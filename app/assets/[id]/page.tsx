'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { RepairCase, STATUS_LABELS, PRIORITY_LABELS, STATUS_COLORS, PRIORITY_COLORS } from '@/types'
import { cn, formatDateTime, timeAgo } from '@/lib/utils'
import { getMainLabel, type CaseMainCategory } from '@/lib/categories'
import Link from 'next/link'
import { ArrowLeft, Monitor, Clock, MapPin, Building2 } from 'lucide-react'

export default function AssetHistoryPage({ params }: { params: { id: string } }) {
  const [asset, setAsset] = useState<any>(null)
  const [cases, setCases] = useState<RepairCase[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [assetRes, casesRes] = await Promise.all([
      supabase.from('assets').select('*, vendor:vendor_id(name)').eq('id', params.id).single(),
      supabase.from('repair_cases').select('*').eq('asset_id', params.id).order('created_at', { ascending: false }),
    ])
    setAsset(assetRes.data)
    setCases(casesRes.data as unknown as RepairCase[] || [])
    setLoading(false)
  }

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>
  if (!asset) return <div className="text-center py-20 text-gray-400">ไม่พบอุปกรณ์นี้</div>

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/cases" className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-gray-500" /></Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{asset.asset_code}</h1>
          <p className="text-sm text-gray-500">{asset.model || '-'} • {(asset as any).vendor?.name || '-'}</p>
        </div>
      </div>

      {/* Asset Info */}
      <div className="bg-white rounded-xl border p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div><span className="text-gray-500">รุ่น:</span> <span className="font-medium">{asset.model || '-'}</span></div>
        <div><span className="text-gray-500">SN:</span> <span className="font-medium">{asset.serial_number || '-'}</span></div>
        <div><span className="text-gray-500">สถานที่:</span> <span className="font-medium">{asset.location || '-'}</span></div>
        <div><span className="text-gray-500">สถานะ:</span> <span className="font-medium">{asset.status}</span></div>
      </div>

      {/* Case History */}
      <div className="bg-white rounded-xl border">
        <div className="px-5 py-4 border-b"><h2 className="font-semibold text-gray-900">ประวัติการซ่อม ({cases.length})</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-5 py-3 font-medium">เลขเคส</th>
                <th className="px-5 py-3 font-medium">หัวข้อ</th>
                <th className="px-5 py-3 font-medium">หมวดหมู่</th>
                <th className="px-5 py-3 font-medium">สถานะ</th>
                <th className="px-5 py-3 font-medium">ความเร่งด่วน</th>
                <th className="px-5 py-3 font-medium hidden md:table-cell">วันที่</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cases.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5"><Link href={`/cases/${c.id}`} className="text-blue-600 font-medium hover:underline">{c.case_no}</Link></td>
                  <td className="px-5 py-3.5 font-medium text-gray-900 max-w-[200px] truncate">{c.title}</td>
                  <td className="px-5 py-3.5"><span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', 'bg-gray-100 text-gray-600')}>{getMainLabel((c as any).category as CaseMainCategory || 'other')}</span></td>
                  <td className="px-5 py-3.5"><span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[c.status])}>{STATUS_LABELS[c.status]}</span></td>
                  <td className="px-5 py-3.5"><span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', PRIORITY_COLORS[c.priority])}>{PRIORITY_LABELS[c.priority]}</span></td>
                  <td className="px-5 py-3.5 text-gray-500 hidden md:table-cell">{timeAgo(c.created_at)}</td>
                </tr>
              ))}
              {cases.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">ไม่มีประวัติการซ่อม</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
