export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { KPIStrip } from '@/components/dashboard/KPIStrip'
import { HistoricalCharts } from '@/components/dashboard/HistoricalCharts'
import { DemographicProfile } from '@/components/dashboard/DemographicProfile'
import { InsightsPanel, ChannelBreakdown } from '@/components/dashboard/InsightsPanel'
import type { MonthlyReport, Property } from '@/types'

// ─── Fetch & Map ──────────────────────────────────────────────────────────────

async function getCurrentMonthReport(year: number, month: number): Promise<MonthlyReport | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await fetch(
      `${baseUrl}/api/cloudbeds/sync?slug=h98&year=${year}&month=${month}`,
      { cache: 'no-store' },
    )
    if (!res.ok) return null
    const d = await res.json()
    const m = d.metrics
    const b = d.billing

    return {
      id: `${year}-${month}`,
      property_id: 'h98',
      period_start: `${year}-${String(month).padStart(2,'0')}-01`,
      period_end:   `${year}-${String(month).padStart(2,'0')}-${new Date(year, month, 0).getDate()}`,
      month,
      year,
      total_guests:        m.guests,
      total_nights:        m.nights,
      total_investment:    b.totalInvestment,
      ad_cost_pct:         b.adCostPct,
      attributable_revenue: m.attributableRevenue,
      total_hotel_revenue:  m.totalRevenue,
      total_bookings:      m.bookingCount,
      booking_volume:      m.bookingVolume,
      avg_ticket:          m.avgTicket,
      avg_stay:            m.avgNightsPerBooking,
      roas:                b.roas,
      google_investment:   b.googleInvestment,
      meta_investment:     b.metaInvestment,
      content_investment:  b.contentInvestment,
      fees_investment:     b.fees,
      total_impressions:   b.impressions,
      total_clicks:        b.clicks,
      avg_cpc:             b.cpc,
      geo_breakdown: m.topCountries.map((c: { name: string; count: number }, i: number, arr: { count: number }[]) => ({
        country:      c.name,
        country_code: '',
        revenue:      0,
        bookings:     c.count,
        pct:          arr.reduce((s: number, x: { count: number }) => s + x.count, 0) > 0
          ? Math.round((c.count / arr.reduce((s: number, x: { count: number }) => s + x.count, 0)) * 1000) / 10
          : 0,
      })),
      room_category_breakdown: m.topRoomTypes.map((r: { name: string; count: number }, i: number, arr: { count: number }[]) => ({
        category_name: r.name,
        revenue:  0,
        bookings: r.count,
        pct: arr.reduce((s: number, x: { count: number }) => s + x.count, 0) > 0
          ? Math.round((r.count / arr.reduce((s: number, x: { count: number }) => s + x.count, 0)) * 1000) / 10
          : 0,
      })),
      booking_status_breakdown: [
        { status: 'Checked Out', count: m.reservationStatus.checkedOut, pct: m.reservationStatus.checkedOut },
        { status: 'Confirmado',  count: m.reservationStatus.confirmed,  pct: m.reservationStatus.confirmed },
        { status: 'Cancelado',   count: m.reservationStatus.cancelled,  pct: m.reservationStatus.cancelled },
        { status: 'No Show',     count: m.reservationStatus.noShow,     pct: m.reservationStatus.noShow },
        { status: 'Hospedado',   count: m.reservationStatus.staying,    pct: m.reservationStatus.staying },
      ],
      booking_lead_time_breakdown: [
        { range: '30+ días',      count: m.leadTime.moreThan30, pct: m.leadTime.moreThan30 },
        { range: '10–30 días',    count: m.leadTime.ten30,      pct: m.leadTime.ten30 },
        { range: '6–9 días',      count: m.leadTime.six9,       pct: m.leadTime.six9 },
        { range: '1–5 días',      count: m.leadTime.one5,       pct: m.leadTime.one5 },
        { range: 'Último minuto', count: m.leadTime.lastMinute, pct: m.leadTime.lastMinute },
      ],
      campaign_breakdown:  [],
      source_breakdown:    [],
      ai_insights:         null,
      milestones:          [],
      status:              'published',
      published_at:        new Date().toISOString(),
      created_at:          new Date().toISOString(),
      updated_at:          new Date().toISOString(),
    }
  } catch {
    return null
  }
}

