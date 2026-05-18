'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { toast } from 'sonner'
import { ArrowLeft, Save, Mail, Power, PowerOff } from 'lucide-react'
import Link from 'next/link'

interface EmailConfig {
  enabled: boolean
  provider: string
  from_address: string
  resend_api_key: string
  smtp_host: string
  smtp_port: number
  smtp_user: string
  smtp_pass: string
  notify_on_create: boolean
  notify_on_assign: boolean
  notify_on_resolve: boolean
  notify_on_close: boolean
  notify_on_sla_breach: boolean
}

export default function EmailConfigPage() {
  const [config, setConfig] = useState<EmailConfig>({
    enabled: false, provider: 'resend', from_address: 'RepairDesk <noreply@repairdesk.app>',
    resend_api_key: '', smtp_host: '', smtp_port: 587, smtp_user: '', smtp_pass: '',
    notify_on_create: true, notify_on_assign: true, notify_on_resolve: true,
    notify_on_close: true, notify_on_sla_breach: true,
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
    const res = await fetch('/api/admin/email-config')
    if (res.ok) {
      const data = await res.json()
      if (data.id) setConfig(data)
    }
    setLoading(false)
  }

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/email-config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config),
    })
    if (res.ok) toast.success('บันทึกการตั้งค่าอีเมลแล้ว')
    else toast.error('บันทึกไม่สำเร็จ')
    setSaving(false)
  }

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin" className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-gray-500" /></Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">ตั้งค่าอีเมล</h1>
          <p className="text-sm text-gray-500">เปิด/ปิดการแจ้งเตือนทางอีเมล</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-6">
        {/* Enable/Disable */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Mail className="w-4 h-4 text-blue-600" /> สถานะ</h3>
            <p className="text-sm text-gray-500">{config.enabled ? 'ระบบอีเมลกำลังทำงาน' : 'ระบบอีเมลถูกปิดอยู่'}</p>
          </div>
          <button onClick={() => setConfig(c => ({ ...c, enabled: !c.enabled }))}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition ${
              config.enabled ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}>
            {config.enabled ? <><Power className="w-4 h-4" /> เปิดอยู่</> : <><PowerOff className="w-4 h-4" /> ปิดอยู่</>}
          </button>
        </div>

        {/* Provider */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ผู้ให้บริการ</label>
          <select value={config.provider} onChange={e => setConfig(c => ({ ...c, provider: e.target.value }))}
            className="w-full px-4 py-2.5 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500">
            <option value="resend">Resend</option>
            <option value="smtp">SMTP</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">อีเมลผู้ส่ง</label>
          <input value={config.from_address} onChange={e => setConfig(c => ({ ...c, from_address: e.target.value }))}
            className="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {config.provider === 'resend' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Resend API Key</label>
            <input type="password" value={config.resend_api_key} onChange={e => setConfig(c => ({ ...c, resend_api_key: e.target.value }))}
              placeholder="re_..." className="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}

        {config.provider === 'smtp' && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
              <input value={config.smtp_host} onChange={e => setConfig(c => ({ ...c, smtp_host: e.target.value }))}
                className="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
              <input type="number" value={config.smtp_port} onChange={e => setConfig(c => ({ ...c, smtp_port: parseInt(e.target.value) || 587 }))}
                className="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input value={config.smtp_user} onChange={e => setConfig(c => ({ ...c, smtp_user: e.target.value }))}
                className="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" value={config.smtp_pass} onChange={e => setConfig(c => ({ ...c, smtp_pass: e.target.value }))}
                className="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        )}

        {/* Notification triggers */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">แจ้งเตือนเมื่อ</h3>
          <div className="space-y-2">
            {[
              { key: 'notify_on_create', label: 'สร้างเคสใหม่' },
              { key: 'notify_on_assign', label: 'มอบหมายช่าง' },
              { key: 'notify_on_resolve', label: 'ดำเนินการเสร็จสิ้น' },
              { key: 'notify_on_close', label: 'ปิดรายการ' },
              { key: 'notify_on_sla_breach', label: 'เกินกำหนด SLA' },
            ].map(item => (
              <label key={item.key} className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={(config as any)[item.key]}
                  onChange={e => setConfig(c => ({ ...c, [item.key]: e.target.checked }))}
                  className="rounded border-gray-300" />
                <span className="text-sm text-gray-700">{item.label}</span>
              </label>
            ))}
          </div>
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
