/**
 * GET /api/cloudbeds/sync?slug=h98&year=2026&month=4
 *
 * Combina tres fuentes:
 *   1. Data Insights API (report 17) → bookingVolume, lead time, room types, status
 *   2. PMS API (getReservations)     → guests, nights, countries
 *   3. Supabase monthly_billing      → totalRevenue, inversión, ROAS
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getReservations } from '@/lib/api/cloudbeds'
import { getInsightsBookingMetrics } from '@/lib/api/insights'

export const dynamic = 'force-dynamic'

const COUNTRY_NAMES: Record<string, string> = {
  US: 'Estados Unidos', CO: 'Colombia',     PR: 'Puerto Rico',
  MX: 'México',         DO: 'Rep. Dominicana', CA: 'Canadá',
  NL: 'Países Bajos',   HT: 'Haití',        DE: 'Alemania',
  VE: 'Venezuela',      ES: 'España',        AR: 'Argentina',
  GB: 'Reino Unido',    CR: 'Costa Rica',    PA: 'Panamá',
  JM: 'Jamaica',        IN: 'India',         FR: 'Francia',
  BR: 'Brasil',         CL: 'Chile',         PE: 'Perú',
}

function pct(n: number, total: number) {
  return total > 0 ? Math.round((n / total) * 1000) / 10 : 0
}

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

    // ── Config del hotel ────────────────────────────────────────────────────
    const { data: property } = await supabase
      .from('properties')
      .select('id, slug, name, primary_color, secondary_color, success_fee_pct, attributable_sources, cloudbeds_property_id')
      .eq('slug', slug)
      .single()

    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 })

    // ── Billing de Supabase ─────────────────────────────────────────────────
    const { data: billing } = await supabase
      .from('monthly_billing')
      .select('*')
      .eq('property_id', property.id)
      .eq('year', year)
      .eq('month', month)
      .single()

    if (!billing) {
      return NextResponse.json({ error: `Sin datos de facturación para ${year}-${month}`, code: 'NO_BILLING_DATA' }, { status: 404 })
    }

    const attrSources = property.attributable_sources ?? []
    const propertyId  = property.cloudbeds_property_id ?? '212206'
    const pad = (n: number) => String(n).padStart(2, '0')
    const firstDay = `${year}-${pad(month)}-01`
    const lastDay  = `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`

    // ── Fetch en paralelo ───────────────────────────────────────────────────
    const [insightsMetrics, arrivals] = await Promise.all([
      // 1. Data Insights → booking volume (por fecha de reserva)
      getInsightsBookingMetrics(apiKey, propertyId, year, month, attrSources),
      // 2. PMS API → huéspedes/noches/países (por fecha de llegada)
      getReservations(apiKey, {
        checkInFrom: firstDay,
        checkInTo:   lastDay,
        status: 'not_confirmed,confirmed,checked_in,checked_out,no_show',
      }),
    ])

    // ── Calcular guests, nights, países ────────────────────────────────────
    let guests = 0
    let nights = 0
    const countryCounts = new Map<string, number>()

    for (const r of arrivals) {
      if (r.status === 'cancelled') continue
      guests += parseInt(r.adults || '0') + parseInt(r.children || '0')
      const start = new Date(r.startDate).getTime()
      const end   = new Date(r.endDate).getTime()
      nights += Math.round((end - start) / 86_400_000)

      if (attrSources.includes(r.sourceName)) {
        const g = Object.values(r.guestList ?? {})[0] as { guestCountry?: string } | undefined
        const countryCode = g?.guestCountry
        if (countryCode) {
          const name = COUNTRY_NAMES[countryCode] ?? countryCode
          countryCounts.set(name, (countryCounts.get(name) ?? 0) + 1)
        }
      }
    }

    const topCountries = [...countryCounts.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }))

    // ── Respuesta ───────────────────────────────────────────────────────────
    return NextResponse.json({
      property: {
        slug:           property.slug,
        name:           property.name,
        primaryColor:   property.primary_color,
        secondaryColor: property.secondary_color,
        successFeePct:  property.success_fee_pct,
      },
      period: { year, month },
      metrics: {
        // Facturación (Supabase)
        totalRevenue:        billing.total_revenue,
        attributableRevenue: billing.total_revenue,
        // KPI Strip (PMS API arrivals)
        guests,
        nights,
        // Booking Volume (Data Insights)
        bookingVolume:         insightsMetrics.bookingVolume,
        bookingCount:          insightsMetrics.bookingCount,
        avgTicket:             insightsMetrics.avgTicket,
        avgNightsPerBooking:   insightsMetrics.avgNightsPerBooking,
        // Demografía
        reservationStatus:     insightsMetrics.reservationStatus,
        leadTime:              insightsMetrics.leadTime,
        topRoomTypes:          insightsMetrics.topRoomTypes,
        topCountries,
      },
      billing: {
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
      },
      _meta: {
        arrivals:      arrivals.length,
        bookingCount:  insightsMetrics.bookingCount,
        dataSource:    'insights+pms+supabase',
      },
    })
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e))
    console.error('[sync]', err.stack)
    return NextResponse.json({ crashed: true, message: err.message }, { status: 500 })
  }
}
