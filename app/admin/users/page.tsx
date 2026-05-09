'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { UserProfile, UserRole, ROLE_LABELS, VendorGroup } from '@/types'
import { cn, getInitials, formatDateTime } from '@/lib/utils'
import { Plus, Edit3, Save, X, UserPlus, Lock, Trash2 } from 'lucide-react'
import ChangePasswordModal from '@/components/admin/change-password-modal'
import ConfirmModal from '@/components/ui/confirm-modal'
import { toast } from 'sonner'

const ROLES: UserRole[] = ['admin', 'supervisor', 'helpdesk', 'vendor_staff']

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([])
  const [vendorGroups, setVendorGroups] = useState<VendorGroup[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ display_name: '', role: 'helpdesk' as string, vendor_id: '', vendor_group_id: '' })

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    display_name: '',
    role: 'helpdesk' as string,
    vendor_id: '',
    vendor_group_id: '',
  })
  const [creating, setCreating] = useState(false)

  // Change password
  const [changePassUser, setChangePassUser] = useState<UserProfile | null>(null)

  // Confirm dialog
  const [confirm, setConfirm] = useState<{ title: string; message: string; variant?: 'danger'; onConfirm: () => void } | null>(null)

  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      supabase.from('user_profiles').select('*').eq('id', session.user.id).single()
        .then(({ data }) => setProfile(data as UserProfile))
    })
    loadUsers()
    supabase.from('vendors').select('id, name').eq('is_active', true).then(({ data }) => setVendors(data || []))
    supabase.from('vendor_groups').select('*').order('name').then(({ data }) => setVendorGroups(data || []))
  }, [])

  async function loadUsers() {
    const { data } = await supabase.from('user_profiles').select('*').order('created_at', { ascending: false })
    setUsers((data || []) as UserProfile[])
  }

  function startEdit(u: UserProfile) {
    setEditing(u.id)
    setEditForm({ display_name: u.display_name, role: u.role, vendor_id: u.vendor_id || '', vendor_group_id: u.vendor_group_id || '' })
  }

  async function saveEdit(id: string) {
    await supabase.from('user_profiles').update({
      display_name: editForm.display_name,
      role: editForm.role,
      vendor_id: editForm.vendor_id || null,
      vendor_group_id: editForm.vendor_group_id || null,
    }).eq('id', id)
    setEditing(null)
    loadUsers()
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('user_profiles').update({ is_active: !current }).eq('id', id)
    loadUsers()
  }

  async function handleCreate() {
    const { email, password, display_name, role, vendor_id, vendor_group_id } = createForm
    if (!email || !password || !display_name) return

    // Basic validation
    if (password.length < 6) { toast.error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'); return }

    setCreating(true)
    try {
      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, display_name, role, vendor_id: vendor_id || null, vendor_group_id: vendor_group_id || null }),
      })

      const json = await res.json()
      if (!res.ok) {
        toast.error('สร้างไม่สำเร็จ: ' + (json.error || res.statusText))
        setCreating(false)
        return
      }

      // Success
      setShowCreate(false)
      setCreateForm({ email: '', password: '', display_name: '', role: 'helpdesk', vendor_id: '', vendor_group_id: '' })
      toast.success(`สร้างผู้ใช้ ${display_name} สำเร็จ`)
      loadUsers()
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาด: ' + (err.message || 'ไม่สามารถสร้างผู้ใช้ได้'))
    }
    setCreating(false)
  }

  async function handleDelete(u: UserProfile) {
    setConfirm({
      title: 'ยืนยันการลบผู้ใช้',
      message: `คุณแน่ใจที่จะลบผู้ใช้ "${u.display_name}" (${u.email}) ใช่หรือไม่?\n\n⚠️ การลบนี้ไม่สามารถเรียกคืนได้`,
      variant: 'danger',
      onConfirm: async () => {
        const res = await fetch('/api/users/delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: u.id }),
        })

        const json = await res.json()
        if (!res.ok) {
          toast.error('ลบไม่สำเร็จ: ' + (json.error || res.statusText))
          return
        }

        toast.success(`ลบผู้ใช้ "${u.display_name}" เรียบร้อย`)
        loadUsers()
      },
    })
  }

  if (!profile || profile.role !== 'admin') return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">จัดการผู้ใช้งาน</h1>
          <p className="text-sm text-gray-500 mt-1">เพิ่ม แก้ไข และกำหนดสิทธิ์ผู้ใช้งาน</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm">
          <Plus className="w-4 h-4" /> เพิ่มผู้ใช้
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">เพิ่มผู้ใช้ใหม่</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อที่แสดง *</label>
              <input type="text" value={createForm.display_name} onChange={e => setCreateForm(f => ({ ...f, display_name: e.target.value }))}
                placeholder="สมชาย ใจดี"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">อีเมล *</label>
              <input type="email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                placeholder="somchai@example.com"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่าน *</label>
              <input type="password" value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                placeholder="อย่างน้อย 6 ตัวอักษร"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">บทบาท *</label>
              <select value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white">
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">กลุ่มบริษัท (สำหรับ vendor_staff)</label>
              <select value={createForm.vendor_group_id} onChange={e => setCreateForm(f => ({ ...f, vendor_group_id: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white">
                <option value="">-- ไม่ระบุ --</option>
                {vendorGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">ผู้ให้เช่า (สำหรับ vendor_staff — เลือกหรือไม่ก็ได้ถ้ามีกลุ่มแล้ว)</label>
              <select value={createForm.vendor_id} onChange={e => setCreateForm(f => ({ ...f, vendor_id: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white">
                <option value="">-- ไม่ระบุ --</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => setShowCreate(false)}
              className="px-5 py-2.5 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium text-sm">
              ยกเลิก
            </button>
            <button onClick={handleCreate} disabled={creating}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium text-sm">
              <UserPlus className="w-4 h-4" /> {creating ? 'กำลังสร้าง...' : 'สร้างผู้ใช้'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-5 py-3 font-medium">ผู้ใช้</th>
                <th className="px-5 py-3 font-medium">อีเมล</th>
                <th className="px-5 py-3 font-medium">บทบาท</th>
                <th className="px-5 py-3 font-medium">กลุ่ม/ผู้ให้เช่า</th>
                <th className="px-5 py-3 font-medium">สถานะ</th>
                <th className="px-5 py-3 font-medium text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5">
                    {editing === u.id ? (
                      <input value={editForm.display_name} onChange={e => setEditForm(f => ({ ...f, display_name: e.target.value }))}
                        className="px-3 py-1.5 border rounded text-sm w-40" />
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-xs">{getInitials(u.display_name)}</div>
                        <span className="font-medium text-gray-900">{u.display_name}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">{u.email || '-'}</td>
                  <td className="px-5 py-3.5">
                    {editing === u.id ? (
                      <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                        className="px-3 py-1.5 border rounded text-sm">
                        {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                    ) : (
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                        u.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                        u.role === 'supervisor' ? 'bg-blue-100 text-blue-800' :
                        u.role === 'vendor_staff' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-700')}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">
                    {editing === u.id ? (
                      <div className="space-y-1">
                        <select value={editForm.vendor_group_id} onChange={e => setEditForm(f => ({ ...f, vendor_group_id: e.target.value }))}
                          className="w-full px-3 py-1.5 border rounded text-sm">
                          <option value="">-- กลุ่มบริษัท --</option>
                          {vendorGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                        <select value={editForm.vendor_id} onChange={e => setEditForm(f => ({ ...f, vendor_id: e.target.value }))}
                          className="w-full px-3 py-1.5 border rounded text-sm">
                          <option value="">-- ผู้ให้เช่า --</option>
                          {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                      </div>
                    ) : (
                      <div>
                        {u.vendor_group_id ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            {vendorGroups.find(g => g.id === u.vendor_group_id)?.name || 'กลุ่ม'}
                          </span>
                        ) : null}
                        {u.vendor_id ? (
                          <span className="text-sm">{vendors.find(v => v.id === u.vendor_id)?.name || '-'}</span>
                        ) : !u.vendor_group_id ? '-': null}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => toggleActive(u.id, u.is_active)}
                      className={cn('px-2.5 py-1 rounded-full text-xs font-medium',
                        u.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-500 hover:bg-red-200')}>
                      {u.is_active ? 'ใช้งาน' : 'ระงับ'}
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {editing === u.id ? (
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => saveEdit(u.id)} className="p-2 text-green-600 hover:bg-green-50 rounded transition"><Save className="w-4 h-4" /></button>
                        <button onClick={() => setEditing(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded transition"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => handleDelete(u)} className="p-2 text-red-500 hover:bg-red-50 rounded transition" title="ลบผู้ใช้"><Trash2 className="w-4 h-4" /></button>
                        <button onClick={() => setChangePassUser(u)} className="p-2 text-amber-500 hover:bg-amber-50 rounded transition" title="เปลี่ยนรหัสผ่าน"><Lock className="w-4 h-4" /></button>
                        <button onClick={() => startEdit(u)} className="p-2 text-gray-400 hover:bg-gray-100 rounded transition"><Edit3 className="w-4 h-4" /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Change Password Modal */}
      {changePassUser && (
        <ChangePasswordModal
          userId={changePassUser.id}
          onClose={() => setChangePassUser(null)}
          onSuccess={() => loadUsers()}
        />
      )}

      {/* Confirm Modal */}
      {confirm && (
        <ConfirmModal
          open={true}
          onOpenChange={() => setConfirm(null)}
          title={confirm.title}
          message={confirm.message}
          variant={confirm.variant || 'default'}
          confirmLabel={confirm.variant === 'danger' ? 'ลบผู้ใช้' : 'ยืนยัน'}
          onConfirm={confirm.onConfirm}
        />
      )}
    </div>
  )
}
