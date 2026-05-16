'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { toast } from 'sonner'
import { ArrowLeft, Save, Clock } from 'lucide-react'
import Link from 'next/link'

interface SLAConfig {
  response_hours: number
  onsite_hours: number
  work_start_hour: number
  work_start_min: number
  work_end_hour: number
  work_end_min: number
}

export default function SLAConfigPage() {
  const [config, setConfig] = useState<SLAConfig>({
    response_hours: 4, onsite_hours: 18,
    work_start_hour: 8, work_start_min: 30,
    work_end_hour: 17, work_end_min: 30,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => { loadConfig() }, [])

  async function loadConfig() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', session.user.id).single()
    if (profile?.role !== 'admin') return

    const res = await fetch('/api/admin/sla-config')
    if (res.ok) {
      const data = await res.json()
      if (data.response_hours) setConfig(data)
    }
    setLoading(false)
  }

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/sla-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    if (res.ok) toast.success('บันทึกการตั้งค่า SLA แล้ว')
    else toast.error('บันทึกไม่สำเร็จ')
    setSaving(false)
  }

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin" className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-gray-500" /></Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">ตั้งค่า SLA</h1>
          <p className="text-sm text-gray-500">กำหนดระยะเวลาตอบรับและเข้าหน้างาน</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-6">
        {/* Response SLA */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-blue-600" /> ระยะเวลาตอบรับ</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ชั่วโมงทำการ</label>
              <input type="number" step="0.5" min="0.5" max="48" value={config.response_hours}
                onChange={e => setConfig(c => ({ ...c, response_hours: parseFloat(e.target.value) || 4 }))}
                className="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="text-xs text-gray-400 mt-1">ค่าเริ่มต้น: 4 ชั่วโมง</p>
            </div>
          </div>
        </div>

        {/* Onsite SLA */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-purple-600" /> ระยะเวลาเข้าหน้างาน</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ชั่วโมงทำการ</label>
              <input type="number" step="0.5" min="0.5" max="120" value={config.onsite_hours}
                onChange={e => setConfig(c => ({ ...c, onsite_hours: parseFloat(e.target.value) || 18 }))}
                className="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="text-xs text-gray-400 mt-1">ค่าเริ่มต้น: 18 ชั่วโมง (2 วันทำการ)</p>
            </div>
          </div>
        </div>

        {/* Working Hours */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-green-600" /> เวลาทำการ</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เริ่มงาน (ชม.)</label>
              <input type="number" min="0" max="23" value={config.work_start_hour}
                onChange={e => setConfig(c => ({ ...c, work_start_hour: parseInt(e.target.value) || 8 }))}
                className="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เริ่มงาน (นาที)</label>
              <input type="number" min="0" max="59" value={config.work_start_min}
                onChange={e => setConfig(c => ({ ...c, work_start_min: parseInt(e.target.value) || 0 }))}
                className="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เลิกงาน (ชม.)</label>
              <input type="number" min="0" max="23" value={config.work_end_hour}
                onChange={e => setConfig(c => ({ ...c, work_end_hour: parseInt(e.target.value) || 17 }))}
                className="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เลิกงาน (นาที)</label>
              <input type="number" min="0" max="59" value={config.work_end_min}
                onChange={e => setConfig(c => ({ ...c, work_end_min: parseInt(e.target.value) || 30 }))}
                className="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">วันทำการ: จันทร์ - ศุกร์</p>
        </div>

        <div className="pt-4 border-t">
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium text-sm">
            <Save className="w-4 h-4" /> {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
          </button>
        </div>
      </div>
    </div>
  )
}
