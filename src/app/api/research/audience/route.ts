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
  const prompt = `Sos un growth strategist senior de marketing hotelero. Producí los TEXTOS de un reporte de AUDIENCIAS premium y CONCLUYENTE para el hotel cliente (mes ${since} a ${until}). El tablero ya dibuja los graficos y calcula los %, indices y tasas; vos aportas el RELATO y los insights de alto valor (la frase de "y esto que significa para vos" de cada bloque).

CONVERSION PROTAGONISTA = RESERVAS DIRECTAS DEL MOTOR: ${totalBookings} (evento de confirmacion GA4). Partí SIEMPRE de este numero. NUNCA uses las conversiones internas de Google Ads (~16) como protagonista.

DATOS REALES (no inventes nada fuera de esto):
GA4 (embudo, quien compra, cuando, intencion, landing):
${ga4 ? JSON.stringify(ga4, null, 2) : 'no disponible'}

GOOGLE ADS (pauta: totales, campañas, demografia, geo, audiencias):
${JSON.stringify(audience, null, 2)}

GUIA DE LOS BLOQUES (un insight por bloque, en lenguaje de negocio, con numeros reales):
- EMBUDO: usuarios -> sesiones -> reservas. La intencion (visitas al motor / sesiones) es alta. El cuello de botella es motor->reserva. El crecimiento esta en cerrar mejor, no en mas trafico.
- QUIEN COMPRA: pais % (top USA/Colombia), dispositivo %, ciudades. Comprador internacional + desktop => web/motor en ingles y desktop son criticos.
- LEALTAD: recurrentes convierten MUCHO mas que nuevos (calcula la idea con newVsReturning) => activar recurrente (remarketing/CRM) es la inversion mas eficiente.
- CUANDO: dia de semana que concentra reservas (Lun/Mar) => dayparting, ofertas y email a inicio de semana.
- INTENCION POR CANAL: Google search enciende la mayoria; Meta aporta intencion que Google Ads NO ve. NO atribuyas reservas por canal (cross-domain). NUNCA "Meta = 0 reservas".
- LANDING: la home concentra las aperturas del motor; /en (ingles) valida al comprador USA.
- PAUTA (Google Ads): CTR vs benchmark hotelero (~2-5%), CPC, y CPA REAL = costo / ${totalBookings} reservas. Lenguaje de eficiencia.
- OPORTUNIDAD (cliente): enmarca SIEMPRE como "mercados de oportunidad" (ej. USA lidera reservas y tiene mucho espacio de pauta; reforzar Colombia). NUNCA menciones el desperdicio en otros mercados de cara al cliente (eso va a internalNote).

TONO (CRITICO — lo lee el hotel cliente): profesional, neutral, CONSTRUCTIVO. NUNCA calificativos negativos sobre el cliente (grave, derroche, mal, error, problema, falla, quemando, perdida). Todo gap = oportunidad. Cada frase con un numero real.

Responde UNICAMENTE con JSON valido, sin markdown:
{
  "headline": "1 frase potente del mes centrada en las ${totalBookings} reservas reales y quien compra",
  "tldr": "2 frases de resumen ejecutivo para abrir el reporte",
  "whoBuys": "2 a 3 frases: el perfil que compra las ${totalBookings} reservas (pais %, dispositivo %, ciudades, nuevo/recurrente)",
  "funnelInsight": "1 a 2 frases: lectura del embudo (intencion alta, cuello motor->reserva, donde esta la palanca)",
  "loyaltyInsight": "1 frase: el recurrente convierte mucho mas que el nuevo; que hacer",
  "timingInsight": "1 frase: que dias concentran la reserva y como aprovecharlo",
  "channelMix": "1 a 2 frases: intencion por canal; Meta/organico/directo que Google Ads no ve. NO atribuir reservas por canal",
  "landingInsight": "1 frase: la home concentra el motor; /en valida al comprador internacional",
  "adsInsight": "1 a 2 frases: eficiencia de la pauta (CTR vs benchmark, CPA real ~ costo/${totalBookings})",
  "opportunityInsight": "1 a 2 frases CLIENTE-FACING: mercados de oportunidad (USA lidera reservas con poca pauta; reforzar Colombia). Tono 100% oportunidad, sin mencionar desperdicio",
  "insights": [ { "title": "titulo corto", "finding": "dato en %/numero", "action": "accion concreta", "impact": "alto|medio|bajo" } ],
  "trackingNote": "1 frase: oportunidad de configurar cross-domain + ecommerce en GA4 para atribuir reservas por canal",
  "internalNote": "NOTA INTERNA — SOLO equipo ColorADS, NO la ve el cliente. Candido: cruce de la pauta (% impresiones por pais, campañas como Demand Gen con 0 conv internas) vs quien compra realmente; reasignacion concreta de presupuesto (ej. mover de Rep.Dominicana hacia USA/Colombia). Numeros y % exactos."
}
Maximo 5 insights por impacto. Devolve SOLO el JSON.`;

  let analysis: any = null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 100000);
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }),
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
