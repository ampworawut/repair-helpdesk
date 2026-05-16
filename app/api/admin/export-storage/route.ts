import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

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

  const action = req.nextUrl.searchParams.get('action') || 'list'
  const bucket = req.nextUrl.searchParams.get('bucket') || 'repair-attachments'

  try {
    if (action === 'list') {
      const { data: files, error } = await supabaseAdmin.storage.from(bucket).list()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      const fileList = (files || []).map(f => ({
        name: f.name,
        size: f.metadata?.size || 0,
        created: f.created_at,
        url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${f.name}`,
      }))

      // Get total size
      const totalSize = fileList.reduce((sum, f) => sum + (f.size || 0), 0)
      return NextResponse.json({ bucket, files: fileList, totalFiles: fileList.length, totalSize })
    }

    if (action === 'download') {
      const path = req.nextUrl.searchParams.get('path') || ''
      const { data, error } = await supabaseAdmin.storage.from(bucket).download(path)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      const buffer = Buffer.from(await data.arrayBuffer())
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': data.type || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${path.split('/').pop()}"`,
        },
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
