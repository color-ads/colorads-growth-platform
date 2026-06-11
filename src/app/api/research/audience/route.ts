import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchGoogleAdsAudience, googleAdsEnabled } from '@/lib/ads/googleAds';
import { fetchGA4Audience } from '@/lib/ads/ga4';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;

function admin() { return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } }); }
function keyOf(y: number, m: number) { return `${y}-${m}`; }
function monthRange(y: number, m: number) {
  const since = `${y}-${String(m).padStart(2, '0')}-01`;
  const until = `${y}-${String(m).padStart(2, '0')}-${new Date(y, m, 0).getDate()}`;
  return { since, until };
}
function extractJson(text: string): any | null {
  if (!text) return null;
  const t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const a = t.indexOf('{'); const b = t.lastIndexOf('}');
  if (a === -1 || b === -1 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}

// ── GET: devolver lo guardado para el mes ──────────────────────────────────────
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') || 'h98';
  const y = parseInt(req.nextUrl.searchParams.get('y') || '', 10);
  const m = parseInt(req.nextUrl.searchParams.get('m') || '', 10);
  if (!y || !m) return NextResponse.json({ ok: false, error: 'missing y/m' }, { status: 400 });
  const db = admin();
  const { data: prop } = await db.from('properties').select('id').eq('slug', slug).single();
  if (!prop) return NextResponse.json({ ok: false, error: 'property not found' }, { status: 404 });
  let map: Record<string, any> = {};
  try {
    const { data: row } = await db.from('properties').select('ai_audience').eq('id', (prop as any).id).single();
    const raw = (row as any)?.ai_audience;
    if (raw && typeof raw === 'object') map = raw;
  } catch { map = {}; }
  return NextResponse.json({ ok: true, enabled: googleAdsEnabled(), data: map[keyOf(y, m)] || null });
}

