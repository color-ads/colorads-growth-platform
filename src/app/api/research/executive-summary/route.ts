import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

function extractJson(text: string): any | null {
  if (!text) return null;
  const t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a === -1 || b === -1 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}

function keyOf(y: number, m: number) { return `${y}-${m}`; }

// ── GET: devolver el resumen guardado para el mes ──────────────────────────────
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') || 'h98';
  const y = parseInt(req.nextUrl.searchParams.get('y') || '', 10);
  const m = parseInt(req.nextUrl.searchParams.get('m') || '', 10);
  if (!y || !m) return NextResponse.json({ ok: false, error: 'missing y/m' }, { status: 400 });

  const db = admin();
  const { data: prop } = await db.from('properties').select('id').eq('slug', slug).single();
  if (!prop) return NextResponse.json({ ok: false, error: 'property not found' }, { status: 404 });
  // Lectura defensiva: si la columna ai_exec_summaries no existe, devolver null sin romper.
  let map: Record<string, any> = {};
  try {
    const { data: row } = await db.from('properties').select('ai_exec_summaries').eq('id', (prop as any).id).single();
    const raw = (row as any)?.ai_exec_summaries;
    if (raw && typeof raw === 'object') map = raw;
  } catch { map = {}; }
  const summary = map[keyOf(y, m)] || null;
  return NextResponse.json({ ok: true, summary });
}

// ── POST: generar (IA) y guardar el resumen del mes ────────────────────────────
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 }); }
  const slug = typeof body.slug === 'string' ? body.slug : 'h98';
  const y = Number(body.year), m = Number(body.month);
  const context = body.context || {};
  if (!y || !m) return NextResponse.json({ ok: false, error: 'missing year/month' }, { status: 400 });

  const db = admin();
  const { data: prop } = await db.from('properties').select('id').eq('slug', slug).single();
  if (!prop) return NextResponse.json({ ok: false, error: 'property not found' }, { status: 404 });

  const prompt = `Sos un growth strategist senior de marketing hotelero de venta directa. Tenés que escribir el RESUMEN EJECUTIVO MENSUAL que el hotel cliente va a DESCARGAR y PRESENTAR A SU COMITÉ. Debe leerse como lo escribiría un growth hacker de alto nivel: agudo, concreto, orientado a decisión, sin relleno.

DATOS DEL MES (verificados, no inventes nada fuera de esto):
${JSON.stringify(context, null, 2)}

REGLAS:
- Tono profesional, neutral y CONSTRUCTIVO. Este informe lo lee el hotel cliente: NUNCA uses calificativos negativos sobre el cliente (grave, derroche, mal, error, problema, falla, deficiente). Todo gap se enmarca como oportunidad puntual de mejora de conversión.
- Conclusiones PUNTUALES (no genéricas): cada una apoyada en un número o un hecho de los datos.
- Acciones CONCRETAS y priorizadas: qué hacer, por qué (rationale ligado a un dato), impacto y esfuerzo estimados, y cuándo. Si en los datos hay acciones ya comprometidas (committedActions), inclúyelas marcadas como comprometidas.
- Usá los datos de competencia (tarifas, posicionamiento, lo que pautan) para el bloque competitivo.
- Español. Números con formato claro (US$, %, x para ROAS).

Responde UNICAMENTE con JSON valido, sin markdown:
{
  "headline": "el gran mensaje del mes en una frase potente",
  "tldr": "2 a 3 frases de resumen ejecutivo para abrir el comité",
  "northStar": { "metric": "nombre de la metrica clave del mes", "value": "valor", "note": "lectura en 1 frase" },
  "highlights": [ { "label": "KPI", "value": "valor", "delta": "+X% vs mes anterior o vacio", "tone": "good|watch|bad" } ],
  "conclusions": [ "conclusion puntual apoyada en un dato", "..." ],
  "actions": [ { "action": "que hacer", "rationale": "por que (dato)", "impact": "alto|medio|bajo", "effort": "alto|medio|bajo", "when": "este mes|proximo mes", "committed": false } ],
  "competitivePositioning": "1 a 2 frases: donde esta el hotel vs competencia (tarifa/rating/pauta), enmarcado como oportunidad",
  "nextMonthFocus": "el foco numero 1 del proximo mes en 1 frase"
}

Maximo 5 highlights, 5 conclusions, 6 actions. Devolve SOLO el JSON.`;

  let rawText = '';
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 110000);
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }),
    });
    clearTimeout(t);
    const j = await resp.json();
    if (!resp.ok) return NextResponse.json({ ok: false, error: 'anthropic error', detail: j }, { status: 502 });
    rawText = (j.content || []).filter((b: any) => b?.type === 'text' && typeof b.text === 'string').map((b: any) => b.text).join('');
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'request failed', detail: String(e?.message || e) }, { status: 500 });
  }

  const summary = extractJson(rawText);
  if (!summary || typeof summary !== 'object') {
    return NextResponse.json({ ok: false, error: 'no se pudo generar el resumen' }, { status: 500 });
  }
  summary.generatedAt = new Date().toISOString();
  summary.period = context.periodLabel || keyOf(y, m);

  // Guardar bajo la clave del mes en properties.ai_exec_summaries (read-modify-write, defensivo).
  // Si la columna no existe aun, persisted=false pero igual devolvemos el resumen para mostrarlo.
  let persisted = false;
  try {
    let existing: Record<string, any> = {};
    const { data: row } = await db.from('properties').select('ai_exec_summaries').eq('id', (prop as any).id).single();
    const raw = (row as any)?.ai_exec_summaries;
    if (raw && typeof raw === 'object') existing = raw;
    const next = { ...existing, [keyOf(y, m)]: summary };
    const upd = await db.from('properties').update({ ai_exec_summaries: next }).eq('id', (prop as any).id);
    persisted = !upd.error;
  } catch { persisted = false; }

  return NextResponse.json({ ok: true, summary, persisted });
}
