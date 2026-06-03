import { NextRequest, NextResponse } from 'next/server'
import { buildMonthReport } from '@/lib/api/month-report'

export const dynamic = 'force-dynamic'

// Wrapper HTTP de buildMonthReport. Lo usa el boton "Actualizar" del dashboard
// para forzar el recalculo de un mes (buildMonthReport reescribe la cache).
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const slug  = searchParams.get('slug')  ?? 'h98'
    const year  = parseInt(searchParams.get('year')  ?? '2026')
    const month = parseInt(searchParams.get('month') ?? '4')
    const payload = await buildMonthReport(slug, year, month)
    return NextResponse.json(payload)
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
