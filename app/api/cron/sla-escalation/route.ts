import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = createClient(true)

  // Run auto-escalation
  const { error } = await supabase.rpc('auto_escalate_cases')
  if (error) {
    console.error('[CRON] Escalation error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Update statuses for expired licenses
  const now = new Date().toISOString()
  const { error: updateErr } = await supabase
    .from('repair_cases')
    .update({ status: 'expired' })
    .not('status', 'in', '(closed,cancelled)')
    .lt('sla_response_dl', now)

  if (updateErr) console.error('[CRON] Status update error:', updateErr.message)

  return NextResponse.json({ ok: true, escalated: true })
}
