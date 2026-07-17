/**
 * Gateway en vivo del motor de reservas de Heiss Hotel (Mirai, embebido en heisshotel.com).
 * Reusa las credenciales OAuth compartidas (scopes adwords + analytics.readonly).
 * Los IDs de Heiss son identificadores, no secretos: van como constantes.
 *
 * Eventos GA4 (contenedor GTM-5K9FJW5T v15/v16, en vivo desde 17-jul-2026):
 *  engine_visit (paso 1 motor) · engine_search (busqueda de fechas, params checkin/checkout/
 *  nights/availability) · begin_checkout · purchase (con revenue) · no_availability · refund.
 */

const GA4_PROPERTY = '446058576';
const ADS_CUSTOMER = '2785634711';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const MEDICION_DESDE = '2026-07-17'; // primer dia con medicion Mirai en vivo

export function heissEnabled(): boolean {
  return !!(
    process.env.GOOGLE_ADS_CLIENT_ID &&
    process.env.GOOGLE_ADS_CLIENT_SECRET &&
    process.env.GOOGLE_ADS_REFRESH_TOKEN
  );
}
function adsEnabled(): boolean {
  return heissEnabled() && !!(process.env.GOOGLE_ADS_DEVELOPER_TOKEN && process.env.GOOGLE_ADS_MCC_ID);
}

