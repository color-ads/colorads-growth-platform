import { createClient } from '@supabase/supabase-js'
import { getReservations } from '@/lib/api/cloudbeds'
import { getInsightsBookingMetrics, getProductionByCountry } from '@/lib/api/insights'
import type { GeoBreakdown, RoomCategoryBreakdown } from '@/types'

const DI = 'https://api.cloudbeds.com/datainsights/v1.1'
const MES_ABBR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function pct(n: number, t: number) { return t > 0 ? Math.round((n / t) * 1000) / 10 : 0 }
const pad = (n: number) => String(n).padStart(2, '0')
function toNum(v: unknown): number {
  if (v == null || v === '-' || v === '') return 0
  const n = parseFloat(String(v).replace(/,/g, ''))
  return isNaN(n) ? 0 : n
}

async function di(apiKey: string, pid: string, reportId: number, body: object) {
  const res = await fetch(`${DI}/stock_reports/${reportId}/query/data?mode=Run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'X-PROPERTY-ID': pid, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`report ${reportId} -> ${res.status}: ${(await res.text()).slice(0, 150)}`)
  return res.json()
}

async function bookingStayDistribution(
  apiKey: string, pid: string, year: number, month: number, attrSources: string[],
) {
  const ny = month === 12 ? year + 1 : year
  const nm = month === 12 ? 1 : month + 1
  const d = await di(apiKey, pid, 17, {
    property_ids: [parseInt(pid)],
    filters: { and: [
      { cdf: { type: 'default', column: 'booking_datetime_property_timezone' }, operator: 'greater_than_or_equal', value: `${year}-${pad(month)}-01T00:00:00` },
      { cdf: { type: 'default', column: 'booking_datetime_property_timezone' }, operator: 'less_than', value: `${ny}-${pad(nm)}-01T00:00:00` },
    ]},
    settings: { details: true, totals: false, subtotals: false, transpose: false },
  })
  const records = d.records ?? {}
  const len = (records.checkin_date ?? records.grand_total_amount ?? records.reservation_source ?? []).length
  const attr = new Set(attrSources)
  const selfKey = `${year}-${pad(month)}`
  const byMonth: Record<string, { revenue: number; bookings: number }> = {}
  for (let i = 0; i < len; i++) {
    const status = String(records.reservation_status?.[i] ?? '').toLowerCase()
    if (status.includes('cancel')) continue
    const src = String(records.reservation_source?.[i] ?? '')
    if (attr.size && !attr.has(src)) continue
    const checkin = String(records.checkin_date?.[i] ?? '')
    if (!checkin || checkin === '-') continue
    const dt = new Date(checkin)
    if (isNaN(dt.getTime())) continue
    const key = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`
    if (key < selfKey) continue
    if (!byMonth[key]) byMonth[key] = { revenue: 0, bookings: 0 }
    byMonth[key].revenue += toNum(records.grand_total_amount?.[i])
    byMonth[key].bookings += 1
  }
  const sorted = Object.keys(byMonth).sort()
  const out = sorted.map((k) => {
    const [yy, mm] = k.split('-').map(Number)
    return {
      key: k,
      label: `${MES_ABBR[mm - 1]}${yy !== year ? " '" + String(yy).slice(2) : ''}`,
      revenue: Math.round(byMonth[k].revenue),
      bookings: byMonth[k].bookings,
      self: k === selfKey,
    }
  })
  const CAP = 7
  if (out.length <= CAP) return out
  const head = out.slice(0, CAP - 1)
  const tail = out.slice(CAP - 1)
  head.push({
    key: 'posterior', label: 'Posterior',
    revenue: tail.reduce((a, b) => a + b.revenue, 0),
    bookings: tail.reduce((a, b) => a + b.bookings, 0),
    self: false,
  })
  return head
}

