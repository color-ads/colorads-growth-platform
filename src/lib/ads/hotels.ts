/**
 * Gateway a SerpAPI google_hotels: tarifa, rating, reviews, clase y amenities por hotel.
 * Gateado por SERPAPI_KEY (sin la key devuelve null). Cache 6h, concurrencia limitada, time-budget duro.
 */

import type { HotelSnapshot } from './types';

const SERPAPI_ENDPOINT = 'https://serpapi.com/search.json';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const hotelCache = new Map<string, { data: HotelSnapshot | null; expires: number }>();

function futureDates(): { check_in_date: string; check_out_date: string } {
  const now = new Date();
  const ci = new Date(now.getTime() + 21 * 86400000);
  const co = new Date(now.getTime() + 23 * 86400000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { check_in_date: fmt(ci), check_out_date: fmt(co) };
}

async function serp(params: Record<string, string>, signal: AbortSignal): Promise<any> {
  const key = process.env.SERPAPI_KEY!;
  const qs = new URLSearchParams({ ...params, api_key: key }).toString();
  const r = await fetch(`${SERPAPI_ENDPOINT}?${qs}`, { signal });
  if (!r.ok) throw new Error(`serpapi ${r.status}`);
  return r.json();
}

async function pMap<T, R>(items: T[], fn: (t: T) => Promise<R>, concurrency: number): Promise<(R | undefined)[]> {
  const results: (R | undefined)[] = new Array(items.length);
  let cursor = 0;
  const n = Math.max(1, Math.min(concurrency, items.length || 1));
  const workers = Array.from({ length: n }, async () => {
    for (;;) {
      const idx = cursor++;
      if (idx >= items.length) break;
      try { results[idx] = await fn(items[idx]); } catch { results[idx] = undefined; }
    }
  });
  await Promise.all(workers);
  return results;
}

function num(x: unknown): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

// google_hotels trata `q` como destino, no como propiedad: hay que buscar `${nombre} ${sub-zona}`
// y encontrar el match DENTRO de los resultados. La sub-zona que funciona varia por hotel
// (ej. Binn solo aparece con "Provenza"), asi que probamos varias hasta dar con el match.
const AREA_VARIANTS = ['El Poblado Medellin', 'Provenza Medellin', 'Medellin Colombia'];

function normHotel(s: string) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\bhotel\b|\bhostel\b|\bby .*/g, '').replace(/[^a-z0-9]/g, '').trim();
}
function nameMatches(a: string, b: string) {
  const na = normHotel(a), nb = normHotel(b);
  return !!na && !!nb && (na.includes(nb) || nb.includes(na));
}

function toSnapshot(label: string, p: any): HotelSnapshot {
  const rate = p.rate_per_night || {};
  const ratePerNight = num(rate.extracted_lowest) ?? (parseInt(String(rate.lowest || '').replace(/[^0-9]/g, ''), 10) || null);
  return {
    label,
    name: String(p.name || ''),
    ratePerNight,
    currency: 'USD',
    rating: num(p.overall_rating),
    reviews: num(p.reviews),
    hotelClass: p.hotel_class ? String(p.hotel_class) : p.extracted_hotel_class ? `${p.extracted_hotel_class}★` : null,
    amenities: Array.isArray(p.amenities) ? p.amenities.slice(0, 8).map((a: unknown) => String(a)) : [],
    image: Array.isArray(p.images) && p.images[0] ? String(p.images[0].thumbnail || p.images[0].original_image || '') || null : null,
    link: p.link ? String(p.link) : null,
  };
}

async function fetchOneHotel(label: string, name: string, signal: AbortSignal): Promise<HotelSnapshot | null> {
  const cacheKey = normHotel(name);
  const hit = hotelCache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return hit.data ? { ...hit.data, label } : null;

  const { check_in_date, check_out_date } = futureDates();
  for (const area of AREA_VARIANTS) {
    const j = await serp(
      { engine: 'google_hotels', q: `${name} ${area}`, check_in_date, check_out_date, currency: 'USD', gl: 'co', hl: 'es' },
      signal,
    );
    const props: any[] = Array.isArray(j.properties) ? j.properties : [];
    const match = props.find((p) => nameMatches(name, String(p.name || '')));
    if (match) {
      const snap = toSnapshot(label, match);
      hotelCache.set(cacheKey, { data: snap, expires: Date.now() + CACHE_TTL_MS });
      return snap;
    }
  }
  hotelCache.set(cacheKey, { data: null, expires: Date.now() + CACHE_TTL_MS });
  return null;
}

/** Devuelve snapshots para self + competidores. null si no hay SERPAPI_KEY. */
export async function fetchHotelSnapshots(
  input: { self?: string; competitors: string[] },
  opts: { timeBudgetMs?: number } = {},
): Promise<HotelSnapshot[] | null> {
  if (!process.env.SERPAPI_KEY) return null;
  const items: { label: string; name: string }[] = [];
  if (input.self) items.push({ label: 'self', name: input.self });
  for (const c of input.competitors) if (c) items.push({ label: c, name: c });
  if (!items.length) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeBudgetMs ?? 55000);
  try {
    const res = await pMap(items, (it) => fetchOneHotel(it.label, it.name, ctrl.signal), 3);
    const out = res.filter(Boolean) as HotelSnapshot[];
    return out.length ? out : null;
  } finally {
    clearTimeout(timer);
  }
}

/** Bloque de texto para inyectar al prompt como EVIDENCIA DURA de tarifas/posicionamiento. */
export function buildHotelBlock(snaps: HotelSnapshot[] | null): string {
  if (!snaps || !snaps.length) return '';
  const line = (s: HotelSnapshot) => {
    const who = s.label === 'self' ? `${s.name} (NUESTRO HOTEL)` : s.name;
    const rate = s.ratePerNight ? `US$${s.ratePerNight}/noche` : 'tarifa n/d';
    const rev = s.rating ? `${s.rating}★ (${s.reviews ?? '?'} reviews)` : 'sin rating';
    const cls = s.hotelClass ? ` · ${s.hotelClass}` : '';
    return `- ${who}: ${rate} · ${rev}${cls}`;
  };
  return [
    'EVIDENCIA DURA — TARIFAS Y POSICIONAMIENTO (Google Hotels, verificado; NO inferido):',
    'Usa estas tarifas, ratings y clase como evidencia dura de posicionamiento y paridad de precio. Es data real de Google Hotels.',
    ...snaps.map(line),
    'Si el hotel cliente queda mal parado en algun eje (ej. rating mas bajo, tarifa fuera de mercado), enmarcalo SIEMPRE como oportunidad puntual de mejora de conversion, nunca como critica.',
  ].join('\n');
}
