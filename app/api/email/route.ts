import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const { to, subject, text } = await req.json()
    if (!to || !subject || !text) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Use Resend or fallback to logging
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.log(`[EMAIL] Would send to ${to}: ${subject}\n${text}`)
      return NextResponse.json({ ok: true, mode: 'log' })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'RepairDesk <noreply@repairdesk.app>',
        to,
        subject,
        text,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      return NextResponse.json({ error: err.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
