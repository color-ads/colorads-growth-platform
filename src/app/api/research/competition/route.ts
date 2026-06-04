import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

function domainOf(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; }
}

async function ogImage(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4500);
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'Mozilla/5.0 (compatible; ColorADSBot/1.0)' } });
    clearTimeout(t);
    if (!r.ok) return null;
    const html = await r.text();
    const patterns = [
      /<meta[^>]+property=["']og:image(?::secure_url|:url)?["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    ];
    for (const p of patterns) {
      const m = html.match(p);
      if (m && m[1]) {
        try { return new URL(m[1], url).href; } catch { return m[1]; }
      }
    }
  } catch { /* ignore */ }
  return null;
}

function extractJson(text: string): any | null {
  if (!text) return null;
  let t = text.trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try { return JSON.parse(t.slice(start, end + 1)); } catch { return null; }
}

function extractUrls(text: string): string[] {
  const out = new Set<string>();
  const re = /https?:\/\/[^\s"'<>)]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.add(m[0].replace(/[.,;]+$/, ''));
  return Array.from(out).slice(0, 12);
}

function buildKbText(data: any): string {
  const lines: string[] = [];
  for (const c of (data.competitors || [])) {
    if (c && c.name) lines.push(String(c.name).toUpperCase());
    if (c && c.edge) lines.push(`Fortaleza: ${c.edge}`);
    if (c && c.detail) lines.push(String(c.detail));
    if (c && c.url) lines.push(`Fuente: ${c.url}`);
    lines.push('');
  }
  if ((data.actions || []).length) {
    lines.push('ACCIONES DESTACADAS (COMPETENCIA)');
    for (const a of data.actions) {
      const tag = a && a.competitor ? ` [inspirado en ${a.competitor}]` : '';
      lines.push(`- ${a && a.title ? a.title : ''}${tag}: ${a && a.body ? a.body : ''}`);
    }
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') || 'h98';
  const db = admin();

  const { data: prop, error: perr } = await db
    .from('properties')
    .select('id, name, competitors')
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

  const prompt = `Sos analista de growth de venta directa hotelera. El hotel cliente es ${prop.name}, un hotel boutique en El Poblado, Medellin (Colombia). Su mercado objetivo son EXTRANJEROS QUE YA ESTAN EN MEDELLIN / COLOMBIA (demanda en destino, alta intencion, ventana de decision corta). NUNCA propongas campanas dirigidas al exterior.

Investiga en la web a estos competidores directos: ${competitors.join(', ')}.

Enfoca el analisis SOLO en lo que sirve para venta directa: innovacion y tecnificacion del funnel (WhatsApp, chatbot, motor de reservas propio, check-in digital, app), promociones y codigos de descuento directos, programas de fidelidad o beneficios, y viralidad / contenido en redes (Instagram, TikTok). Se honesto: si un competidor no tiene nada nuevo relevante, decilo en su "detail".

Responde UNICAMENTE con un objeto JSON valido, sin markdown, sin texto antes ni despues, exactamente con esta forma:
{
  "competitors": [
    { "name": "Nombre", "url": "https://sitio-oficial", "edge": "su mayor fortaleza en venta directa, en una linea", "detail": "2 a 3 frases concretas con lo mas relevante que encontraste" }
  ],
  "actions": [
    { "title": "accion corta y accionable para ${prop.name}", "body": "1 a 2 frases: que hacer y por que, atado a un dato del hotel o del mercado en destino", "competitor": "Nombre del competidor que inspira la accion", "ref": "https://url-de-respaldo" }
  ],
  "references": ["https://...", "https://..."]
}

Incluye los ${competitors.length} competidores en "competitors" (uno por cada uno). Da EXACTAMENTE 3 elementos en "actions", cada uno citando contra que competidor se mueve. En "references" pone las URLs reales que usaste (sitios oficiales, Instagram, etc). Todo en espanol. Devolve SOLO el JSON.`;

  let rawText = '';
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 240000);
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
        max_tokens: 2600,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
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
    return NextResponse.json({ ok: false, error: 'request failed', detail: String(e?.message || e) }, { status: 500 });
  }

  let data: any = extractJson(rawText);
  if (!data || typeof data !== 'object') {
    data = { competitors: [], actions: [], references: extractUrls(rawText), summary: rawText.trim().slice(0, 4000) };
  }
  data.competitors = Array.isArray(data.competitors) ? data.competitors : [];
  data.actions = Array.isArray(data.actions) ? data.actions : [];
  data.references = Array.isArray(data.references) && data.references.length ? data.references : extractUrls(rawText);

  await Promise.allSettled(
    data.competitors.map(async (c: any) => {
      const url = c && c.url ? String(c.url) : '';
      c.domain = domainOf(url);
      c.favicon = c.domain ? `https://www.google.com/s2/favicons?domain=${c.domain}&sz=128` : null;
      c.image = url ? await ogImage(url) : null;
    })
  );

  data.generatedAt = new Date().toISOString();
  const kbText = buildKbText(data);

  // Guardar estructurado + texto. Si la columna jsonb no existe aun, guarda solo el texto.
  const upd = await db.from('properties').update({ ai_competition_data: data, ai_competition_kb: kbText }).eq('id', prop.id);
  if (upd.error) {
    await db.from('properties').update({ ai_competition_kb: kbText }).eq('id', prop.id);
  }

  return NextResponse.json({
    ok: true,
    competitors,
    count: data.competitors.length,
    actions: data.actions.length,
    data,
  });
}
