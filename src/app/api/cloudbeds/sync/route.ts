import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
    const { data, error } = await supabase.from('properties').select('id, slug').eq('slug', 'h98').single()
    return NextResponse.json({ ok: true, data, error: error?.message })
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e))
    return NextResponse.json({ crashed: true, message: err.message, stack: err.stack?.split('\n').slice(0,4) }, { status: 500 })
  }
}
