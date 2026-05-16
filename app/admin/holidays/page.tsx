'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Trash2, Calendar, Download, Upload, Pencil, Check, X } from 'lucide-react'
import Link from 'next/link'

interface Holiday {
  id: string
  date: string
  name: string
}

const TEMPLATE_CSV = 'date,name\n2026-01-01,วันขึ้นปีใหม่\n2026-04-13,วันสงกรานต์\n2026-12-31,วันสิ้นปี'

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [newDate, setNewDate] = useState('')
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editName, setEditName] = useState('')
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
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
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: newDate, name: newName.trim() }),
    })
    if (res.ok) { toast.success('เพิ่มวันหยุดแล้ว'); setNewDate(''); setNewName(''); loadHolidays() }
    else { const err = await res.json(); toast.error(err.error || 'เพิ่มไม่สำเร็จ') }
    setAdding(false)
  }

  function startEdit(h: Holiday) {
    setEditingId(h.id); setEditDate(h.date); setEditName(h.name)
  }
  function cancelEdit() { setEditingId(null) }

  async function saveEdit() {
    if (!editingId || !editDate || !editName.trim()) return
    const res = await fetch('/api/admin/holidays', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingId, date: editDate, name: editName.trim() }),
    })
    if (res.ok) { toast.success('อัปเดตแล้ว'); setEditingId(null); loadHolidays() }
    else toast.error('อัปเดตไม่สำเร็จ')
  }

  async function removeHoliday(id: string) {
    const res = await fetch('/api/admin/holidays', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (res.ok) { toast.success('ลบวันหยุดแล้ว'); loadHolidays() }
    else toast.error('ลบไม่สำเร็จ')
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'holiday-template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const lines = text.split('\n').filter(l => l.trim())
      const headers = lines[0].toLowerCase().split(',')
      const dateIdx = headers.findIndex(h => h.trim() === 'date')
      const nameIdx = headers.findIndex(h => h.trim() === 'name')
      if (dateIdx === -1 || nameIdx === -1) { toast.error('CSV ต้องมีคอลัมน์ date และ name'); return }

      const holidays = lines.slice(1).map(line => {
        const cols = line.split(',')
        return { date: cols[dateIdx]?.trim(), name: cols[nameIdx]?.trim() }
      }).filter(h => h.date && h.name)

      if (holidays.length === 0) { toast.error('ไม่พบข้อมูลในไฟล์'); return }

      const res = await fetch('/api/admin/holidays', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holidays }),
      })
      if (res.ok) {
        const data = await res.json()
        toast.success(`นำเข้า ${data.count} รายการ`)
        loadHolidays()
      } else {
        const err = await res.json(); toast.error(err.error || 'นำเข้าไม่สำเร็จ')
      }
    } catch { toast.error('อ่านไฟล์ไม่สำเร็จ') }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = '' }
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

      {/* Add + Import row */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Plus className="w-4 h-4 text-blue-600" /> เพิ่มวันหยุด</h3>
        <div className="flex gap-3">
          <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="ชื่อวันหยุด" className="flex-1 px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={addHoliday} disabled={adding || !newDate || !newName.trim()} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition text-sm font-medium">
            {adding ? '...' : 'เพิ่ม'}
          </button>
        </div>

        <div className="flex gap-3 pt-2 border-t">
          <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium">
            <Download className="w-4 h-4" /> ดาวน์โหลดเทมเพลต
          </button>
          <label className={`flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium cursor-pointer ${importing ? 'opacity-50' : ''}`}>
            <Upload className="w-4 h-4" /> {importing ? 'กำลังนำเข้า...' : 'นำเข้า CSV'}
            <input ref={fileRef} type="file" accept=".csv" onChange={handleImport} className="hidden" disabled={importing} />
          </label>
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
                {editingId === h.id ? (
                  <div className="flex items-center gap-3 flex-1">
                    <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="px-3 py-1.5 border rounded text-sm" />
                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="flex-1 px-3 py-1.5 border rounded text-sm" />
                    <button onClick={saveEdit} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Check className="w-4 h-4" /></button>
                    <button onClick={cancelEdit} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <>
                    <div>
                      <span className="text-sm font-medium text-gray-900">{h.name}</span>
                      <span className="text-xs text-gray-400 ml-3">{new Date(h.date).toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEdit(h)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => removeHoliday(h.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
