import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = cookies()
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )
  const { data: { session } } = await supabaseAuth.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabaseAuth.from('user_profiles').select('role').eq('id', session.user.id).single()
  if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data } = await supabaseAdmin.from('sla_config').select('*').single()
  return NextResponse.json(data || {})
}

export async function PUT(req: NextRequest) {
  const cookieStore = cookies()
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )
  const { data: { session } } = await supabaseAuth.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabaseAuth.from('user_profiles').select('role').eq('id', session.user.id).single()
  if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const body = await req.json()
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error } = await supabaseAdmin.from('sla_config').upsert({
    id: 1,
    response_hours: body.response_hours,
    onsite_hours: body.onsite_hours,
    work_start_hour: body.work_start_hour,
    work_start_min: body.work_start_min,
    work_end_hour: body.work_end_hour,
    work_end_min: body.work_end_min,
    updated_by: session.user.id,
    updated_at: new Date().toISOString(),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
