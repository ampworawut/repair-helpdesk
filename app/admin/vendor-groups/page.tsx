'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import {
  VendorGroup, Vendor, VENDOR_TYPE_LABELS, VendorType,
  LineNotifyEvent, LineNotifyConfig, LINE_NOTIFY_EVENT_LABELS,
} from '@/types'
import { DEFAULT_LINE_NOTIFY_CONFIG } from '@/lib/notify-config'
import { Plus, X, ChevronDown, ChevronRight, Trash2, Bell, MessageCircle, Settings } from 'lucide-react'
import ConfirmModal from '@/components/ui/confirm-modal'
import LineGroupListener from '@/components/line-group-listener'
import { toast } from 'sonner'

export default function AdminVendorGroupsPage() {
  const [groups, setGroups] = useState<VendorGroup[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [notifyConfigOpen, setNotifyConfigOpen] = useState<Set<string>>(new Set())
  const [form, setForm] = useState({ name: '', description: '' })
  const [assigningGroupId, setAssigningGroupId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'group' | 'vendor'; id: string } | null>(null)
  const [savingConfig, setSavingConfig] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [groupsRes, vendorsRes] = await Promise.all([
      supabase.from('vendor_groups').select('*').order('name'),
      supabase.from('vendors').select('*').order('name'),
    ])
    setGroups(groupsRes.data as VendorGroup[] || [])
    setVendors(vendorsRes.data as Vendor[] || [])
  }

  async function handleAddGroup(e: React.FormEvent) {
    e.preventDefault()
    const { data: newGroup, error } = await supabase.from('vendor_groups').insert({
      name: form.name,
      description: form.description || null,
      line_notify_config: DEFAULT_LINE_NOTIFY_CONFIG,
    }).select('*').single()
    
    if (error) { toast.error(error.message); return }
    toast.success('สร้างกลุ่มบริษัทเรียบร้อย')
    setShowAdd(false)
    setForm({ name: '', description: '' })
    
    // Update UI immediately instead of reloading
    if (newGroup) {
      setGroups(prev => [...prev, newGroup as VendorGroup])
    }
  }

  async function handleDeleteGroup(id: string) {
    await supabase.from('vendors').update({ group_id: null }).eq('group_id', id)
    const { error } = await supabase.from('vendor_groups').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('ลบกลุ่มบริษัทเรียบร้อย')
    
    // Update UI immediately
    setGroups(prev => prev.filter(g => g.id !== id))
  }

  async function handleAssignVendor(vendorId: string, groupId: string) {
    const { error } = await supabase.from('vendors').update({ group_id: groupId }).eq('id', vendorId)
    if (error) { toast.error(error.message); return }
    toast.success('เพิ่มบริษัทเข้ากลุ่มเรียบร้อย')
    setAssigningGroupId(null)
    
    // Update vendors list immediately
    setVendors(prev => prev.map(v => 
      v.id === vendorId ? { ...v, group_id: groupId } : v
    ))
  }

  async function handleUnassignVendor(vendorId: string) {
    const { error } = await supabase.from('vendors').update({ group_id: null }).eq('id', vendorId)
    if (error) { toast.error(error.message); return }
    toast.success('ถอดบริษัทออกจากกลุ่มเรียบร้อย')
    
    // Update vendors list immediately
    setVendors(prev => prev.map(v => 
      v.id === vendorId ? { ...v, group_id: null } : v
    ))
  }

  async function handleUpdateVendorType(vendorId: string, vendorType: VendorType) {
    const { error } = await supabase.from('vendors').update({ vendor_type: vendorType }).eq('id', vendorId)
    if (error) { toast.error(error.message); return }
    toast.success('อัปเดตประเภทเรียบร้อย')
    
    // Update vendors list immediately
    setVendors(prev => prev.map(v => 
      v.id === vendorId ? { ...v, vendor_type: vendorType } : v
    ))
  }

  async function handleSaveNotifyConfig(groupId: string) {
    setSavingConfig(groupId)
    const group = groups.find(g => g.id === groupId)
    if (!group) return

    const { error } = await supabase
      .from('vendor_groups')
      .update({ line_notify_config: group.line_notify_config, line_group_id: group.line_group_id })
      .eq('id', groupId)

    if (error) { toast.error(error.message)
    } else { toast.success('บันทึกการตั้งค่าแจ้งเตือนเรียบร้อย') }
    setSavingConfig(null)
  }

  async function handleSaveLineGroupId(groupId: string) {
    setSavingConfig(groupId)
    const group = groups.find(g => g.id === groupId)
    if (!group) return

    const { error } = await supabase
      .from('vendor_groups')
      .update({ line_group_id: group.line_group_id })
      .eq('id', groupId)

    if (error) { 
      toast.error(error.message)
    } else { 
      toast.success('บันทึก LINE Group ID เรียบร้อย')
    }
    setSavingConfig(null)
  }

  function toggleExpand(id: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleNotifyConfig(id: string) {
    setNotifyConfigOpen(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function updateGroup(id: string, updates: Partial<VendorGroup>) {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g))
  }

  function toggleNotifyEvent(groupId: string, event: LineNotifyEvent) {
    setGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g
      const config = { ...(g.line_notify_config || DEFAULT_LINE_NOTIFY_CONFIG) }
      config[event] = !config[event]
      return { ...g, line_notify_config: config }
    }))
  }

  // Count vendors per group for display purposes
  const vendorGroupCounts = new Map<string, number>()
  vendors.forEach(v => {
    if (v.group_id) vendorGroupCounts.set(v.group_id, (vendorGroupCounts.get(v.group_id) || 0) + 1)
  })
  
  // Ungrouped vendors are those without a group assignment
  const ungroupedVendors = vendors.filter(v => !v.group_id)

  // Show all vendor groups in admin UI
  const realGroups = groups;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">กลุ่มบริษัท</h1>
          <p className="text-sm text-gray-500 mt-1">จัดกลุ่มบริษัทที่เป็นเครือเดียวกัน เช่น บริษัทแม่-บริษัทย่อย หรือชื่อสะกดผิด</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm">
          <Plus className="w-4 h-4" /> สร้างกลุ่มใหม่
        </button>
      </div>

      {/* LINE Group Listener */}
      <LineGroupListener />

      {showAdd && (
        <form onSubmit={handleAddGroup} className="bg-white rounded-xl border p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">สร้างกลุ่มบริษัทใหม่</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อกลุ่ม *</label>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder='เช่น "นิปด้า กรุ๊ป"' />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">คำอธิบาย</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="คำอธิบายเพิ่มเติม (ไม่จำเป็น)" />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowAdd(false)} className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">ยกเลิก</button>
            <button type="submit" className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition">สร้าง</button>
          </div>
        </form>
      )}

      {/* Groups list */}
      {realGroups.map(group => {
        const groupVendors = vendors.filter(v => v.group_id === group.id)
        const isExpanded = expandedGroups.has(group.id)
        const isConfigOpen = notifyConfigOpen.has(group.id)
        const config = group.line_notify_config || DEFAULT_LINE_NOTIFY_CONFIG

        return (
          <div key={group.id} className="bg-white rounded-xl border overflow-hidden">
            {/* Group header */}
            <button
              onClick={() => toggleExpand(group.id)}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition text-left"
            >
              {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900">{group.name}</span>
                  {group.description && <span className="text-sm text-gray-500">— {group.description}</span>}
                  {group.line_group_id && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      <MessageCircle className="w-3 h-3" /> LINE
                    </span>
                  )}
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                {groupVendors.length} บริษัท
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: 'group', id: group.id }) }}
                className="p-2 text-red-400 hover:bg-red-50 rounded transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t px-5 py-4 space-y-3">
                {/* Vendors in this group */}
                {groupVendors.length > 0 ? (
                  <div className="space-y-2">
                    {groupVendors.map(v => (
                      <div key={v.id} className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-gray-900">{v.name}</span>
                          {v.code && <span className="text-xs text-gray-500 ml-2">({v.code})</span>}
                        </div>
                        <select
                          value={v.vendor_type}
                          onChange={e => handleUpdateVendorType(v.id, e.target.value as VendorType)}
                          className="px-2 py-1 border rounded text-xs bg-white"
                        >
                          {Object.entries(VENDOR_TYPE_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleUnassignVendor(v.id)}
                          className="p-1 text-gray-400 hover:text-red-500 rounded transition"
                          title="ถอดออกจากกลุ่ม"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-2">ยังไม่มีบริษัทในกลุ่มนี้</p>
                )}

                {/* Assign vendor */}
                <div className="pt-2">
                  {assigningGroupId === group.id ? (
                    <div className="flex gap-2">
                      <select
                        className="flex-1 px-3 py-2 border rounded-lg text-sm"
                        id={`assign-${group.id}`}
                        defaultValue=""
                      >
                        <option value="" disabled>เลือกบริษัทที่จะเพิ่ม...</option>
                        {ungroupedVendors.map(v => (
                          <option key={v.id} value={v.id}>{v.name}{v.code ? ` (${v.code})` : ''}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          const select = document.getElementById(`assign-${group.id}`) as HTMLSelectElement
                          if (select?.value) handleAssignVendor(select.value, group.id)
                        }}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
                      >
                        เพิ่ม
                      </button>
                      <button
                        onClick={() => setAssigningGroupId(null)}
                        className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 transition"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAssigningGroupId(group.id)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      + เพิ่มบริษัทเข้ากลุ่ม
                    </button>
                  )}
                </div>

                {/* Divider + LINE Notification Config */}
                <div className="pt-3 border-t">
                  {/* LINE Group ID Field */}
                  <div className="mb-3">
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                      <MessageCircle className="w-4 h-4 text-green-500" /> LINE Group ID
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={group.line_group_id || ''}
                        onChange={e => updateGroup(group.id, { line_group_id: e.target.value })}
                        placeholder="ได้จากการเพิ่มบอทเข้ากลุ่ม LINE"
                        className="flex-1 px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500 font-mono"
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSaveLineGroupId(group.id) }}
                        disabled={savingConfig === group.id}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition font-medium disabled:opacity-50"
                      >
                        {savingConfig === group.id ? '...' : 'บันทึก'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      เพิ่ม @repairdesk_bot เข้ากลุ่ม LINE → ส่งข้อความ → ดู Group ID ใน Webhook Log
                    </p>
                  </div>

                  {/* Notification Config Toggle */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleNotifyConfig(group.id) }}
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition"
                  >
                    {isConfigOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <Bell className="w-4 h-4" />
                    ตั้งค่าการแจ้งเตือน
                    <span className="text-xs text-gray-400">
                      ({Object.values(config).filter(Boolean).length}/{Object.keys(config).length})
                    </span>
                  </button>

                  {/* Config checkboxes */}
                  {isConfigOpen && (
                    <div className="mt-3 ml-7 p-4 bg-gray-50 rounded-lg space-y-3">
                      <p className="text-xs text-gray-500 mb-0">
                        เลือกเหตุการณ์ที่จะส่งแจ้งเตือนไปยัง LINE Group
                        {group.line_group_id ? '' : ' (ยังไม่ได้ตั้ง LINE Group ID)'}
                      </p>

                      <div className="grid sm:grid-cols-2 gap-2">
                        {(Object.entries(LINE_NOTIFY_EVENT_LABELS) as [LineNotifyEvent, string][]).map(([event, label]) => (
                          <label
                            key={event}
                            className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border cursor-pointer hover:border-blue-300 transition text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={config[event] !== false}
                              onChange={() => toggleNotifyEvent(group.id, event)}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span className={config[event] ? 'text-gray-900 font-medium' : 'text-gray-400'}>
                              {label}
                            </span>
                          </label>
                        ))}
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSaveNotifyConfig(group.id) }}
                          disabled={savingConfig === group.id}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition font-medium disabled:opacity-50"
                        >
                          {savingConfig === group.id ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Ungrouped vendors */}
      {ungroupedVendors.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-5 py-4 bg-yellow-50 border-b">
            <h3 className="font-semibold text-yellow-800">บริษัทที่ยังไม่อยู่ในกลุ่ม ({ungroupedVendors.length})</h3>
            <p className="text-sm text-yellow-600 mt-1">บริษัทเหล่านี้ยังไม่ถูกจัดกลุ่ม — เจ้าหน้าที่ผู้ให้เช่าจะเห็นเฉพาะเคสของบริษัทตัวเอง</p>
          </div>
          <div className="divide-y">
            {ungroupedVendors.map(v => (
              <div key={v.id} className="flex items-center gap-3 px-5 py-3">
                <span className="font-medium text-gray-900">{v.name}</span>
                {v.code && <span className="text-xs text-gray-500">({v.code})</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {realGroups.length === 0 && ungroupedVendors.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p>ยังไม่มีกลุ่มบริษัท</p>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmModal
        open={deleteConfirm !== null}
        onOpenChange={(open) => { if (!open) setDeleteConfirm(null) }}
        title={deleteConfirm?.type === 'group' ? 'ลบกลุ่มบริษัท' : 'ลบ'}
        message={deleteConfirm?.type === 'group' ? 'ลบกลุ่มนี้? บริษัททั้งหมดในกลุ่มจะถูกถอดออก แต่จะไม่ถูกลบ' : 'ยืนยันการลบ?'}
        confirmLabel="ลบ"
        variant="danger"
        onConfirm={() => {
          if (deleteConfirm) {
            if (deleteConfirm.type === 'group') handleDeleteGroup(deleteConfirm.id)
            setDeleteConfirm(null)
          }
        }}
      />
    </div>
  )
}
