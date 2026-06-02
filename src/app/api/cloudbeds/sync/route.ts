import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getReservations } from '@/lib/api/cloudbeds'
import { getInsightsBookingMetrics } from '@/lib/api/insights'
import type { GeoBreakdown, RoomCategoryBreakdown } from '@/types'

export const dynamic = 'force-dynamic'

const COUNTRY_NAMES: Record<string, string> = {
  US: 'Estados Unidos', CO: 'Colombia', PR: 'Puerto Rico', MX: 'México',
  DO: 'Rep. Dominicana', CA: 'Canadá', NL: 'Países Bajos', DE: 'Alemania',
  VE: 'Venezuela', ES: 'España', AR: 'Argentina', GB: 'Reino Unido',
  CR: 'Costa Rica', PA: 'Panamá', JM: 'Jamaica', IN: 'India', FR: 'Francia',
  BR: 'Brasil', CL: 'Chile', PE: 'Perú', HT: 'Haití', EC: 'Ecuador',
}

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

    const { data: billing } = await supabase.from('monthly_billing').select('*')
      .eq('property_id', property.id).eq('year', year).eq('month', month).single()
    if (!billing) return NextResponse.json({ error: `Sin datos para ${year}-${month}`, code: 'NO_BILLING_DATA' }, { status: 404 })

    const attrSources = property.attributable_sources ?? []
    const propertyId  = property.cloudbeds_property_id ?? '212206'
    const pad = (n: number) => String(n).padStart(2, '0')

    const [insightsMetrics, arrivals] = await Promise.all([
      getInsightsBookingMetrics(apiKey, propertyId, year, month, attrSources),
      getReservations(apiKey, {
        checkInFrom: `${year}-${pad(month)}-01`,
        checkInTo:   `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`,
        status: 'not_confirmed,confirmed,checked_in,checked_out,no_show',
      }),
    ])

    // Guests, nights, countries from PMS arrivals
    let guests = 0, nights = 0
    const countryCounts = new Map<string, { code: string; count: number }>()
    let totalActiveArrivals = 0
    let attrActiveArrivals  = 0

    for (const r of arrivals) {
      if (r.status === 'cancelled') continue
      totalActiveArrivals++
      guests += parseInt(r.adults || '0') + parseInt(r.children || '0')
      nights += Math.round((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / 86_400_000)

      if (attrSources.includes(r.sourceName)) {
        attrActiveArrivals++
        const g = Object.values(r.guestList ?? {})[0] as { guestCountry?: string } | undefined
        const code = g?.guestCountry
        if (code) {
          const name = COUNTRY_NAMES[code] ?? code
          const cur = countryCounts.get(name) ?? { code, count: 0 }
          countryCounts.set(name, { code, count: cur.count + 1 })
        }
      }
    }

    // attributableRevenue = portion of billing from direct channel arrivals
    const attributableRevenue = totalActiveArrivals > 0
      ? Math.round((attrActiveArrivals / totalActiveArrivals) * billing.total_revenue)
      : billing.total_revenue

    // Country revenue: proportional to booking volume
    const totalCountryCount = [...countryCounts.values()].reduce((s, c) => s + c.count, 0) || 1
    const bv = insightsMetrics.bookingVolume

    const geoBreakdown: GeoBreakdown[] = [...countryCounts.entries()]
      .sort(([, a], [, b]) => b.count - a.count).slice(0, 6)
      .map(([name, d]) => ({
        country: name, country_code: d.code,
        revenue:  Math.round((d.count / totalCountryCount) * bv),
        bookings: d.count,
        pct: pct(d.count, totalCountryCount),
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
        totalRevenue:        billing.total_revenue,
        attributableRevenue,
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
      _meta: { arrivals: arrivals.length, attrArrivals: attrActiveArrivals, totalArrivals: totalActiveArrivals, bookingCount: insightsMetrics.bookingCount, dataSource: 'insights+pms+supabase' },
    })
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e))
    console.error('[sync]', err.stack)
    return NextResponse.json({ crashed: true, message: err.message }, { status: 500 })
  }
}
