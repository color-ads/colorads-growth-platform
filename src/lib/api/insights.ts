/**
 * Cloudbeds Data Insights API Client — v3
 * Incluye revenue por país y habitación directamente desde Data Insights
 */

const INSIGHTS_BASE = 'https://api.cloudbeds.com/datainsights/v1.1'

export interface InsightsMonthResult {
  bookingVolume:       number
  bookingCount:        number
  avgTicket:           number
  avgNightsPerBooking: number
  leadTime: {
    moreThan30: number; ten30: number; six9: number; one5: number; lastMinute: number
  }
  topRoomTypes: { name: string; revenue: number; count: number }[]
  topCountries:  { name: string; code: string; revenue: number; count: number }[]
  reservationStatus: {
    checkedOut: number; confirmed: number; cancelled: number; noShow: number; staying: number
  }
}

function toNum(v: unknown): number {
  if (v == null || v === '-') return 0
  const n = parseFloat(String(v).replace(/,/g, ''))
  return isNaN(n) ? 0 : n
}

function pct(n: number, total: number) {
  return total > 0 ? Math.round((n / total) * 1000) / 10 : 0
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000)
}

async function insightsQuery(
  apiKey: string,
  propertyId: string,
  stockReportId: number,
  filterOverride: object,
  extraColumns?: object[],
): Promise<{ headers: string[]; records: Record<string, unknown[]>; index: unknown[][] }> {
  const url = `${INSIGHTS_BASE}/stock_reports/${stockReportId}/query/data?mode=Run`

  const body: Record<string, unknown> = {
    property_ids: [parseInt(propertyId)],
    filters:  filterOverride,
    settings: { details: true, totals: false, subtotals: false, transpose: false },
  }

  // Add extra columns to the existing report columns
  if (extraColumns && extraColumns.length > 0) {
    body.columns = [
      // Keep default report columns
      { cdf: { type: 'default', column: 'reservation_source' } },
      { cdf: { type: 'default', column: 'reservation_status' } },
      { cdf: { type: 'default', column: 'room_types' } },
      { cdf: { type: 'default', column: 'checkin_date' } },
      { cdf: { type: 'default', column: 'checkout_date' } },
      { cdf: { type: 'default', column: 'room_nights_count' }, metrics: ['sum'] },
      { cdf: { type: 'default', column: 'guest_count' }, metrics: ['sum'] },
      { cdf: { type: 'default', column: 'grand_total_amount' }, metrics: ['sum'] },
      // Extra columns
      ...extraColumns,
    ]
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization:   `Bearer ${apiKey}`,
      'X-PROPERTY-ID': propertyId,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
    next: { revalidate: 0 },
  })

  if (!res.ok) throw new Error(`Insights API ${res.status}: ${await res.text()}`)
  const data = await res.json()
  if (data.error) throw new Error(`Insights error: ${JSON.stringify(data.error)}`)
  return data
}

