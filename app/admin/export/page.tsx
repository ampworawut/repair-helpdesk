'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { toast } from 'sonner'
import { ArrowLeft, Download, Database, HardDrive, FileText, Image } from 'lucide-react'
import Link from 'next/link'

export default function ExportPage() {
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [storageFiles, setStorageFiles] = useState<any[]>([])
  const [storageLoading, setStorageLoading] = useState(false)
  const [storageInfo, setStorageInfo] = useState<{ totalFiles: number; totalSize: number } | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      supabase.from('user_profiles').select('role').eq('id', session.user.id).single()
        .then(({ data }) => { if (data?.role !== 'admin') return; setLoading(false) })
    })
  }, [])

  async function exportDB(format: string) {
    setExporting(true)
    try {
      const res = await fetch(`/api/admin/export-db?format=${format}`)
      if (!res.ok) { toast.error('ส่งออกไม่สำเร็จ'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `repairdesk-db-${new Date().toISOString().slice(0, 10)}.${format === 'sql' ? 'sql' : format}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('ส่งออกฐานข้อมูลแล้ว')
    } catch { toast.error('ส่งออกไม่สำเร็จ') }
    finally { setExporting(false) }
  }

  async function loadStorage() {
    setStorageLoading(true)
    try {
      const res = await fetch('/api/admin/export-storage?action=list')
      if (res.ok) {
        const data = await res.json()
        setStorageFiles(data.files || [])
        setStorageInfo({ totalFiles: data.totalFiles, totalSize: data.totalSize })
      }
    } catch { toast.error('โหลดรายการไฟล์ไม่สำเร็จ') }
    finally { setStorageLoading(false) }
  }

  async function downloadFile(path: string, name: string) {
    const res = await fetch(`/api/admin/export-storage?action=download&path=${encodeURIComponent(path)}`)
    if (!res.ok) { toast.error('ดาวน์โหลดไม่สำเร็จ'); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = name; a.click()
    URL.revokeObjectURL(url)
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin" className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-gray-500" /></Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">ส่งออกข้อมูล</h1>
          <p className="text-sm text-gray-500">ส่งออกฐานข้อมูลและไฟล์แนบเพื่อย้ายระบบ</p>
        </div>
      </div>

      {/* Database Export */}
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Database className="w-5 h-5 text-blue-600" /> ส่งออกฐานข้อมูล</h3>
        <p className="text-sm text-gray-500">ส่งออกทุกตารางในรูปแบบที่นำเข้า Supabase, PostgreSQL หรือเครื่องมืออื่นได้</p>

        <div className="flex flex-wrap gap-3">
          <button onClick={() => exportDB('sql')} disabled={exporting}
            className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium text-sm">
            <Download className="w-4 h-4" /> SQL (PostgreSQL)
          </button>
          <button onClick={() => exportDB('json')} disabled={exporting}
            className="flex items-center gap-2 px-5 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition font-medium text-sm">
            <FileText className="w-4 h-4" /> JSON
          </button>
          <button onClick={() => exportDB('csv')} disabled={exporting}
            className="flex items-center gap-2 px-5 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition font-medium text-sm">
            <FileText className="w-4 h-4" /> CSV
          </button>
        </div>

        <div className="text-xs text-gray-400 space-y-1">
          <p><strong>SQL:</strong> ใช้กับ Supabase SQL Editor, pgAdmin, psql — มี BEGIN/COMMIT และ INSERT statements</p>
          <p><strong>JSON:</strong> ใช้กับ MongoDB, Firebase หรือเขียนสคริปต์นำเข้าเอง</p>
          <p><strong>CSV:</strong> ใช้กับ Excel, Google Sheets, MySQL Workbench</p>
        </div>
      </div>

      {/* Storage Export */}
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2"><HardDrive className="w-5 h-5 text-purple-600" /> ส่งออกไฟล์แนบ</h3>
        <p className="text-sm text-gray-500">ไฟล์รูปภาพและเอกสารที่แนบมากับเคสซ่อม</p>

        {!storageInfo && !storageLoading && (
          <button onClick={loadStorage} className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium text-sm">
            <Image className="w-4 h-4" /> โหลดรายการไฟล์
          </button>
        )}

        {storageLoading && <div className="text-sm text-gray-400">กำลังโหลด...</div>}

        {storageInfo && (
          <div className="space-y-3">
            <div className="flex gap-6 text-sm">
              <div><span className="text-gray-500">ไฟล์ทั้งหมด:</span> <span className="font-semibold">{storageInfo.totalFiles}</span></div>
              <div><span className="text-gray-500">ขนาดรวม:</span> <span className="font-semibold">{formatSize(storageInfo.totalSize)}</span></div>
            </div>

            {storageFiles.length > 0 && (
              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {storageFiles.slice(0, 50).map((f: any) => (
                  <div key={f.name} className="px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <Image className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="truncate text-gray-700">{f.name}</span>
                      <span className="text-xs text-gray-400 shrink-0">{formatSize(f.size)}</span>
                    </div>
                    <button onClick={() => downloadFile(f.name, f.name.split('/').pop() || f.name)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded shrink-0">
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-gray-400">
              ดาวน์โหลดไฟล์ทีละไฟล์ หรือใช้ Supabase Dashboard → Storage → Download all
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
