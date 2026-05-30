/**
 * GET /api/cloudbeds/sync?year=2026&month=4
 *
 * Fetch datos reales del dashboard:
 *   1. Lee billing data de Supabase (hoja Facturación importada)
 *   2. Llama Cloudbeds API v1.2 con API Key
 *   3. Transforma y retorna métricas
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMonthReservations } from '@/lib/api/cloudbeds'
import { transformToMetrics, type BillingData } from '@/lib/api/transformer'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const slug  = searchParams.get('slug')  ?? 'h98'
  const year  = parseInt(searchParams.get('year')  ?? '2026')
  const month = parseInt(searchParams.get('month') ?? '4')

  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Invalid year/month' }, { status: 400 })
  }

  // ── API Key: env var como fuente (Vercel) ──────────────────────────────────
  const apiKey = process.env.CLOUDBEDS_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'CLOUDBEDS_API_KEY not configured', code: 'NOT_CONNECTED' },
      { status: 503 },
    )
  }

  const supabase = await createClient()

  // ── Config del hotel ────────────────────────────────────────────────────────
  const { data: property } = await supabase
    .from('properties')
    .select('id, slug, name, primary_color, secondary_color, success_fee_pct, attributable_sources')
    .eq('slug', slug)
    .single()

  if (!property) {
    return NextResponse.json({ error: 'Property not found' }, { status: 404 })
  }

  // ── Billing data de Supabase ────────────────────────────────────────────────
  const { data: billing } = await supabase
    .from('monthly_billing')
    .select('*')
    .eq('property_id', property.id)
    .eq('year', year)
    .eq('month', month)
    .single()

  if (!billing) {
    return NextResponse.json(
      { error: `Sin datos de facturación para ${year}-${month}`, code: 'NO_BILLING_DATA' },
      { status: 404 },
    )
  }

  // ── Cloudbeds API v1.2 ──────────────────────────────────────────────────────
  let cloudbedsData
  try {
    cloudbedsData = await getMonthReservations(apiKey, year, month)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    if (msg === 'CLOUDBEDS_INVALID_KEY') {
      return NextResponse.json(
        { error: 'API Key inválido. Verifica CLOUDBEDS_API_KEY en Vercel.', code: 'INVALID_KEY' },
        { status: 401 },
      )
    }
    console.error('[cloudbeds/sync]', msg)
    return NextResponse.json({ error: msg, code: 'API_ERROR' }, { status: 502 })
  }

  // ── Transformar ─────────────────────────────────────────────────────────────
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
      attributableSources: property.attributable_sources,
    },
  })
}
