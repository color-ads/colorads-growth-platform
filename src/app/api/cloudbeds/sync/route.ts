import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMonthReservations } from '@/lib/api/cloudbeds'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const year  = parseInt(searchParams.get('year')  ?? '2026')
    const month = parseInt(searchParams.get('month') ?? '4')

    const apiKey = process.env.CLOUDBEDS_API_KEY ?? ''

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    const { data: property } = await supabase
      .from('properties').select('*').eq('slug', 'h98').single()

    const { data: billing } = await supabase
      .from('monthly_billing').select('*')
      .eq('property_id', property.id).eq('year', year).eq('month', month).single()

    const cloudbeds = await getMonthReservations(apiKey, year, month)

    return NextResponse.json({
      ok: true,
      property: property.name,
      billing: !!billing,
      byBookingDate: cloudbeds.byBookingDate.length,
      byArrival: cloudbeds.byArrival.length,
    })
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e))
    return NextResponse.json({ crashed: true, message: err.message, stack: err.stack?.split('\n').slice(0,5) }, { status: 500 })
  }
}