export async function getInsightsBookingMetrics(
  apiKey: string,
  propertyId: string,
  year: number,
  month: number,
  attributableSources: string[],
): Promise<InsightsMonthResult> {
  const pad       = (n: number) => String(n).padStart(2, '0')
  const from      = `${year}-${pad(month)}-01T00:00:00`
  const nextYear  = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const to        = `${nextYear}-${pad(nextMonth)}-01T00:00:00`

  const data = await insightsQuery(
    apiKey, propertyId, 17,
    {
      and: [
        { cdf: { type: 'default', column: 'booking_datetime_property_timezone' },
          operator: 'greater_than_or_equal', value: from },
        { cdf: { type: 'default', column: 'booking_datetime_property_timezone' },
          operator: 'less_than', value: to },
        { cdf: { type: 'default', column: 'reservation_status' },
          operator: 'list_contains',
          value: ['No Show', 'Confirmed', 'Checked Out', 'In-House', 'Confirmation Pending', 'Cancelled'] },
      ],
    },
    // Add country columns
    [
      { cdf: { type: 'default', column: 'primary_guest_residence_country' } },
      { cdf: { type: 'default', column: 'primary_guest_residence_country_code' } },
    ],
  )

  const { records, index } = data
  const n = index.length

  let bookingVolume = 0
  let bookingCount  = 0
  let bookingNights = 0

  const lt    = { moreThan30: 0, ten30: 0, six9: 0, one5: 0, lastMinute: 0 }
  const st    = { checkedOut: 0, confirmed: 0, cancelled: 0, noShow: 0, staying: 0 }
  const rooms    = new Map<string, { revenue: number; count: number }>()
  const countries = new Map<string, { code: string; revenue: number; count: number }>()

  for (let i = 0; i < n; i++) {
    const source      = String(records.reservation_source?.[i] ?? '')
    const total       = toNum(records.grand_total_amount?.[i])
    const nights      = toNum(records.room_nights_count?.[i])
    const status      = String(records.reservation_status?.[i] ?? '')
    const checkinDate = String(records.checkin_date?.[i] ?? '')
    const bookingDate = Array.isArray(index[i]) ? String(index[i][0]) : String(index[i])
    const rawRoom     = String(records.room_types?.[i] ?? '').replace(/\s*\(.*?\)/g, '').trim()
    const countryName = String(records.primary_guest_residence_country?.[i] ?? '')
    const countryCode = String(records.primary_guest_residence_country_code?.[i] ?? '')

    // Status distribution (todos los canales)
    if      (status === 'Checked Out')                                    st.checkedOut++
    else if (status === 'Confirmed' || status === 'Confirmation Pending')  st.confirmed++
    else if (status === 'No Show')                                         st.noShow++
    else if (status === 'In-House')                                        st.staying++
    else if (status === 'Cancelled')                                       st.cancelled++

    // Skip cancelled for financial metrics
    if (status === 'Cancelled') continue

    // Room and country totals (attributable only)
    if (attributableSources.includes(source)) {
      if (rawRoom) {
        const r = rooms.get(rawRoom) ?? { revenue: 0, count: 0 }
        rooms.set(rawRoom, { revenue: r.revenue + total, count: r.count + 1 })
      }
      const cname = countryName || countryCode || 'Desconocido'
      if (cname && cname !== 'Desconocido' && cname !== '-') {
        const c = countries.get(cname) ?? { code: countryCode, revenue: 0, count: 0 }
        countries.set(cname, { code: countryCode, revenue: c.revenue + total, count: c.count + 1 })
      }
    }

    // Booking volume (attributable only)
    if (!attributableSources.includes(source)) continue

    bookingVolume += total
    bookingCount  += 1
    bookingNights += nights

    // Lead time from dates
    if (bookingDate && checkinDate) {
      const days = daysBetween(bookingDate, checkinDate)
      if      (days <= 0)  lt.lastMinute++
      else if (days <= 5)  lt.one5++
      else if (days <= 9)  lt.six9++
      else if (days <= 30) lt.ten30++
      else                 lt.moreThan30++
    }
  }

  const totalSt = Object.values(st).reduce((a, b) => a + b, 0)
  const totalLt = Object.values(lt).reduce((a, b) => a + b, 0)

  return {
    bookingVolume,
    bookingCount,
    avgTicket:           bookingCount > 0 ? Math.round(bookingVolume / bookingCount) : 0,
    avgNightsPerBooking: bookingCount > 0 ? Math.round((bookingNights / bookingCount) * 10) / 10 : 0,
    leadTime: {
      moreThan30: pct(lt.moreThan30, totalLt), ten30: pct(lt.ten30, totalLt),
      six9: pct(lt.six9, totalLt), one5: pct(lt.one5, totalLt), lastMinute: pct(lt.lastMinute, totalLt),
    },
    topRoomTypes: [...rooms.entries()]
      .sort(([, a], [, b]) => b.revenue - a.revenue).slice(0, 6)
      .map(([name, d]) => ({ name, revenue: Math.round(d.revenue), count: d.count })),
    topCountries: [...countries.entries()]
      .sort(([, a], [, b]) => b.revenue - a.revenue).slice(0, 6)
      .map(([name, d]) => ({ name, code: d.code, revenue: Math.round(d.revenue), count: d.count })),
    reservationStatus: {
      checkedOut: pct(st.checkedOut, totalSt), confirmed: pct(st.confirmed, totalSt),
      cancelled:  pct(st.cancelled,  totalSt), noShow:    pct(st.noShow,    totalSt),
      staying:    pct(st.staying,    totalSt),
    },
  }
}
