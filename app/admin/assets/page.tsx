'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { Asset, AssetStatus, Vendor, ASSET_STATUS_LABELS } from '@/types'
import { cn } from '@/lib/utils'
import { Search, Edit3, Save, X, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import * as XLSX from 'xlsx'

const CHUNK_SIZE = 500 // rows per API call

interface ImportResult {
  upserted: number
  total: number
}

type ModalState = 'idle' | 'importing' | 'done'

export default function AdminAssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editing, setEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Asset>>({})

  const [modalState, setModalState] = useState<ModalState>('idle')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [progressPct, setProgressPct] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setModalState('importing')
    setImportResult(null)
    setImportError(null)
    setProgressPct(0)
    setProgressLabel('กำลังอ่านไฟล์...')

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const allRows: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 })

      if (allRows.length < 2) {
        setImportError('ไฟล์ว่างเปล่า ไม่มีข้อมูล')
        setModalState('done')
        return
      }

      const dataRows = allRows.slice(1)
      const validRows = dataRows.filter(r => r[2] && String(r[2]).trim())
      const skippedCount = dataRows.length - validRows.length

      if (validRows.length === 0) {
        setImportError('ไม่พบข้อมูลที่มี Comp Name')
        setModalState('done')
        return
      }

      // Split into chunks
      const chunks: any[][][] = []
      for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
        chunks.push(validRows.slice(i, i + CHUNK_SIZE))
      }

      const totalChunks = chunks.length
      let upsertedTotal = 0

      for (let ci = 0; ci < totalChunks; ci++) {
        const pct = Math.round((ci / totalChunks) * 100)
        setProgressPct(pct)
        setProgressLabel(`กำลังนำเข้า chunk ${ci + 1}/${totalChunks} (${Math.round((ci / totalChunks) * 100)}%)`)

        const res = await fetch('/api/import-assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: chunks[ci] }),
        })

        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error || `Chunk ${ci + 1} failed`)
        }

        const data = await res.json()
        upsertedTotal += (data.upserted || 0)
      }

      setProgressPct(100)
      setImportResult({ upserted: upsertedTotal, total: validRows.length + skippedCount })
      loadAssets()
    } catch (err: any) {
      setImportError(err.message || 'Import failed')
    } finally {
      setTimeout(() => setModalState('done'), 400)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function closeModal() {
    setModalState('idle')
    setImportResult(null)
    setImportError(null)
    setProgressPct(0)
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
        <button onClick={() => fileInputRef.current?.click()} disabled={modalState === 'importing'}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition">
          <FileSpreadsheet className="w-4 h-4" />
          นำเข้าจาก Excel
        </button>
      </div>

      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />

      {/* Modal */}
      {modalState !== 'idle' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={modalState === 'done' ? closeModal : undefined} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 animate-in fade-in zoom-in">
            {modalState === 'importing' ? (
              <div className="text-center">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900">กำลังนำเข้าข้อมูล</h3>
                <p className="text-sm text-gray-500 mt-1">{progressLabel}</p>

                <div className="mt-5 bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="text-sm font-semibold text-blue-600 mt-2">{progressPct}%</p>
              </div>
            ) : (
              <div>
                {importError ? (
                  <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-red-700">เกิดข้อผิดพลาด</h3>
                    <p className="text-sm text-red-500 mt-1">{importError}</p>
                  </div>
                ) : importResult ? (
                  <div className="text-center">
                    <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8 text-green-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">นำเข้าสำเร็จ</h3>

                    <div className="grid grid-cols-2 gap-4 mt-5">
                      <div className="bg-blue-50 rounded-xl p-4">
                        <p className="text-2xl font-bold text-blue-600">{importResult.upserted}</p>
                        <p className="text-xs text-blue-500 mt-0.5">Upserted record(s)</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-2xl font-bold text-gray-400">{importResult.total}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Total in file</p>
                      </div>
                    </div>
                  </div>
                ) : null}

                <button
                  onClick={closeModal}
                  className="mt-6 w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition"
                >
                  ปิด
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
