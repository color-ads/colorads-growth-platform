/**
 * Gateway a la Google Ads API (v21) para analisis de audiencia real.
 * Gateado por las 5 env vars (sin ellas, googleAdsEnabled()=false y todo sigue como hoy).
 * Auth: OAuth2 refresh token -> access token (cacheado ~50min).
 */

const API_VERSION = 'v21';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export function googleAdsEnabled(): boolean {
  return !!(
    process.env.GOOGLE_ADS_CLIENT_ID &&
    process.env.GOOGLE_ADS_CLIENT_SECRET &&
    process.env.GOOGLE_ADS_REFRESH_TOKEN &&
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
    process.env.GOOGLE_ADS_MCC_ID &&
    process.env.GOOGLE_ADS_H98_CUSTOMER_ID
  );
}

let cachedToken: { value: string; expires: number } | null = null;

async function getAccessToken(signal: AbortSignal): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now()) return cachedToken.value;
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }).toString(),
  });
  const j = await res.json();
  if (!res.ok || !j.access_token) throw new Error(`oauth ${res.status}`);
  cachedToken = { value: j.access_token, expires: Date.now() + (Number(j.expires_in || 3600) - 300) * 1000 };
  return j.access_token;
}

async function gaql(query: string, customerId: string, signal: AbortSignal): Promise<any[]> {
  const token = await getAccessToken(signal);
  const res = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/googleAds:search`, {
    method: 'POST',
    signal,
    headers: {
      authorization: `Bearer ${token}`,
      'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
      'login-customer-id': process.env.GOOGLE_ADS_MCC_ID!,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`gads ${res.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return Array.isArray(j.results) ? j.results : [];
}

const AGE_LABELS: Record<string, string> = {
  AGE_RANGE_18_24: '18-24', AGE_RANGE_25_34: '25-34', AGE_RANGE_35_44: '35-44',
  AGE_RANGE_45_54: '45-54', AGE_RANGE_55_64: '55-64', AGE_RANGE_65_UP: '65+',
  AGE_RANGE_UNDETERMINED: 'Sin determinar',
};
const GENDER_LABELS: Record<string, string> = { MALE: 'Hombres', FEMALE: 'Mujeres', UNDETERMINED: 'Sin determinar' };

export interface AudienceRow { label: string; impressions: number; clicks: number; conversions: number; cost?: number }
export interface SearchTermRow { term: string; impressions: number; clicks: number; conversions: number }
export interface GoogleAdsAudience {
  fetchedAt: string;
  range: { since: string; until: string };
  devices: AudienceRow[];
  ageRanges: AudienceRow[];
  genders: AudienceRow[];
  geo: AudienceRow[];
  searchTerms: SearchTermRow[];
}

const n = (x: unknown) => Number(x) || 0;

// Agrega filas por una clave (suma metrics).
function aggregate(rows: any[], keyFn: (r: any) => string | null): AudienceRow[] {
  const map = new Map<string, AudienceRow>();
  for (const r of rows) {
    const key = keyFn(r);
    if (!key) continue;
    const m = r.metrics || {};
    const cur = map.get(key) || { label: key, impressions: 0, clicks: 0, conversions: 0, cost: 0 };
    cur.impressions += n(m.impressions);
    cur.clicks += n(m.clicks);
    cur.conversions += n(m.conversions);
    cur.cost = (cur.cost || 0) + n(m.costMicros) / 1e6;
    map.set(key, cur);
  }
  return [...map.values()].filter((r) => r.impressions > 0 || r.clicks > 0).sort((a, b) => b.clicks - a.clicks);
}

function dateRange(since?: string, until?: string): { since: string; until: string; clause: string } {
  if (since && until) return { since, until, clause: `segments.date BETWEEN '${since}' AND '${until}'` };
  return { since: 'last_30_days', until: 'last_30_days', clause: 'segments.date DURING LAST_30_DAYS' };
}

/** Trae el panorama de audiencia real de Google Ads. null si no esta configurado. */
export async function fetchGoogleAdsAudience(opts: { since?: string; until?: string; timeBudgetMs?: number } = {}): Promise<GoogleAdsAudience | null> {
  if (!googleAdsEnabled()) return null;
  const cid = process.env.GOOGLE_ADS_H98_CUSTOMER_ID!;
  const { since, until, clause } = dateRange(opts.since, opts.until);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeBudgetMs ?? 45000);
  try {
    const [devRows, ageRows, genRows, geoRows, stRows] = await Promise.all([
      gaql(`SELECT segments.device, metrics.impressions, metrics.clicks, metrics.conversions, metrics.cost_micros FROM customer WHERE ${clause}`, cid, ctrl.signal),
      gaql(`SELECT ad_group_criterion.age_range.type, metrics.impressions, metrics.clicks, metrics.conversions FROM age_range_view WHERE ${clause}`, cid, ctrl.signal),
      gaql(`SELECT ad_group_criterion.gender.type, metrics.impressions, metrics.clicks, metrics.conversions FROM gender_view WHERE ${clause}`, cid, ctrl.signal),
      gaql(`SELECT geographic_view.country_criterion_id, metrics.impressions, metrics.clicks, metrics.conversions FROM geographic_view WHERE ${clause}`, cid, ctrl.signal),
      gaql(`SELECT search_term_view.search_term, metrics.impressions, metrics.clicks, metrics.conversions FROM search_term_view WHERE ${clause} ORDER BY metrics.clicks DESC LIMIT 25`, cid, ctrl.signal),
    ]);

    const devices = aggregate(devRows, (r) => {
      const d = r.segments?.device;
      return d ? ({ MOBILE: 'Mobile', DESKTOP: 'Desktop', TABLET: 'Tablet' }[d as string] || d) : null;
    });
    const ageRanges = aggregate(ageRows, (r) => {
      const t = r.adGroupCriterion?.ageRange?.type;
      return t ? (AGE_LABELS[t] || t) : null;
    });
    const genders = aggregate(genRows, (r) => {
      const t = r.adGroupCriterion?.gender?.type;
      return t ? (GENDER_LABELS[t] || t) : null;
    });

    // Geo: agregar por country_criterion_id y resolver nombres.
    const geoAgg = aggregate(geoRows, (r) => {
      const id = r.geographicView?.countryCriterionId;
      return id ? String(id) : null;
    });
    const names = await resolveGeoNames(geoAgg.map((g) => g.label), cid, ctrl.signal);
    const geo = geoAgg.map((g) => ({ ...g, label: names[g.label] || `País ${g.label}` })).sort((a, b) => b.clicks - a.clicks).slice(0, 8);

    const searchTerms: SearchTermRow[] = stRows
      .map((r) => ({
        term: r.searchTermView?.searchTerm || '',
        impressions: n(r.metrics?.impressions),
        clicks: n(r.metrics?.clicks),
        conversions: n(r.metrics?.conversions),
      }))
      .filter((s) => s.term)
      .slice(0, 15);

    return {
      fetchedAt: new Date().toISOString(),
      range: { since, until },
      devices, ageRanges, genders, geo, searchTerms,
    };
  } finally {
    clearTimeout(timer);
  }
}

// Resuelve IDs de pais (geo_target_constant) a nombres legibles.
async function resolveGeoNames(ids: string[], cid: string, signal: AbortSignal): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const valid = ids.filter(Boolean);
  if (!valid.length) return out;
  try {
    const rows = await gaql(
      `SELECT geo_target_constant.id, geo_target_constant.name FROM geo_target_constant WHERE geo_target_constant.id IN (${valid.join(',')})`,
      cid, signal,
    );
    for (const r of rows) {
      const id = r.geoTargetConstant?.id;
      const name = r.geoTargetConstant?.name;
      if (id && name) out[String(id)] = String(name);
    }
  } catch { /* si falla, se usan los ids crudos */ }
  return out;
}
