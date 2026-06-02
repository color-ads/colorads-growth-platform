import { NextRequest, NextResponse } from 'next/server'
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

// Defense-in-depth: middleware already gates /api/admin/*, but we re-check here too.
async function requireUser() {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// GET /api/admin/billing?slug=h98 → all billing rows for the property
export async function GET(req: NextRequest) {
  try {
    if (!(await requireUser())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const slug = new URL(req.url).searchParams.get('slug') ?? 'h98'
    const supabase = service()
    const { data: prop } = await supabase.from('properties').select('id').eq('slug', slug).single()
    if (!prop) return NextResponse.json({ error: 'Property not found' }, { status: 404 })

    const { data: rows } = await supabase
      .from('monthly_billing')
      .select('year,month,total_revenue,google_investment,meta_investment,content_investment,fees,total_investment,ad_cost_pct,roas,clicks,impressions,cpc')
      .eq('property_id', prop.id)
      .order('year').order('month')

    return NextResponse.json({ rows: rows ?? [] })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// POST /api/admin/billing → upsert one month's marketing KPIs (derived fields computed server-side)
export async function POST(req: NextRequest) {
  try {
    if (!(await requireUser())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const slug = body.slug ?? 'h98'
    const year = parseInt(body.year)
    const month = parseInt(body.month)
    if (!year || !month || month < 1 || month > 12)
      return NextResponse.json({ error: 'Año/mes inválido' }, { status: 400 })

    const num = (v: unknown) => {
      const n = parseFloat(String(v ?? 0).replace(/[,$\s]/g, ''))
      return isNaN(n) ? 0 : n
    }
    const google_investment   = num(body.google_investment)
    const meta_investment     = num(body.meta_investment)
    const content_investment  = num(body.content_investment)
    const fees                = num(body.fees)
    const clicks              = Math.round(num(body.clicks))
    const impressions         = Math.round(num(body.impressions))

    // Only marketing inputs + CPC are stored here. Facturación, ROAS and % cost
    // are derived from Cloudbeds (monthly_source_revenue) at read time in the dashboard.
    const total_investment = google_investment + meta_investment + content_investment + fees
    const ad_spend         = google_investment + meta_investment
    const cpc              = clicks > 0 ? Math.round(ad_spend / clicks) : 0

    const supabase = service()
    const { data: prop } = await supabase.from('properties').select('id').eq('slug', slug).single()
    if (!prop) return NextResponse.json({ error: 'Property not found' }, { status: 404 })

    // Fields the admin manages (no revenue here)
    const marketing = {
      google_investment, meta_investment, content_investment, fees,
      total_investment, clicks, impressions, cpc,
    }

    const { data: existing } = await supabase
      .from('monthly_billing').select('id')
      .eq('property_id', prop.id).eq('year', year).eq('month', month).maybeSingle()

    if (existing) {
      // Preserve any existing total_revenue/roas/ad_cost_pct columns; only update marketing fields
      const { error } = await supabase.from('monthly_billing').update(marketing)
        .eq('property_id', prop.id).eq('year', year).eq('month', month)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      // New month: include zero defaults for legacy revenue columns (defensive against NOT NULL)
      const { error } = await supabase.from('monthly_billing').insert({
        property_id: prop.id, year, month,
        ...marketing,
        total_revenue: 0, roas: 0, ad_cost_pct: 0,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, saved: { year, month, ...marketing } })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
