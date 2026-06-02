import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

// GET /api/sources?slug=h98 → granular per-source data + current attributable list
export async function GET(req: NextRequest) {
  try {
    const slug = new URL(req.url).searchParams.get('slug') ?? 'h98'
    const supabase = admin()
    const { data: prop } = await supabase
      .from('properties').select('id, attributable_sources').eq('slug', slug).single()
    if (!prop) return NextResponse.json({ error: 'Property not found' }, { status: 404 })

    const { data: rows } = await supabase
      .from('monthly_source_revenue')
      .select('year,month,source,category,stay_revenue,booking_volume,booking_count')
      .eq('property_id', prop.id)
      .order('year').order('month')

    return NextResponse.json({ rows: rows ?? [], attributable: prop.attributable_sources ?? [] })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// POST /api/sources  body: { slug, sources: string[] } → save attributable list
export async function POST(req: NextRequest) {
  try {
    const { slug = 'h98', sources } = await req.json()
    if (!Array.isArray(sources))
      return NextResponse.json({ error: 'sources must be an array' }, { status: 400 })

    const supabase = admin()
    const { error } = await supabase
      .from('properties').update({ attributable_sources: sources }).eq('slug', slug)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, count: sources.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
