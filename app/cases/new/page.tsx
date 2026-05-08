'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Asset, UserProfile } from '@/types'
import { cn } from '@/lib/utils'
import LocationPicker from '@/components/cases/location-picker'
import AssetAutocomplete from '@/components/cases/asset-autocomplete'
import { classifyCase } from '@/lib/categories'
import { ArrowLeft, Upload, X, Image as ImageIcon } from 'lucide-react'
import Link from 'next/link'

export default function NewCasePage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    assetCode: '',
    title: '',
    serviceLocation: '',
    priority: 'medium' as string,
    description: '',
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return router.push('/login')
      supabase.from('user_profiles').select('*').eq('id', session.user.id).single()
        .then(({ data }) => setProfile(data as UserProfile))
    })
  }, [])

  function handleAssetSelect(asset: Asset) {
    setSelectedAsset(asset)
  }

  function handleAssetClear() {
    setSelectedAsset(null)
  }

  function handleFileAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const newFiles = Array.from(e.target.files || [])
    if (files.length + newFiles.length > 10) {
      alert('แนบรูปได้สูงสุด 10 รูป')
      return
    }
    const valid = newFiles.filter(f => f.size <= 5 * 1024 * 1024)
    if (valid.length !== newFiles.length) alert('บางไฟล์เกิน 5MB ถูกข้าม')

    setFiles(prev => [...prev, ...valid])
    valid.forEach(f => {
      const url = URL.createObjectURL(f)
      setPreviews(prev => [...prev, url])
    })
  }

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
    setPreviews(prev => {
      URL.revokeObjectURL(prev[idx])
      return prev.filter((_, i) => i !== idx)
    })
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!selectedAsset) e.assetCode = 'กรุณาเลือกอุปกรณ์'
    if (!form.title.trim()) e.title = 'กรุณากรอกหัวข้อแจ้งซ่อม'
    if (!form.serviceLocation.trim()) e.serviceLocation = 'กรุณาระบุสถานที่รับบริการ'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate() || !profile) return

    setSubmitting(true)
    try {
      // 1. Classify
      const category = classifyCase(form.title, form.description)

      // 2. Create case
      const { data: newCase, error: caseError } = await supabase
        .from('repair_cases')
        .insert({
          asset_id: selectedAsset?.id || null,
          title: form.title,
          description: form.description || null,
          priority: form.priority,
          category,
          service_location: form.serviceLocation,
          created_by: profile.id,
        })
        .select('id')
        .single()

      if (caseError) throw caseError
      const caseId = newCase.id

      // 2. Upload files
      for (const file of files) {
        const filePath = `${caseId}/${Date.now()}_${file.name}`
        const { error: uploadError } = await supabase.storage
          .from('repair-attachments')
          .upload(filePath, file)

        if (uploadError) {
          console.error('Upload error:', uploadError)
          continue
        }

        await supabase.from('case_attachments').insert({
          case_id: caseId,
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
          uploaded_by: profile.id,
        })
      }

      // 3. Log activity
      await supabase.from('case_activity_log').insert({
        case_id: caseId,
        user_id: profile.id,
        action: 'create_case',
        comment: 'สร้างเคส',
      })

      // 4. Update asset status to 'under_repair'
      if (selectedAsset?.id) {
        await supabase.from('assets').update({ status: 'under_repair' }).eq('id', selectedAsset.id)
      }

      router.push(`/cases/${caseId}`)
    } catch (err: any) {
      console.error(err)
      alert('เกิดข้อผิดพลาด: ' + (err.message || 'ไม่สามารถสร้างเคสได้'))
    } finally {
      setSubmitting(false)
    }
  }

  if (!profile) return null

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/cases" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">แจ้งซ่อมคอมพิวเตอร์</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-6 space-y-6">
        {/* อุปกรณ์ */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">อุปกรณ์/เครื่อง *</label>
          <AssetAutocomplete
            value={selectedAsset?.asset_code || ''}
            asset={selectedAsset}
            onSelect={handleAssetSelect}
            onClear={handleAssetClear}
            error={errors.assetCode}
          />
        </div>

        {/* หัวข้อ */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">หัวข้อแจ้งซ่อม *</label>
          <input
            type="text"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder='เช่น "โน๊ตบุ๊คเปิดไม่ติด", "ปริ้นเตอร์กระดาษติด"'
            className={cn(
              'w-full px-4 py-3 border rounded-lg outline-none transition',
              errors.title ? 'border-red-400' : 'border-gray-300 focus:ring-2 focus:ring-blue-500'
            )}
          />
          {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
        </div>

        {/* สถานที่รับบริการ */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">สถานที่รับบริการ *</label>
          <LocationPicker
            value={form.serviceLocation}
            onChange={v => setForm(f => ({ ...f, serviceLocation: v }))}
            error={errors.serviceLocation}
          />
          {errors.serviceLocation && <p className="text-red-500 text-sm mt-1">{errors.serviceLocation}</p>}
        </div>

        {/* ความเร่งด่วน */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">ความเร่งด่วน *</label>
          <div className="flex gap-2 flex-wrap">
            {[
              { value: 'low', label: 'ปกติ', color: 'bg-gray-100 text-gray-700 border-gray-300' },
              { value: 'medium', label: 'ปานกลาง', color: 'bg-yellow-50 text-yellow-800 border-yellow-300' },
              { value: 'high', label: 'สูง', color: 'bg-orange-50 text-orange-800 border-orange-300' },
              { value: 'critical', label: 'ด่วนมาก', color: 'bg-red-50 text-red-800 border-red-300' },
            ].map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => setForm(f => ({ ...f, priority: p.value }))}
                className={cn(
                  'px-4 py-2.5 rounded-lg border font-medium text-sm transition-all',
                  form.priority === p.value
                    ? `${p.color} ring-2 ring-offset-1 ring-blue-400`
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* รายละเอียด */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียดเพิ่มเติม</label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={4}
            placeholder="อธิบายอาการเสีย หรือสิ่งที่ต้องการให้ช่างตรวจสอบ..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition resize-none"
          />
        </div>

        {/* แนบรูป */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">📸 แนบรูปภาพ (สูงสุด 10 รูป)</label>
          <div className="flex flex-wrap gap-3">
            {previews.map((url, i) => (
              <div key={i} className="relative w-24 h-24 rounded-lg border overflow-hidden group">
                <img src={url} alt={`preview ${i}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {files.length < 10 && (
              <label className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition text-gray-400 hover:text-blue-500">
                <Upload className="w-5 h-5" />
                <span className="text-xs mt-1">เพิ่มรูป</span>
                <input type="file" accept="image/*" multiple onChange={handleFileAdd} className="hidden" />
              </label>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">รองรับ JPG, PNG, WebP • ขนาดไม่เกิน 5MB ต่อรูป</p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 justify-end pt-4 border-t">
          <Link
            href="/cases"
            className="px-6 py-3 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
          >
            ยกเลิก
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium"
          >
            {submitting ? 'กำลังบันทึก...' : '✅ แจ้งซ่อม'}
          </button>
        </div>
      </form>
    </div>
  )
}
