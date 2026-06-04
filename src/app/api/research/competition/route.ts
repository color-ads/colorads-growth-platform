import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Investigacion web de competencia (manual). Genera/actualiza properties.ai_competition_kb.
// Los competidores se configuran por hotel en properties.competitors (editable desde el admin).
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

    let competitors: string[] = []
    const { data: cRow } = await supabase.from('properties').select('competitors').eq('id', prop.id).maybeSingle()
    const raw = (cRow as { competitors?: unknown } | null)?.competitors
    if (Array.isArray(raw)) competitors = (raw as unknown[]).map((x) => String(x)).filter(Boolean)
    const list = competitors.length ? competitors.join(', ') : 'hoteles boutique o medianos comparables en El Poblado, Medellin'

    const prompt = `Sos analista de growth e inteligencia competitiva hotelera. Con como MAXIMO 3 busquedas web enfocadas, analiza estos competidores REALES de ${prop.name} en El Poblado, Medellin: ${list}.

Para CADA competidor, busca señales que valga la pena DESTACAR para el growth de la venta directa:
- Innovacion y tecnificacion: motor de reservas propio, app, chatbot o WhatsApp, automatizaciones, check-in digital, upsell automatizado.
- Promos y codigos: ofertas, codigos de descuento, tarifa de socio o directo, paquetes, beneficios exclusivos por reservar directo.
- Viralidad en redes: contenido que les funciona, formatos o reels con mucha traccion, campañas, colaboraciones con creadores.
- Cualquier otra palanca de growth que los haga destacar.
Si de algun competidor NO hay nada nuevo o relevante para destacar, decilo en una linea: NO inventes ni rellenes.

Ademas, 2 o 3 ideas accionables para ${prop.name}, recordando que el publico son extranjeros que YA estan en Colombia/Medellin (demanda en destino; nada de campanas al exterior).

Devolve TEXTO PLANO en espanol (sin markdown: sin '#', sin '---', sin asteriscos; parrafos cortos y limpios), conciso (~400 palabras). Arranca DIRECTO con el analisis: NO escribas preambulos ni frases como "aqui va el analisis" o "en texto plano". Solo afirma cosas respaldadas en la web. Lista breve de referencias (URLs) al final, sin cortarte antes.`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 290000)
    let res: Response
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2400,
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
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
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    if (!text) return NextResponse.json({ error: 'empty result' }, { status: 502 })

    const { error } = await supabase.from('properties').update({ ai_competition_kb: text }).eq('id', prop.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, length: text.length, competitors, competition_kb: text })
  } catch (e) {
    const err = e as Error
    const msg = err.name === 'AbortError' ? 'timeout: la busqueda web tardo demasiado' : err.message
    return NextResponse.json({ error: msg }, { status: 504 })
  }
}
