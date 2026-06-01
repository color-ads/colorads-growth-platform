/**
 * Data Transformer — Cloudbeds → Dashboard Metrics
 *
 * Implementa la distinción central del negocio:
 *   bookingVolume  = reservas HECHAS en el mes (by booking date)  ← Bloque C
 *   totalRevenue   = facturación del hotel en el mes              ← Bloque B (viene de hoja Facturación)
 *   guests/nights  = huéspedes que LLEGARON ese mes               ← KPI Strip
 */

import type { CloudbedsReservation } from './cloudbeds'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DashboardMetrics {
  // ── Bloque B: Facturación
  totalRevenue: number           // De la hoja Facturación (billing real del hotel)
  attributableRevenue: number    // Revenue atribuible calculado desde Cloudbeds

  // ── KPI Strip
  guests: number                 // Adultos + niños que LLEGARON este mes (todos canales)
  nights: number                 // Noches totales de los que llegaron (todos canales)

  // ── Bloque C: Volumen de reservas
  bookingVolume: number          // COP — reservas HECHAS este mes (booking date, atribuibles)
  bookingCount: number           // N° reservas hechas este mes (atribuibles)
  avgTicket: number              // bookingVolume / bookingCount
  avgNightsPerBooking: number    // noches promedio por reserva

  // ── Bloque F: Demografía
  reservationStatus: {
    checkedOut: number           // %
    confirmed: number            // %
    cancelled: number            // %
    noShow: number               // %
    staying: number              // % (checked_in / hospedado)
  }
  leadTime: {
    moreThan30: number           // %
    ten30: number                // %
    six9: number                 // %
    one5: number                 // %
    lastMinute: number           // %
  }
  topCountries: { name: string; revenue: number }[]
  topRoomTypes:  { name: string; revenue: number }[]
}

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseAmount(s: string | number | undefined | null): number {
  if (s == null) return 0
  if (typeof s === 'number') return s
  return parseFloat(String(s).replace(/,/g, '')) || 0
}

/**
 * Calculate lead time bucket (days between booking and check-in).
 */
function getLeadTimeBucket(dateCreated: string, checkIn: string): string {
  const created = new Date(dateCreated)
  const arrival = new Date(checkIn)
  const days = Math.round((arrival.getTime() - created.getTime()) / 86_400_000)

  if (days <= 0)  return 'lastMinute'   // 0 días
  if (days <= 5)  return 'one5'         // 1–5 días
  if (days <= 9)  return 'six9'         // 6–9 días
  if (days <= 30) return 'ten30'        // 10–30 días
  return 'moreThan30'                   // 30+ días
}

// ─── Main Transformer ─────────────────────────────────────────────────────────

/**
 * Transform raw Cloudbeds reservations into dashboard-ready metrics.
 *
 * @param byBookingDate  Reservas cuyo booking date cae en el mes objetivo
 * @param byArrival      Reservas cuyo check-in cae en el mes objetivo
 * @param billingData    Datos de la hoja Facturación para este mes
 * @param attributableSources  Fuentes que cuentan como atribuibles al marketing
 */
