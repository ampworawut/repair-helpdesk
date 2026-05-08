import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await req.json()

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Delete auth user (this cascades or we handle manually)
    const { error: authError } = await supabase.auth.admin.deleteUser(userId)

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // Delete user_profile (in case no cascade)
    await supabase.from('user_profiles').delete().eq('id', userId)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
