'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { UserProfile, UserRole, ROLE_LABELS } from '@/types'
import { cn, getInitials } from '@/lib/utils'
import { Plus, Trash2, Edit3, Save, X, UserPlus } from 'lucide-react'

const ROLES: UserRole[] = ['admin', 'supervisor', 'helpdesk', 'vendor_staff']

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ display_name: '', role: 'helpdesk' as string, vendor_id: '' })
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      supabase.from('user_profiles').select('*').eq('id', session.user.id).single()
        .then(({ data }) => setProfile(data as UserProfile))
    })
    loadUsers()
    supabase.from('vendors').select('id, name').eq('is_active', true).then(({ data }) => setVendors(data || []))
  }, [])

  async function loadUsers() {
    const { data } = await supabase.from('user_profiles').select('*').order('created_at', { ascending: false })
    setUsers((data || []) as UserProfile[])
  }

  function startEdit(u: UserProfile) {
    setEditing(u.id)
    setEditForm({ display_name: u.display_name, role: u.role, vendor_id: u.vendor_id || '' })
  }

  async function saveEdit(id: string) {
    await supabase.from('user_profiles').update({
      display_name: editForm.display_name,
      role: editForm.role,
      vendor_id: editForm.vendor_id || null,
    }).eq('id', id)
    setEditing(null)
    loadUsers()
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('user_profiles').update({ is_active: !current }).eq('id', id)
    loadUsers()
  }

  async function handleInvite() {
    if (!inviteEmail) return
    setInviting(true)
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(inviteEmail)
    if (error) { alert('ไม่สามารถส่งคำเชิญได้: ' + error.message); setInviting(false); return }
    // Wait and refresh
    setTimeout(() => { loadUsers(); setInviteEmail(''); setInviting(false) }, 1500)
  }

  if (!profile || profile.role !== 'admin') return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">จัดการผู้ใช้งาน</h1>
          <p className="text-sm text-gray-500 mt-1">เพิ่ม แก้ไข และกำหนดสิทธิ์ผู้ใช้งาน</p>
        </div>
      </div>

      {/* Invite */}
      <div className="bg-white rounded-xl border p-5">
        <h2 className="font-semibold text-gray-900 mb-3">เชิญผู้ใช้ใหม่</h2>
        <div className="flex gap-3">
          <input
            type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
            placeholder="email@example.com"
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <button onClick={handleInvite} disabled={inviting || !inviteEmail}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium text-sm">
            <UserPlus className="w-4 h-4" /> {inviting ? 'กำลังส่ง...' : 'ส่งคำเชิญ'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">ผู้ใช้จะได้รับอีเมลเชิญให้สมัครสมาชิก</p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-5 py-3 font-medium">ผู้ใช้</th>
                <th className="px-5 py-3 font-medium">อีเมล</th>
                <th className="px-5 py-3 font-medium">บทบาท</th>
                <th className="px-5 py-3 font-medium">ผู้ให้เช่า</th>
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
                      <select value={editForm.vendor_id} onChange={e => setEditForm(f => ({ ...f, vendor_id: e.target.value }))}
                        className="px-3 py-1.5 border rounded text-sm">
                        <option value="">-- ไม่ระบุ --</option>
                        {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                    ) : (u.vendor_id ? vendors.find(v => v.id === u.vendor_id)?.name || '-' : '-')}
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
                      <button onClick={() => startEdit(u)} className="p-2 text-gray-400 hover:bg-gray-100 rounded transition"><Edit3 className="w-4 h-4" /></button>
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
