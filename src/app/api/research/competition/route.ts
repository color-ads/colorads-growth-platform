import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Investigacion web de competencia (manual). Genera/actualiza properties.ai_competition_kb.
// La busqueda corre del lado de Anthropic (tool web_search); no se busca en cada corrida.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const slug = searchParams.get('slug') ?? 'h98'
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY missing' }, { status: 500 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const { data: prop } = await supabase.from('properties').select('id, name').eq('slug', slug).single()
    if (!prop) return NextResponse.json({ error: 'property not found' }, { status: 404 })

    const prompt = `Sos analista de inteligencia competitiva para hoteleria en Medellin. Investiga EN LA WEB hoteles boutique o medianos en El Poblado, Medellin que compitan con ${prop.name} (sitio: hashtag98.com.co).

Identifica 4 a 6 competidores REALES y, para cada uno, que hacen BIEN en venta directa: tarifas y beneficios por reservar directo, contenido/redes, experiencia y UX del sitio de reservas, reputacion en resenas. Ademas, resume buenas practicas de venta directa hotelera aplicables a un hotel de El Poblado.

REGLAS:
- Solo afirma cosas que encuentres respaldadas en la web; NO inventes. Si no encontras algo, omitilo.
- Premisa del hotel: el publico son extranjeros que YA estan en Colombia/Medellin (demanda en destino). Las ideas deben servir para captar esa demanda, nunca campanas al exterior.
- Devolve un TEXTO en espanol, conciso y accionable (no JSON), de ~300 a 500 palabras, util como base de conocimiento para un consultor de growth que propone experimentos de venta directa.
- Al final, una lista breve de referencias (fuentes/URLs).`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2500,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 6 }],
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300)
      return NextResponse.json({ error: `API_${res.status}`, detail: body }, { status: 502 })
    }
    const data = await res.json()
    const text: string = (data.content ?? [])
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('\n\n')
      .trim()
    if (!text) return NextResponse.json({ error: 'empty result' }, { status: 502 })

    const { error } = await supabase.from('properties').update({ ai_competition_kb: text }).eq('id', prop.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, length: text.length, competition_kb: text })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
