import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const { error } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE repair_cases ADD COLUMN IF NOT EXISTS category text; CREATE INDEX IF NOT EXISTS idx_repair_cases_category ON repair_cases(category);',
    })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    // If RPC doesn't exist, try direct approach via REST
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
