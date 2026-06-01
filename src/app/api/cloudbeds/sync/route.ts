import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const apiKey = process.env.CLOUDBEDS_API_KEY ?? ''
  const res = await fetch(
    'https://hotels.cloudbeds.com/api/v1.2/getReservations?pageNumber=1&pageSize=100&dateFrom=2026-04-01&dateTo=2026-04-30&status=confirmed,checked_in,checked_out,no_show',
    { headers: { Authorization: `Bearer ${apiKey}` } }
  )
  const json = await res.json()
  return NextResponse.json({
    success: json.success,
    topLevelKeys: Object.keys(json),
    count: json.count,
    total: json.total,
    totalResults: json.totalResults,
    dataLength: json.data?.length,
  })
}
