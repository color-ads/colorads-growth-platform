import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { adsEnabled, fetchGoogleAds } from '@/lib/ads/serpapi';
import { buildGoogleAdsBlock, toStoredGoogleAds } from '@/lib/ads/buildAdsBlock';
import { fetchHotelSnapshots, buildHotelBlock } from '@/lib/ads/hotels';
import type { AdvertiserMap, GoogleAdsBundle, HotelSnapshot } from '@/lib/ads/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;
const OUR_URL = 'https://hashtag98.com.co/';

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

async function urlAlive(u: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4500);
    const r = await fetch(u, {
      method: 'GET',
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; ColorADSBot/1.0)' },
    });
    clearTimeout(t);
    return !(r.status === 404 || r.status === 410);
  } catch {
    return false;
  }
}

function extractJson(text: string): any | null {
  if (!text) return null;
  let t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a === -1 || b === -1 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}

function buildKbText(data: any): string {
  const L: string[] = [];
  if (data.ourHotel && Array.isArray(data.ourHotel.alreadyDoing) && data.ourHotel.alreadyDoing.length) {
    L.push('LO QUE EL HOTEL YA HACE: ' + data.ourHotel.alreadyDoing.join('; '));
    L.push('');
  }
  L.push('HALLAZGOS DE COMPETENCIA (oportunidades que el hotel NO hace hoy):');
  for (const f of (data.findings || [])) {
    L.push(`- [${f.category || ''}] ${f.title || ''} (via ${f.competitor || ''}, confianza ${f.confidence || '?'})`);
    if (f.whatTheyDo) L.push(`  Hacen: ${f.whatTheyDo}`);
    if (f.weDont) L.push(`  No hacemos: ${f.weDont}`);
    if (f.opportunity) L.push(`  Oportunidad: ${f.opportunity}`);
  }
  if (data.diggingNote) { L.push(''); L.push('A profundizar el proximo mes: ' + data.diggingNote); }
  return L.join('\n').trim();
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') || 'h98';
  const fast = req.nextUrl.searchParams.get('fast') === '1';
  const db = admin();

  const { data: prop, error: perr } = await db
    .from('properties')
    .select('id, name, competitors, internal_context')
    .eq('slug', slug)
    .single();
  if (perr || !prop) {
    return NextResponse.json({ ok: false, error: 'property not found', detail: perr?.message }, { status: 404 });
  }

  const competitors: string[] = Array.isArray((prop as any).competitors)
    ? (prop as any).competitors.filter(Boolean)
    : [];
  if (!competitors.length) {
    return NextResponse.json({ ok: false, error: 'no competitors configured' }, { status: 400 });
  }

  // VERDAD DE BASE: contexto interno cargado por el equipo. Resiliente a null / vacio / texto / lista / objeto.
  const icRaw = (prop as any).internal_context;
  let internalContext = '';
  if (typeof icRaw === 'string') {
    internalContext = icRaw.trim();
  } else if (Array.isArray(icRaw)) {
    internalContext = icRaw.map((x) => String(x ?? '').trim()).filter(Boolean).map((x) => `- ${x}`).join('\n');
  } else if (icRaw && typeof icRaw === 'object') {
    try { internalContext = JSON.stringify(icRaw, null, 2); } catch { internalContext = ''; }
  }

  const baseTruthBlock = internalContext
    ? `

VERDAD DE BASE — LO QUE EL HOTEL YA HACE (fuente interna del equipo de ColorADS; tiene MAS autoridad que cualquier inferencia tuya desde la web):
${internalContext}

REGLA CRITICA E INVIOLABLE: NUNCA reportes como gap, finding u oportunidad algo que ya figure (explicita o equivalentemente) en esta VERDAD DE BASE, AUNQUE un competidor lo haga. Si un competidor hace algo que el hotel YA hace segun esta lista, es PARIDAD: va en "alsoChecked" en una sola linea, jamas como finding. Ademas, incluí integra esta lista dentro de "ourHotel.alreadyDoing".`
    : '';

  // EVIDENCIA DURA: datos verificados de Google Ads (SerpAPI). Gateado por SERPAPI_KEY.
  // Sin la key (o sin ad_advertiser_ids), adsBundle queda null -> bloque vacio -> prompt identico al de hoy.
  // Lectura DEFENSIVA en query aparte: si la columna ad_advertiser_ids aun no existe en Supabase,
  // Supabase devuelve error sin romper y aaiRaw queda null (cero regresion).
  let aaiRaw: any = null;
  if (adsEnabled()) {
    const { data: aai } = await db.from('properties').select('ad_advertiser_ids').eq('id', prop.id).single();
    aaiRaw = (aai as any)?.ad_advertiser_ids ?? null;
  }
  const advMap: AdvertiserMap = {
    self: Array.isArray(aaiRaw?.self) ? aaiRaw.self.map((x: unknown) => String(x).trim()).filter(Boolean) : [],
    competitors:
      aaiRaw?.competitors && typeof aaiRaw.competitors === 'object'
        ? Object.fromEntries(
            Object.entries(aaiRaw.competitors as Record<string, unknown>).map(([k, v]) => [
              k,
              Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [],
            ]),
          )
        : {},
  };
  const hasAdvIds = advMap.self.length > 0 || Object.keys(advMap.competitors).length > 0;

  let adsBundle: GoogleAdsBundle | null = null;
  if (adsEnabled() && hasAdvIds) {
    try {
      adsBundle = await fetchGoogleAds(advMap, { mode: fast ? 'fast' : 'deep' });
    } catch {
      adsBundle = null; // error aislado: el research sigue sin datos de Google Ads
    }
  }
  const googleAdsBlock = buildGoogleAdsBlock(adsBundle);

  // EVIDENCIA DURA: tarifas/posicionamiento (Google Hotels). Gateado por SERPAPI_KEY. fast no lo trae (barato).
  let hotelSnaps: HotelSnapshot[] | null = null;
  if (adsEnabled() && !fast && competitors.length) {
    try {
      hotelSnaps = await fetchHotelSnapshots({ self: prop.name, competitors }, { timeBudgetMs: 55000 });
    } catch {
      hotelSnaps = null;
    }
  }
  const hotelBlock = buildHotelBlock(hotelSnaps);

  const prompt = `Sos analista senior de growth y performance marketing para venta directa hotelera. Tu trabajo NO es describir competidores ni rellenar un informe: es encontrar de 1 a 3 HALLAZGOS realmente accionables que el hotel cliente todavia NO esta haciendo y que podrian mover su venta directa. Menos es mejor que rellenar.

HOTEL CLIENTE: ${prop.name}. Sitio oficial: ${OUR_URL}. Esta en El Poblado, Medellin (Colombia). Su segmento objetivo son EXTRANJEROS QUE YA ESTAN EN MEDELLIN o en Colombia (demanda en destino, alta intencion, ventana de decision corta). NUNCA propongas campanas dirigidas al exterior ni a publico que aun no viaja.${baseTruthBlock}${googleAdsBlock ? `\n\n${googleAdsBlock}` : ''}${hotelBlock ? `\n\n${hotelBlock}` : ''}

PASO 1 - Entende que YA hace el hotel cliente. Si arriba hay una VERDAD DE BASE, esa lista tiene PRIORIDAD sobre lo que infieras y debe incluirse integra en "ourHotel.alreadyDoing". Complementala visitando su sitio ${OUR_URL} y mirando su presencia publica (Instagram, ficha de Google); suma a "ourHotel.alreadyDoing" lo que YA tiene (motor de reservas, WhatsApp, codigos/promos, idiomas del sitio, packs, blog, redes). CRITICO: si el hotel ya lo hace, NO puede ser un hallazgo.

PASO 2 - Investiga a fondo a los competidores directos: ${competitors.join(', ')}. Haz multiples busquedas especificas. Tenes tiempo para un estudio profundo: SE EXHAUSTIVO, haz varias busquedas cubriendo las distintas lentes y a cada competidor antes de concluir; no te detengas temprano ni te conformes con la primera pagina de resultados. Cubri estas lentes y profundiza donde haya senal real:
- GOOGLE ADS: si arriba hay una seccion EVIDENCIA DURA, basate en ESA data verificada para Google Ads (no en inferencia web); si tu busqueda web la contradice, prevalece la EVIDENCIA DURA. Complementa buscando en el Centro de Transparencia de Anuncios de Google (adstransparency.google.com) y en SERP si cada competidor pauta. Que ofrecen los anuncios, sobre que terminos, a que landing llevan.
- META ADS: busca en la Meta Ad Library (facebook.com/ads/library) anuncios activos de cada competidor: angulos, ofertas, si pautan always-on o por rafagas.
- SEO / SERP: por que terminos rankean (ej "hotel el poblado", "where to stay medellin poblado", su marca), si tienen sitio en ingles, blog/contenido, resultados enriquecidos.
- OTAs / PORTALES: como aparecen en Booking/Expedia/Hostelworld, paridad de tarifa vs su sitio directo, que incentivo de reserva directa le gana a la OTA, score y resenas.
- FUNNEL DIRECTO Y OFERTAS: motor propio, chatbot, fidelidad/membresia, packs, codigos.
- CONTENIDO / VIRALIDAD: angulos de Instagram/TikTok que de verdad empujan reservas (UGC, creadores), crecimiento de seguidores.
Si una libreria de anuncios no carga o es dinamica, NO inventes: usa lo que SI puedas ver (landings, anuncios en SERP, menciones) y baja el confidence; podes sugerir una verificacion manual en diggingNote.

PASO 3 - Filtra sin piedad. Para que algo sea finding tiene que cumplir TODO: (a) el hotel cliente NO lo hace hoy, (b) es concreto y lo respalda evidencia que viste en la web, (c) es plausible que mueva reserva directa del extranjero ya en destino. Si algo es paridad (ya lo hacemos, ej un boton de WhatsApp generico), generico o no accionable, NO lo pongas como finding: ponelo en "alsoChecked" en una sola linea.

REGLAS DE SALIDA:
- Maximo 3 findings. Si solo 1 vale la pena, devolve 1. Si casi no hay nada, devolve 0 o 1 y usa "diggingNote" para decir DONDE meter el dedo el proximo mes (que fuente o competidor revisar mas a fondo).
- Cada finding ESPECIFICO y con EVIDENCIA: nombra al competidor, la tactica exacta, que viste, y de 1 a 3 URLs de respaldo que REALMENTE aparecieron en tus busquedas. NO inventes ni construyas URLs de memoria; solo links que viste; prefiere dominios oficiales.
- whatTheyDo: 2 a 4 frases concretas sobre el competidor. weDont: 1 a 2 frases que describan, en tono neutral y constructivo, el espacio de mejora del hotel cliente como una oportunidad todavia no aprovechada (NUNCA como deficiencia, error ni en tono critico). opportunity: 1 a 3 frases con una ruta concreta y puntual para mejorar conversion.
- Se honesto con confidence (alta/media/baja) segun la evidencia.
- TONO Y PRESENTACION (CRITICO — este informe lo lee el HOTEL CLIENTE en su tablero): presenta cada hallazgo como una RUTA CONCRETA Y ACCIONABLE PARA MEJORAR LA CONVERSION, en tono profesional, neutral y constructivo. PROHIBIDO usar calificativos negativos o alarmistas sobre el hotel cliente: nada de "grave", "derroche", "derrochando", "desperdicio", "desperdiciando", "mal", "error", "problema", "falla", "deficiente", "perdiendo plata", "estas perdiendo". NUNCA describas al hotel cliente como que hace algo mal: enmarca TODO como una oportunidad puntual de optimizacion. Ejemplo: en vez de "tus ads se muestran en 20 paises derrochando presupuesto", escribi "hay una oportunidad puntual de concentrar la pauta en Colombia y mercados emisores clave para mejorar la conversion del trafico en destino". El competidor puede describirse con neutralidad; la critica nunca recae sobre el cliente.
- ANALISIS DE ESTRUCTURA DE ANUNCIOS ("adAnalysis"): si arriba hay EVIDENCIA DURA de Google Ads, descompone la composicion de los anuncios SOLO DE LOS COMPETIDORES. NUNCA analices ni incluyas al hotel cliente (${prop.name}) en "adAnalysis": el objetivo es explorar a la competencia, no exponer al cliente. Para anuncios de TEXTO del competidor: SUBRAYA de 3 a 5 atributos de su estructura (Hook, Oferta, CTA, Keywords/Sitelinks, Urgencia, Propuesta de valor), con el "value" EXACTO que usan y un "takeaway" de que puede rescatar el hotel cliente. Para anuncios de IMAGEN o VIDEO del competidor: NO analices texto; solo una "visualNote" de 1 frase describiendo la composicion (que se ve: ambiente, producto, gente, vista). Un objeto por COMPETIDOR (jamas el hotel cliente).

Responde UNICAMENTE con JSON valido, sin markdown, sin texto antes ni despues:
{
  "ourHotel": { "name": "${prop.name}", "url": "${OUR_URL}", "alreadyDoing": ["...", "..."] },
  "findings": [
    {
      "title": "ruta concreta de mejora en una linea, en tono neutral y constructivo (sin calificativos negativos sobre el hotel cliente)",
      "competitor": "quien lo hace",
      "category": "Google Ads | Meta Ads | SEO | OTAs | Funnel directo | Contenido",
      "whatTheyDo": "2 a 4 frases con detalle y lo que viste del competidor",
      "weDont": "1 a 2 frases: el espacio de mejora del hotel cliente enmarcado como oportunidad, en tono neutral (nunca como deficiencia ni critica)",
      "opportunity": "1 a 3 frases: la ruta puntual para mejorar conversion y por que encaja con el extranjero ya en destino",
      "evidence": [ { "label": "que es", "url": "https://..." } ],
      "confidence": "alta|media|baja"
    }
  ],
  "alsoChecked": ["cosa revisada que ya hacemos o no aporta, en 1 linea"],
  "diggingNote": "si se encontro poco, donde profundizar el proximo mes",
  "adAnalysis": [
    {
      "competitor": "nombre del COMPETIDOR (NUNCA el hotel cliente)",
      "textAttributes": [
        { "attribute": "Hook | Oferta | CTA | Keywords/Sitelinks | Urgencia | Propuesta de valor", "value": "el texto exacto que usan", "takeaway": "que puede rescatar el hotel cliente" }
      ],
      "visualNote": "para imagen/video: 1 frase de composicion (que se ve). Vacio si solo hay texto."
    }
  ]
}

Todo en espanol. Devolve SOLO el JSON.`;

  let rawText = '';
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), fast ? 150000 : 280000);
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 12000,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: fast ? 4 : 10 }],
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    clearTimeout(t);
    const j = await resp.json();
    if (!resp.ok) {
      return NextResponse.json({ ok: false, error: 'anthropic error', detail: j }, { status: 502 });
    }
    rawText = (j.content || [])
      .filter((b: any) => b && b.type === 'text' && typeof b.text === 'string')
      .map((b: any) => b.text)
      .join('');
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'request failed (posible timeout; reintenta)', detail: String(e?.message || e) }, { status: 500 });
  }

  let data: any = extractJson(rawText);
  if (!data || typeof data !== 'object') {
    data = { ourHotel: { name: prop.name, url: OUR_URL, alreadyDoing: [] }, findings: [], alsoChecked: [], diggingNote: '', summary: rawText.trim().slice(0, 4000) };
  }
  data.ourHotel = (data.ourHotel && typeof data.ourHotel === 'object') ? data.ourHotel : { name: prop.name, url: OUR_URL, alreadyDoing: [] };
  if (!Array.isArray(data.ourHotel.alreadyDoing)) data.ourHotel.alreadyDoing = [];
  data.findings = Array.isArray(data.findings) ? data.findings.slice(0, 3) : [];
  data.alsoChecked = Array.isArray(data.alsoChecked) ? data.alsoChecked : [];
  data.adAnalysis = Array.isArray(data.adAnalysis) ? data.adAnalysis : [];

  const urls = new Set<string>();
  for (const f of data.findings) {
    const ev = Array.isArray(f.evidence) ? f.evidence : [];
    for (const e of ev) if (e && e.url) urls.add(String(e.url));
  }
  const alive: Record<string, boolean> = {};
  await Promise.allSettled([...urls].map(async (u) => { alive[u] = await urlAlive(u); }));
  for (const f of data.findings) {
    f.evidence = (Array.isArray(f.evidence) ? f.evidence : []).filter((e: any) => e && e.url && alive[String(e.url)]);
  }

  data.generatedAt = new Date().toISOString();
  // Adjuntar creatividades verificadas de Google Ads (para mostrar ejemplos/imagenes en el tablero).
  data.googleAds = toStoredGoogleAds(adsBundle);
  // Adjuntar tarifas/posicionamiento verificados (Google Hotels).
  data.hotelSnapshot = hotelSnaps || [];
  const kbText = buildKbText(data);

  const upd = await db.from('properties').update({ ai_competition_data: data, ai_competition_kb: kbText }).eq('id', prop.id);
  if (upd.error) {
    await db.from('properties').update({ ai_competition_kb: kbText }).eq('id', prop.id);
  }

  return NextResponse.json({ ok: true, fast, findings: data.findings.length, data });
}
