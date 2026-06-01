import { NextRequest, NextResponse } from 'next/server'
import { getReservations } from '@/lib/api/cloudbeds'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const apiKey = process.env.CLOUDBEDS_API_KEY ?? ''

  // Traer una reserva para obtener su ID
  const res = await fetch(
    'https://hotels.cloudbeds.com/api/v1.2/getReservations?pageNumber=1&pageSize=1&checkInFrom=2026-04-01&checkInTo=2026-04-30&status=checked_out',
    { headers: { Authorization: `Bearer ${apiKey}` } }
  )
  const list = await res.json()
  const reservationID = list.data?.[0]?.reservationID

  // Traer detalle completo de esa reserva
  const detail = await fetch(
    `https://hotels.cloudbeds.com/api/v1.2/getReservation?reservationID=${reservationID}`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  )
  const full = await detail.json()

  return NextResponse.json({
    reservationID,
    topLevelKeys: Object.keys(full.data ?? {}),
    financialFields: {
      grandTotal: full.data?.grandTotal,
      subTotal: full.data?.subTotal,
      balance: full.data?.balance,
      amountPaid: full.data?.amountPaid,
      taxAmount: full.data?.taxAmount,
      rooms: full.data?.rooms?.map((r: any) => ({
        roomTotal: r.roomTotal,
        roomRate: r.roomRate,
        keys: Object.keys(r)
      }))
    }
  })
}
