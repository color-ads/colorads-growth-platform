const INSIGHTS_BASE = 'https://api.cloudbeds.com/datainsights/v1.1'

export interface InsightsMonthResult {
  bookingVolume: number; bookingCount: number; avgTicket: number; avgNightsPerBooking: number
  leadTime: { moreThan30: number; ten30: number; six9: number; one5: number; lastMinute: number }
  topRoomTypes:  { name: string; revenue: number; count: number }[]
  topCountries:  { name: string; code: string; revenue: number; count: number }[]
  reservationStatus: { checkedOut: number; confirmed: number; cancelled: number; noShow: number; staying: number }
}

function toNum(v: unknown): number {
  if (v == null || v === '-') return 0
  const n = parseFloat(String(v).replace(/,/g, ''))
  return isNaN(n) ? 0 : n
}
function pct(n: number, t: number) { return t > 0 ? Math.round((n / t) * 1000) / 10 : 0 }
function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000)
}

// Full column list for report 17 + country columns
const REPORT_17_COLUMNS = [
  { cdf: { type: 'default', column: 'reservation_number' } },
  { cdf: { type: 'default', column: 'reservation_status' } },
  { cdf: { type: 'default', column: 'room_types' } },
  { cdf: { type: 'default', column: 'reservation_source' } },
  { cdf: { type: 'default', column: 'reservation_source_category' } },
  { cdf: { type: 'default', column: 'primary_guest_full_name' } },
  { cdf: { type: 'default', column: 'is_hotel_collect_booking' } },
  { cdf: { type: 'default', column: 'group_profile_name' } },
  { cdf: { type: 'default', column: 'public_rate_plan' } },
  { cdf: { type: 'default', column: 'checkin_date' } },
  { cdf: { type: 'default', column: 'checkout_date' } },
  { cdf: { type: 'default', column: 'room_nights_count' }, metrics: ['sum'] },
  { cdf: { type: 'default', column: 'guest_count' }, metrics: ['sum'] },
  { cdf: { type: 'default', column: 'deposit_amount' }, metrics: ['sum'] },
  { cdf: { type: 'default', column: 'grand_total_amount' }, metrics: ['sum'] },
  { cdf: { type: 'default', column: 'room_revenue_total_amount' }, metrics: ['sum'] },
  { cdf: { type: 'default', column: 'taxes_value_amount' }, metrics: ['sum'] },
  { cdf: { type: 'default', column: 'reservation_paid_amount' }, metrics: ['sum'] },
  { cdf: { type: 'default', column: 'reservation_balance_due_amount' }, metrics: ['sum'] },
  // Extra country fields
  { cdf: { type: 'default', column: 'primary_guest_residence_country' } },
  { cdf: { type: 'default', column: 'primary_guest_residence_country_code' } },
]

async function insightsQuery(
  apiKey: string, propertyId: string, from: string, to: string,
): Promise<{ headers: string[]; records: Record<string, unknown[]>; index: unknown[][] }> {
  const url = `${INSIGHTS_BASE}/stock_reports/17/query/data?mode=Run`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'X-PROPERTY-ID': propertyId, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      property_ids: [parseInt(propertyId)],
      columns: REPORT_17_COLUMNS,
      filters: { and: [
        { cdf: { type: 'default', column: 'booking_datetime_property_timezone' }, operator: 'greater_than_or_equal', value: from },
        { cdf: { type: 'default', column: 'booking_datetime_property_timezone' }, operator: 'less_than', value: to },
        { cdf: { type: 'default', column: 'reservation_status' }, operator: 'list_contains',
          value: ['No Show', 'Confirmed', 'Checked Out', 'In-House', 'Confirmation Pending', 'Cancelled'] },
      ]},
      settings: { details: true, totals: false, subtotals: false, transpose: false },
    }),
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`Insights API ${res.status}: ${await res.text()}`)
  const data = await res.json()
  if (data.error) throw new Error(`Insights error: ${JSON.stringify(data.error)}`)
  return data
}

