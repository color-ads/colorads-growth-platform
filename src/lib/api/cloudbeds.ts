/**
 * Cloudbeds API Client — v1.2
 * Base URL: https://hotels.cloudbeds.com/api/v1.2/
 * Auth: API Key (Bearer token) — sin OAuth, sin refresh tokens
 *
 * Deprecation note: v1.1 fue deprecada en marzo 2025.
 */

const CLOUDBEDS_BASE = 'https://hotels.cloudbeds.com/api/v1.2'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CloudbedsReservation {
  reservationID: string
  guestName: string
  guestEmail: string
  status: 'not_confirmed' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show'
  dateCreated: string    // 'YYYY-MM-DD' — cuando se hizo la reserva (booking date)
  checkIn: string        // 'YYYY-MM-DD'
  checkOut: string       // 'YYYY-MM-DD'
  nights: number
  adults: number
  children: number
  countryCode: string
  country: string
  grandTotal: string     // string decimal, COP
  balance: string
  amountPaid: string
  sourceName: string     // "Sitio web o motor de reservas", "WALK IN", etc.
  rooms: CloudbedsRoom[]
}

export interface CloudbedsRoom {
  roomID: string
  roomName: string
  roomTypeName: string
  roomTypeID: string
  roomTotal: string
}

export interface CloudbedsHotel {
  propertyID: string
  propertyName: string
  propertyCity: string
  propertyCountry: string
  propertyCurrency: string
}

// ─── Core request ─────────────────────────────────────────────────────────────

async function request<T>(
  apiKey: string,
  endpoint: string,
  params: Record<string, string> = {},
): Promise<T> {
  const url = new URL(`${CLOUDBEDS_BASE}/${endpoint}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
    next: { revalidate: 0 },
  })

  if (res.status === 401) throw new Error('CLOUDBEDS_INVALID_KEY')
  if (res.status === 403) throw new Error('CLOUDBEDS_FORBIDDEN')
  if (!res.ok) throw new Error(`Cloudbeds ${res.status}: ${await res.text()}`)

  const json = await res.json()
  if (!json.success) throw new Error(`Cloudbeds error: ${json.message}`)
  return json as T
}

// ─── Hotel Details ────────────────────────────────────────────────────────────

export async function getHotelDetails(apiKey: string): Promise<CloudbedsHotel> {
  const data = await request<{ data: CloudbedsHotel }>(apiKey, 'getHotels')
  return Array.isArray(data.data) ? data.data[0] : data.data
}

// ─── Reservations ─────────────────────────────────────────────────────────────

interface GetReservationsParams {
  createdFrom?:   string  // YYYY-MM-DD — booking date desde
  createdTo?:     string  // YYYY-MM-DD — booking date hasta
  checkInFrom?:   string  // YYYY-MM-DD — check-in desde
  checkInTo?:     string  // YYYY-MM-DD — check-in hasta
  checkOutFrom?:  string
  checkOutTo?:    string
  status?:        string  // comma-separated
}

/**
 * Fetch ALL reservations, paginando automáticamente.
 */
export async function getReservations(
  apiKey: string,
  params: GetReservationsParams,
): Promise<CloudbedsReservation[]> {
  const PAGE_SIZE = 100
  const all: CloudbedsReservation[] = []
  let page = 1
  let total = Infinity

  while (all.length < total) {
    const q: Record<string, string> = {
      pageNumber: String(page),
      pageSize:   String(PAGE_SIZE),
      includeGuestsDetails: '1',
      status: params.status ?? 'confirmed,checked_in,checked_out,no_show',
    }

    if (params.createdFrom)  q.dateFrom     = params.createdFrom
    if (params.createdTo)    q.dateTo       = params.createdTo
    if (params.checkInFrom)  q.checkInFrom  = params.checkInFrom
    if (params.checkInTo)    q.checkInTo    = params.checkInTo
    if (params.checkOutFrom) q.checkOutFrom = params.checkOutFrom
    if (params.checkOutTo)   q.checkOutTo   = params.checkOutTo

    const res = await request<{
      data: CloudbedsReservation[]
      count: number
      totalResults: number
    }>(apiKey, 'getReservations', q)

    all.push(...res.data)
    total = res.totalResults
    page++

    if (res.data.length === 0) break
  }

  return all
}

/**
 * Fetch reservas del mes en DOS agrupaciones:
 *   byBookingDate → reservas HECHAS en el mes (Bloque C: volumen de reservas)
 *   byArrival     → reservas con CHECK-IN en el mes (KPI strip: huéspedes/noches)
 */
export async function getMonthReservations(
  apiKey: string,
  year: number,
  month: number,
) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const firstDay = `${year}-${pad(month)}-01`
  const lastDay  = new Date(year, month, 0).getDate()
  const lastDayStr = `${year}-${pad(month)}-${pad(lastDay)}`

  const [byBookingDate, byArrival] = await Promise.all([
    // Reservas HECHAS en este mes (por booking date)
    getReservations(apiKey, {
      createdFrom: firstDay,
      createdTo:   lastDayStr,
      status: 'confirmed,checked_in,checked_out,no_show',
    }),
    // Reservas con llegada en este mes
    getReservations(apiKey, {
      checkInFrom: firstDay,
      checkInTo:   lastDayStr,
      status: 'not_confirmed,confirmed,checked_in,checked_out,no_show',
    }),
  ])

  return { byBookingDate, byArrival }
}
