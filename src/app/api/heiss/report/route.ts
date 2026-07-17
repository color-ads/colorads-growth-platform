import { NextRequest, NextResponse } from 'next/server';
import { fetchHeissReport, heissEnabled } from '@/lib/heiss/report';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!heissEnabled()) {
    return NextResponse.json({ ok: false, error: 'Credenciales de Google no configuradas' }, { status: 503 });
  }
  const days = Number(req.nextUrl.searchParams.get('days')) || 7;
  try {
    const report = await fetchHeissReport({ days, timeBudgetMs: 45000 });
    return NextResponse.json({ ok: true, report });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 200) }, { status: 502 });
  }
}
