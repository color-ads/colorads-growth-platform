import { NextRequest, NextResponse } from 'next/server';
import { fetchGoogleAdsAudience, googleAdsEnabled } from '@/lib/ads/googleAds';
import { fetchGA4Audience, ga4Enabled } from '@/lib/ads/ga4';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const since = req.nextUrl.searchParams.get('since') || undefined;
  const until = req.nextUrl.searchParams.get('until') || undefined;

  // Healthcheck de conectividad + diagnostico de GA4 (errores expuestos a proposito).
  const out: any = {
    googleAds: { enabled: googleAdsEnabled() },
    ga4: { enabled: ga4Enabled(), hasPropertyId: !!process.env.GOOGLE_GA4_PROPERTY_ID },
  };

  if (googleAdsEnabled()) {
    try { out.googleAds.audience = await fetchGoogleAdsAudience({ since, until }); }
    catch (e: any) { out.googleAds.error = String(e?.message || e); }
  }
  if (ga4Enabled() && since && until) {
    try { out.ga4.data = await fetchGA4Audience({ since, until }); }
    catch (e: any) { out.ga4.error = String(e?.message || e); }
  }
  return NextResponse.json({ ok: true, ...out });
}
