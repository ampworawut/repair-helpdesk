import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const EXPORT_TABLES = [
  'vendors', 'vendor_groups', 'locations', 'assets',
  'user_profiles', 'vendor_staff_skills', 'ticket_templates',
  'repair_cases', 'case_attachments', 'ticket_comments',
  'case_activity_log', 'notifications', 'line_webhook_logs',
  'sla_config', 'holidays', 'admin_audit_log',
]

function escapeSQL(val: any): string {
  if (val === null || val === undefined) return 'NULL'
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE'
  if (typeof val === 'number') return String(val)
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`
  return `'${String(val).replace(/'/g, "''")}'`
}

export async function GET(req: NextRequest) {
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

  const format = req.nextUrl.searchParams.get('format') || 'sql'
  const table = req.nextUrl.searchParams.get('table') || ''

  try {
    const tables = table ? [table] : EXPORT_TABLES
    let output = ''

    if (format === 'sql') {
      output += `-- RepairDesk Database Export\n`
      output += `-- Generated: ${new Date().toISOString()}\n`
      output += `-- Tables: ${tables.join(', ')}\n\n`
      output += `BEGIN;\n\n`
    }

    for (const tbl of tables) {
      const { data, error } = await supabaseAdmin.from(tbl).select('*')
      if (error) { console.error(`Export ${tbl}:`, error.message); continue }
      if (!data || data.length === 0) continue

      if (format === 'sql') {
        output += `-- Table: ${tbl} (${data.length} rows)\n`
        const columns = Object.keys(data[0])
        const colList = columns.map(c => `"${c}"`).join(', ')

        for (const row of data) {
          const vals = columns.map(c => escapeSQL(row[c])).join(', ')
          output += `INSERT INTO "${tbl}" (${colList}) VALUES (${vals});\n`
        }
        output += `\n`
      } else if (format === 'json') {
        output += JSON.stringify({ table: tbl, rows: data }, null, 2) + '\n'
      } else if (format === 'csv') {
        if (!output) {
          output += `"table",${Object.keys(data[0]).map(c => `"${c}"`).join(',')}\n`
        }
        for (const row of data) {
          output += `"${tbl}",${Object.values(row).map(v => escapeSQL(v)).join(',')}\n`
        }
      }
    }

    if (format === 'sql') output += `COMMIT;\n`

    const contentType = format === 'json' ? 'application/json' : 'text/plain'
    return new NextResponse(output, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="repairdesk-export-${new Date().toISOString().slice(0, 10)}.${format === 'sql' ? 'sql' : format}"`,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
