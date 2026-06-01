/**
 * Cloudbeds API Client — v1.2
 */

const CLOUDBEDS_BASE = 'https://hotels.cloudbeds.com/api/v1.2'

export interface CloudbedsGuestRoom {
  roomTypeName: string
  roomTypeID: string
}

export interface CloudbedsGuest {
  guestID: string
  guestCountry: string
  isMainGuest: boolean
  rooms: CloudbedsGuestRoom[]
}

export interface CloudbedsReservation {
  reservationID: string
  status: string
  dateCreated: string    // 'YYYY-MM-DD HH:MM:SS'
  startDate: string      // check-in 'YYYY-MM-DD'
  endDate: string        // check-out 'YYYY-MM-DD'
  adults: string
  children: string
  balance: string
  sourceName: string
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
    if (params.checkInFrom) q.checkInFrom = params.checkInFrom
    if (params.checkInTo)   q.checkInTo   = params.checkInTo

    const res = await request<{
      data: CloudbedsReservation[]
      count: number
    }>(apiKey, 'getReservations', q)

    all.push(...res.data)
    if (res.data.length < PAGE_SIZE) break
    if (page >= 20) break
    page++
  }
  return all
}

/**
 * Fetch the total (grandTotal) for a single reservation.
 * Returns 0 on error to avoid crashing the whole batch.
 */
export async function getReservationTotal(
  apiKey: string,
  reservationID: string,
): Promise<number> {
  try {
    const res = await request<{ data: { total: number } }>(
      apiKey,
      'getReservation',
      { reservationID },
    )
    return res.data?.total ?? 0
  } catch {
    return 0
  }
}

/**
 * Batch-fetch totals for multiple reservations with concurrency control.
 */
export async function getReservationTotals(
  apiKey: string,
  reservationIDs: string[],
  concurrency = 10,
): Promise<Map<string, number>> {
  const results = new Map<string, number>()
  for (let i = 0; i < reservationIDs.length; i += concurrency) {
    const batch = reservationIDs.slice(i, i + concurrency)
    const fetched = await Promise.all(
      batch.map(async id => ({
        id,
        total: await getReservationTotal(apiKey, id),
      })),
    )
    fetched.forEach(({ id, total }) => results.set(id, total))
  }
  return results
}

/**
 * Fetch all reservations for a month + totals for attributable bookings.
 *
 * byArrival    = check-in in this month (huéspedes/noches/demografía)
 * byBookingDate = reservas CREADAS este mes (filtrado client-side por dateCreated)
 * bookingVolume = COP suma de totals de reservas atribuibles creadas este mes
 */
export async function getMonthData(
  apiKey: string,
  year: number,
  month: number,
  attributableSources: string[],
) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const firstDay   = `${year}-${pad(month)}-01`
  const lastDayNum = new Date(year, month, 0).getDate()
  const lastDay    = `${year}-${pad(month)}-${pad(lastDayNum)}`
  const monthPrefix = `${year}-${pad(month)}`

  // Arrivals del mes (para huéspedes, noches, demografía)
  const byArrival = await getReservations(apiKey, {
    checkInFrom: firstDay,
    checkInTo:   lastDay,
    status: 'not_confirmed,confirmed,checked_in,checked_out,no_show',
  })

  // Reservas CREADAS este mes: filtrar byArrival por dateCreated
  // Nota: esto captura reservas hechas en el mes para llegadas del mismo mes.
  // Reservas hechas en el mes para llegadas futuras se pierden (limitación API v1.2)
  const byBookingDate = byArrival.filter(r =>
    r.dateCreated.startsWith(monthPrefix) && r.status !== 'cancelled',
  )

  // Para las atribuibles, buscar el total real (COP)
  const attrBookings = byBookingDate.filter(r =>
    attributableSources.includes(r.sourceName),
  )

  let bookingVolume = 0
  if (attrBookings.length > 0) {
    const totals = await getReservationTotals(
      apiKey,
      attrBookings.map(r => r.reservationID),
    )
    bookingVolume = [...totals.values()].reduce((sum, t) => sum + t, 0)
  }

  return {
    byArrival,
    byBookingDate,
    bookingVolume,
    bookingCount: attrBookings.length,
  }
}
