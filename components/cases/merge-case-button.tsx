'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { toast } from 'sonner'
import { Merge } from 'lucide-react'

export default function MergeCaseButton({ caseId, caseNo }: { caseId: string; caseNo: string }) {
  const router = useRouter()
  const supabase = createClient()

  async function handleMerge() {
    const target = prompt(`Merge ${caseNo} into case number (e.g. REP-26-0001):`)
    if (!target) return

    const { data: targetCase } = await supabase.from('repair_cases').select('id').eq('case_no', target).single()
    if (!targetCase) { toast.error('ไม่พบเคสเป้าหมาย'); return }

    if (!confirm(`ย้ายข้อมูลทั้งหมดจาก ${caseNo} ไปยัง ${target}?`)) return

    // Move comments
    await supabase.from('ticket_comments').update({ case_id: targetCase.id }).eq('case_id', caseId)
    // Move attachments
    await supabase.from('case_attachments').update({ case_id: targetCase.id }).eq('case_id', caseId)
    // Move activity log
    await supabase.from('case_activity_log').update({ case_id: targetCase.id }).eq('case_id', caseId)
    // Cancel source case
    await supabase.from('repair_cases').update({ status: 'cancelled' }).eq('id', caseId)
    // Log merge
    await supabase.from('case_activity_log').insert({
      case_id: targetCase.id, user_id: null, action: 'comment',
      metadata: { content: `🔀 รวมเคสจาก ${caseNo}` },
    })

    toast.success(`รวมเคส ${caseNo} → ${target} แล้ว`)
    router.push(`/cases/${targetCase.id}`)
    router.refresh()
  }

  return (
    <button onClick={handleMerge} className="flex items-center gap-2 px-4 py-2.5 border border-purple-200 text-purple-600 rounded-lg hover:bg-purple-50 transition text-sm font-medium">
      <Merge className="w-4 h-4" /> รวมเคส
    </button>
  )
}
