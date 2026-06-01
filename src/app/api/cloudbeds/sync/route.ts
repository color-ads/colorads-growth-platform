import { NextRequest, NextResponse } from 'next/server'
import { getMonthReservations } from '@/lib/api/cloudbeds'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const apiKey = process.env.CLOUDBEDS_API_KEY ?? ''
  const data = await getMonthReservations(apiKey, 2026, 4)
  const sample = data.byArrival[0]
  return NextResponse.json({
    fields: Object.keys(sample),
    sample: {
      status: sample.status,
      sourceName: sample.sourceName,
      adults: sample.adults,
      children: sample.children,
      nights: sample.nights,
      grandTotal: sample.grandTotal,
      country: sample.country,
      countryCode: sample.countryCode,
      rooms: sample.rooms?.[0],
      dateCreated: sample.dateCreated,
      checkIn: sample.checkIn,
    }
  })
}
