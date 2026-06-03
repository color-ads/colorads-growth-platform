import { createClient } from '@supabase/supabase-js'
import { getReservations } from '@/lib/api/cloudbeds'
import { getInsightsBookingMetrics, getProductionByCountry } from '@/lib/api/insights'
import type { GeoBreakdown, RoomCategoryBreakdown } from '@/types'

const DI = 'https://api.cloudbeds.com/datainsights/v1.1'
const MES_ABBR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function pct(n: number, t: number) { return t > 0 ? Math.round((n / t) * 1000) / 10 : 0 }
const pad = (n: number) => String(n).padStart(2, '0')
function toNum(v: unknown): number {
  if (v == null || v === '-' || v === '') return 0
  const n = parseFloat(String(v).replace(/,/g, ''))
  return isNaN(n) ? 0 : n
}

async function di(apiKey: string, pid: string, reportId: number, body: object) {
  const res = await fetch(`${DI}/stock_reports/${reportId}/query/data?mode=Run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'X-PROPERTY-ID': pid, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`report ${reportId} -> ${res.status}: ${(await res.text()).slice(0, 150)}`)
  return res.json()
}

// Distribucion de la VENTA de reservas hechas en (year, month) segun su mes de estadia.
// Solo venta directa atribuible (igual que el resto de "venta de reservas" del tablero).
// Report 17 filtra por fecha de reserva; cada registro trae checkin_date + grand_total.
async function bookingStayDistribution(
  apiKey: string, pid: string, year: number, month: number, attrSources: string[],
) {
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
  const len = (records.checkin_date ?? records.grand_total_amount ?? records.reservation_source ?? []).length
  const attr = new Set(attrSources)
  const selfKey = `${year}-${pad(month)}`
  const byMonth: Record<string, { revenue: number; bookings: number }> = {}
  for (let i = 0; i < len; i++) {
    const status = String(records.reservation_status?.[i] ?? '').toLowerCase()
    if (status.includes('cancel')) continue
    const src = String(records.reservation_source?.[i] ?? '')
    if (attr.size && !attr.has(src)) continue           // solo venta directa atribuible
    const checkin = String(records.checkin_date?.[i] ?? '')
    if (!checkin || checkin === '-') continue
    const dt = new Date(checkin)
    if (isNaN(dt.getTime())) continue
    const key = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`
    if (key < selfKey) continue                          // solo mismo mes en adelante
    if (!byMonth[key]) byMonth[key] = { revenue: 0, bookings: 0 }
    byMonth[key].revenue += toNum(records.grand_total_amount?.[i])
    byMonth[key].bookings += 1
  }
  const sorted = Object.keys(byMonth).sort()
  const out = sorted.map((k) => {
    const [yy, mm] = k.split('-').map(Number)
    return {
      key: k,
      label: `${MES_ABBR[mm - 1]}${yy !== year ? " '" + String(yy).slice(2) : ''}`,
      revenue: Math.round(byMonth[k].revenue),
      bookings: byMonth[k].bookings,
      self: k === selfKey,
    }
  })
  // Cap a 7 barras; el resto se agrupa en "Posterior" para no ensuciar el grafico.
  const CAP = 7
  if (out.length <= CAP) return out
  const head = out.slice(0, CAP - 1)
  const tail = out.slice(CAP - 1)
  head.push({
    key: 'posterior', label: 'Posterior',
    revenue: tail.reduce((a, b) => a + b.revenue, 0),
    bookings: tail.reduce((a, b) => a + b.bookings, 0),
    self: false,
  })
  return head
}

export async function buildMonthReport(slug: string, year: number, month: number) {
  const apiKey = process.env.CLOUDBEDS_API_KEY
  if (!apiKey) throw new Error('CLOUDBEDS_API_KEY not configured')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data: property } = await supabase.from('properties')
    .select('id,slug,name,primary_color,secondary_color,success_fee_pct,attributable_sources,cloudbeds_property_id')
    .eq('slug', slug).single()
  if (!property) throw new Error('Property not found')

  const { data: billingRow } = await supabase.from('monthly_billing').select('*')
    .eq('property_id', property.id).eq('year', year).eq('month', month).maybeSingle()
  const billing = billingRow ?? {
    total_revenue: 0, google_investment: 0, meta_investment: 0, content_investment: 0,
    fees: 0, total_investment: 0, ad_cost_pct: 0, roas: 0, clicks: 0, impressions: 0, cpc: 0,
    booking_volume: null, booking_count: null,
  }

  const attrSources = property.attributable_sources ?? []
  const propertyId  = property.cloudbeds_property_id ?? '212206'

  const [insightsMetrics, arrivals, countryProduction, stayDist] = await Promise.all([
    getInsightsBookingMetrics(apiKey, propertyId, year, month, attrSources),
    getReservations(apiKey, {
      checkInFrom: `${year}-${pad(month)}-01`,
      checkInTo:   `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`,
      status: 'not_confirmed,confirmed,checked_in,checked_out,no_show',
    }),
    getProductionByCountry(apiKey, propertyId, year, month, attrSources),
    bookingStayDistribution(apiKey, propertyId, year, month, attrSources),
  ])

  let guests = 0, nights = 0
  for (const r of arrivals) {
    if (r.status === 'cancelled') continue
    guests += parseInt(r.adults || '0') + parseInt(r.children || '0')
    nights += Math.round((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / 86_400_000)
  }

  const totalCountryRevenue = countryProduction.reduce((s, c) => s + c.revenue, 0) || 1
  const geoBreakdown: GeoBreakdown[] = countryProduction.slice(0, 6).map(c => ({
    country: c.country, country_code: '', revenue: c.revenue, bookings: c.bookings,
    pct: pct(c.revenue, totalCountryRevenue),
  }))

  const totalRooms = insightsMetrics.topRoomTypes.reduce((s, r) => s + r.count, 0) || 1
  const roomBreakdown: RoomCategoryBreakdown[] = insightsMetrics.topRoomTypes
    .filter(r => !r.name.includes(','))
    .map(r => ({ category_name: r.name, revenue: r.revenue, bookings: r.count, pct: pct(r.count, totalRooms) }))

  const payload = {
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
    bookingStayDistribution: stayDist,
    billing: {
      totalRevenue: billing.total_revenue, googleInvestment: billing.google_investment,
      metaInvestment: billing.meta_investment, contentInvestment: billing.content_investment,
      fees: billing.fees, totalInvestment: billing.total_investment, adCostPct: billing.ad_cost_pct,
      roas: billing.roas, clicks: billing.clicks, impressions: billing.impressions, cpc: billing.cpc,
    },
    _meta: { arrivals: arrivals.length, bookingCount: insightsMetrics.bookingCount, geoCountries: countryProduction.length, geoTotal: Math.round(totalCountryRevenue), dataSource: 'insights+pms+supabase' },
  }

  const { error } = await supabase.from('monthly_dashboard_cache').upsert(
    { property_id: property.id, year, month, payload, refreshed_at: new Date().toISOString() },
    { onConflict: 'property_id,year,month' },
  )
  if (error) console.error('[buildMonthReport] cache upsert:', error.message)

  return payload
}