// ─── Base de conocimiento del hotel (estable, reutilizada en cada generacion) ────
const HOTEL_KB: Record<string, string> = {
  h98: `HOTEL: Hashtag 98 Hotel, en El Poblado, Medellin, Colombia (sitio: hashtag98.com.co). Canal analizado: VENTA DIRECTA (reservas por canales propios) frente a las OTAs.

PREMISA CLAVE DE TARGETING (respetar SIEMPRE): el publico objetivo son EXTRANJEROS QUE YA ESTAN EN COLOMBIA / en Medellin: demanda en destino, alta intencion y ventana de reserva corta. Hacer campanas hacia el exterior (extranjeros en su pais de origen) es CARO y de retorno muy bajo; NO proponer eso. Toda propuesta de captacion debe enfocarse en quienes ya estan en el pais/ciudad: geolocalizacion dentro de Colombia, remarketing de alta intencion, last-minute, y presencia en los momentos de decision en destino.

BENCHMARK ESTABLE (propio de marketing hotelero; usar este, NO 'rangos de ROAS' genericos de internet): el costo de referencia es la COMISION DE OTAs. Booking.com y Expedia cobran aprox. 15-20% del valor de la reserva (hasta ~25% con programas de visibilidad). El canal directo es rentable mientras el costo de adquisicion directo (coste publicitario como % de la venta directa) se mantenga POR DEBAJO de esa comision. Equivalencia util: una comision de ~18% equivale a un ROAS de break-even de ~5.5x; por encima de ~6x el canal directo ya es claramente mas rentable que vender por OTA. Al evaluar el ROAS, anclalo SIEMPRE a esta logica (cuanta comision OTA estamos ahorrando), nunca a cifras de industria inventadas.

CONTEXTO DE MERCADO: El Poblado es la zona prime de Medellin para turismo, vida nocturna, nomadas digitales/expats y negocios; alto volumen de visitantes extranjeros y fuerte demanda de ultimo momento ya en destino.

PALANCAS DE GROWTH HACKING HOTELERO (elegir las que encajen con los datos del mes): mover demanda de OTA a directo con tarifa o beneficio directo exclusivo; garantia de mejor precio directo; remarketing a visitantes de alta intencion que no reservaron; email/CRM a huespedes pasados; campanas por ventana de reserva (lead time) priorizando last-minute en destino; concentrar presupuesto en los mercados de origen de mayor valor (entre los que ya estan en el pais); upsell hacia las categorias de mayor ADR; optimizar el funnel de reserva del sitio.`,
}

// ─── Conclusiones / propuestas IA (ciclo mensual de experimentacion) ─────────────
type Card = { title: string; body: string }
type AiInsights = { positive: Card[]; attention: Card[]; strategic: Card[] }

// Formatea las propuestas del mes anterior (para el look-back).
function formatPriorProposals(ai: AiInsights | null): string {
  if (!ai) return ''
  const lines: string[] = []
  for (const c of (ai.positive || [])) lines.push(`[fortaleza] ${c.title}: ${c.body}`)
  for (const c of (ai.attention || [])) lines.push(`[a vigilar] ${c.title}: ${c.body}`)
  for (const c of (ai.strategic || [])) lines.push(`[propuesta] ${c.title}: ${c.body}`)
  return lines.join('\n')
}

