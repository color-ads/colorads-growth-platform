import { NextRequest, NextResponse } from 'next/server'
import { buildMonthReport } from '@/lib/api/month-report'
import { syncSourceRevenueForMonth } from '@/lib/api/source-revenue'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Wrapper HTTP del boton "Actualizar": reescribe monthly_source_revenue del mes
// (graficos de Facturacion/Reservas) Y reconstruye la cache del dashboard (KPIs).
// ?force=1 regenera el analisis aunque el mes este cerrado (congelado).
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const slug  = searchParams.get('slug')  ?? 'h98'
    const year  = parseInt(searchParams.get('year')  ?? '2026')
    const month = parseInt(searchParams.get('month') ?? '4')
    const force = (searchParams.get('force') ?? '') === '1'
    // 1) Refrescar la facturacion/reservas del mes desde Cloudbeds (best-effort).
    let sourceSync: unknown = null
    try {
      sourceSync = await syncSourceRevenueForMonth(slug, year, month)
    } catch (e) {
      sourceSync = { error: e instanceof Error ? e.message : String(e) }
    }
    // 2) Reconstruir la cache del dashboard (KPIs/metricas).
    const payload = await buildMonthReport(slug, year, month, { force })
    return NextResponse.json({ ...payload, sourceSync })
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e))
    if (err.message.includes('CLOUDBEDS_API_KEY')) {
      return NextResponse.json({ error: err.message, code: 'NOT_CONNECTED' }, { status: 503 })
    }
    if (err.message.includes('Property not found')) {
      return NextResponse.json({ error: err.message }, { status: 404 })
    }
    console.error('[sync]', err.stack)
    return NextResponse.json({ crashed: true, message: err.message }, { status: 500 })
  }
}