async function getHistoricalReports(): Promise<MonthlyReport[]> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const { data: prop } = await supabase.from('properties').select('id').eq('slug', 'h98').single()
    if (!prop) return []

    const { data: rows } = await supabase
      .from('monthly_billing')
      .select('*')
      .eq('property_id', prop.id)
      .order('year').order('month')

    return (rows ?? []).map(r => ({
      id:              `${r.year}-${r.month}`,
      property_id:     'h98',
      period_start:    `${r.year}-${String(r.month).padStart(2,'0')}-01`,
      period_end:      `${r.year}-${String(r.month).padStart(2,'0')}-28`,
      month:           r.month,
      year:            r.year,
      total_guests:    0,
      total_nights:    0,
      total_investment:    r.total_investment,
      ad_cost_pct:         r.ad_cost_pct,
      attributable_revenue: r.total_revenue,
      total_hotel_revenue:  r.total_revenue,
      total_bookings:  0,
      booking_volume:  0,
      avg_ticket:      0,
      avg_stay:        0,
      roas:            r.roas,
      google_investment:   r.google_investment,
      meta_investment:     r.meta_investment,
      content_investment:  r.content_investment,
      fees_investment:     r.fees,
      total_impressions:   r.impressions,
      total_clicks:        r.clicks,
      avg_cpc:             r.cpc,
      campaign_breakdown:          [],
      geo_breakdown:               [],
      source_breakdown:            [],
      room_category_breakdown:     [],
      booking_status_breakdown:    [],
      booking_lead_time_breakdown: [],
      ai_insights:  null,
      milestones:   [],
      status:       'published',
      published_at: new Date().toISOString(),
      created_at:   new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    }))
  } catch {
    return []
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const currentMonth = 4
  const currentYear  = 2026

  const [currentReport, historical] = await Promise.all([
    getCurrentMonthReport(currentYear, currentMonth),
    getHistoricalReports(),
  ])

  const prevReport = historical[historical.length - 2] ?? null

  const property: Property = {
    id:                  'h98',
    name:                'Hashtag 98 Hotel',
    slug:                'h98',
    location:            'El Poblado, Medellín',
    logo_url:            null,
    primary_color:       '#E63946',
    secondary_color:     '#457B9D',
    success_fee_pct:     2.5,
    active:              true,
    created_at:          '2025-01-01',
    cloudbeds_property_id: null,
    google_ads_account_id: null,
    meta_ad_account_id:    null,
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar property={property} alertCount={2} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-base font-medium text-gray-900">
                Informe de gestión Venta Directa ·{' '}
                <span style={{ color: property.primary_color }}>H98</span>
              </h1>
              <p className="text-[11px] text-gray-400">
                Abril 2026 · El Poblado, Medellín
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {[{m:1,l:'ene'},{m:2,l:'feb'},{m:3,l:'mar'},{m:4,l:'abr'}].map(({m,l}) => (
                <div
                  key={m}
                  className={`px-3 py-1 rounded-md text-[12px] cursor-pointer transition-all ${
                    m === currentMonth
                      ? 'bg-white text-gray-900 font-medium shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {l}
                </div>
              ))}
            </div>
          </div>
        </header>

        {/* Main scroll area */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {!currentReport ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
              Cargando datos del mes...
            </div>
          ) : (
            <>
              <KPIStrip
                currentReport={currentReport}
                prevReport={prevReport}
                property={property}
              />
              <HistoricalCharts
                historical={historical}
                currentMonth={currentMonth}
                currentYear={currentYear}
              />
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-6">
                  <DemographicProfile report={currentReport} />
                  <ChannelBreakdown report={currentReport} />
                </div>
                <div className="space-y-6">
                  <InsightsPanel report={currentReport} property={property} />
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
