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
