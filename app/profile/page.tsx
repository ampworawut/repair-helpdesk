'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { UserProfile, ROLE_LABELS } from '@/types'
import { formatDateTime } from '@/lib/utils'
import { ArrowLeft, Lock, Eye, EyeOff, Check, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // Password form
  const [showForm, setShowForm] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      supabase.from('user_profiles').select('*').eq('id', session.user.id).single()
        .then(({ data }) => {
          setProfile(data as UserProfile)
          setLoading(false)
        })
    })
  }, [])

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' })
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'ยืนยันรหัสผ่านไม่ตรงกัน' })
      return
    }
    if (newPassword === oldPassword) {
      setMessage({ type: 'error', text: 'รหัสผ่านใหม่ต้องไม่ตรงกับรหัสผ่านเดิม' })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/users/change-password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile!.id, oldPassword, newPassword }),
      })

      const json = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: json.error || 'เปลี่ยนรหัสผ่านไม่สำเร็จ' })
      } else {
        setMessage({ type: 'success', text: '✅ เปลี่ยนรหัสผ่านเรียบร้อย' })
        setShowForm(false)
        setOldPassword('')
        setNewPassword('')
        setConfirmPassword('')
        // Refresh profile to get updated password_changed_at
        const { data } = await supabase.from('user_profiles').select('*').eq('id', profile!.id).single()
        if (data) setProfile(data as UserProfile)
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด: ' + (err.message || '') })
    }
    setSubmitting(false)
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
    </div>
  }

  if (!profile) return <div className="text-center py-20 text-gray-400">ไม่พบข้อมูลผู้ใช้</div>

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">โปรไฟล์ของฉัน</h1>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xl">
            {profile.display_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{profile.display_name}</h2>
            <p className="text-sm text-gray-500">{profile.email}</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 pt-4 border-t">
          <div>
            <span className="text-xs text-gray-400">บทบาท</span>
            <p className="font-medium text-gray-900">{ROLE_LABELS[profile.role]}</p>
          </div>
          <div>
            <span className="text-xs text-gray-400">สถานะ</span>
            <p className="font-medium">
              <span className={profile.is_active ? 'text-green-600' : 'text-red-400'}>
                {profile.is_active ? '● ใช้งาน' : '○ ระงับ'}
              </span>
            </p>
          </div>
          <div>
            <span className="text-xs text-gray-400">สมัครเมื่อ</span>
            <p className="font-medium text-gray-700 text-sm">{formatDateTime(profile.created_at)}</p>
          </div>
          {profile.password_changed_at && (
            <div>
              <span className="text-xs text-gray-400">เปลี่ยนรหัสผ่านล่าสุด</span>
              <p className="font-medium text-gray-700 text-sm">{formatDateTime(profile.password_changed_at)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Password Section */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-gray-500" />
            <h2 className="font-semibold text-gray-900">เปลี่ยนรหัสผ่าน</h2>
          </div>
          {!showForm && (
            <button onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm">
              เปลี่ยนรหัสผ่าน
            </button>
          )}
        </div>

        {/* Last changed info */}
        {profile.password_changed_at && !showForm && (
          <p className="text-sm text-gray-500">
            เปลี่ยนครั้งล่าสุด: {formatDateTime(profile.password_changed_at)}
          </p>
        )}

        {!profile.password_changed_at && !showForm && (
          <p className="text-sm text-amber-600 flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" /> ยังไม่เคยเปลี่ยนรหัสผ่าน
          </p>
        )}

        {/* Form */}
        {showForm && (
          <form onSubmit={handleChangePassword} className="space-y-4 pt-2">
            {message && (
              <div className={`px-4 py-3 rounded-lg text-sm font-medium ${
                message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {message.text}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่านปัจจุบัน</label>
              <div className="relative">
                <input type={showOld ? 'text' : 'password'} value={oldPassword} onChange={e => setOldPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                <button type="button" onClick={() => setShowOld(!showOld)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่านใหม่</label>
              <div className="relative">
                <input type={showNew ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="อย่างน้อย 6 ตัวอักษร" />
                <button type="button" onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ยืนยันรหัสผ่านใหม่</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-5 py-2.5 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium text-sm">
                ยกเลิก
              </button>
              <button type="submit" disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium text-sm">
                {submitting ? 'กำลังบันทึก...' : <><Check className="w-4 h-4" /> เปลี่ยนรหัสผ่าน</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