async function generateInsights(ctx: {
  hotelName: string; knowledgeBase: string; priorProposals: string; year: number; month: number
  attrRevenue: number; totalInvestment: number; roas: number; adCostPct: number; fee: number; successFeePct: number
  google: number; meta: number; content: number; fees: number; clicks: number; cpc: number; impressions: number
  bookingVolume: number; bookingCount: number; avgTicket: number; avgNights: number
  reservationStatus: Record<string, number>; leadTime: Record<string, number>
  topCountries: { country: string; revenue: number; pct: number }[]
  topRoomTypes: { category_name: string; revenue: number; pct: number }[]
  stayDist: { label: string; revenue: number; self: boolean }[]
}): Promise<{ insights: AiInsights | null; debug: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { insights: null, debug: 'NO_API_KEY' }
  const cop = (n: number) => '$' + (Math.round(n) / 1e6).toFixed(1) + 'M'
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  const mesNombre = meses[ctx.month - 1] ?? String(ctx.month)

  const prompt = `Sos consultor senior de growth marketing hotelero de la agencia ColorADS. Entregas conclusiones de nivel consultoria sobre el canal de VENTA DIRECTA del hotel: precisas, accionables y honestas. Las lee el dueno del hotel, asi que deben sonar expertas y dejar bien parado el trabajo de la agencia. REGLA DE ORO: no inventes datos ni cifras de mejora; usa SOLO los numeros del mes que te doy, tu base de conocimiento y criterio profesional.

El analisis es un CICLO MENSUAL de experimentacion: cada mes cerramos con lo aprendido y planteamos hipotesis para probar el mes siguiente; al mes siguiente evaluamos si funcionaron.

=== BASE DE CONOCIMIENTO DEL HOTEL Y SU ESTRATEGIA ===
${ctx.knowledgeBase || '(sin base; usa criterio general de marketing hotelero y la premisa de captar extranjeros YA presentes en el pais, nunca campanas al exterior)'}

=== PROPUESTAS DEL MES ANTERIOR (lo que planteamos probar este mes) ===
${ctx.priorProposals || '(no hay analisis del mes anterior; este es el punto de partida del ciclo)'}

=== DATOS REALES DE ${mesNombre} ${ctx.year} ===
- Facturacion atribuible (venta directa generada por el marketing): ${cop(ctx.attrRevenue)}
- Inversion total en marketing: ${cop(ctx.totalInvestment)}
- ROAS: ${ctx.roas.toFixed(1)}x · coste publicitario: ${ctx.adCostPct.toFixed(1)}% de la venta directa
- Fee de exito (${ctx.successFeePct}%): ${cop(ctx.fee)}
- Inversion por canal: Google ${cop(ctx.google)} (${ctx.clicks.toLocaleString()} clics, CPC ${cop(ctx.cpc)}), Meta ${cop(ctx.meta)} (${ctx.impressions.toLocaleString()} impresiones), Contenido ${cop(ctx.content)}, Honorarios ${cop(ctx.fees)}
- Reservas: ${ctx.bookingCount} reservas por ${cop(ctx.bookingVolume)}, ticket promedio ${cop(ctx.avgTicket)}, estadia promedio ${ctx.avgNights.toFixed(1)} noches
- Estado de reservas (%): ${Object.entries(ctx.reservationStatus).map(([k, v]) => `${k} ${Number(v).toFixed(0)}%`).join(', ')}
- Antelacion de reserva (%): ${Object.entries(ctx.leadTime).map(([k, v]) => `${k} ${Number(v).toFixed(0)}%`).join(', ')}
- Top paises por venta: ${ctx.topCountries.slice(0, 5).map((c) => `${c.country} ${cop(c.revenue)} (${c.pct.toFixed(0)}%)`).join(', ')}
- Top categorias de habitacion: ${ctx.topRoomTypes.slice(0, 5).map((r) => `${r.category_name} ${cop(r.revenue)}`).join(', ')}
- Ritmo de venta de reservas (meses de estadia reservados este mes): ${ctx.stayDist.map((s) => `${s.label} ${cop(s.revenue)}${s.self ? ' (mismo mes)' : ''}`).join(', ')}

=== REGLAS DE LA ENTREGA ===
- EXACTAMENTE 4 items.
- SI hay propuestas del mes anterior: dedica 1 o 2 items a EVALUAR si esas propuestas funcionaron, mirando como se movieron los numeros de este mes ("good" si funciono, "watch" si no rindio o sigue pendiente). Se honesto: si algo no se movio, decilo claramente.
- Los items restantes (al menos 2) son PROPUESTAS/EXPERIMENTOS para probar el PROXIMO mes ("action"), de las palancas de la base de conocimiento, atados a estos numeros y respetando la premisa de targeting (extranjeros ya en el pais; jamas campanas al exterior). Planteales como hipotesis: que vamos a probar y que esperamos que mueva.
- SI NO hay propuestas del mes anterior: los 4 son propuestas/experimentos para el proximo mes (3-4 "action", como mucho 1 "good"/"watch" de contexto).
- En al menos un item evalua el ROAS de ${ctx.roas.toFixed(1)}x usando el benchmark de comision OTA de la base de conocimiento (no rangos genericos) y traducilo a una accion.
- Cada item atado a un numero real del mes. Nada generico, sin promesas garantizadas ni cifras inventadas.
- LARGO (el texto va en tarjetas): "title" 3 a 6 palabras. "body" CONCISO: 1 o 2 frases, MAXIMO ~45 palabras.
- Tono: consultoria profesional, segura y honesta.

Responde SOLO con JSON valido (sin markdown ni texto extra): un objeto con la clave "items" cuyo valor es un array de EXACTAMENTE 4 objetos, cada uno con las claves "tone" (good|watch|action), "title" (string) y "body" (string).`

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 25000)
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }),
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) {
      const body = (await res.text()).slice(0, 150)
      return { insights: null, debug: `API_${res.status}: ${body}` }
    }
    const data = await res.json()
    const text: string = (data.content ?? [])
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('\n')
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim()
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      const m = jsonStr.match(/\{[\s\S]*\}/)
      if (!m) return { insights: null, debug: `PARSE_FAIL raw: ${text.slice(0, 150)}` }
      try { parsed = JSON.parse(m[0]) } catch { return { insights: null, debug: `PARSE_FAIL raw: ${text.slice(0, 150)}` } }
    }
    const root = parsed as { items?: unknown }
    const items: { tone?: string; title?: string; body?: string }[] = Array.isArray(parsed) ? parsed as [] : ((root.items as []) ?? [])
    const out: AiInsights = { positive: [], attention: [], strategic: [] }
    for (const it of items) {
      const card: Card = { title: String(it.title ?? '').slice(0, 120), body: String(it.body ?? '').slice(0, 600) }
      if (!card.title && !card.body) continue
      if (it.tone === 'good') out.positive.push(card)
      else if (it.tone === 'watch') out.attention.push(card)
      else out.strategic.push(card)
    }
    const total = out.positive.length + out.attention.length + out.strategic.length
    if (total === 0) return { insights: null, debug: `EMPTY raw: ${text.slice(0, 150)}` }
    return { insights: out, debug: `OK ${total} items` }
  } catch (e) {
    return { insights: null, debug: `EXCEPTION: ${(e as Error).message}` }
  }
}

