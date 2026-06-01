/**
 * Cloudbeds API Client — v1.2
 * Auth: API Key (Bearer)
 * Pagination: stop when data.length < PAGE_SIZE (last page)
 */

const CLOUDBEDS_BASE = 'https://hotels.cloudbeds.com/api/v1.2'

export interface CloudbedsGuestRoom {
  roomTypeName: string
  roomTypeID: string
  roomCheckIn: string
  roomCheckOut: string
}

export interface CloudbedsGuest {
  guestID: string
  guestCountry: string   // ISO 2-letter: "US", "CO"
  isMainGuest: boolean
  startDate: string
  endDate: string
  rooms: CloudbedsGuestRoom[]
}

export interface CloudbedsReservation {
  reservationID: string
  status: string         // 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show'
  dateCreated: string    // 'YYYY-MM-DD HH:MM:SS' — booking datetime
  startDate: string      // 'YYYY-MM-DD' — check-in
  endDate: string        // 'YYYY-MM-DD' — check-out
  adults: string         // "1", "2"
  children: string       // "0", "1"
  balance: string
  sourceName: string
  guestName: string
  guestList: Record<string, CloudbedsGuest>
}

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
  if (!res.ok) throw new Error(`Cloudbeds ${res.status}: ${await res.text()}`)
  const json = await res.json()
  if (!json.success) throw new Error(`Cloudbeds error: ${json.message}`)
  return json as T
}

export async function getReservations(
  apiKey: string,
  params: {
    createdFrom?: string
    createdTo?: string
    checkInFrom?: string
    checkInTo?: string
    status?: string
  },
): Promise<CloudbedsReservation[]> {
  const PAGE_SIZE = 100
  const all: CloudbedsReservation[] = []
  let page = 1

  while (true) {
    const q: Record<string, string> = {
      pageNumber: String(page),
      pageSize: String(PAGE_SIZE),
      includeGuestsDetails: '1',
      status: params.status ?? 'confirmed,checked_in,checked_out,no_show',
    }
    if (params.createdFrom)  q.dateFrom    = params.createdFrom
    if (params.createdTo)    q.dateTo      = params.createdTo
    if (params.checkInFrom)  q.checkInFrom = params.checkInFrom
    if (params.checkInTo)    q.checkInTo   = params.checkInTo

    const res = await request<{
      data: CloudbedsReservation[]
      count: number
      total: number
    }>(apiKey, 'getReservations', q)

    all.push(...res.data)

    // Última página: menos resultados que el tamaño de página
    if (res.data.length < PAGE_SIZE) break
    // Safety limit: máx 2000 reservas por query
    if (page >= 20) break

    page++
  }

  return all
}

export async function getMonthReservations(
  apiKey: string,
  year: number,
  month: number,
) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const firstDay   = `${year}-${pad(month)}-01`
  const lastDayNum = new Date(year, month, 0).getDate()
  const lastDay    = `${year}-${pad(month)}-${pad(lastDayNum)}`

  const [byBookingDate, byArrival] = await Promise.all([
    getReservations(apiKey, {
      createdFrom: firstDay,
      createdTo: lastDay,
    }),
    getReservations(apiKey, {
      checkInFrom: firstDay,
      checkInTo: lastDay,
      status: 'not_confirmed,confirmed,checked_in,checked_out,no_show',
    }),
  ])

  return { byBookingDate, byArrival }
}