// ── POST: fetch Google Ads + analisis IA + guardar ─────────────────────────────
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 }); }
  const slug = typeof body.slug === 'string' ? body.slug : 'h98';
  const y = Number(body.year), m = Number(body.month);
  if (!y || !m) return NextResponse.json({ ok: false, error: 'missing year/month' }, { status: 400 });
  if (!googleAdsEnabled()) return NextResponse.json({ ok: false, error: 'google ads no configurado (faltan env vars)' }, { status: 200 });

  const { since, until } = monthRange(y, m);
  let audience;
  try {
    audience = await fetchGoogleAdsAudience({ since, until });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'google ads: ' + String(e?.message || e) }, { status: 502 });
  }
  if (!audience) return NextResponse.json({ ok: false, error: 'sin datos de audiencia' }, { status: 200 });

  // GA4: conversiones reales de TODOS los canales (incluye Meta/orgánico/directo que Google Ads no ve).
  let ga4 = null;
  try {
    ga4 = await fetchGA4Audience({ since, until });
  } catch { ga4 = null; }

  const totalBookings = ga4?.totalBookings ?? 0;
  const prompt = `Sos un growth strategist senior de marketing hotelero. Analiza la AUDIENCIA del hotel cliente (mes ${since} a ${until}) y produci un informe CONCLUYENTE, concreto y accionable para el cliente.

EL NUMERO QUE IMPORTA — CONVERSION REAL = RESERVAS DIRECTAS DEL MOTOR: ${totalBookings} reservas (evento de confirmacion de GA4). ESTE es el valor de venta medible del sitio. PARTI SIEMPRE DE ESTE NUMERO GRANDE (${totalBookings}). NO uses las conversiones internas de Google Ads (que subcuentan, ~16) como el numero principal; son solo el tracking parcial de la pauta.

QUIEN COMPRA — perfil REAL detras de las ${totalBookings} reservas (de GA4, CONFIABLE: pais/ciudad/dispositivo del que llega a la confirmacion):
${ga4 ? JSON.stringify({ bookingsByCountry: ga4.bookingsByCountry, bookingsByDevice: ga4.bookingsByDevice, bookingsByCity: ga4.bookingsByCity, totalBookings: ga4.totalBookings }, null, 2) : 'no disponible'}

PERFIL DE LA PAUTA — audiencia de Google Ads (demografia que GA4 no tiene: edad, genero; + geo y dispositivo de los clics pagos). Exprésalo en relevancia/porcentaje:
${JSON.stringify(audience, null, 2)}

INTENCION POR CANAL (GA4, visitas al motor) — revela canales que Google Ads NO ve:
${ga4 ? JSON.stringify(ga4.channels, null, 2) : 'no disponible'}

REGLAS DE ANALISIS:
- El protagonista es: ${totalBookings} reservas directas reales, y QUE AUDIENCIA esta detras (pais %, dispositivo %, ciudades). Expresá los pesos en PORCENTAJE sobre el total de reservas.
- Cruzá: el perfil de QUIEN COMPRA (GA4) vs el perfil de la PAUTA (Google Ads). Si la pauta lleva clics a un pais que casi no compra, o si quien compra es un pais/dispositivo poco priorizado, eso es una OPORTUNIDAD de realinear la inversion hacia el comprador real.
- Para canales: usá engineVisits (intencion) para mostrar que Meta/organico/directo aportan intencion que Google Ads no ve. NO atribuyas reservas por canal (cross-domain distorsiona); NUNCA digas "Meta = 0 reservas".
- Demografia (edad/genero) sale solo de Google Ads (GA4 no la tiene); usala para describir la audiencia de la pauta en %.
- Edad/genero como % sobre clics. Geo de Google Ads como % de relevancia.

TONO (CRITICO — lo lee el hotel cliente): profesional, neutral, CONSTRUCTIVO. NUNCA calificativos negativos sobre el cliente (grave, derroche, mal, error, problema, falla, quemando, perdida). Todo gap = oportunidad puntual. Cada afirmacion con un NUMERO real.

Responde UNICAMENTE con JSON valido, sin markdown:
{
  "headline": "frase potente centrada en las ${totalBookings} reservas reales y quien compra (ej: 'Las ${totalBookings} reservas directas vienen mayormente de USA y Colombia en desktop')",
  "whoBuys": "2 a 3 frases CONCLUYENTES: el perfil que compra las ${totalBookings} reservas (pais % top, dispositivo %, ciudades clave)",
  "adVsBuyer": "1 a 2 frases: como se compara la audiencia de la PAUTA (Google Ads, en %) con quien REALMENTE compra, y la oportunidad de realinear",
  "insights": [
    { "title": "titulo corto", "finding": "dato concreto en %/numero", "action": "que hacer ya, especifico", "impact": "alto|medio|bajo" }
  ],
  "channelMix": "1 a 2 frases: que canales aportan mas INTENCION (visitas al motor) segun GA4, destacando los que Google Ads no ve (Meta/Instagram, organico, directo). NO atribuyas reservas por canal.",
  "trackingNote": "1 frase: oportunidad de configurar cross-domain + ecommerce en GA4 para atribuir las reservas por canal con precision"
}
Maximo 5 insights, ordenados por impacto. Devolve SOLO el JSON.`;

  let analysis: any = null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 100000);
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
    });
    clearTimeout(t);
    const j = await resp.json();
    if (resp.ok) {
      const txt = (j.content || []).filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('');
      analysis = extractJson(txt);
    }
  } catch { analysis = null; }

  const payload = { audience, ga4, analysis, generatedAt: new Date().toISOString(), range: { since, until } };

  // Guardar en properties.ai_audience[mes] (defensivo).
  const db = admin();
  let persisted = false;
  try {
    const { data: prop } = await db.from('properties').select('id').eq('slug', slug).single();
    if (prop) {
      let existing: Record<string, any> = {};
      const { data: row } = await db.from('properties').select('ai_audience').eq('id', (prop as any).id).single();
      const raw = (row as any)?.ai_audience;
      if (raw && typeof raw === 'object') existing = raw;
      const upd = await db.from('properties').update({ ai_audience: { ...existing, [keyOf(y, m)]: payload } }).eq('id', (prop as any).id);
      persisted = !upd.error;
    }
  } catch { persisted = false; }

  return NextResponse.json({ ok: true, data: payload, persisted });
}
