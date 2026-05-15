'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { canBulkCreateTickets } from '@/lib/permissions'
import {
  Asset, UserProfile, CasePriority, AssetStatus,
  PRIORITY_LABELS, PRIORITY_COLORS, ASSET_STATUS_LABELS,
} from '@/types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  ArrowLeft, Layers, Plus, X, Check, Monitor,
  Search, ChevronRight, Loader2, AlertTriangle,
} from 'lucide-react'

/* ── Types ── */

interface BatchCaseItem {
  asset: Asset
  title: string
  description: string
  priority: CasePriority
}

type Step = 1 | 2 | 3 | 4

const PRIORITY_OPTIONS: { value: CasePriority; label: string; color: string }[] = [
  { value: 'low', label: 'ปกติ', color: 'bg-gray-100 text-gray-700 border-gray-300' },
  { value: 'critical', label: 'ด่วนมาก', color: 'bg-red-50 text-red-800 border-red-300' },
]

/* ── Page ── */

export default function BatchCasePage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)

  // Step 1: Asset selection
  const [assetSearch, setAssetSearch] = useState('')
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([])
  const [showAssetDropdown, setShowAssetDropdown] = useState(false)

  // Step 2: Case details
  const [commonPriority, setCommonPriority] = useState<CasePriority>('low')
  const [batchItems, setBatchItems] = useState<BatchCaseItem[]>([])

  // Step 3: Preview (derived)

  // Step 4: Submission
  const [submitting, setSubmitting] = useState(false)
  const [submitResults, setSubmitResults] = useState<{
    success: number
    failed: number
    errors: string[]
    createdIds: string[]
  } | null>(null)

  const [step, setStep] = useState<Step>(1)

  /* ── Load profile + assets ── */

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: prof } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      const userProfile = prof as UserProfile
      setProfile(userProfile)

      // Permission check
      if (!canBulkCreateTickets(userProfile?.role ?? null)) {
        router.push('/cases')
        return
      }

      const { data: assetData } = await supabase
        .from('assets')
        .select('*')
        .eq('is_active', true)
        .order('asset_code')

      setAssets(assetData as Asset[] || [])
      setLoading(false)
    }
    init()
  }, [])

  /* ── Filtered assets for search dropdown ── */

  const filteredAssets = useMemo(() => {
    const selectedIds = new Set(selectedAssets.map(a => a.id))
    return assets
      .filter(a => !selectedIds.has(a.id))
      .filter(a => {
        if (!assetSearch.trim()) return true
        const q = assetSearch.toLowerCase()
        return (
          a.asset_code.toLowerCase().includes(q) ||
          (a.model || '').toLowerCase().includes(q) ||
          (a.serial_number || '').toLowerCase().includes(q) ||
          (a.location || '').toLowerCase().includes(q)
        )
      })
  }, [assets, assetSearch, selectedAssets])

  /* ── Step handlers ── */

  function addAsset(asset: Asset) {
    setSelectedAssets(prev => [...prev, asset])
    setBatchItems(prev => [
      ...prev,
      {
        asset,
        title: `${asset.model || asset.asset_code} — ต้องซ่อม`,
        description: '',
        priority: commonPriority,
      },
    ])
    setAssetSearch('')
    setShowAssetDropdown(false)
  }

  function removeAsset(assetId: string) {
    setSelectedAssets(prev => prev.filter(a => a.id !== assetId))
    setBatchItems(prev => prev.filter(item => item.asset.id !== assetId))
  }

  function updateBatchItem(index: number, updates: Partial<BatchCaseItem>) {
    setBatchItems(prev =>
      prev.map((item, i) => (i === index ? { ...item, ...updates } : item))
    )
  }

  function applyCommonPriority() {
    setBatchItems(prev =>
      prev.map(item => ({ ...item, priority: commonPriority }))
    )
  }

  function goToStep2() {
    if (selectedAssets.length === 0) {
      toast.error('กรุณาเลือกอุปกรณ์อย่างน้อย 1 รายการ')
      return
    }
    // Ensure batch items are in sync
    setBatchItems(prev => {
      const existing = new Set(prev.map(i => i.asset.id))
      const updated = [...prev]
      for (const asset of selectedAssets) {
        if (!existing.has(asset.id)) {
          updated.push({
            asset,
            title: `${asset.model || asset.asset_code} — ต้องซ่อม`,
            description: '',
            priority: commonPriority,
          })
        }
      }
      return updated
    })
    setStep(2)
  }

  function goToStep3() {
    const hasEmptyTitle = batchItems.some(item => !item.title.trim())
    if (hasEmptyTitle) {
      toast.error('กรุณากรอกหัวข้อให้ครบทุกรายการ')
      return
    }
    setStep(3)
  }

  async function submitBatch() {
    if (!profile) return
    setSubmitting(true)
    setStep(4)

    const batchId = crypto.randomUUID()
    let successCount = 0
    let failCount = 0
    const errors: string[] = []
    const createdIds: string[] = []

    for (const item of batchItems) {
      try {
        const { data: newCase, error: caseError } = await supabase
          .from('repair_cases')
          .insert({
            asset_id: item.asset.id,
            title: item.title.trim(),
            description: item.description.trim() || null,
            priority: item.priority,
            service_location: item.asset.location || null,
            created_by: profile.id,
            batch_id: batchId,
          })
          .select('id')
          .single()

        if (caseError) throw caseError
        const caseId = newCase.id
        createdIds.push(caseId)
        successCount++

        // Log activity
        await supabase.from('case_activity_log').insert({
          case_id: caseId,
          user_id: profile.id,
          action: 'create_case',
          comment: 'สร้างเคส (แบบกลุ่ม)',
        })

        // Update asset status
        await supabase.from('assets').update({ status: 'under_repair' }).eq('id', item.asset.id)
      } catch (err: any) {
        failCount++
        errors.push(`${item.asset.asset_code}: ${err.message || 'ไม่สามารถสร้างเคสได้'}`)
      }
    }

    // Send combined LINE notification for all created cases
    if (createdIds.length > 0) {
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseIds: createdIds, event: 'case_created_bulk' }),
      }).catch(() => {})
    }

    setSubmitResults({ success: successCount, failed: failCount, errors, createdIds })
    setSubmitting(false)

    if (successCount > 0) {
      toast.success(`สร้างเคสสำเร็จ ${successCount} รายการ`)
    }
    if (failCount > 0) {
      toast.error(`สร้างเคสไม่สำเร็จ ${failCount} รายการ`)
    }
  }

  /* ── Loading ── */

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!profile || !canBulkCreateTickets(profile.role)) {
    return null
  }

  /* ── Step indicators ── */

  const STEPS = [
    { num: 1, label: 'เลือกอุปกรณ์' },
    { num: 2, label: 'กรอกรายละเอียด' },
    { num: 3, label: 'ตรวจสอบ' },
    { num: 4, label: 'ผลลัพธ์' },
  ]

  /* ── Render ── */

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/cases" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <Layers className="w-6 h-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">สร้างเคสซ่อมหลายรายการ</h1>
      </div>

      {/* Step indicator */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center gap-2 overflow-x-auto">
          {STEPS.map((s, i) => (
            <div key={s.num} className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (s.num < step) setStep(s.num as Step)
                }}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap',
                  step === s.num
                    ? 'bg-blue-100 text-blue-700'
                    : step > s.num
                      ? 'bg-green-50 text-green-700 cursor-pointer hover:bg-green-100'
                      : 'bg-gray-50 text-gray-400 cursor-default'
                )}
              >
                {step > s.num ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs current-step">
                    {s.num}
                  </span>
                )}
                {s.label}
              </button>
              {i < STEPS.length - 1 && (
                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Step 1: Select Assets ── */}
      {step === 1 && (
        <div className="bg-white rounded-xl border p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Monitor className="w-5 h-5 text-blue-600" />
            เลือกอุปกรณ์ที่ต้องการแจ้งซ่อม
          </h2>
          <p className="text-sm text-gray-500">
            ค้นหาและเลือกอุปกรณ์ที่ต้องการสร้างเคสซ่อม สามารถเลือกได้หลายรายการ
          </p>

          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={assetSearch}
              onChange={e => {
                setAssetSearch(e.target.value)
                setShowAssetDropdown(true)
              }}
              onFocus={() => setShowAssetDropdown(true)}
              placeholder="ค้นหาจากรหัสเครื่อง รุ่น หรือตำแหน่ง..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />

            {/* Dropdown */}
            {showAssetDropdown && (
              <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {filteredAssets.length === 0 ? (
                  <div className="px-4 py-6 text-center text-gray-400 text-sm">
                    ไม่พบอุปกรณ์
                  </div>
                ) : (
                  filteredAssets.slice(0, 50).map(a => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => addAsset(a)}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 transition flex items-center gap-3 border-b last:border-b-0"
                    >
                      <Monitor className="w-4 h-4 text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900">
                          {a.asset_code}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {a.model || '-'} • {a.location || 'ไม่ระบุตำแหน่ง'}
                        </div>
                      </div>
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-medium shrink-0',
                        a.status === 'in_use' ? 'bg-green-100 text-green-700' :
                        a.status === 'under_repair' ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-600'
                      )}>
                        {ASSET_STATUS_LABELS[a.status] || a.status}
                      </span>
                      <Plus className="w-4 h-4 text-blue-500 shrink-0" />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Click-away handler for dropdown */}
          {showAssetDropdown && (
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowAssetDropdown(false)}
            />
          )}

          {/* Selected assets list */}
          {selectedAssets.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">
                  อุปกรณ์ที่เลือก ({selectedAssets.length} รายการ)
                </h3>
                <button
                  type="button"
                  onClick={() => { setSelectedAssets([]); setBatchItems([]) }}
                  className="text-xs text-red-500 hover:underline"
                >
                  ล้างทั้งหมด
                </button>
              </div>

              <div className="divide-y border rounded-lg">
                {selectedAssets.map(a => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
                  >
                    <Monitor className="w-4 h-4 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900">
                        {a.asset_code}
                      </div>
                      <div className="text-xs text-gray-500">
                        {a.model || '-'} • {a.location || 'ไม่ระบุตำแหน่ง'}
                        {a.serial_number && ` • S/N: ${a.serial_number}`}
                      </div>
                    </div>
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-medium shrink-0',
                      a.status === 'in_use' ? 'bg-green-100 text-green-700' :
                      a.status === 'under_repair' ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-600'
                    )}>
                      {ASSET_STATUS_LABELS[a.status] || a.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAsset(a.id)}
                      className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-end pt-4 border-t">
            <button
              type="button"
              onClick={goToStep2}
              disabled={selectedAssets.length === 0}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
            >
              ถัดไป
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Set Details ── */}
      {step === 2 && (
        <div className="space-y-5">
          {/* Common priority */}
          <div className="bg-white rounded-xl border p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">ตั้งค่าความเร่งด่วนร่วม</h2>
            <p className="text-sm text-gray-500">
              เลือกความเร่งด่วนที่จะใช้กับทุกรายการ หรือปรับเป็นรายเคสได้ด้านล่าง
            </p>

            <div className="flex flex-wrap gap-2 items-center">
              {PRIORITY_OPTIONS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setCommonPriority(p.value)}
                  className={cn(
                    'px-4 py-2.5 rounded-lg border font-medium text-sm transition-all',
                    commonPriority === p.value
                      ? `${p.color} ring-2 ring-offset-1 ring-blue-400`
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  )}
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={applyCommonPriority}
                className="px-4 py-2.5 rounded-lg border border-blue-200 text-blue-600 text-sm font-medium hover:bg-blue-50 transition"
              >
                ใช้กับทุกรายการ
              </button>
            </div>
          </div>

          {/* Per-case forms */}
          <div className="space-y-4">
            {batchItems.map((item, idx) => (
              <div key={item.asset.id} className="bg-white rounded-xl border p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-semibold text-sm text-gray-900">
                        {item.asset.asset_code}
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.asset.model || '-'} • {item.asset.location || 'ไม่ระบุตำแหน่ง'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAsset(item.asset.id)}
                    className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 transition"
                    title="นำออก"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    หัวข้อแจ้งซ่อม *
                  </label>
                  <input
                    type="text"
                    value={item.title}
                    onChange={e => updateBatchItem(idx, { title: e.target.value })}
                    placeholder='เช่น "โน๊ตบุ๊คเปิดไม่ติด"'
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    รายละเอียดเพิ่มเติม
                  </label>
                  <textarea
                    value={item.description}
                    onChange={e => updateBatchItem(idx, { description: e.target.value })}
                    rows={2}
                    placeholder="อธิบายอาการเสีย..."
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ความเร่งด่วน
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {PRIORITY_OPTIONS.map(p => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => updateBatchItem(idx, { priority: p.value })}
                        className={cn(
                          'px-3 py-1.5 rounded-lg border font-medium text-xs transition-all',
                          item.priority === p.value
                            ? `${p.color} ring-2 ring-offset-1 ring-blue-400`
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex justify-between pt-4 border-t">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-6 py-3 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
            >
              ← ย้อนกลับ
            </button>
            <button
              type="button"
              onClick={goToStep3}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              ถัดไป
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Preview ── */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-5 py-4 border-b bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">
                ตรวจสอบก่อนสร้าง ({batchItems.length} รายการ)
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                กรุณาตรวจสอบข้อมูลให้ถูกต้องก่อนกดยืนยัน
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-left">
                  <tr>
                    <th className="px-5 py-3 font-medium w-8">#</th>
                    <th className="px-5 py-3 font-medium">อุปกรณ์</th>
                    <th className="px-5 py-3 font-medium">รุ่น / ตำแหน่ง</th>
                    <th className="px-5 py-3 font-medium">หัวข้อ</th>
                    <th className="px-5 py-3 font-medium">ความเร่งด่วน</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {batchItems.map((item, idx) => (
                    <tr key={item.asset.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-gray-400 font-mono text-xs">
                        {idx + 1}
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-mono text-gray-900 font-medium">
                          {item.asset.asset_code}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-600 text-xs">
                        <div>{item.asset.model || '-'}</div>
                        <div className="text-gray-400">{item.asset.location || 'ไม่ระบุ'}</div>
                      </td>
                      <td className="px-5 py-3 text-gray-900 font-medium max-w-[250px]">
                        <div className="truncate">{item.title}</div>
                        {item.description && (
                          <div className="text-xs text-gray-400 truncate mt-0.5">
                            {item.description}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-medium',
                          PRIORITY_COLORS[item.priority]
                        )}>
                          {PRIORITY_LABELS[item.priority]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Warning */}
          {batchItems.some(i => i.asset.status === 'under_repair') && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <strong>ข้อควรระวัง:</strong> มีอุปกรณ์ที่อยู่ในสถานะ &quot;ส่งซ่อม&quot; อยู่แล้ว
                อาจมีเคสซ่อมที่เปิดอยู่สำหรับอุปกรณ์เหล่านี้
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4 border-t">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-6 py-3 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
            >
              ← ย้อนกลับ
            </button>
            <button
              type="button"
              onClick={submitBatch}
              disabled={submitting}
              className="flex items-center gap-2 px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition font-medium"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  กำลังสร้างเคส...
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4" />
                  สร้างเคสทั้งหมด ({batchItems.length} รายการ)
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Results ── */}
      {step === 4 && (
        <div className="space-y-5">
          {submitting && (
            <div className="bg-white rounded-xl border p-8 flex flex-col items-center gap-4">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              <div className="text-lg font-semibold text-gray-900">กำลังสร้างเคส...</div>
              <div className="text-sm text-gray-500">กรุณารอสักครู่</div>
            </div>
          )}

          {submitResults && (
            <>
              {/* Result summary */}
              <div className={cn(
                'rounded-xl border p-6 space-y-2',
                submitResults.failed === 0
                  ? 'bg-green-50 border-green-200'
                  : 'bg-amber-50 border-amber-200'
              )}>
                <div className="flex items-center gap-3">
                  {submitResults.failed === 0 ? (
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <Check className="w-5 h-5 text-green-600" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {submitResults.failed === 0
                        ? 'สร้างเคสสำเร็จทั้งหมด!'
                        : `สร้างเคสเสร็จสิ้น (มีข้อผิดพลาด)`
                      }
                    </h2>
                    <p className="text-sm text-gray-600">
                      สำเร็จ {submitResults.success} รายการ
                      {submitResults.failed > 0 && ` • ไม่สำเร็จ ${submitResults.failed} รายการ`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Error list */}
              {submitResults.errors.length > 0 && (
                <div className="bg-white rounded-xl border p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-red-600">รายการที่ผิดพลาด</h3>
                  <ul className="space-y-1">
                    {submitResults.errors.map((err, i) => (
                      <li key={i} className="text-sm text-red-600 flex items-start gap-2">
                        <X className="w-4 h-4 shrink-0 mt-0.5" />
                        {err}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Created case list */}
              {submitResults.createdIds.length > 0 && (
                <div className="bg-white rounded-xl border overflow-hidden">
                  <div className="px-5 py-3 bg-gray-50 border-b">
                    <h3 className="text-sm font-semibold text-gray-700">
                      เคสที่สร้างแล้ว ({submitResults.createdIds.length} รายการ)
                    </h3>
                  </div>
                  <div className="divide-y">
                    {submitResults.createdIds.map((id, i) => (
                      <div key={id} className="flex items-center justify-between px-5 py-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-green-500" />
                          <span className="text-gray-500">เคสที่ {i + 1}:</span>
                          <Link
                            href={`/cases/${id}`}
                            className="text-blue-600 font-medium hover:underline"
                          >
                            ดูรายละเอียด
                          </Link>
                        </div>
                        <Link
                          href={`/cases/${id}`}
                          className="text-xs text-blue-500 hover:underline"
                        >
                          เปิด →
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-3 pt-4 border-t">
                <Link
                  href="/cases"
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  กลับไปยังรายการเคส
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setStep(1)
                    setSelectedAssets([])
                    setBatchItems([])
                    setSubmitResults(null)
                    setCommonPriority('low')
                  }}
                  className="px-6 py-3 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  สร้างชุดใหม่
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}