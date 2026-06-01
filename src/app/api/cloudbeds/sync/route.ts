import { NextRequest, NextResponse } from 'next/server'
import { getMonthReservations } from '@/lib/api/cloudbeds'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const apiKey = process.env.CLOUDBEDS_API_KEY ?? ''
  const data = await getMonthReservations(apiKey, 2026, 4)
  const sample = data.byArrival[0]
  return NextResponse.json({
    guestListSample: sample.guestList,
    allFields: Object.keys(sample),
  })
}
