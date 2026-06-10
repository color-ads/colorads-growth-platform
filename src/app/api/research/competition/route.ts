import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

  const prompt = `Sos analista senior de growth y performance marketing para venta directa hotelera. Tu trabajo NO es describir competidores ni rellenar un informe: es encontrar de 1 a 3 HALLAZGOS realmente accionables que el hotel cliente todavia NO esta haciendo y que podrian mover su venta directa. Menos es mejor que rellenar.

HOTEL CLIENTE: ${prop.name}. Sitio oficial: ${OUR_URL}. Esta en El Poblado, Medellin (Colombia). Su segmento objetivo son EXTRANJEROS QUE YA ESTAN EN MEDELLIN o en Colombia (demanda en destino, alta intencion, ventana de decision corta). NUNCA propongas campanas dirigidas al exterior ni a publico que aun no viaja.${baseTruthBlock}

PASO 1 - Entende que YA hace el hotel cliente. Si arriba hay una VERDAD DE BASE, esa lista tiene PRIORIDAD sobre lo que infieras y debe incluirse integra en "ourHotel.alreadyDoing". Complementala visitando su sitio ${OUR_URL} y mirando su presencia publica (Instagram, ficha de Google); suma a "ourHotel.alreadyDoing" lo que YA tiene (motor de reservas, WhatsApp, codigos/promos, idiomas del sitio, packs, blog, redes). CRITICO: si el hotel ya lo hace, NO puede ser un hallazgo.

PASO 2 - Investiga a fondo a los competidores directos: ${competitors.join(', ')}. Haz multiples busquedas especificas. Tenes tiempo para un estudio profundo: SE EXHAUSTIVO, haz varias busquedas cubriendo las distintas lentes y a cada competidor antes de concluir; no te detengas temprano ni te conformes con la primera pagina de resultados. Cubri estas lentes y profundiza donde haya senal real:
- GOOGLE ADS: busca en el Centro de Transparencia de Anuncios de Google (adstransparency.google.com) y en SERP si cada competidor pauta. Que ofrecen los anuncios, sobre que terminos, a que landing llevan.
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
- whatTheyDo: 2 a 4 frases concretas. weDont: 1 a 2 frases especificas al hotel cliente. opportunity: 1 a 3 frases, algo concreto para probar.
- Se honesto con confidence (alta/media/baja) segun la evidencia.

Responde UNICAMENTE con JSON valido, sin markdown, sin texto antes ni despues:
{
  "ourHotel": { "name": "${prop.name}", "url": "${OUR_URL}", "alreadyDoing": ["...", "..."] },
  "findings": [
    {
      "title": "hallazgo concreto en una linea",
      "competitor": "quien lo hace",
      "category": "Google Ads | Meta Ads | SEO | OTAs | Funnel directo | Contenido",
      "whatTheyDo": "2 a 4 frases con detalle y lo que viste",
      "weDont": "1 a 2 frases: el gap especifico del hotel cliente",
      "opportunity": "1 a 3 frases: que probar y por que encaja con el extranjero ya en destino",
      "evidence": [ { "label": "que es", "url": "https://..." } ],
      "confidence": "alta|media|baja"
    }
  ],
  "alsoChecked": ["cosa revisada que ya hacemos o no aporta, en 1 linea"],
  "diggingNote": "si se encontro poco, donde profundizar el proximo mes"
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
        max_tokens: 8000,
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
  const kbText = buildKbText(data);

  const upd = await db.from('properties').update({ ai_competition_data: data, ai_competition_kb: kbText }).eq('id', prop.id);
  if (upd.error) {
    await db.from('properties').update({ ai_competition_kb: kbText }).eq('id', prop.id);
  }

  return NextResponse.json({ ok: true, fast, findings: data.findings.length, data });
}