export async function getInsightsBookingMetrics(
  apiKey: string, propertyId: string, year: number, month: number, attributableSources: string[],
): Promise<InsightsMonthResult> {
  const pad = (n: number) => String(n).padStart(2, '0')
  const ny = month === 12 ? year + 1 : year
  const nm = month === 12 ? 1 : month + 1
  const data = await insightsQuery(apiKey, propertyId, `${year}-${pad(month)}-01T00:00:00`, `${ny}-${pad(nm)}-01T00:00:00`)
  const { records, index } = data
  const n = index.length

  let bookingVolume = 0, bookingCount = 0, bookingNights = 0
  const lt = { moreThan30: 0, ten30: 0, six9: 0, one5: 0, lastMinute: 0 }
  const st = { checkedOut: 0, confirmed: 0, cancelled: 0, noShow: 0, staying: 0 }
  const rooms     = new Map<string, { revenue: number; count: number }>()
  const countries = new Map<string, { code: string; revenue: number; count: number }>()

  for (let i = 0; i < n; i++) {
    const source  = String(records.reservation_source?.[i] ?? '')
    const total   = toNum(records.grand_total_amount?.[i])
    const nights  = toNum(records.room_nights_count?.[i])
    const status  = String(records.reservation_status?.[i] ?? '')
    const checkin = String(records.checkin_date?.[i] ?? '')
    const bkDate  = Array.isArray(index[i]) ? String(index[i][0]) : String(index[i])
    const rawRoom = String(records.room_types?.[i] ?? '').replace(/\s*\(.*?\)/g, '').trim()
    const cname   = String(records.primary_guest_residence_country?.[i] ?? '')
    const ccode   = String(records.primary_guest_residence_country_code?.[i] ?? '')

    if      (status === 'Checked Out')                                    st.checkedOut++
    else if (status === 'Confirmed' || status === 'Confirmation Pending') st.confirmed++
    else if (status === 'No Show')                                        st.noShow++
    else if (status === 'In-House')                                       st.staying++
    else if (status === 'Cancelled')                                      st.cancelled++

    if (status === 'Cancelled') continue

    const isAttr = attributableSources.includes(source)
    if (isAttr) {
      if (rawRoom) { const r = rooms.get(rawRoom) ?? { revenue: 0, count: 0 }; rooms.set(rawRoom, { revenue: r.revenue + total, count: r.count + 1 }) }
      if (cname && cname !== '-') { const c = countries.get(cname) ?? { code: ccode, revenue: 0, count: 0 }; countries.set(cname, { code: ccode, revenue: c.revenue + total, count: c.count + 1 }) }
      bookingVolume += total; bookingCount += 1; bookingNights += nights
      if (bkDate && checkin) {
        const d = daysBetween(bkDate, checkin)
        if (d <= 0) lt.lastMinute++; else if (d <= 5) lt.one5++; else if (d <= 9) lt.six9++; else if (d <= 30) lt.ten30++; else lt.moreThan30++
      }
    }
  }

  const totalSt = Object.values(st).reduce((a, b) => a + b, 0)
  const totalLt = Object.values(lt).reduce((a, b) => a + b, 0)
  return {
    bookingVolume, bookingCount,
    avgTicket:           bookingCount > 0 ? Math.round(bookingVolume / bookingCount) : 0,
    avgNightsPerBooking: bookingCount > 0 ? Math.round((bookingNights / bookingCount) * 10) / 10 : 0,
    leadTime: { moreThan30: pct(lt.moreThan30, totalLt), ten30: pct(lt.ten30, totalLt), six9: pct(lt.six9, totalLt), one5: pct(lt.one5, totalLt), lastMinute: pct(lt.lastMinute, totalLt) },
    topRoomTypes: [...rooms.entries()].sort(([,a],[,b]) => b.revenue - a.revenue).slice(0,6).map(([name,d]) => ({ name, revenue: Math.round(d.revenue), count: d.count })),
    topCountries: [...countries.entries()].sort(([,a],[,b]) => b.revenue - a.revenue).slice(0,6).map(([name,d]) => ({ name, code: d.code, revenue: Math.round(d.revenue), count: d.count })),
    reservationStatus: { checkedOut: pct(st.checkedOut, totalSt), confirmed: pct(st.confirmed, totalSt), cancelled: pct(st.cancelled, totalSt), noShow: pct(st.noShow, totalSt), staying: pct(st.staying, totalSt) },
  }
}
