export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { KPIStrip } from '@/components/dashboard/KPIStrip'
import { RevenueExplorer, type SourceRow } from '@/components/dashboard/RevenueExplorer'
import { DemographicProfile } from '@/components/dashboard/DemographicProfile'
import CompetitionPanel from '@/components/dashboard/CompetitionPanel';
import { ExecutiveSummary } from '@/components/dashboard/ExecutiveSummary'
import { InsightsPanel, ChannelBreakdown, RoiStrip } from '@/components/dashboard/InsightsPanel'
import type { MonthlyReport, Property } from '@/types'
import { MonthSelector } from '@/components/dashboard/MonthSelector'
import { RefreshButton } from '@/components/dashboard/RefreshButton'
import { BookingPaceChart, type StayBucket } from '@/components/dashboard/BookingPaceChart'
import { buildMonthReport } from '@/lib/api/month-report'
import { roasFrom, adCostPctFrom } from '@/lib/metrics'

// ─── Fetch & Map ──────────────────────────────────────────────────────────────

async function getCurrentMonthReport(year: number, month: number): Promise<{ report: MonthlyReport; stayDistribution: StayBucket[] } | null> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const { data: prop } = await supabase.from('properties').select('id').eq('slug', 'h98').single()
    if (!prop) return null

    // Metricas + distribucion de reservas: de la cache; si falta (o es una cache vieja sin
    // la distribucion), se arma una vez y queda guardado -> self-heal. Sin pegarle a Cloudbeds
    // en cada carga.
    const { data: cacheRow } = await supabase
      .from('monthly_dashboard_cache')
      .select('payload, refreshed_at')
      .eq('property_id', prop.id).eq('year', year).eq('month', month)
      .maybeSingle()

    let m = cacheRow?.payload?.metrics
    let dist = cacheRow?.payload?.bookingStayDistribution
    let ai = cacheRow?.payload?.aiInsights ?? null
    let refreshedAt: string = cacheRow?.refreshed_at ?? new Date().toISOString()
    if (!m || dist === undefined) {
      const built = await buildMonthReport('h98', year, month, { withAi: false })
      if (!built) return null
      m = built.metrics
      dist = built.bookingStayDistribution ?? []
      ai = built.aiInsights ?? null
      refreshedAt = new Date().toISOString()
    }

    // Inversion / marketing: SIEMPRE en vivo desde monthly_billing (lo edita el admin),
    // asi un cambio de inversion se refleja al instante sin esperar al cron.
    const { data: billingRow } = await supabase.from('monthly_billing').select('*')
      .eq('property_id', prop.id).eq('year', year).eq('month', month).maybeSingle()
    const b = billingRow ?? {
      total_investment: 0, ad_cost_pct: 0, roas: 0, google_investment: 0, meta_investment: 0,
      content_investment: 0, fees: 0, impressions: 0, clicks: 0, cpc: 0,
    }

    const report: MonthlyReport = {
      id: `${year}-${month}`,
      property_id: 'h98',
      period_start: `${year}-${String(month).padStart(2,'0')}-01`,
      period_end:   `${year}-${String(month).padStart(2,'0')}-${new Date(year, month, 0).getDate()}`,
      month,
      year,
      total_guests:        m.guests,
      total_nights:        m.nights,
      total_investment:    b.total_investment ?? 0,
      ad_cost_pct:         b.ad_cost_pct ?? 0,
      attributable_revenue: 0,   // lo fija facturacionForMonth (abajo) desde monthly_source_revenue
      total_hotel_revenue:  0,   // idem - el sync ya no calcula facturacion
      total_bookings:      m.bookingCount,
      booking_volume:      m.bookingVolume,
      avg_ticket:          m.avgTicket,
      avg_stay:            m.avgNightsPerBooking,
      roas:                b.roas ?? 0,
      google_investment:   b.google_investment ?? 0,
      meta_investment:     b.meta_investment ?? 0,
      content_investment:  b.content_investment ?? 0,
      fees_investment:     b.fees ?? 0,
      total_impressions:   b.impressions ?? 0,
      total_clicks:        b.clicks ?? 0,
      avg_cpc:             b.cpc ?? 0,
      geo_breakdown: (m.topCountries || []).map((c: { country: string; country_code: string; revenue: number; bookings: number; pct: number }) => ({
        country:      c.country,
        country_code: c.country_code,
        revenue:      c.revenue,
        bookings:     c.bookings,
        pct:          c.pct,
      })),
      room_category_breakdown: (m.topRoomTypes || []).map((r: { category_name: string; revenue: number; bookings: number; pct: number }) => ({
        category_name: r.category_name,
        revenue:  r.revenue,
        bookings: r.bookings,
        pct:      r.pct,
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
      ai_insights:         ai,
      milestones:          [],
      status:              'published',
      published_at:        new Date().toISOString(),
      created_at:          new Date().toISOString(),
      updated_at:          refreshedAt,
    }
    return { report, stayDistribution: (dist ?? []) as StayBucket[] }
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
      attributable_revenue: Math.min(r.attributable_revenue ?? r.total_revenue, r.total_revenue),
      total_hotel_revenue:  r.total_revenue,
      total_bookings:  r.booking_count ?? 0,
      booking_volume:  r.booking_volume ?? 0,
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

async function getProposalTracking(year: number, month: number): Promise<Record<number, { will_execute: string; period: string; comment: string }>> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const { data: prop } = await supabase.from('properties').select('id').eq('slug', 'h98').single()
    if (!prop) return {}
    const { data: rows } = await supabase
      .from('proposal_tracking')
      .select('idx, will_execute, period, comment')
      .eq('property_id', prop.id).eq('year', year).eq('month', month)
    const map: Record<number, { will_execute: string; period: string; comment: string }> = {}
    for (const t of (rows ?? [])) map[t.idx] = { will_execute: t.will_execute, period: t.period ?? '', comment: t.comment ?? '' }
    return map
  } catch {
    return {}
  }
}

async function getSourceData(): Promise<{ rows: SourceRow[]; attributable: string[] }> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const { data: prop } = await supabase
      .from('properties').select('id, attributable_sources').eq('slug', 'h98').single()
    if (!prop) return { rows: [], attributable: [] }

    const { data: rows } = await supabase
      .from('monthly_source_revenue')
      .select('year,month,source,category,stay_revenue,booking_volume,booking_count')
      .eq('property_id', prop.id)
      .order('year').order('month')

    return { rows: (rows ?? []) as SourceRow[], attributable: prop.attributable_sources ?? [] }
  } catch {
    return { rows: [], attributable: [] }
  }
}


