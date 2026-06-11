import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchGoogleAdsAudience, googleAdsEnabled } from '@/lib/ads/googleAds';

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

  const prompt = `Sos un growth strategist senior de marketing hotelero. Te paso la AUDIENCIA REAL de Google Ads del hotel cliente (mes ${since} a ${until}). Tu trabajo: convertir esto en un analisis demografico de ALTO VALOR para el cliente, con insights CONCRETOS y RAPIDAMENTE ACCIONABLES.

DATOS REALES (no inventes nada fuera de esto):
${JSON.stringify(audience, null, 2)}

REGLAS DE TONO (CRITICO — lo lee el hotel cliente):
- Profesional, neutral y CONSTRUCTIVO. NUNCA uses calificativos negativos sobre el cliente (grave, derroche, mal, error, problema, falla, perdida, quemando). Todo gap se enmarca como OPORTUNIDAD puntual de mejorar conversion.
- Ej: en vez de "estas quemando plata en Republica Dominicana", deci "hay una oportunidad clara de reasignar pauta hacia Colombia, donde se concentran las conversiones, para subir el ROI".
- Cada insight apoyado en un NUMERO real de los datos. Accionable YA (que hacer concretamente).

Responde UNICAMENTE con JSON valido, sin markdown:
{
  "headline": "el mensaje clave de la audiencia en una frase potente y positiva",
  "whoConverts": "1 a 2 frases: el perfil que MEJOR convierte (edad, genero, geo, dispositivo) segun los datos",
  "insights": [
    { "title": "titulo corto", "finding": "el dato concreto que lo sustenta", "action": "que hacer ya, especifico", "impact": "alto|medio|bajo" }
  ],
  "searchRead": "1 frase sobre los terminos de busqueda (marca vs generico vs competidor) y que implica"
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

  const payload = { audience, analysis, generatedAt: new Date().toISOString(), range: { since, until } };

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