export function transformToMetrics(
  byBookingDate: CloudbedsReservation[],
  byArrival: CloudbedsReservation[],
  billingData: BillingData,
  attributableSources: string[],
): DashboardMetrics {
  const isAttributable = (r: CloudbedsReservation) =>
    attributableSources.includes(r.sourceName)

  const isActive = (r: CloudbedsReservation) =>
    r.status !== 'cancelled'

  // ── BLOQUE C: Volumen de reservas (by booking date, atribuibles)
  const attributableBookings = byBookingDate.filter(
    r => isAttributable(r) && isActive(r),
  )

  const bookingVolume = attributableBookings.reduce(
    (sum, r) => sum + parseAmount(r.grandTotal),
    0,
  )
  const bookingCount = attributableBookings.length
  const bookingNights = attributableBookings.reduce(
    (sum, r) => sum + r.nights,
    0,
  )

  // ── KPI STRIP: Huéspedes y noches (by arrival, todos los canales)
  const activeArrivals = byArrival.filter(r => isActive(r))
  const guests = activeArrivals.reduce(
    (sum, r) => sum + r.adults + r.children,
    0,
  )
  const nights = activeArrivals.reduce((sum, r) => sum + r.nights, 0)

  // ── BLOQUE B: Revenue atribuible (by arrival, atribuibles)
  const attrArrivals = byArrival.filter(
    r => isAttributable(r) && isActive(r),
  )
  const attributableRevenue = attrArrivals.reduce(
    (sum, r) => sum + parseAmount(r.grandTotal),
    0,
  )

  // ── DEMOGRAFÍA: por mes del reporte (byArrival como referencia)
  // Estados
  const statusCounts = {
    checkedOut: 0, confirmed: 0, cancelled: 0, noShow: 0, staying: 0,
  }
  // Para estados, usamos TODOS (incluye cancelados para mostrar % real)
  const allArrivals = [...byArrival]
  for (const r of allArrivals) {
    if (r.status === 'checked_out')  statusCounts.checkedOut++
    else if (r.status === 'confirmed')    statusCounts.confirmed++
    else if (r.status === 'cancelled')   statusCounts.cancelled++
    else if (r.status === 'no_show')     statusCounts.noShow++
    else if (r.status === 'checked_in')  statusCounts.staying++
  }
  const totalStatuses = Object.values(statusCounts).reduce((a, b) => a + b, 0) || 1

  // Antelación (de las reservas hechas este mes)
  const leadCounts = { moreThan30: 0, ten30: 0, six9: 0, one5: 0, lastMinute: 0 }
  for (const r of byBookingDate) {
    const bucket = getLeadTimeBucket(r.dateCreated, r.checkIn) as keyof typeof leadCounts
    leadCounts[bucket]++
  }
  const totalLead = Object.values(leadCounts).reduce((a, b) => a + b, 0) || 1

  // Top países (atribuibles, por arrival, activos)
  const countryRevenue = new Map<string, number>()
  for (const r of attrArrivals) {
    const country = r.country || r.countryCode || 'Desconocido'
    countryRevenue.set(country, (countryRevenue.get(country) ?? 0) + parseAmount(r.grandTotal))
  }
  const topCountries = [...countryRevenue.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([name, revenue]) => ({ name, revenue }))

  // Top habitaciones (atribuibles, por arrival, activos)
  const roomRevenue = new Map<string, number>()
  for (const r of attrArrivals) {
    // Use the first room's type (most reservations are single-room)
    const roomType = r.rooms?.[0]?.roomTypeName ?? 'Sin categoría'
    roomRevenue.set(roomType, (roomRevenue.get(roomType) ?? 0) + parseAmount(r.grandTotal))
  }
  const topRoomTypes = [...roomRevenue.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([name, revenue]) => ({ name, revenue }))

  return {
    // Facturación
    totalRevenue: billingData.totalRevenue,
    attributableRevenue,

    // KPI Strip
    guests,
    nights,

    // Bloque C
    bookingVolume,
    bookingCount,
    avgTicket: bookingCount > 0 ? Math.round(bookingVolume / bookingCount) : 0,
    avgNightsPerBooking: bookingCount > 0
      ? Math.round((bookingNights / bookingCount) * 10) / 10
      : 0,

    // Demografía
    reservationStatus: {
      checkedOut: Math.round((statusCounts.checkedOut / totalStatuses) * 1000) / 10,
      confirmed:  Math.round((statusCounts.confirmed  / totalStatuses) * 1000) / 10,
      cancelled:  Math.round((statusCounts.cancelled  / totalStatuses) * 1000) / 10,
      noShow:     Math.round((statusCounts.noShow     / totalStatuses) * 1000) / 10,
      staying:    Math.round((statusCounts.staying    / totalStatuses) * 1000) / 10,
    },
    leadTime: {
      moreThan30: Math.round((leadCounts.moreThan30 / totalLead) * 1000) / 10,
      ten30:      Math.round((leadCounts.ten30      / totalLead) * 1000) / 10,
      six9:       Math.round((leadCounts.six9       / totalLead) * 1000) / 10,
      one5:       Math.round((leadCounts.one5       / totalLead) * 1000) / 10,
      lastMinute: Math.round((leadCounts.lastMinute / totalLead) * 1000) / 10,
    },
    topCountries,
    topRoomTypes,
  }
}
