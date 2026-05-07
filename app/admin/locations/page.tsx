'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Location } from '@/types'
import { Plus, Trash2, Edit3, Save, X, GripVertical } from 'lucide-react'

export default function AdminLocationsPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', building: '', floor: '' })
  const [editForm, setEditForm] = useState({ name: '', building: '', floor: '' })
  const supabase = createClient()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data } = await supabase.from('locations').select('*').order('sort_order')
    setLocations(data as Location[] || [])
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const nextSort = locations.length + 1
    await supabase.from('locations').insert({ ...form, sort_order: nextSort })
    setShowAdd(false)
    setForm({ name: '', building: '', floor: '' })
    loadData()
  }

  function startEdit(l: Location) {
    setEditing(l.id)
    setEditForm({ name: l.name, building: l.building || '', floor: l.floor || '' })
  }

  async function saveEdit(id: string) {
    await supabase.from('locations').update(editForm).eq('id', id)
    setEditing(null)
    loadData()
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('locations').update({ is_active: !current }).eq('id', id)
    loadData()
  }

  async function remove(id: string) {
    if (!confirm('ลบสถานที่นี้ออกจากระบบ?')) return
    await supabase.from('locations').delete().eq('id', id)
    loadData()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">จัดการสถานที่</h1>
          <p className="text-sm text-gray-500 mt-1">สถานที่ให้บริการที่ Helpdesk สามารถเลือกได้ตอนแจ้งซ่อม</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm">
          <Plus className="w-4 h-4" /> เพิ่มสถานที่
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white rounded-xl border p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">เพิ่มสถานที่ใหม่</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">ชื่อสถานที่ *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="เช่น MT 329" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">อาคาร</label><input value={form.building} onChange={e => setForm(f => ({ ...f, building: e.target.value }))} className="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="อาคาร MT" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">ชั้น</label><input value={form.floor} onChange={e => setForm(f => ({ ...f, floor: e.target.value }))} className="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="3" /></div>
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowAdd(false)} className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">ยกเลิก</button>
            <button type="submit" className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition">บันทึก</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-5 py-3 font-medium w-12">#</th>
                <th className="px-5 py-3 font-medium">ชื่อสถานที่</th>
                <th className="px-5 py-3 font-medium">อาคาร</th>
                <th className="px-5 py-3 font-medium">ชั้น</th>
                <th className="px-5 py-3 font-medium">สถานะ</th>
                <th className="px-5 py-3 font-medium text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {locations.map((l, i) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5 text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-5 py-3.5">
                    {editing === l.id
                      ? <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="px-3 py-1.5 border rounded text-sm w-36" />
                      : <span className="font-medium text-gray-900">{l.name}</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    {editing === l.id
                      ? <input value={editForm.building} onChange={e => setEditForm(f => ({ ...f, building: e.target.value }))} className="px-3 py-1.5 border rounded text-sm w-24" />
                      : <span className="text-gray-600">{l.building || '-'}</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    {editing === l.id
                      ? <input value={editForm.floor} onChange={e => setEditForm(f => ({ ...f, floor: e.target.value }))} className="px-3 py-1.5 border rounded text-sm w-16" />
                      : <span className="text-gray-600">{l.floor || '-'}</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => toggleActive(l.id, l.is_active)}
                      className={l.is_active ? 'px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200' : 'px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-500 hover:bg-red-200'}>
                      {l.is_active ? 'ใช้งาน' : 'ระงับ'}
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {editing === l.id ? (
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => saveEdit(l.id)} className="p-2 text-green-600 hover:bg-green-50 rounded transition"><Save className="w-4 h-4" /></button>
                        <button onClick={() => setEditing(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded transition"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => startEdit(l)} className="p-2 text-gray-400 hover:bg-gray-100 rounded transition"><Edit3 className="w-4 h-4" /></button>
                        <button onClick={() => remove(l.id)} className="p-2 text-red-400 hover:bg-red-50 rounded transition"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {locations.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400">ยังไม่มีสถานที่</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
