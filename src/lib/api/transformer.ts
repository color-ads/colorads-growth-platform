import type { CloudbedsReservation, CloudbedsGuest } from './cloudbeds'

export interface BillingData {
  totalRevenue: number
  googleInvestment: number
  metaInvestment: number
  contentInvestment: number
  fees: number
  totalInvestment: number
  adCostPct: number
  roas: number
  clicks: number
  impressions: number
  cpc: number
}

export interface DashboardMetrics {
  totalRevenue: number
  attributableRevenue: number
  guests: number
  nights: number
  bookingVolume: number
  bookingCount: number
  avgTicket: number
  avgNightsPerBooking: number
  reservationStatus: {
    checkedOut: number
    confirmed: number
    cancelled: number
    noShow: number
    staying: number
  }
  leadTime: {
    moreThan30: number
    ten30: number
    six9: number
    one5: number
    lastMinute: number
  }
  topCountries: { name: string; count: number }[]
  topRoomTypes: { name: string; count: number }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcNights(startDate: string, endDate: string): number {
  return Math.round(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000,
  )
}

function getLeadTimeBucket(dateCreated: string, startDate: string): string {
  const bookingDate = dateCreated.split(' ')[0] // strip time
  const days = Math.round(
    (new Date(startDate).getTime() - new Date(bookingDate).getTime()) / 86_400_000,
  )
  if (days <= 0)  return 'lastMinute'
  if (days <= 5)  return 'one5'
  if (days <= 9)  return 'six9'
  if (days <= 30) return 'ten30'
  return 'moreThan30'
}

function getMainGuest(
  guestList: Record<string, CloudbedsGuest> | undefined,
): CloudbedsGuest | undefined {
  if (!guestList) return undefined
  const guests = Object.values(guestList)
  return guests.find(g => g.isMainGuest) ?? guests[0]
}

const COUNTRY_NAMES: Record<string, string> = {
  US: 'Estados Unidos', CO: 'Colombia',     PR: 'Puerto Rico',
  MX: 'México',         DO: 'República Dominicana', CA: 'Canadá',
  NL: 'Países Bajos',   HT: 'Haití',        DE: 'Alemania',
  VE: 'Venezuela',      ES: 'España',        AR: 'Argentina',
  GB: 'Reino Unido',    CR: 'Costa Rica',    PA: 'Panamá',
  JM: 'Jamaica',        IN: 'India',         FR: 'Francia',
  BR: 'Brasil',         CL: 'Chile',         PE: 'Perú',
  EC: 'Ecuador',        UY: 'Uruguay',       BO: 'Bolivia',
}

function pct(n: number, total: number) {
  return total > 0 ? Math.round((n / total) * 1000) / 10 : 0
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function transformToMetrics(
  byBookingDate: CloudbedsReservation[],
  byArrival: CloudbedsReservation[],
  billingData: BillingData,
  attributableSources: string[],
): DashboardMetrics {
  const isAttr   = (r: CloudbedsReservation) => attributableSources.includes(r.sourceName)
  const isActive = (r: CloudbedsReservation) => r.status !== 'cancelled'

  // ── KPI Strip: huéspedes y noches (todos los canales, por arrival) ──────────
  let guests = 0
  let nights = 0
  for (const r of byArrival) {
    if (!isActive(r)) continue
    guests += parseInt(r.adults || '0') + parseInt(r.children || '0')
    nights += calcNights(r.startDate, r.endDate)
  }

  // ── Bloque C: bookings hechos este mes (atribuibles) ───────────────────────
  const attrBookings = byBookingDate.filter(r => isAttr(r) && isActive(r))
  const bookingCount = attrBookings.length
  const bookingNights = attrBookings.reduce(
    (s, r) => s + calcNights(r.startDate, r.endDate), 0,
  )

  // ── Estados ────────────────────────────────────────────────────────────────
  const st = { checkedOut: 0, confirmed: 0, cancelled: 0, noShow: 0, staying: 0 }
  for (const r of byArrival) {
    if      (r.status === 'checked_out')                           st.checkedOut++
    else if (r.status === 'confirmed' || r.status === 'not_confirmed') st.confirmed++
    else if (r.status === 'cancelled')                             st.cancelled++
    else if (r.status === 'no_show')                               st.noShow++
    else if (r.status === 'checked_in')                            st.staying++
  }
  const totalSt = Object.values(st).reduce((a, b) => a + b, 0)

  // ── Antelación ────────────────────────────────────────────────────────────
  const lt = { moreThan30: 0, ten30: 0, six9: 0, one5: 0, lastMinute: 0 }
  for (const r of byBookingDate) {
    const b = getLeadTimeBucket(r.dateCreated, r.startDate) as keyof typeof lt
    lt[b]++
  }
  const totalLt = Object.values(lt).reduce((a, b) => a + b, 0)

  // ── Top países y habitaciones (atribuibles, por arrival, por conteo) ───────
  const countryCounts = new Map<string, number>()
  const roomCounts    = new Map<string, number>()

  for (const r of byArrival) {
    if (!isAttr(r) || !isActive(r)) continue
    const g = getMainGuest(r.guestList)
    if (g?.guestCountry) {
      const name = COUNTRY_NAMES[g.guestCountry] ?? g.guestCountry
      countryCounts.set(name, (countryCounts.get(name) ?? 0) + 1)
    }
    const rawRoom = g?.rooms?.[0]?.roomTypeName ?? ''
    const roomType = rawRoom.replace(/\s*\(.*?\)/g, '').trim()
    if (roomType) {
      roomCounts.set(roomType, (roomCounts.get(roomType) ?? 0) + 1)
    }
  }

  return {
    totalRevenue: billingData.totalRevenue,
    attributableRevenue: billingData.totalRevenue, // proxy hasta tener grandTotal
    guests,
    nights,
    bookingVolume: 0,   // pendiente: requiere endpoint adicional de Cloudbeds
    bookingCount,
    avgTicket: 0,
    avgNightsPerBooking:
      bookingCount > 0
        ? Math.round((bookingNights / bookingCount) * 10) / 10
        : 0,
    reservationStatus: {
      checkedOut: pct(st.checkedOut, totalSt),
      confirmed:  pct(st.confirmed,  totalSt),
      cancelled:  pct(st.cancelled,  totalSt),
      noShow:     pct(st.noShow,     totalSt),
      staying:    pct(st.staying,    totalSt),
    },
    leadTime: {
      moreThan30: pct(lt.moreThan30, totalLt),
      ten30:      pct(lt.ten30,      totalLt),
      six9:       pct(lt.six9,       totalLt),
      one5:       pct(lt.one5,       totalLt),
      lastMinute: pct(lt.lastMinute, totalLt),
    },
    topCountries: [...countryCounts.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([name, count]) => ({ name, count })),
    topRoomTypes: [...roomCounts.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([name, count]) => ({ name, count })),
  }
}
