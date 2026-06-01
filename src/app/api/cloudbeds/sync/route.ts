import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMonthReservations } from '@/lib/api/cloudbeds'
import { transformToMetrics, type BillingData } from '@/lib/api/transformer'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const slug  = searchParams.get('slug')  ?? 'h98'
    const year  = parseInt(searchParams.get('year')  ?? '2026')
    const month = parseInt(searchParams.get('month') ?? '4')

    const apiKey = process.env.CLOUDBEDS_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'CLOUDBEDS_API_KEY not configured', code: 'NOT_CONNECTED' }, { status: 503 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const { data: property } = await supabase
      .from('properties')
      .select('id, slug, name, primary_color, secondary_color, success_fee_pct, attributable_sources')
      .eq('slug', slug)
      .single()

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    const { data: billing } = await supabase
      .from('monthly_billing')
      .select('*')
      .eq('property_id', property.id)
      .eq('year', year)
      .eq('month', month)
      .single()

    if (!billing) {
      return NextResponse.json(
        { error: `Sin datos de facturacion para ${year}-${month}`, code: 'NO_BILLING_DATA' },
        { status: 404 },
      )
    }

    const cloudbedsData = await getMonthReservations(apiKey, year, month)

    const billingData: BillingData = {
      totalRevenue:      billing.total_revenue,
      googleInvestment:  billing.google_investment,
      metaInvestment:    billing.meta_investment,
      contentInvestment: billing.content_investment,
      fees:              billing.fees,
      totalInvestment:   billing.total_investment,
      adCostPct:         billing.ad_cost_pct,
      roas:              billing.roas,
      clicks:            billing.clicks,
      impressions:       billing.impressions,
      cpc:               billing.cpc,
    }

    const metrics = transformToMetrics(
      cloudbedsData.byBookingDate,
      cloudbedsData.byArrival,
      billingData,
      property.attributable_sources ?? [],
    )

    return NextResponse.json({
      property: {
        slug:           property.slug,
        name:           property.name,
        primaryColor:   property.primary_color,
        secondaryColor: property.secondary_color,
        successFeePct:  property.success_fee_pct,
      },
      period:  { year, month },
      metrics,
      billing: billingData,
      _meta: {
        byBookingDate: cloudbedsData.byBookingDate.length,
        byArrival:     cloudbedsData.byArrival.length,
      },
    })
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e))
    console.error('[sync]', err.stack)
    return NextResponse.json({ crashed: true, message: err.message }, { status: 500 })
  }
}
