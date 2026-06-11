/**
 * Gateway a la Google Analytics 4 Data API (runReport).
 * Reusa las credenciales OAuth de Google (scope analytics.readonly) + GOOGLE_GA4_PROPERTY_ID.
 *
 * Semantica: "cloudbeds" = visita/carga del motor (INTENCION). "reservas" = page view de
 * /reservation/confirmation = RESERVA DIRECTA REAL. "purchase" = ecommerce (hoy roto).
 * La VENTA REAL es el evento "reservas"; su perfil por pais/ciudad/dispositivo/dia es CONFIABLE.
 * La atribucion de reservas por CANAL no es confiable (cross-domain).
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ENGINE_EVENTS = ['cloudbeds', 'CloudBeds'];
const BOOKING_EVENTS = ['reservas'];
const PURCHASE_EVENT = 'purchase';

export function ga4Enabled(): boolean {
  return !!(
    process.env.GOOGLE_ADS_CLIENT_ID &&
    process.env.GOOGLE_ADS_CLIENT_SECRET &&
    process.env.GOOGLE_ADS_REFRESH_TOKEN &&
    process.env.GOOGLE_GA4_PROPERTY_ID
  );
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

async function runReport(body: any, signal: AbortSignal): Promise<any[]> {
  const token = await getAccessToken(signal);
  const pid = process.env.GOOGLE_GA4_PROPERTY_ID!;
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${pid}:runReport`, {
    method: 'POST', signal,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`ga4 ${res.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return Array.isArray(j.rows) ? j.rows : [];
}

const n = (x: unknown) => Number(x) || 0;
const dr = (since: string, until: string) => [{ startDate: since, endDate: until }];
const eventFilter = (values: string[]) => ({ filter: { fieldName: 'eventName', inListFilter: { values } } });

export interface GA4Channel { label: string; sessions: number; engineVisits: number }
export interface GA4Count { label: string; value: number }
export interface GA4TrendPoint { date: string; value: number }
export interface GA4Audience {
  fetchedAt: string;
  range: { since: string; until: string };
  funnel: { sessions: number; users: number; newUsers: number };
  channels: GA4Channel[];
  bookingsByCountry: GA4Count[];
  bookingsByDevice: GA4Count[];
  bookingsByCity: GA4Count[];
  bookingsByDayOfWeek: GA4Count[]; // label = dia (en ingles), value = reservas
  bookingsTrend: GA4TrendPoint[]; // date YYYY-MM-DD
  newVsReturning: { newBookings: number; returningBookings: number; newSessions: number; returningSessions: number };
  engineLandingPages: GA4Count[]; // landing page -> aperturas de motor
  totalEngineVisits: number;
  totalBookings: number;
  totalPurchases: number;
}

function mapCount(rows: any[], titleCase = false): GA4Count[] {
  return rows
    .map((r) => {
      let label = r.dimensionValues?.[0]?.value || '';
      if (titleCase) label = ({ mobile: 'Mobile', desktop: 'Desktop', tablet: 'Tablet' } as Record<string, string>)[label] || label;
      return { label, value: n(r.metricValues?.[0]?.value) };
    })
    .filter((c) => c.label && c.value > 0);
}
function isoDate(d: string) { return d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d; }

export async function fetchGA4Audience(opts: { since: string; until: string; timeBudgetMs?: number }): Promise<GA4Audience | null> {
  if (!ga4Enabled()) return null;
  const { since, until } = opts;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeBudgetMs ?? 40000);
  const bookF = eventFilter(BOOKING_EVENTS);
  const D = dr(since, until);
  try {
    const [
      funnelRows, engineRows, byCountry, byDevice, byCity, byDow, byDate, bookNvR, sessNvR, landingRows, purchaseRows,
    ] = await Promise.all([
      runReport({ dateRanges: D, metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'newUsers' }] }, ctrl.signal),
      runReport({ dateRanges: D, dimensions: [{ name: 'sessionSourceMedium' }], metrics: [{ name: 'eventCount' }], dimensionFilter: eventFilter(ENGINE_EVENTS), limit: 12, orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }] }, ctrl.signal),
      runReport({ dateRanges: D, dimensions: [{ name: 'country' }], metrics: [{ name: 'eventCount' }], dimensionFilter: bookF, limit: 12, orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }] }, ctrl.signal),
      runReport({ dateRanges: D, dimensions: [{ name: 'deviceCategory' }], metrics: [{ name: 'eventCount' }], dimensionFilter: bookF }, ctrl.signal),
      runReport({ dateRanges: D, dimensions: [{ name: 'city' }], metrics: [{ name: 'eventCount' }], dimensionFilter: bookF, limit: 8, orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }] }, ctrl.signal),
      runReport({ dateRanges: D, dimensions: [{ name: 'dayOfWeekName' }], metrics: [{ name: 'eventCount' }], dimensionFilter: bookF }, ctrl.signal),
      runReport({ dateRanges: D, dimensions: [{ name: 'date' }], metrics: [{ name: 'eventCount' }], dimensionFilter: bookF, orderBys: [{ dimension: { dimensionName: 'date' } }] }, ctrl.signal),
      runReport({ dateRanges: D, dimensions: [{ name: 'newVsReturning' }], metrics: [{ name: 'eventCount' }], dimensionFilter: bookF }, ctrl.signal),
      runReport({ dateRanges: D, dimensions: [{ name: 'newVsReturning' }], metrics: [{ name: 'sessions' }] }, ctrl.signal),
      runReport({ dateRanges: D, dimensions: [{ name: 'landingPage' }], metrics: [{ name: 'eventCount' }], dimensionFilter: eventFilter(ENGINE_EVENTS), limit: 8, orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }] }, ctrl.signal),
      runReport({ dateRanges: D, metrics: [{ name: 'eventCount' }], dimensionFilter: eventFilter([PURCHASE_EVENT]) }, ctrl.signal),
    ]);

    const fm = funnelRows[0]?.metricValues || [];
    const funnel = { sessions: n(fm[0]?.value), users: n(fm[1]?.value), newUsers: n(fm[2]?.value) };

    const channels: GA4Channel[] = engineRows.map((r) => ({ label: r.dimensionValues?.[0]?.value || '', engineVisits: n(r.metricValues?.[0]?.value), sessions: 0 })).filter((c) => c.label);

    const bookingsByCountry = mapCount(byCountry);
    const bookingsByDevice = mapCount(byDevice, true);
    const bookingsByCity = mapCount(byCity).filter((c) => c.label !== '(not set)');
    const bookingsByDayOfWeek = mapCount(byDow);
    const bookingsTrend: GA4TrendPoint[] = byDate.map((r) => ({ date: isoDate(r.dimensionValues?.[0]?.value || ''), value: n(r.metricValues?.[0]?.value) })).filter((p) => p.date);
    const engineLandingPages = mapCount(landingRows);

    const nvrBook = new Map<string, number>();
    for (const r of bookNvR) nvrBook.set(r.dimensionValues?.[0]?.value || '', n(r.metricValues?.[0]?.value));
    const nvrSess = new Map<string, number>();
    for (const r of sessNvR) nvrSess.set(r.dimensionValues?.[0]?.value || '', n(r.metricValues?.[0]?.value));
    const newVsReturning = {
      newBookings: nvrBook.get('new') || 0,
      returningBookings: nvrBook.get('returning') || 0,
      newSessions: nvrSess.get('new') || 0,
      returningSessions: nvrSess.get('returning') || 0,
    };

    const totalEngineVisits = channels.reduce((s, c) => s + c.engineVisits, 0);
    const totalBookings = bookingsByCountry.reduce((s, c) => s + c.value, 0);
    const totalPurchases = purchaseRows.reduce((s, r) => s + n(r.metricValues?.[0]?.value), 0);

    return {
      fetchedAt: new Date().toISOString(), range: { since, until },
      funnel, channels, bookingsByCountry, bookingsByDevice, bookingsByCity,
      bookingsByDayOfWeek, bookingsTrend, newVsReturning, engineLandingPages,
      totalEngineVisits, totalBookings, totalPurchases,
    };
  } finally {
    clearTimeout(timer);
  }
}
