import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Diagnostico solo-lectura. Borrar despues de depurar.
export async function GET(req: NextRequest) {
  const slug = new URL(req.url).searchParams.get('slug') ?? 'h98'
  const out: Record<string, unknown> = {
    slug,
    env: {
      url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      serviceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
    },
  }
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    // 1) buscar la propiedad SIN .single, para ver cuantas filas hay
    const r1 = await supabase.from('properties').select('id, slug, name').eq('slug', slug)
    out.propertyLookup = {
      rows: Array.isArray(r1.data) ? r1.data.length : 0,
      error: r1.error?.message ?? null,
      data: r1.data ?? null,
    }

    // 2) el SELECT exacto que usa buildMonthReport (para detectar columnas faltantes)
    const r2 = await supabase.from('properties')
      .select('id,slug,name,primary_color,secondary_color,success_fee_pct,attributable_sources,cloudbeds_property_id')
      .eq('slug', slug)
    out.buildSelect = {
      rows: Array.isArray(r2.data) ? r2.data.length : 0,
      error: r2.error?.message ?? null,
    }

    // 3) columnas nuevas
    const r3 = await supabase.from('properties').select('competitors').eq('slug', slug).limit(1)
    out.competitorsColumn = {
      exists: !r3.error,
      error: r3.error?.message ?? null,
      value: r3.data?.[0] ?? null,
    }
    const r4 = await supabase.from('properties').select('ai_competition_kb').eq('slug', slug).limit(1)
    const v = (r4.data?.[0] as { ai_competition_kb?: string | null } | undefined)?.ai_competition_kb
    out.aiCompetitionKbColumn = {
      exists: !r4.error,
      error: r4.error?.message ?? null,
      hasValue: !!v,
      length: v ? v.length : 0,
    }
  } catch (e) {
    out.exception = (e as Error).message
  }
  return NextResponse.json(out)
}
