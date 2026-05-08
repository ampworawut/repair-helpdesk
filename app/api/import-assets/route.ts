import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const STATUS_MAP: Record<string, string> = {
  'ว่าง': 'available',
  'ใช้งาน': 'in_use',
  'รอดำเนินการ': 'pending',
  'ส่งซ่อม': 'under_repair',
  'รอทำลาย': 'retired',
}

function buddhistToAD(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  try {
    const parts = dateStr.trim().split('/')
    if (parts.length !== 3) return null
    const d = parts[0].padStart(2, '0')
    const m = parts[1].padStart(2, '0')
    let y = parseInt(parts[2], 10)
    if (y > 2500) y -= 543
    return `${y}-${m}-${d}`
  } catch { return null }
}

export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', session.user.id).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const rows: any[][] = body.rows || []

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No rows' }, { status: 400 })
    }

    // Pre-fetch vendors
    const { data: allVendors } = await supabase.from('vendors').select('id, name')
    const vendorMap = new Map<string, string>()
    if (allVendors) {
      for (const v of allVendors) vendorMap.set(v.name.trim(), v.id)
    }

    // Convert rows to upsert-ready objects
    const assets: Record<string, any>[] = []

    for (const row of rows) {
      const compName = row[2] ? String(row[2]).trim() : null
      if (!compName) continue

      let vendorId: string | null = null
      const vendorName = row[7] ? String(row[7]).trim() : null
      if (vendorName) {
        const existingId = vendorMap.get(vendorName)
        if (existingId) {
          vendorId = existingId
        } else {
          const { data: newVendor } = await supabase
            .from('vendors').insert({ name: vendorName }).select('id').single()
          if (newVendor) {
            vendorId = newVendor.id
            vendorMap.set(vendorName, newVendor.id)
          }
        }
      }

      const statusThai = row[9] ? String(row[9]).trim() : null
      const status = statusThai ? (STATUS_MAP[statusThai] || 'available') : 'available'

      assets.push({
        asset_code: compName,
        serial_number: row[0] ? String(row[0]).trim() : null,
        assigned_to: row[1] ? String(row[1]).trim() : null,
        model: row[5] ? String(row[5]).trim() : null,
        mac_lan: row[3] ? String(row[3]).trim() : null,
        mac_wlan: row[4] ? String(row[4]).trim() : null,
        monthly_rent: row[6] != null ? parseFloat(String(row[6])) : null,
        vendor_id: vendorId,
        location: row[8] ? String(row[8]).trim() : null,
        status,
        description: row[10] ? String(row[10]).trim() : null,
        contract_start: buddhistToAD(row[11] ? String(row[11]) : null),
        contract_end: buddhistToAD(row[12] ? String(row[12]) : null),
      })
    }

    // Dedup — keep last occurrence of each asset_code (Postgres can't upsert same key twice)
    const deduped = new Map<string, Record<string, any>>()
    for (const a of assets) {
      deduped.set(a.asset_code, a)
    }
    const unique = Array.from(deduped.values())
    const dupesRemoved = assets.length - unique.length

    // Bulk upsert — onConflict uses asset_code as key
    const { error: upsertErr } = await supabase
      .from('assets')
      .upsert(unique, { onConflict: 'asset_code', ignoreDuplicates: false })

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 })
    }

    // count from upsert doesn't distinguish insert vs update. For large imports,
    // return count and note it's upserted. The client already knows the total.
    return NextResponse.json({
      success: true,
      upserted: assets.length,
      total: rows.length,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Import failed' }, { status: 500 })
  }
}
