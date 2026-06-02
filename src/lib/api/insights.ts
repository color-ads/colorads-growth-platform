const INSIGHTS_BASE = 'https://api.cloudbeds.com/datainsights/v1.1'

export interface InsightsMonthResult {
  bookingVolume: number; bookingCount: number; avgTicket: number; avgNightsPerBooking: number
  leadTime: { moreThan30: number; ten30: number; six9: number; one5: number; lastMinute: number }
  topRoomTypes: { name: string; revenue: number; count: number }[]
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

async function insightsQuery(
  apiKey: string, propertyId: string, from: string, to: string,
): Promise<{ headers: string[]; records: Record<string, unknown[]>; index: unknown[][] }> {
  const url = `${INSIGHTS_BASE}/stock_reports/17/query/data?mode=Run`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'X-PROPERTY-ID': propertyId, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      property_ids: [parseInt(propertyId)],
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
  const rooms = new Map<string, { revenue: number; count: number }>()

  for (let i = 0; i < n; i++) {
    const source  = String(records.reservation_source?.[i] ?? '')
    const total   = toNum(records.grand_total_amount?.[i])
    const nights  = toNum(records.room_nights_count?.[i])
    const status  = String(records.reservation_status?.[i] ?? '')
    const checkin = String(records.checkin_date?.[i] ?? '')
    const bkDate  = Array.isArray(index[i]) ? String(index[i][0]) : String(index[i])
    const rawRoom = String(records.room_types?.[i] ?? '').split(',')[0].replace(/\s*\(.*?\)/g, '').trim()

    if      (status === 'Checked Out')                                    st.checkedOut++
    else if (status === 'Confirmed' || status === 'Confirmation Pending') st.confirmed++
    else if (status === 'No Show')                                        st.noShow++
    else if (status === 'In-House')                                       st.staying++
    else if (status === 'Cancelled')                                      st.cancelled++

    if (status === 'Cancelled') continue

    if (attributableSources.includes(source)) {
      if (rawRoom) {
        const r = rooms.get(rawRoom) ?? { revenue: 0, count: 0 }
        rooms.set(rawRoom, { revenue: r.revenue + total, count: r.count + 1 })
      }
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
    topRoomTypes: [...rooms.entries()].sort(([,a],[,b]) => b.revenue - a.revenue).slice(0,6)
      .map(([name, d]) => ({ name, revenue: Math.round(d.revenue), count: d.count })),
    reservationStatus: { checkedOut: pct(st.checkedOut, totalSt), confirmed: pct(st.confirmed, totalSt), cancelled: pct(st.cancelled, totalSt), noShow: pct(st.noShow, totalSt), staying: pct(st.staying, totalSt) },
  }
}

// ─── Venta (producción) por país del huésped — report 34 ──────────────────
// Nombres de país vienen en inglés desde Cloudbeds; los mapeamos a español.
const COUNTRY_ES: Record<string, string> = {
  'United States of America': 'Estados Unidos', 'United States': 'Estados Unidos',
  'Colombia': 'Colombia', 'Puerto Rico': 'Puerto Rico', 'Mexico': 'México',
  'Dominican Republic': 'Rep. Dominicana', 'Canada': 'Canadá', 'Venezuela': 'Venezuela',
  'Ecuador': 'Ecuador', 'Costa Rica': 'Costa Rica', 'Spain': 'España', 'Aruba': 'Aruba',
  'Cuba': 'Cuba', 'Panama': 'Panamá', 'Honduras': 'Honduras', 'Peru': 'Perú',
  'Chile': 'Chile', 'Brazil': 'Brasil', 'Argentina': 'Argentina', 'Guatemala': 'Guatemala',
  'Nicaragua': 'Nicaragua', 'El Salvador': 'El Salvador', 'Bolivia': 'Bolivia',
  'Germany': 'Alemania', 'United Kingdom': 'Reino Unido', 'Netherlands': 'Países Bajos',
  'Curacao': 'Curazao', 'Jamaica': 'Jamaica', 'Trinidad and Tobago': 'Trinidad y Tobago',
  'Suriname': 'Surinam', 'Switzerland': 'Suiza', 'Australia': 'Australia', 'China': 'China',
  'India': 'India', 'Israel': 'Israel', 'Poland': 'Polonia', 'Portugal': 'Portugal',
  'Russia': 'Rusia', 'France': 'Francia', 'Italy': 'Italia',
}

export interface CountryProduction { country: string; revenue: number; bookings: number }

// Venta REAL atribuible por país, por fecha de reserva (booking date), excluyendo canceladas.
// Report 34 "Production by Guest Country" (dataset 3): el país es la dimensión de
// agrupación (viene en `index`), y cada fila trae reservation_source + grand_total_amount.
export async function getProductionByCountry(
  apiKey: string, propertyId: string, year: number, month: number, attributableSources: string[],
): Promise<CountryProduction[]> {
  const pad = (n: number) => String(n).padStart(2, '0')
  const ny = month === 12 ? year + 1 : year
  const nm = month === 12 ? 1 : month + 1
  const from = `${year}-${pad(month)}-01T00:00:00`
  const to   = `${ny}-${pad(nm)}-01T00:00:00`

  const res = await fetch(`${INSIGHTS_BASE}/stock_reports/34/query/data?mode=Run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'X-PROPERTY-ID': propertyId, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      property_ids: [parseInt(propertyId)],
      filters: { and: [
        { cdf: { type: 'default', column: 'booking_datetime_property_timezone' }, operator: 'greater_than_or_equal', value: from },
        { cdf: { type: 'default', column: 'booking_datetime_property_timezone' }, operator: 'less_than', value: to },
        // excluir canceladas (report 34 no expone reservation_status como columna, sí como filtro)
        { cdf: { type: 'default', column: 'reservation_status' }, operator: 'list_contains',
          value: ['No Show', 'Confirmed', 'Checked Out', 'In-House', 'Confirmation Pending'] },
      ]},
      settings: { details: true, totals: false, subtotals: false, transpose: false },
    }),
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`Insights API (report 34) ${res.status}: ${await res.text()}`)
  const data = await res.json()
  if (data.error) throw new Error(`Insights error (report 34): ${JSON.stringify(data.error)}`)

  const records: Record<string, unknown[]> = data.records ?? {}
  const index: unknown[][] = data.index ?? []
  const src = records.reservation_source ?? []
  const gt  = records.grand_total_amount ?? []
  const n = index.length

  const byCountry = new Map<string, { revenue: number; bookings: number }>()
  for (let i = 0; i < n; i++) {
    const raw = Array.isArray(index[i]) ? String(index[i][0] ?? '') : String(index[i] ?? '')
    if (!raw || raw === '-') continue                         // país desconocido
    if (!attributableSources.includes(String(src[i] ?? ''))) continue  // solo atribuible
    const revenue = toNum(gt[i])
    const cur = byCountry.get(raw) ?? { revenue: 0, bookings: 0 }
    byCountry.set(raw, { revenue: cur.revenue + revenue, bookings: cur.bookings + 1 })
  }

  return [...byCountry.entries()]
    .map(([country, d]) => ({ country: COUNTRY_ES[country] ?? country, revenue: Math.round(d.revenue), bookings: d.bookings }))
    .sort((a, b) => b.revenue - a.revenue)
}
