import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createAuthClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

async function requireUser() {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// GET /api/admin/sources?slug=h98 → granular per-source rows + current attributable list
export async function GET(req: NextRequest) {
  try {
    if (!(await requireUser())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const slug = new URL(req.url).searchParams.get('slug') ?? 'h98'
    const supabase = service()
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

// POST /api/admin/sources  body: { slug, sources: string[] } → save attributable list
export async function POST(req: NextRequest) {
  try {
    if (!(await requireUser())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { slug = 'h98', sources } = await req.json()
    if (!Array.isArray(sources))
      return NextResponse.json({ error: 'sources must be an array' }, { status: 400 })

    const supabase = service()
    const { error } = await supabase
      .from('properties').update({ attributable_sources: sources }).eq('slug', slug)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    revalidatePath('/dashboard')
    return NextResponse.json({ ok: true, count: sources.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
