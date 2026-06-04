import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Investigacion web de competencia (manual). Genera/actualiza properties.ai_competition_kb.
// Liviano (2 busquedas) y enfocado SOLO en competidores + practicas; texto plano.
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

    const prompt = `Sos analista de inteligencia competitiva hotelera. Con como MAXIMO 2 busquedas web enfocadas, investiga hoteles boutique o medianos en El Poblado, Medellin que compitan con ${prop.name} (hashtag98.com.co).

Devolve TEXTO PLANO en espanol (sin markdown: sin '#', sin '---', sin asteriscos; parrafos cortos y limpios), util como base para un consultor de growth de venta directa. NO describas a ${prop.name} en si (ya tenemos sus datos); enfocate SOLO en:
- 3 competidores REALES de El Poblado y que hacen BIEN en venta directa (tarifa o beneficio por reservar directo, contenido/redes, sitio de reservas propio, resenas o premios como prueba social).
- 2 o 3 buenas practicas de venta directa aplicables a un hotel de El Poblado, recordando que el publico son extranjeros que YA estan en Colombia/Medellin (demanda en destino; nada de campanas al exterior).
- Una lista breve de referencias (URLs) al final.

Solo afirma cosas respaldadas en la web; no inventes. Se conciso (~350 palabras) y NO te cortes antes de las referencias.`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 290000)
    let res: Response
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }],
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }
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
    const err = e as Error
    const msg = err.name === 'AbortError' ? 'timeout: la busqueda web tardo demasiado' : err.message
    return NextResponse.json({ error: msg }, { status: 504 })
  }
}
