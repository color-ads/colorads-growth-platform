import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function admin() { return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } }); }

// URL propia del deployment para auto-llamar los endpoints de generacion.
function baseUrl(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

// Target del corte segun scope: 'current' (mes en curso) o 'prior' (mes cerrado).
function targetMonth(scope: string): { year: number; month: number } {
  const now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth() + 1; // 1-12
  if (scope === 'prior') {
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  return { year: y, month: m };
}

export async function GET(req: NextRequest) {
  // Auth: si CRON_SECRET esta seteado, exigirlo (Vercel cron lo envia automaticamente).
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const scope = req.nextUrl.searchParams.get('scope') || 'prior';
  const { year, month } = targetMonth(scope);
  const base = baseUrl();

  // Propiedades activas (escalable a multiples hoteles). Fallback a h98.
  let slugs: string[] = ['h98'];
  try {
    const { data } = await admin().from('properties').select('slug, active');
    const rows = (data || []).filter((p: any) => p.active !== false).map((p: any) => p.slug).filter(Boolean);
    if (rows.length) slugs = rows;
  } catch { /* fallback h98 */ }

  const results: any[] = [];
  for (const slug of slugs) {
    const r: any = { slug, year, month };
    // 1) Audiencia (Google Ads + GA4 + analisis IA) — el reporte protagonista.
    try {
      const res = await fetch(`${base}/api/research/audience`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, year, month }),
      });
      const j = await res.json();
      r.audience = j?.ok ? 'ok' : (j?.error || 'fail');
    } catch (e: any) { r.audience = 'error: ' + String(e?.message || e); }

    // 2) Competencia (research) — best-effort, mes en curso.
    if (scope === 'current') {
      try {
        const res = await fetch(`${base}/api/research/competition?slug=${encodeURIComponent(slug)}`, { method: 'GET' });
        r.competition = res.ok ? 'ok' : 'fail';
      } catch (e: any) { r.competition = 'error'; }
    }
    results.push(r);
  }

  return NextResponse.json({ ok: true, scope, year, month, properties: slugs.length, results });
}
