import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const DI = 'https://api.cloudbeds.com/datainsights/v1.1'
const OTA_KNOWN = ['Expedia', 'Booking.com', 'Airbnb (API)', 'Despegar/Decolar']

function toNum(v: unknown): number {
  if (v == null || v === '-' || v === '') return 0
  const n = parseFloat(String(v).replace(/,/g, ''))
  return isNaN(n) ? 0 : n
}
const pad = (n: number) => String(n).padStart(2, '0')

async function di(apiKey: string, pid: string, reportId: number, body: object) {
  const res = await fetch(`${DI}/stock_reports/${reportId}/query/data?mode=Run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'X-PROPERTY-ID': pid, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`report ${reportId} → ${res.status}: ${(await res.text()).slice(0, 150)}`)
  return res.json()
}

// Report 191 (Channel Production): room_revenue per source by stay_date
async function facturacion(apiKey: string, pid: string, year: number, month: number) {
  const ny = month === 12 ? year + 1 : year
  const nm = month === 12 ? 1 : month + 1
  const d = await di(apiKey, pid, 191, {
    property_ids: [parseInt(pid)],
    filters: { and: [
      { cdf: { type: 'default', column: 'stay_date' }, operator: 'greater_than_or_equal', value: `${year}-${pad(month)}-01` },
      { cdf: { type: 'default', column: 'stay_date' }, operator: 'less_than', value: `${ny}-${pad(nm)}-01` },
      { cdf: { type: 'default', column: 'reservation_source', multi_level_id: 4 }, operator: 'all', value: '' },
      { cdf: { type: 'default', column: 'reservation_source_category', multi_level_id: 4 }, operator: 'all', value: '' },
      { cdf: { type: 'default', column: 'reservation_status', multi_level_id: 4 }, operator: 'all', value: [] },
    ]},
    settings: { details: true, totals: false, subtotals: false, transpose: false },
  })
  const index = d.index ?? []
  const rr = d.records?.room_revenue ?? []
  const fact: Record<string, number> = {}
  const cat: Record<string, string> = {}
  for (let i = 0; i < index.length; i++) {
    const row = index[i]
    const c = Array.isArray(row) && row.length > 1 ? String(row[1]) : '-'
    const src = Array.isArray(row) && row.length > 2 ? String(row[2]) : '-'
    fact[src] = (fact[src] ?? 0) + toNum(rr[i])
    cat[src] = c
  }
  return { fact, cat }
}

// Report 17 (Reservations by Booking Date): grand_total per source by booking date
async function reservas(apiKey: string, pid: string, year: number, month: number) {
  const ny = month === 12 ? year + 1 : year
  const nm = month === 12 ? 1 : month + 1
  const d = await di(apiKey, pid, 17, {
    property_ids: [parseInt(pid)],
    filters: { and: [
      { cdf: { type: 'default', column: 'booking_datetime_property_timezone' }, operator: 'greater_than_or_equal', value: `${year}-${pad(month)}-01T00:00:00` },
      { cdf: { type: 'default', column: 'booking_datetime_property_timezone' }, operator: 'less_than', value: `${ny}-${pad(nm)}-01T00:00:00` },
    ]},
    settings: { details: true, totals: false, subtotals: false, transpose: false },
  })
  const records = d.records ?? {}
  const index = d.index ?? []
  const vol: Record<string, number> = {}
  const cnt: Record<string, number> = {}
  for (let i = 0; i < index.length; i++) {
    const src = String(records.reservation_source?.[i] ?? '')
    vol[src] = (vol[src] ?? 0) + toNum(records.grand_total_amount?.[i])
    cnt[src] = (cnt[src] ?? 0) + 1
  }
  return { vol, cnt }
}

export async function GET(req: NextRequest) {
  // Auth: if CRON_SECRET set, require it (Vercel cron sends it automatically)
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.CLOUDBEDS_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'CLOUDBEDS_API_KEY missing' }, { status: 503 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug') ?? 'h98'

  const { data: prop } = await supabase
    .from('properties').select('id, cloudbeds_property_id').eq('slug', slug).single()
  if (!prop) return NextResponse.json({ error: 'property not found' }, { status: 404 })
  const pid = prop.cloudbeds_property_id ?? '212206'

  // Rolling window: from (now − back) to (now + ahead). Older months are frozen.
  const back = parseInt(searchParams.get('back') ?? '2')
  const ahead = parseInt(searchParams.get('ahead') ?? '6')
  const now = new Date()
  const months: [number, number][] = []
  for (let off = -back; off <= ahead; off++) {
    const d = new Date(now.getFullYear(), now.getMonth() + off, 1)
    months.push([d.getFullYear(), d.getMonth() + 1])
  }

  const results: Record<string, { fact: number; vol: number; src: number }> = {}
  for (const [year, month] of months) {
    const key = `${year}-${pad(month)}`
    try {
      const [{ fact, cat }, { vol, cnt }] = await Promise.all([
        facturacion(apiKey, pid, year, month),
        reservas(apiKey, pid, year, month),
      ])
      const allSrc = new Set<string>([...Object.keys(fact), ...Object.keys(vol)])
      allSrc.delete('-')
      const rows = [...allSrc].map(src => {
        let c = cat[src]
        if (!c || c === '-') c = OTA_KNOWN.includes(src) ? 'OTA' : 'Direct'
        return {
          property_id: prop.id, year, month, source: src, category: c,
          stay_revenue: Math.round(fact[src] ?? 0),
          booking_volume: Math.round(vol[src] ?? 0),
          booking_count: cnt[src] ?? 0,
        }
      })
      if (rows.length) {
        const { error } = await supabase
          .from('monthly_source_revenue')
          .upsert(rows, { onConflict: 'property_id,year,month,source' })
        if (error) throw new Error(error.message)
      }
      results[key] = {
        fact: rows.reduce((a, r) => a + r.stay_revenue, 0),
        vol: rows.reduce((a, r) => a + r.booking_volume, 0),
        src: rows.length,
      }
    } catch (e) {
      results[key] = { fact: -1, vol: -1, src: 0 }
      console.error(`[cron sync-sources] ${key}:`, e)
    }
  }

  return NextResponse.json({ ok: true, refreshed: months.length, results })
}
