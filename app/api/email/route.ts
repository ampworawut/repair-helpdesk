import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const { to, subject, text } = await req.json()
    if (!to || !subject || !text) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Check email config from DB
    const supabase = createClient(true)
    const { data: config } = await supabase.from('email_config').select('*').single()

    if (!config?.enabled) {
      return NextResponse.json({ ok: false, reason: 'Email notifications disabled' })
    }

    const from = config.from_address || 'RepairDesk <noreply@repairdesk.app>'

    if (config.provider === 'resend') {
      const apiKey = config.resend_api_key || process.env.RESEND_API_KEY
      if (!apiKey) {
        console.log(`[EMAIL] No API key — would send to ${to}: ${subject}\n${text}`)
        return NextResponse.json({ ok: true, mode: 'log' })
      }

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, subject, text }),
      })

      if (!res.ok) {
        const err = await res.json()
        return NextResponse.json({ error: err.message }, { status: 500 })
      }

      return NextResponse.json({ ok: true })
    }

    if (config.provider === 'smtp') {
      // SMTP via nodemailer would go here — for now log
      console.log(`[EMAIL SMTP] ${config.smtp_host}:${config.smtp_port} → ${to}: ${subject}`)
      return NextResponse.json({ ok: true, mode: 'smtp-log' })
    }

    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
