'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Asset, AssetStatus, Vendor, ASSET_STATUS_LABELS } from '@/types'
import { cn } from '@/lib/utils'
import { Search, Upload, Monitor, Edit3, Save, X } from 'lucide-react'

export default function AdminAssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editing, setEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Asset>>({})
  const supabase = createClient()

  useEffect(() => {
    loadAssets()
    supabase.from('vendors').select('*').eq('is_active', true).order('name')
      .then(({ data }) => setVendors(data as Vendor[] || []))
  }, [])

  async function loadAssets() {
    const { data } = await supabase.from('assets').select('*, vendor:vendor_id(id, name)').order('asset_code')
    setAssets(data as Asset[] || [])
  }

  function startEdit(a: Asset) {
    setEditing(a.id)
    setEditForm({
      model: a.model, serial_number: a.serial_number, vendor_id: a.vendor_id,
      location: a.location, assigned_to: a.assigned_to, status: a.status,
      description: a.description,
    })
  }

  async function saveEdit(id: string) {
    await supabase.from('assets').update(editForm).eq('id', id)
    setEditing(null)
    loadAssets()
  }

  const filtered = assets.filter(a => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false
    if (search && !a.asset_code.toLowerCase().includes(search.toLowerCase()) &&
        !(a.model || '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">จัดการเครื่องคอมพิวเตอร์</h1>
          <p className="text-sm text-gray-500 mt-1">{assets.length} เครื่องในระบบ</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหารหัสเครื่อง หรือรุ่น..."
            className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 border rounded-lg text-sm bg-white">
          <option value="all">ทุกสถานะ</option>
          {Object.entries(ASSET_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-5 py-3 font-medium">รหัสเครื่อง</th>
                <th className="px-5 py-3 font-medium">รุ่น</th>
                <th className="px-5 py-3 font-medium">SN</th>
                <th className="px-5 py-3 font-medium">ผู้ให้เช่า</th>
                <th className="px-5 py-3 font-medium">สถานที่</th>
                <th className="px-5 py-3 font-medium">สถานะ</th>
                <th className="px-5 py-3 font-medium text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5 font-mono text-xs font-medium text-gray-900">{a.asset_code}</td>
                  <td className="px-5 py-3.5">
                    {editing === a.id
                      ? <input value={editForm.model || ''} onChange={e => setEditForm(f => ({ ...f, model: e.target.value }))} className="px-3 py-1.5 border rounded text-sm w-48" />
                      : <span className="text-gray-600 max-w-[200px] truncate block">{a.model || '-'}</span>}
                  </td>
                  <td className="px-5 py-3.5 text-gray-600 text-xs">{a.serial_number || '-'}</td>
                  <td className="px-5 py-3.5">
                    {editing === a.id ? (
                      <select value={editForm.vendor_id || ''} onChange={e => setEditForm(f => ({ ...f, vendor_id: e.target.value }))}
                        className="px-3 py-1.5 border rounded text-sm">
                        <option value="">-- ไม่ระบุ --</option>
                        {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                    ) : ((a as any).vendor?.name || '-')}
                  </td>
                  <td className="px-5 py-3.5">
                    {editing === a.id
                      ? <input value={editForm.location || ''} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} className="px-3 py-1.5 border rounded text-sm w-32" />
                      : <span className="text-gray-600">{a.location || '-'}</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    {editing === a.id ? (
                      <select value={editForm.status || ''} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as AssetStatus }))}
                        className="px-3 py-1.5 border rounded text-sm">
                        {Object.entries(ASSET_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    ) : (
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                        a.status === 'available' ? 'bg-green-100 text-green-700' :
                        a.status === 'in_use' ? 'bg-blue-100 text-blue-700' :
                        a.status === 'under_repair' ? 'bg-orange-100 text-orange-700' :
                        a.status === 'retired' ? 'bg-red-100 text-red-500' :
                        'bg-gray-100 text-gray-600')}>{ASSET_STATUS_LABELS[a.status]}</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {editing === a.id ? (
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => saveEdit(a.id)} className="p-2 text-green-600 hover:bg-green-50 rounded transition"><Save className="w-4 h-4" /></button>
                        <button onClick={() => setEditing(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded transition"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(a)} className="p-2 text-gray-400 hover:bg-gray-100 rounded transition"><Edit3 className="w-4 h-4" /></button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">ไม่พบข้อมูล</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
