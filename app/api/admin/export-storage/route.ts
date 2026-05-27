import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { listS3Files, getS3PublicUrl, getS3DownloadUrl } from '@/lib/s3'

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

  const action = req.nextUrl.searchParams.get('action') || 'list'
  const prefix = req.nextUrl.searchParams.get('prefix') || ''

  try {
    if (action === 'list') {
      const files = await listS3Files(prefix || undefined)

      const fileList = files.map(f => ({
        name: f.key,
        size: f.size,
        lastModified: f.lastModified.toISOString(),
        url: getS3PublicUrl(f.key),
      }))

      const totalSize = fileList.reduce((sum, f) => sum + (f.size || 0), 0)
      return NextResponse.json({ bucket: process.env.AWS_S3_BUCKET, files: fileList, totalFiles: fileList.length, totalSize })
    }

    if (action === 'download') {
      const path = req.nextUrl.searchParams.get('path') || ''
      const url = await getS3DownloadUrl(path)
      return NextResponse.redirect(url)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
