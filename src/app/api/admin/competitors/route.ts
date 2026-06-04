import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function supa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function GET(req: NextRequest) {
  try {
    const slug = new URL(req.url).searchParams.get('slug') ?? 'h98'
    const { data: prop } = await supa().from('properties').select('competitors').eq('slug', slug).single()
    const raw = (prop as { competitors?: unknown } | null)?.competitors
    const competitors = Array.isArray(raw) ? (raw as unknown[]).map((x) => String(x)).filter(Boolean) : []
    return NextResponse.json({ competitors })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, competitors: [] }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const slug = typeof body.slug === 'string' ? body.slug : 'h98'
    const competitors = Array.isArray(body.competitors)
      ? body.competitors.map((x: unknown) => String(x).trim()).filter(Boolean).slice(0, 20)
      : []
    const supabase = supa()
    const { data: prop } = await supabase.from('properties').select('id').eq('slug', slug).single()
    if (!prop) return NextResponse.json({ error: 'property not found' }, { status: 404 })
    const { error } = await supabase.from('properties').update({ competitors }).eq('id', prop.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, competitors })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
