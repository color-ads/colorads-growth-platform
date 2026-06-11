/**
 * Gateway a la Google Analytics 4 Data API (runReport).
 * Reusa las credenciales OAuth de Google (refresh token con scope analytics.readonly)
 * + GOOGLE_GA4_PROPERTY_ID. Gateado: sin las env vars, ga4Enabled()=false.
 *
 * IMPORTANTE — semantica de conversiones:
 * El evento "cloudbeds" en GA4 es VISITA/CARGA DEL MOTOR de reservas (intencion), NO una venta.
 * El evento "purchase" (compra real) hoy casi no se dispara -> GA4 no mide ventas confiables.
 * Por eso este gateway mide INTENCION (visitas al motor por canal) y reporta aparte el conteo
 * de compras como señal del estado del tracking. La VENTA REAL vive en Cloudbeds (PMS).
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ENGINE_EVENTS = ['cloudbeds', 'CloudBeds']; // visita/carga del motor de reservas (intencion)
const BOOKING_EVENTS = ['reservas']; // page view de /reservation/confirmation = reserva directa real (H98)
const PURCHASE_EVENT = 'purchase'; // ecommerce estandar (hoy mal implementado -> flag de tracking)

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

export interface GA4Channel { label: string; sessions: number; engineVisits: number; bookings: number }
export interface GA4Audience {
  fetchedAt: string;
  range: { since: string; until: string };
  channels: GA4Channel[]; // por canal: sesiones, visitas al motor (intencion), reservas directas (venta)
  totalEngineVisits: number;
  totalBookings: number; // evento reservas (confirmacion) = reservas directas reales
  totalPurchases: number; // evento purchase: flag del estado del tracking ecommerce (hoy bajo)
  bookingEvents: string[];
  engineEvents: string[];
}

/** Intencion (visitas al motor) por canal desde GA4. null si no esta configurado. */
export async function fetchGA4Audience(opts: { since: string; until: string; timeBudgetMs?: number }): Promise<GA4Audience | null> {
  if (!ga4Enabled()) return null;
  const { since, until } = opts;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeBudgetMs ?? 30000);
  try {
    const [engineRows, bookingRows, sessRows, purchaseRows] = await Promise.all([
      runReport({ dateRanges: dr(since, until), dimensions: [{ name: 'sessionSourceMedium' }], metrics: [{ name: 'eventCount' }], dimensionFilter: eventFilter(ENGINE_EVENTS), limit: 12, orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }] }, ctrl.signal),
      runReport({ dateRanges: dr(since, until), dimensions: [{ name: 'sessionSourceMedium' }], metrics: [{ name: 'eventCount' }], dimensionFilter: eventFilter(BOOKING_EVENTS), limit: 12, orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }] }, ctrl.signal),
      runReport({ dateRanges: dr(since, until), dimensions: [{ name: 'sessionSourceMedium' }], metrics: [{ name: 'sessions' }], limit: 25 }, ctrl.signal),
      runReport({ dateRanges: dr(since, until), metrics: [{ name: 'eventCount' }], dimensionFilter: eventFilter([PURCHASE_EVENT]) }, ctrl.signal),
    ]);

    const sessByChannel = new Map<string, number>();
    for (const r of sessRows) sessByChannel.set(r.dimensionValues?.[0]?.value || '', n(r.metricValues?.[0]?.value));
    const bookByChannel = new Map<string, number>();
    for (const r of bookingRows) bookByChannel.set(r.dimensionValues?.[0]?.value || '', n(r.metricValues?.[0]?.value));

    // Union de canales con intencion o con reserva.
    const labels = new Set<string>();
    for (const r of engineRows) labels.add(r.dimensionValues?.[0]?.value || '');
    for (const r of bookingRows) labels.add(r.dimensionValues?.[0]?.value || '');
    const engineByChannel = new Map<string, number>();
    for (const r of engineRows) engineByChannel.set(r.dimensionValues?.[0]?.value || '', n(r.metricValues?.[0]?.value));

    const channels: GA4Channel[] = [...labels]
      .filter(Boolean)
      .map((label) => ({ label, engineVisits: engineByChannel.get(label) || 0, bookings: bookByChannel.get(label) || 0, sessions: sessByChannel.get(label) || 0 }))
      .sort((a, b) => b.bookings - a.bookings || b.engineVisits - a.engineVisits);

    const totalEngineVisits = channels.reduce((s, c) => s + c.engineVisits, 0);
    const totalBookings = channels.reduce((s, c) => s + c.bookings, 0);
    const totalPurchases = purchaseRows.reduce((s, r) => s + n(r.metricValues?.[0]?.value), 0);

    return { fetchedAt: new Date().toISOString(), range: { since, until }, channels, totalEngineVisits, totalBookings, totalPurchases, bookingEvents: BOOKING_EVENTS, engineEvents: ENGINE_EVENTS };
  } finally {
    clearTimeout(timer);
  }
}
