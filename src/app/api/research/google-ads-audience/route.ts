import { NextRequest, NextResponse } from 'next/server';
import { fetchGoogleAdsAudience, googleAdsEnabled } from '@/lib/ads/googleAds';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!googleAdsEnabled()) {
    return NextResponse.json({ ok: false, error: 'google ads no configurado' }, { status: 200 });
  }
  const since = req.nextUrl.searchParams.get('since') || undefined;
  const until = req.nextUrl.searchParams.get('until') || undefined;
  try {
    const audience = await fetchGoogleAdsAudience({ since, until });
    return NextResponse.json({ ok: true, audience });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
