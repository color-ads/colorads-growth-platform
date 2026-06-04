import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Guarda la decision de ejecucion de una propuesta (check + periodo + comentario).
// La usan los controles de las tarjetas de propuesta en el tablero.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const slug = typeof body.slug === 'string' ? body.slug : 'h98'
    const year = parseInt(String(body.year))
    const month = parseInt(String(body.month))
    const idx = parseInt(String(body.idx))
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(idx)) {
      return NextResponse.json({ error: 'bad params' }, { status: 400 })
    }
    const willExecute = ['pending', 'yes', 'no'].includes(body.willExecute) ? body.willExecute : 'pending'
    const period = typeof body.period === 'string' && body.period ? body.period.slice(0, 7) : null
    const comment = typeof body.comment === 'string' ? body.comment.slice(0, 2000) : null
    const title = typeof body.title === 'string' ? body.title.slice(0, 300) : null

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const { data: prop } = await supabase.from('properties').select('id').eq('slug', slug).single()
    if (!prop) return NextResponse.json({ error: 'property not found' }, { status: 404 })

    const { error } = await supabase.from('proposal_tracking').upsert(
      {
        property_id: prop.id, year, month, idx, title,
        will_execute: willExecute, period, comment,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'property_id,year,month,idx' },
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
