'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import { createClient } from '@/lib/supabase'
import { TicketTemplate, CasePriority, PRIORITY_LABELS, PRIORITY_COLORS, UserProfile } from '@/types'
import { canManageTemplates } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { Plus, Pencil, Trash2, FileText, X } from 'lucide-react'
import { toast } from 'sonner'
import ConfirmModal from '@/components/ui/confirm-modal'

const PRIORITIES: CasePriority[] = ['low', 'medium', 'high', 'critical']

interface TemplateForm {
  name: string
  title_template: string
  description_template: string
  priority: CasePriority | ''
  category: string
  is_active: boolean
}

const emptyForm: TemplateForm = {
  name: '',
  title_template: '',
  description_template: '',
  priority: 'medium',
  category: '',
  is_active: true,
}

export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<TicketTemplate[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<TemplateForm>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
        return
      }
      supabase
        .from('user_profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
        .then(({ data }) => {
          const p = data as UserProfile | null
          setProfile(p)
          if (p && !canManageTemplates(p.role)) {
            router.replace('/')
          }
        })
    })
    loadTemplates()
  }, [])

  async function loadTemplates() {
    const { data } = await supabase
      .from('ticket_templates')
      .select('*')
      .order('created_at', { ascending: false })
    setTemplates((data || []) as TicketTemplate[])
    setLoading(false)
  }

  function openAdd() {
    setEditingId(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(t: TicketTemplate) {
    setEditingId(t.id)
    setForm({
      name: t.name,
      title_template: t.title_template || '',
      description_template: t.description_template || '',
      priority: t.priority || '',
      category: t.category || '',
      is_active: t.is_active,
    })
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.title_template.trim()) {
      toast.error('กรุณากรอกข้อมูลที่จำเป็น')
      return
    }

    setSubmitting(true)

    if (editingId) {
      const { error } = await supabase
        .from('ticket_templates')
        .update({
          name: form.name.trim(),
          title_template: form.title_template.trim(),
          description_template: form.description_template.trim() || null,
          priority: form.priority || null,
          category: form.category.trim() || null,
          is_active: form.is_active,
        })
        .eq('id', editingId)

      if (error) {
        toast.error('ไม่สามารถบันทึกได้: ' + error.message)
      } else {
        toast.success('อัปเดตเทมเพลตสำเร็จ')
        setModalOpen(false)
        loadTemplates()
      }
    } else {
      const { error } = await supabase.from('ticket_templates').insert({
        name: form.name.trim(),
        title_template: form.title_template.trim(),
        description_template: form.description_template.trim() || null,
        priority: form.priority || null,
        category: form.category.trim() || null,
        is_active: form.is_active,
      })

      if (error) {
        toast.error('ไม่สามารถสร้างได้: ' + error.message)
      } else {
        toast.success('สร้างเทมเพลตสำเร็จ')
        setModalOpen(false)
        loadTemplates()
      }
    }

    setSubmitting(false)
  }

  function handleDelete(t: TicketTemplate) {
    setConfirm({
      title: 'ยืนยันการลบเทมเพลต',
      message: `ต้องการลบเทมเพลต "${t.name}" หรือไม่?`,
      onConfirm: async () => {
        const { error } = await supabase
          .from('ticket_templates')
          .update({ is_active: false })
          .eq('id', t.id)

        if (error) {
          toast.error('ไม่สามารถลบได้: ' + error.message)
        } else {
          toast.success('ลบเทมเพลตสำเร็จ')
          loadTemplates()
        }
      },
    })
  }

  async function toggleActive(t: TicketTemplate) {
    const { error } = await supabase
      .from('ticket_templates')
      .update({ is_active: !t.is_active })
      .eq('id', t.id)

    if (error) {
      toast.error('ไม่สามารถเปลี่ยนสถานะได้: ' + error.message)
    } else {
      loadTemplates()
    }
  }

  if (!profile || !canManageTemplates(profile.role)) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">จัดการเทมเพลต</h1>
          <p className="text-sm text-gray-500 mt-1">เทมเพลตสำหรับสร้างเคสแจ้งซ่อม</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm"
        >
          <Plus className="w-4 h-4" /> เพิ่มเทมเพลต
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-5 py-3 font-medium">ชื่อเทมเพลต</th>
                <th className="px-5 py-3 font-medium">หัวข้อเรื่อง</th>
                <th className="px-5 py-3 font-medium">ความเร่งด่วน</th>
                <th className="px-5 py-3 font-medium">หมวดหมู่</th>
                <th className="px-5 py-3 font-medium">สถานะ</th>
                <th className="px-5 py-3 font-medium text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-gray-400">
                    กำลังโหลด...
                  </td>
                </tr>
              ) : templates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-gray-400">
                    <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    ยังไม่มีเทมเพลต
                  </td>
                </tr>
              ) : (
                templates.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3.5">
                      <span className="font-medium text-gray-900">{t.name}</span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 max-w-xs truncate">
                      {t.title_template || '-'}
                    </td>
                    <td className="px-5 py-3.5">
                      {t.priority ? (
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-medium',
                            PRIORITY_COLORS[t.priority]
                          )}
                        >
                          {PRIORITY_LABELS[t.priority]}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{t.category || '-'}</td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => toggleActive(t)}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-xs font-medium',
                          t.is_active
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-red-100 text-red-500 hover:bg-red-200'
                        )}
                      >
                        {t.is_active ? 'ใช้งาน' : 'ระงับ'}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => openEdit(t)}
                          className="p-2 text-gray-400 hover:bg-gray-100 rounded transition"
                          title="แก้ไข"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(t)}
                          className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded transition"
                          title="ลบ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Dialog.Root open={modalOpen} onOpenChange={setModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto z-50 p-6">
            <div className="flex items-center justify-between mb-5">
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                {editingId ? 'แก้ไขเทมเพลต' : 'เพิ่มเทมเพลตใหม่'}
              </Dialog.Title>
              <Dialog.Close className="p-1 text-gray-400 hover:text-gray-600 rounded transition">
                <X className="w-5 h-5" />
              </Dialog.Close>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อเทมเพลต <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="เช่น ซ่อมคอมพิวเตอร์ทั่วไป"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  หัวข้อเรื่อง <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={form.title_template}
                  onChange={(e) => setForm((f) => ({ ...f, title_template: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="เช่น แจ้งซ่อมคอมพิวเตอร์"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  รายละเอียด
                </label>
                <textarea
                  value={form.description_template}
                  onChange={(e) => setForm((f) => ({ ...f, description_template: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="รายละเอียดเริ่มต้นสำหรับเคส"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ความเร่งด่วน
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, priority: e.target.value as CasePriority | '' }))
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- ไม่ระบุ --</option>
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    หมวดหมู่
                  </label>
                  <input
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="เช่น Hardware"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.is_active}
                  onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    form.is_active ? 'bg-blue-600' : 'bg-gray-300'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      form.is_active ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
                <span className="text-sm text-gray-700">
                  {form.is_active ? 'ใช้งาน' : 'ระงับ'}
                </span>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition"
                  >
                    ยกเลิก
                  </button>
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {submitting ? 'กำลังบันทึก...' : editingId ? 'บันทึกการแก้ไข' : 'สร้างเทมเพลต'}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {/* Confirm Modal */}
      {confirm && (
        <ConfirmModal
          open={true}
          onOpenChange={() => setConfirm(null)}
          title={confirm.title}
          message={confirm.message}
          onConfirm={confirm.onConfirm}
        />
      )}
    </div>
  )
}