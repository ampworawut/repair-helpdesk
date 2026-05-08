import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const { email, password, display_name, role, vendor_id } = await req.json()

    if (!email || !password || !display_name || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 1. Create auth user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // skip email verification
      user_metadata: { display_name },
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // 2. Insert user_profile
    const { error: profileError } = await supabase.from('user_profiles').insert({
      id: authUser.user.id,
      display_name,
      role,
      vendor_id: vendor_id || null,
      email,
      is_active: true,
    })

    if (profileError) {
      // Rollback: delete auth user if profile insert fails
      await supabase.auth.admin.deleteUser(authUser.user.id)
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      user: { id: authUser.user.id, email, display_name, role },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