// Computes facturacion (Cloudbeds room_revenue by stay date) for a month:
// attributable = selected sources, total = all sources.
function facturacionForMonth(
  rows: SourceRow[], attributable: string[], year: number, month: number,
): { attributable_revenue: number; total_hotel_revenue: number } {
  const attrSet = new Set(attributable)
  let attr = 0, total = 0
  for (const r of rows) {
    if (r.year !== year || r.month !== month) continue
    total += r.stay_revenue
    if (attrSet.has(r.source)) attr += r.stay_revenue
  }
  return { attributable_revenue: Math.round(attr), total_hotel_revenue: Math.round(total) }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; y?: string; tab?: string }>
}) {
  const sp = await searchParams
  const tab: 'performance' | 'acciones' | 'resumen' =
    sp.tab === 'acciones' ? 'acciones' : sp.tab === 'resumen' ? 'resumen' : 'performance'
  const now = new Date()
  const nowY = now.getFullYear()
  const nowM = now.getMonth() + 1

  // Mes a analizar (de la URL: ?y=YYYY&m=MM). Default: el ultimo mes (mes en curso).
  let selYear  = parseInt(sp.y ?? '') || nowY
  let selMonth = parseInt(sp.m ?? '') || nowM
  if (selMonth < 1 || selMonth > 12) selMonth = nowM
  // No permitir un mes futuro: si llega, se acota al mes en curso.
  if (selYear * 12 + selMonth > nowY * 12 + nowM) { selYear = nowY; selMonth = nowM }

  const periodLabel = new Date(selYear, selMonth - 1)
    .toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
    .replace(/^\w/, (c) => c.toUpperCase())

  const [currentData, historical, sourceData, proposalTracking] = await Promise.all([
    getCurrentMonthReport(selYear, selMonth),
    getHistoricalReports(),
    getSourceData(),
    getProposalTracking(selYear, selMonth),
  ])
  const currentReport = currentData?.report ?? null
  const stayDistribution: StayBucket[] = currentData?.stayDistribution ?? []

  // Facturacion + ROAS come from Cloudbeds (monthly_source_revenue), not the sheet.
  // Investment stays from monthly_billing (admin). ROAS = attributable facturacion / investment.
  for (const r of historical) {
    const f = facturacionForMonth(sourceData.rows, sourceData.attributable, r.year!, r.month!)
    r.attributable_revenue = f.attributable_revenue
    r.total_hotel_revenue  = f.total_hotel_revenue
    r.roas = roasFrom(f.attributable_revenue, r.total_investment || 0)
    r.ad_cost_pct = adCostPctFrom(f.attributable_revenue, r.total_investment || 0)
  }
  if (currentReport) {
    const f = facturacionForMonth(sourceData.rows, sourceData.attributable, selYear, selMonth)
    currentReport.attributable_revenue = f.attributable_revenue
    currentReport.total_hotel_revenue  = f.total_hotel_revenue
    currentReport.roas = roasFrom(f.attributable_revenue, currentReport.total_investment || 0)
    currentReport.ad_cost_pct = adCostPctFrom(f.attributable_revenue, currentReport.total_investment || 0)
  }

  // Mes anterior al seleccionado (para los deltas del KPIStrip)
  const prevIdx = selYear * 12 + (selMonth - 1) - 1
  const prevReport = historical.find((r) => r.year! * 12 + (r.month! - 1) === prevIdx) ?? null

  // "Actualizado: ..." - cuando se refresco la cache de Cloudbeds de este mes.
  const refreshedLabel = currentReport?.updated_at
    ? new Date(currentReport.updated_at).toLocaleString('es-CO', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    : null

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
      <Sidebar property={property} />

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
                {periodLabel} · El Poblado, Medellín
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {refreshedLabel && (
              <span className="text-[11px] text-gray-400">Actualizado: {refreshedLabel}</span>
            )}
            <RefreshButton year={selYear} month={selMonth} />
            <MonthSelector year={nowY} upTo={nowM} selected={selYear === nowY ? selMonth : 0} tab={tab} />
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
              {/* Tabs: Performance (metricas) y Acciones y conclusiones (propuestas + competencia) */}
              <div className="flex gap-1 border-b border-gray-200">
                {([['performance', 'Performance'], ['acciones', 'Acciones y conclusiones'], ['resumen', 'Resumen ejecutivo']] as const).map(([key, label]) => (
                  <a
                    key={key}
                    href={`${selYear === nowY && selMonth === nowM ? '/dashboard' : `/dashboard?y=${selYear}&m=${selMonth}`}${selYear === nowY && selMonth === nowM ? '?' : '&'}tab=${key}`}
                    className={`px-4 py-2 text-[13px] border-b-2 -mb-px transition-colors ${tab === key ? 'font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    style={tab === key ? { borderColor: property.primary_color, color: property.primary_color } : {}}
                  >
                    {label}
                  </a>
                ))}
              </div>

              {tab === 'performance' ? (
                <>
                  <KPIStrip
                    report={currentReport}
                    prevReport={prevReport}
                    property={property}
                  />
                  <RevenueExplorer
                    rows={sourceData.rows}
                    attributable={sourceData.attributable}
                    property={property}
                  />
                  <RoiStrip report={currentReport} property={property} />
                  <BookingPaceChart distribution={stayDistribution} monthLabel={periodLabel} />
                  <DemographicProfile report={currentReport} historicalReports={historical} property={property} />
                  <ChannelBreakdown report={currentReport} property={property} />
                </>
              ) : tab === 'acciones' ? (
                <>
                  <InsightsPanel report={currentReport} property={property} tracking={proposalTracking} editable={selYear === nowY && selMonth === nowM} />
                  {/* Conclusiones de competencia: concentradas en el mes en curso. No se muestran en meses anteriores. */}
                  {selYear === nowY && selMonth === nowM && <CompetitionPanel slug="h98" />}
                </>
              ) : (
                <ExecutiveSummary
                  report={currentReport}
                  prevReport={prevReport}
                  property={property}
                  periodLabel={periodLabel}
                  tracking={proposalTracking}
                  year={selYear}
                  month={selMonth}
                  canGenerate={selYear === nowY && selMonth === nowM}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
