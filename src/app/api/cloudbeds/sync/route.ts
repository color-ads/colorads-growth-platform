import { NextRequest, NextResponse } from 'next/server'
import { getMonthReservations } from '@/lib/api/cloudbeds'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const apiKey = process.env.CLOUDBEDS_API_KEY ?? ''
  const data = await getMonthReservations(apiKey, 2026, 4)
  const sources = new Map<string, number>()
  for (const r of data.byArrival) {
    sources.set(r.sourceName, (sources.get(r.sourceName) ?? 0) + 1)
  }
  return NextResponse.json({
    totalReservations: data.byArrival.length,
    sources: Object.fromEntries([...sources.entries()].sort(([,a],[,b]) => b-a))
  })
}
