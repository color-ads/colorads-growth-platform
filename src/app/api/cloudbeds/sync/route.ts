import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getReservations } from '@/lib/api/cloudbeds'
import { getInsightsBookingMetrics, getProductionByCountry } from '@/lib/api/insights'
import type { GeoBreakdown, RoomCategoryBreakdown } from '@/types'

export const dynamic = 'force-dynamic'

function pct(n: number, t: number) { return t > 0 ? Math.round((n / t) * 1000) / 10 : 0 }

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const slug  = searchParams.get('slug')  ?? 'h98'
    const year  = parseInt(searchParams.get('year')  ?? '2026')
    const month = parseInt(searchParams.get('month') ?? '4')

    const apiKey = process.env.CLOUDBEDS_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'CLOUDBEDS_API_KEY not configured', code: 'NOT_CONNECTED' }, { status: 503 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const { data: property } = await supabase.from('properties')
      .select('id,slug,name,primary_color,secondary_color,success_fee_pct,attributable_sources,cloudbeds_property_id')
      .eq('slug', slug).single()
    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 })

    const { data: billingRow } = await supabase.from('monthly_billing').select('*')
      .eq('property_id', property.id).eq('year', year).eq('month', month).maybeSingle()
    // Si no hay inversión cargada para el mes, seguimos igual: la facturación sale de
    // monthly_source_revenue (en el dashboard) y la inversión/ROAS quedan en 0.
    const billing = billingRow ?? {
      total_revenue: 0, google_investment: 0, meta_investment: 0, content_investment: 0,
      fees: 0, total_investment: 0, ad_cost_pct: 0, roas: 0, clicks: 0, impressions: 0, cpc: 0,
      booking_volume: null, booking_count: null,
    }

    const attrSources = property.attributable_sources ?? []
    const propertyId  = property.cloudbeds_property_id ?? '212206'
    const pad = (n: number) => String(n).padStart(2, '0')

    const [insightsMetrics, arrivals, countryProduction] = await Promise.all([
      getInsightsBookingMetrics(apiKey, propertyId, year, month, attrSources),
      getReservations(apiKey, {
        checkInFrom: `${year}-${pad(month)}-01`,
        checkInTo:   `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`,
        status: 'not_confirmed,confirmed,checked_in,checked_out,no_show',
      }),
      getProductionByCountry(apiKey, propertyId, year, month, attrSources),
    ])

    // Guests + nights from PMS arrivals (check-in based)
    let guests = 0, nights = 0
    for (const r of arrivals) {
      if (r.status === 'cancelled') continue
      guests += parseInt(r.adults || '0') + parseInt(r.children || '0')
      nights += Math.round((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / 86_400_000)
    }
    // Facturación (atribuible y total) NO se calcula aquí: la computa el dashboard
    // desde monthly_source_revenue (room_revenue por estadía). Ver facturacionForMonth en page.tsx.

    // Venta por país: REAL atribuible, grand_total por fecha de reserva (report 34)
    const totalCountryRevenue = countryProduction.reduce((s, c) => s + c.revenue, 0) || 1
    const geoBreakdown: GeoBreakdown[] = countryProduction.slice(0, 6).map(c => ({
      country: c.country,
      country_code: '',
      revenue: c.revenue,
      bookings: c.bookings,
      pct: pct(c.revenue, totalCountryRevenue),
    }))

    // Room breakdown — deduplicate multi-room bookings
    const totalRooms = insightsMetrics.topRoomTypes.reduce((s, r) => s + r.count, 0) || 1
    const roomBreakdown: RoomCategoryBreakdown[] = insightsMetrics.topRoomTypes
      .filter(r => !r.name.includes(','))   // skip multi-room concatenated entries
      .map(r => ({
        category_name: r.name,
        revenue:  r.revenue,
        bookings: r.count,
        pct: pct(r.count, totalRooms),
      }))

    return NextResponse.json({
      property: { slug: property.slug, name: property.name, primaryColor: property.primary_color, secondaryColor: property.secondary_color, successFeePct: property.success_fee_pct },
      period: { year, month },
      metrics: {
        guests, nights,
        bookingVolume:       billing.booking_volume ?? insightsMetrics.bookingVolume,
        bookingCount:        billing.booking_count  ?? insightsMetrics.bookingCount,
        avgTicket:           insightsMetrics.avgTicket,
        avgNightsPerBooking: insightsMetrics.avgNightsPerBooking,
        reservationStatus:   insightsMetrics.reservationStatus,
        leadTime:            insightsMetrics.leadTime,
        topRoomTypes:        roomBreakdown,
        topCountries:        geoBreakdown,
      },
      billing: {
        totalRevenue: billing.total_revenue, googleInvestment: billing.google_investment,
        metaInvestment: billing.meta_investment, contentInvestment: billing.content_investment,
        fees: billing.fees, totalInvestment: billing.total_investment, adCostPct: billing.ad_cost_pct,
        roas: billing.roas, clicks: billing.clicks, impressions: billing.impressions, cpc: billing.cpc,
      },
      _meta: { arrivals: arrivals.length, bookingCount: insightsMetrics.bookingCount, geoCountries: countryProduction.length, geoTotal: Math.round(totalCountryRevenue), dataSource: 'insights+pms+supabase' },
    })
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e))
    console.error('[sync]', err.stack)
    return NextResponse.json({ crashed: true, message: err.message }, { status: 500 })
  }
}
