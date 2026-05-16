'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Trash2, Calendar } from 'lucide-react'
import Link from 'next/link'

interface Holiday {
  id: string
  date: string
  name: string
}

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [newDate, setNewDate] = useState('')
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const supabase = createClient()

  useEffect(() => { loadHolidays() }, [])

  async function loadHolidays() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', session.user.id).single()
    if (profile?.role !== 'admin') return

    const res = await fetch('/api/admin/holidays')
    if (res.ok) setHolidays(await res.json())
    setLoading(false)
  }

  async function addHoliday() {
    if (!newDate || !newName.trim()) return
    setAdding(true)
    const res = await fetch('/api/admin/holidays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: newDate, name: newName.trim() }),
    })
    if (res.ok) {
      toast.success('เพิ่มวันหยุดแล้ว')
      setNewDate('')
      setNewName('')
      loadHolidays()
    } else {
      const err = await res.json()
      toast.error(err.error || 'เพิ่มไม่สำเร็จ')
    }
    setAdding(false)
  }

  async function removeHoliday(id: string) {
    const res = await fetch('/api/admin/holidays', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) { toast.success('ลบวันหยุดแล้ว'); loadHolidays() }
    else toast.error('ลบไม่สำเร็จ')
  }

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>

  const grouped: Record<string, Holiday[]> = {}
  holidays.forEach(h => {
    const year = h.date.slice(0, 4)
    if (!grouped[year]) grouped[year] = []
    grouped[year].push(h)
  })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin" className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-gray-500" /></Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">วันหยุด</h1>
          <p className="text-sm text-gray-500">จัดการวันหยุดสำหรับการคำนวณ SLA</p>
        </div>
      </div>

      {/* Add form */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Plus className="w-4 h-4 text-blue-600" /> เพิ่มวันหยุด</h3>
        <div className="flex gap-3">
          <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
            className="px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="ชื่อวันหยุด" className="flex-1 px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={addHoliday} disabled={adding || !newDate || !newName.trim()}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition text-sm font-medium">
            {adding ? '...' : 'เพิ่ม'}
          </button>
        </div>
      </div>

      {/* Holiday list */}
      {Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a)).map(([year, items]) => (
        <div key={year} className="bg-white rounded-xl border overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b font-semibold text-sm text-gray-700 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" /> {year} ({items.length} วัน)
          </div>
          <div className="divide-y">
            {items.map(h => (
              <div key={h.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <span className="text-sm font-medium text-gray-900">{h.name}</span>
                  <span className="text-xs text-gray-400 ml-3">{new Date(h.date).toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <button onClick={() => removeHoliday(h.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