export async function buildMonthReport(slug: string, year: number, month: number, opts: { withAi?: boolean; force?: boolean } = {}) {
  const apiKey = process.env.CLOUDBEDS_API_KEY
  if (!apiKey) throw new Error('CLOUDBEDS_API_KEY not configured')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data: property } = await supabase.from('properties')
    .select('id,slug,name,primary_color,secondary_color,success_fee_pct,attributable_sources,cloudbeds_property_id')
    .eq('slug', slug).single()
  if (!property) throw new Error('Property not found')

  const { data: billingRow } = await supabase.from('monthly_billing').select('*')
    .eq('property_id', property.id).eq('year', year).eq('month', month).maybeSingle()
  const billing = billingRow ?? {
    total_revenue: 0, google_investment: 0, meta_investment: 0, content_investment: 0,
    fees: 0, total_investment: 0, ad_cost_pct: 0, roas: 0, clicks: 0, impressions: 0, cpc: 0,
    booking_volume: null, booking_count: null,
  }

  const attrSources = property.attributable_sources ?? []
  const propertyId  = property.cloudbeds_property_id ?? '212206'

  const [insightsMetrics, arrivals, countryProduction, stayDist] = await Promise.all([
    getInsightsBookingMetrics(apiKey, propertyId, year, month, attrSources),
    getReservations(apiKey, {
      checkInFrom: `${year}-${pad(month)}-01`,
      checkInTo:   `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`,
      status: 'not_confirmed,confirmed,checked_in,checked_out,no_show',
    }),
    getProductionByCountry(apiKey, propertyId, year, month, attrSources),
    bookingStayDistribution(apiKey, propertyId, year, month, attrSources),
  ])

  let guests = 0, nights = 0
  for (const r of arrivals) {
    if (r.status === 'cancelled') continue
    guests += parseInt(r.adults || '0') + parseInt(r.children || '0')
    nights += Math.round((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / 86_400_000)
  }

  const totalCountryRevenue = countryProduction.reduce((s, c) => s + c.revenue, 0) || 1
  const geoBreakdown: GeoBreakdown[] = countryProduction.slice(0, 6).map(c => ({
    country: c.country, country_code: '', revenue: c.revenue, bookings: c.bookings,
    pct: pct(c.revenue, totalCountryRevenue),
  }))

  const totalRooms = insightsMetrics.topRoomTypes.reduce((s, r) => s + r.count, 0) || 1
  const roomBreakdown: RoomCategoryBreakdown[] = insightsMetrics.topRoomTypes
    .filter(r => !r.name.includes(','))
    .map(r => ({ category_name: r.name, revenue: r.revenue, bookings: r.count, pct: pct(r.count, totalRooms) }))

  const payload = {
    property: { slug: property.slug, name: property.name, primaryColor: property.primary_color, secondaryColor: property.secondary_color, successFeePct: property.success_fee_pct },
    period: { year, month },
    metrics: {
      guests, nights,
      bookingVolume:       billing.booking_volume ?? insightsMetrics.bookingVolume,
      bookingCount:        billing.booking_count  ?? insightsMetrics.bookingCount,
      avgTicket:           insightsMetrics.avgTicket,
      avgNightsPerBooking: insightsMetrics.avgNightsPerBooking,
      reservationStatus:   insightsMetrics.reservationStatus,
      leadTime:            insightsMetrics.leadTime,
      topRoomTypes:        roomBreakdown,
      topCountries:        geoBreakdown,
    },
    bookingStayDistribution: stayDist,
    billing: {
      totalRevenue: billing.total_revenue, googleInvestment: billing.google_investment,
      metaInvestment: billing.meta_investment, contentInvestment: billing.content_investment,
      fees: billing.fees, totalInvestment: billing.total_investment, adCostPct: billing.ad_cost_pct,
      roas: billing.roas, clicks: billing.clicks, impressions: billing.impressions, cpc: billing.cpc,
    },
    _meta: { arrivals: arrivals.length, bookingCount: insightsMetrics.bookingCount, geoCountries: countryProduction.length, geoTotal: Math.round(totalCountryRevenue), dataSource: 'insights+pms+supabase' },
  }

  // ── Conclusiones IA: ciclo mensual. Mes cerrado con analisis -> se congela (salvo force).
  const withAi = opts.withAi !== false
  const force = opts.force === true
  let aiInsights: AiInsights | null = null
  if (withAi) {
    const { data: existingRow } = await supabase.from('monthly_dashboard_cache')
      .select('payload').eq('property_id', property.id).eq('year', year).eq('month', month).maybeSingle()
    const existingAi = ((existingRow?.payload as { aiInsights?: AiInsights } | null)?.aiInsights) ?? null

    const now = new Date()
    const isPastMonth = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)

    if (isPastMonth && existingAi && !force) {
      // Mes cerrado con analisis ya hecho: congelado (registro de hipotesis). No regenerar.
      aiInsights = existingAi
    } else {
      // Look-back: propuestas del mes anterior (de la cache).
      const pm = month === 1 ? 12 : month - 1
      const py = month === 1 ? year - 1 : year
      const { data: prevRow } = await supabase.from('monthly_dashboard_cache')
        .select('payload').eq('property_id', property.id).eq('year', py).eq('month', pm).maybeSingle()
      const prevAi = ((prevRow?.payload as { aiInsights?: AiInsights } | null)?.aiInsights) ?? null

      let attrRevenue = 0
      const attrSet = new Set(attrSources)
      const { data: srcRows } = await supabase.from('monthly_source_revenue')
        .select('source,stay_revenue').eq('property_id', property.id).eq('year', year).eq('month', month)
      for (const r of (srcRows ?? [])) if (attrSet.has(r.source)) attrRevenue += Number(r.stay_revenue) || 0
      attrRevenue = Math.round(attrRevenue)

      const totalInvestment = Number(billing.total_investment) || 0
      const r = await generateInsights({
        hotelName: property.name, knowledgeBase: HOTEL_KB[slug] ?? '',
        priorProposals: formatPriorProposals(prevAi),
        year, month, attrRevenue, totalInvestment,
        roas: totalInvestment > 0 ? attrRevenue / totalInvestment : 0,
        adCostPct: attrRevenue > 0 ? (totalInvestment / attrRevenue) * 100 : 0,
        fee: Math.round((attrRevenue * (Number(property.success_fee_pct) || 0)) / 100),
        successFeePct: Number(property.success_fee_pct) || 0,
        google: Number(billing.google_investment) || 0, meta: Number(billing.meta_investment) || 0,
        content: Number(billing.content_investment) || 0, fees: Number(billing.fees) || 0,
        clicks: Number(billing.clicks) || 0, cpc: Number(billing.cpc) || 0, impressions: Number(billing.impressions) || 0,
        bookingVolume: payload.metrics.bookingVolume, bookingCount: payload.metrics.bookingCount,
        avgTicket: insightsMetrics.avgTicket, avgNights: insightsMetrics.avgNightsPerBooking,
        reservationStatus: insightsMetrics.reservationStatus as unknown as Record<string, number>,
        leadTime: insightsMetrics.leadTime as unknown as Record<string, number>,
        topCountries: geoBreakdown.map((g) => ({ country: g.country, revenue: g.revenue, pct: g.pct })),
        topRoomTypes: roomBreakdown.map((r) => ({ category_name: r.category_name, revenue: r.revenue, pct: r.pct })),
        stayDist: stayDist.map((s) => ({ label: s.label, revenue: s.revenue, self: s.self })),
      })
      aiInsights = r.insights ?? existingAi   // si falla la generacion, no borrar lo que habia
      if (!r.insights) console.error('[buildMonthReport] insights null:', r.debug)
    }
  } else {
    const { data: existing } = await supabase.from('monthly_dashboard_cache')
      .select('payload').eq('property_id', property.id).eq('year', year).eq('month', month).maybeSingle()
    aiInsights = ((existing?.payload as { aiInsights?: AiInsights } | null)?.aiInsights) ?? null
  }

  const fullPayload = { ...payload, aiInsights }

  const { error } = await supabase.from('monthly_dashboard_cache').upsert(
    { property_id: property.id, year, month, payload: fullPayload, refreshed_at: new Date().toISOString() },
    { onConflict: 'property_id,year,month' },
  )
  if (error) console.error('[buildMonthReport] cache upsert:', error.message)

  return fullPayload
}
