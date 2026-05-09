'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Vendor, VendorGroup, VENDOR_TYPE_LABELS, VendorType } from '@/types'
import { Plus, Trash2, Edit3, Save, X } from 'lucide-react'
import ConfirmModal from '@/components/ui/confirm-modal'
import { toast } from 'sonner'

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [groups, setGroups] = useState<VendorGroup[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', code: '', contact: '', email: '', phone: '', group_id: '', vendor_type: 'company' as VendorType })
  const [editForm, setEditForm] = useState({ name: '', contact: '', email: '', phone: '' })
  const supabase = createClient()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [vRes, gRes] = await Promise.all([
      supabase.from('vendors').select('*, vendor_group:vendor_groups(*)').order('created_at', { ascending: false }),
      supabase.from('vendor_groups').select('*').order('name'),
    ])
    setVendors(vRes.data as Vendor[] || [])
    setGroups(gRes.data as VendorGroup[] || [])
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const insertData = { ...form, group_id: form.group_id || null }
    delete (insertData as any).vendor_type_only
    const { error } = await supabase.from('vendors').insert(insertData)
    if (error) { toast.error(error.message); return }
    toast.success('เพิ่มผู้ให้เช่าเรียบร้อย')
    setShowAdd(false)
    setForm({ name: '', code: '', contact: '', email: '', phone: '', group_id: '', vendor_type: 'company' })
    loadData()
  }

  function startEdit(v: Vendor) {
    setEditing(v.id)
    setEditForm({ name: v.name, contact: v.contact || '', email: v.email || '', phone: v.phone || '' })
  }

  async function saveEdit(id: string) {
    await supabase.from('vendors').update(editForm).eq('id', id)
    setEditing(null)
    loadData()
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('vendors').update({ is_active: !current }).eq('id', id)
    loadData()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">จัดการผู้ให้เช่า</h1>
          <p className="text-sm text-gray-500 mt-1">บริษัทผู้ให้เช่าคอมพิวเตอร์</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm">
          <Plus className="w-4 h-4" /> เพิ่มผู้ให้เช่า
        </button>
      </div>

      {/* Add form modal */}
      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white rounded-xl border p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">เพิ่มผู้ให้เช่าใหม่</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">ชื่อบริษัท *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">รหัสย่อ</label><input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">กลุ่มบริษัท</label>
              <select value={form.group_id} onChange={e => setForm(f => ({ ...f, group_id: e.target.value }))} className="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— ไม่มีกลุ่ม —</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ประเภท</label>
              <select value={form.vendor_type} onChange={e => setForm(f => ({ ...f, vendor_type: e.target.value as VendorType }))} className="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                {Object.entries(VENDOR_TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">ผู้ติดต่อ</label><input value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} className="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">อีเมล</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทร</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowAdd(false)} className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">ยกเลิก</button>
            <button type="submit" className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition">บันทึก</button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-5 py-3 font-medium">ชื่อบริษัท</th>
                <th className="px-5 py-3 font-medium">กลุ่ม</th>
                <th className="px-5 py-3 font-medium">ประเภท</th>
                <th className="px-5 py-3 font-medium">รหัส</th>
                <th className="px-5 py-3 font-medium">ผู้ติดต่อ</th>
                <th className="px-5 py-3 font-medium">สถานะ</th>
                <th className="px-5 py-3 font-medium text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {vendors.map(v => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5">
                    {editing === v.id
                      ? <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="px-3 py-1.5 border rounded text-sm w-48" />
                      : <span className="font-medium text-gray-900">{v.name}</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    {v.vendor_group
                      ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{v.vendor_group.name}</span>
                      : <span className="text-xs text-gray-400">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      {VENDOR_TYPE_LABELS[v.vendor_type] || v.vendor_type}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">{v.code || '-'}</td>
                  <td className="px-5 py-3.5 text-gray-600">
                    {editing === v.id ? <input value={editForm.contact} onChange={e => setEditForm(f => ({ ...f, contact: e.target.value }))} className="px-3 py-1.5 border rounded text-sm w-32" /> : (v.contact || '-')}
                  </td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => toggleActive(v.id, v.is_active)}
                      className={v.is_active ? 'px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200' : 'px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-500 hover:bg-red-200'}>
                      {v.is_active ? 'ใช้งาน' : 'ระงับ'}
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {editing === v.id ? (
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => saveEdit(v.id)} className="p-2 text-green-600 hover:bg-green-50 rounded transition"><Save className="w-4 h-4" /></button>
                        <button onClick={() => setEditing(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded transition"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(v)} className="p-2 text-gray-400 hover:bg-gray-100 rounded transition"><Edit3 className="w-4 h-4" /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