let cachedToken: { value: string; expires: number } | null = null;
async function getAccessToken(signal: AbortSignal): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now()) return cachedToken.value;
  const res = await fetch(TOKEN_URL, {
    method: 'POST', signal,
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

async function ga4(method: 'runReport' | 'runRealtimeReport', body: any, signal: AbortSignal): Promise<any[]> {
  const token = await getAccessToken(signal);
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY}:${method}`, {
    method: 'POST', signal,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`ga4 ${res.status}: ${JSON.stringify(j).slice(0, 180)}`);
  return Array.isArray(j.rows) ? j.rows : [];
}

async function gaql(query: string, signal: AbortSignal): Promise<any[]> {
  const token = await getAccessToken(signal);
  const res = await fetch(`https://googleads.googleapis.com/v21/customers/${ADS_CUSTOMER}/googleAds:search`, {
    method: 'POST', signal,
    headers: {
      authorization: `Bearer ${token}`,
      'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
      'login-customer-id': process.env.GOOGLE_ADS_MCC_ID!,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`gaql ${res.status}: ${JSON.stringify(j).slice(0, 180)}`);
  return Array.isArray(j.results) ? j.results : [];
}

const n = (x: unknown) => Number(x) || 0;
const eventFilter = (values: string[]) => ({ filter: { fieldName: 'eventName', inListFilter: { values } } });
// checkin de Mirai llega como dd/mm/aaaa
function toISO(raw: string): string | null {
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export interface HeissKpis {
  sessions: number; engineVisit: number; engineSearch: number; noAvailability: number;
  beginCheckout: number; purchases: number; revenue: number;
}
export interface HeissHeatCell { yes: number; no: number }
export interface HeissCampaign { name: string; clicks: number; cost: number; conversions: number; value: number }
export interface HeissTrendPoint { date: string; engineVisit: number; engineSearch: number; purchases: number }
export interface HeissRealtime { activeUsers: number; events: Record<string, number> }
export interface HeissReport {
  fetchedAt: string;
  range: { since: string; until: string; days: number };
  medicionDesde: string;
  kpis: HeissKpis;
  heatmap: Record<string, HeissHeatCell>; // checkin ISO -> busquedas
  nights: { label: string; count: number }[];
  sources: { label: string; count: number }[];
  trend: HeissTrendPoint[];
  ads: { campaigns: HeissCampaign[]; totals: HeissCampaign; error?: string };
  realtime: HeissRealtime;
  errors: string[];
}

export async function fetchHeissReport(opts: { days?: number; timeBudgetMs?: number } = {}): Promise<HeissReport | null> {
  if (!heissEnabled()) return null;
  const days = Math.min(90, Math.max(1, opts.days ?? 7));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeBudgetMs ?? 45000);
  const errors: string[] = [];
  const safe = async <T,>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try { return await fn(); } catch (e: any) { errors.push(`${label}: ${String(e?.message || e).slice(0, 140)}`); return fallback; }
  };
  const D = [{ startDate: `${days - 1}daysAgo`, endDate: 'today' }];

  try {
    const [evRows, revRows, heatRows, nightsRows, srcRows, trendRows, adsRows, rtRows] = await Promise.all([
      safe('eventos', () => ga4('runReport', {
        dateRanges: D, dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }],
        dimensionFilter: eventFilter(['session_start', 'engine_visit', 'engine_search', 'no_availability', 'begin_checkout', 'purchase']),
      }, ctrl.signal), []),
      safe('revenue', () => ga4('runReport', { dateRanges: D, metrics: [{ name: 'purchaseRevenue' }, { name: 'transactions' }] }, ctrl.signal), []),
      safe('heatmap', () => ga4('runReport', {
        dateRanges: D, dimensions: [{ name: 'customEvent:checkin' }, { name: 'customEvent:availability' }],
        metrics: [{ name: 'eventCount' }], dimensionFilter: eventFilter(['engine_search']), limit: 2000,
      }, ctrl.signal), []),
      safe('noches', () => ga4('runReport', {
        dateRanges: D, dimensions: [{ name: 'customEvent:nights' }], metrics: [{ name: 'eventCount' }],
        dimensionFilter: eventFilter(['engine_search']), limit: 15,
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      }, ctrl.signal), []),
      safe('fuentes', () => ga4('runReport', {
        dateRanges: D, dimensions: [{ name: 'sessionSourceMedium' }], metrics: [{ name: 'eventCount' }],
        dimensionFilter: eventFilter(['engine_visit']), limit: 8,
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      }, ctrl.signal), []),
      safe('tendencia', () => ga4('runReport', {
        dateRanges: D, dimensions: [{ name: 'date' }, { name: 'eventName' }], metrics: [{ name: 'eventCount' }],
        dimensionFilter: eventFilter(['engine_visit', 'engine_search', 'purchase']),
        orderBys: [{ dimension: { dimensionName: 'date' } }], limit: 300,
      }, ctrl.signal), []),
      adsEnabled()
        ? safe('ads', () => gaql(
            `SELECT campaign.name, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM campaign WHERE segments.date DURING LAST_${days <= 7 ? '7' : days <= 30 ? '30' : '90'}_DAYS`,
            ctrl.signal), [])
        : Promise.resolve([]),
      safe('realtime', () => ga4('runRealtimeReport', {
        dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }],
        dimensionFilter: eventFilter(['page_view', 'engine_visit', 'engine_search', 'begin_checkout', 'purchase']),
      }, ctrl.signal), []),
    ]);

    const ev = new Map<string, number>();
    for (const r of evRows) ev.set(r.dimensionValues?.[0]?.value, n(r.metricValues?.[0]?.value));
    const kpis: HeissKpis = {
      sessions: ev.get('session_start') || 0,
      engineVisit: ev.get('engine_visit') || 0,
      engineSearch: ev.get('engine_search') || 0,
      noAvailability: ev.get('no_availability') || 0,
      beginCheckout: ev.get('begin_checkout') || 0,
      purchases: ev.get('purchase') || 0,
      revenue: n(revRows[0]?.metricValues?.[0]?.value),
    };

    const heatmap: Record<string, HeissHeatCell> = {};
    for (const r of heatRows) {
      const iso = toISO(r.dimensionValues?.[0]?.value || '');
      if (!iso) continue;
      const cell = (heatmap[iso] ||= { yes: 0, no: 0 });
      cell[r.dimensionValues?.[1]?.value === 'no' ? 'no' : 'yes'] += n(r.metricValues?.[0]?.value);
    }

    const nights = nightsRows
      .map((r: any) => ({ label: r.dimensionValues?.[0]?.value || '', count: n(r.metricValues?.[0]?.value) }))
      .filter((x: any) => x.label && x.label !== '(not set)');
    const sources = srcRows
      .map((r: any) => ({ label: r.dimensionValues?.[0]?.value || '', count: n(r.metricValues?.[0]?.value) }))
      .filter((x: any) => x.label);

    const trendMap = new Map<string, HeissTrendPoint>();
    for (const r of trendRows) {
      const d = r.dimensionValues?.[0]?.value || '';
      if (d.length !== 8) continue;
      const iso = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
      const p = trendMap.get(iso) || { date: iso, engineVisit: 0, engineSearch: 0, purchases: 0 };
      const name = r.dimensionValues?.[1]?.value;
      if (name === 'engine_visit') p.engineVisit += n(r.metricValues?.[0]?.value);
      if (name === 'engine_search') p.engineSearch += n(r.metricValues?.[0]?.value);
      if (name === 'purchase') p.purchases += n(r.metricValues?.[0]?.value);
      trendMap.set(iso, p);
    }

    const campaigns: HeissCampaign[] = adsRows
      .map((r: any) => ({
        name: r.campaign?.name || '', clicks: n(r.metrics?.clicks), cost: n(r.metrics?.costMicros) / 1e6,
        conversions: n(r.metrics?.conversions), value: n(r.metrics?.conversionsValue),
      }))
      .filter((c) => c.clicks > 0 || c.cost > 0);
    const totals = campaigns.reduce(
      (a, c) => ({ name: 'total', clicks: a.clicks + c.clicks, cost: a.cost + c.cost, conversions: a.conversions + c.conversions, value: a.value + c.value }),
      { name: 'total', clicks: 0, cost: 0, conversions: 0, value: 0 },
    );

    const realtime: HeissRealtime = { activeUsers: 0, events: {} };
    for (const r of rtRows) realtime.events[r.dimensionValues?.[0]?.value] = n(r.metricValues?.[0]?.value);

    const until = new Date();
    const since = new Date(until.getTime() - (days - 1) * 86400000);
    return {
      fetchedAt: new Date().toISOString(),
      range: { since: since.toISOString().slice(0, 10), until: until.toISOString().slice(0, 10), days },
      medicionDesde: MEDICION_DESDE,
      kpis, heatmap, nights, sources,
      trend: [...trendMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
      ads: { campaigns, totals },
      realtime, errors,
    };
  } finally {
    clearTimeout(timer);
  }
}
