/**
 * Gateway server-side a SerpAPI (Google Ads Transparency Center).
 * - Gateado por SERPAPI_KEY: sin la key, fetchGoogleAds() devuelve null (todo sigue como hoy).
 * - fast  = solo listado de anuncios (sin detalles, no quema cuota ni tiempo).
 * - deep  = listado + detalles con tope GLOBAL, concurrencia limitada y time-budget duro.
 * Cache en memoria con TTL ~6h (suficiente para iterar local; en serverless no persiste entre invocaciones).
 */

import type {
  AdContent,
  AdCreative,
  AdFormat,
  AdvertiserAds,
  AdvertiserMap,
  GoogleAdsBundle,
} from './types';

const SERPAPI_ENDPOINT = 'https://serpapi.com/search.json';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

type CacheEntry = { data: AdvertiserAds; expires: number };
const listCache = new Map<string, CacheEntry>();

export function adsEnabled(): boolean {
  return !!process.env.SERPAPI_KEY;
}

function toIso(unix: unknown): string | null {
  const n = Number(unix);
  if (!Number.isFinite(n) || n <= 0) return null;
  try {
    return new Date(n * 1000).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function normFormat(f: unknown): AdFormat {
  const s = String(f || '').toUpperCase();
  return s === 'TEXT' || s === 'IMAGE' || s === 'VIDEO' ? s : 'UNKNOWN';
}

async function serp(params: Record<string, string>, signal: AbortSignal): Promise<any> {
  const key = process.env.SERPAPI_KEY!;
  const qs = new URLSearchParams({ ...params, api_key: key }).toString();
  const r = await fetch(`${SERPAPI_ENDPOINT}?${qs}`, { signal });
  if (!r.ok) throw new Error(`serpapi ${r.status}`);
  return r.json();
}

/** Pequeño runner de concurrencia: nunca rechaza (errores -> undefined). */
async function pMap<T, R>(items: T[], fn: (t: T) => Promise<R>, concurrency: number): Promise<(R | undefined)[]> {
  const results: (R | undefined)[] = new Array(items.length);
  let cursor = 0;
  const n = Math.max(1, Math.min(concurrency, items.length || 1));
  const workers = Array.from({ length: n }, async () => {
    for (;;) {
      const idx = cursor++;
      if (idx >= items.length) break;
      try {
        results[idx] = await fn(items[idx]);
      } catch {
        results[idx] = undefined;
      }
    }
  });
  await Promise.all(workers);
  return results;
}

async function fetchList(advertiserId: string, topN: number, signal: AbortSignal): Promise<AdvertiserAds | null> {
  const hit = listCache.get(advertiserId);
  if (hit && hit.expires > Date.now()) return hit.data;

  const j = await serp({ engine: 'google_ads_transparency_center', advertiser_id: advertiserId }, signal);
  const ads: any[] = Array.isArray(j.ad_creatives) ? j.ad_creatives : [];
  const name = ads[0]?.advertiser ? String(ads[0].advertiser) : 'Unknown';
  const total = Number(j?.search_information?.total_results ?? ads.length) || ads.length;

  const creatives: AdCreative[] = ads
    .map(
      (a): AdCreative => ({
        id: String(a.ad_creative_id || ''),
        advertiserId,
        format: normFormat(a.format),
        firstShown: toIso(a.first_shown),
        lastShown: toIso(a.last_shown),
        totalDaysShown: Number.isFinite(Number(a.total_days_shown)) ? Number(a.total_days_shown) : null,
        regions: [],
        detailsLink: a.details_link ? String(a.details_link) : null,
        content: {},
      }),
    )
    .filter((c) => c.id)
    .sort((x, y) => (y.lastShown || '').localeCompare(x.lastShown || ''))
    .slice(0, topN);

  const data: AdvertiserAds = { advertiserId, advertiserName: name, totalResults: total, creatives };
  listCache.set(advertiserId, { data, expires: Date.now() + CACHE_TTL_MS });
  return data;
}

async function fetchDetail(
  advertiserId: string,
  creativeId: string,
  signal: AbortSignal,
): Promise<{ regions: string[]; content: AdContent }> {
  const j = await serp(
    { engine: 'google_ads_transparency_center_ad_details', advertiser_id: advertiserId, creative_id: creativeId },
    signal,
  );
  const si = j?.search_information || {};
  const regions: string[] = Array.isArray(si.regions)
    ? si.regions.map((r: any) => String(r?.region_name || '')).filter(Boolean)
    : si.region_name
      ? [String(si.region_name)]
      : [];

  const variants: any[] = Array.isArray(j.ad_creatives) ? j.ad_creatives : [];
  const content: AdContent = {};
  for (const c of variants) {
    // primer valor no vacio gana (los image ads suelen no traer texto -> degradado elegante)
    if (!content.headline && c.headline) content.headline = String(c.headline);
    if (!content.description && (c.snippet || c.description)) content.description = String(c.snippet || c.description);
    if (!content.callToAction && c.call_to_action) content.callToAction = String(c.call_to_action);
    if (!content.visibleLink && c.visible_link) content.visibleLink = String(c.visible_link);
    if (!content.landingPageUrl && c.link) content.landingPageUrl = String(c.link);
    if (!content.imageUrl && c.image) content.imageUrl = String(c.image);
    // Video ads: usar el thumbnail de YouTube como vista previa (los image ads no traen thumbnail).
    if (!content.imageUrl && c.thumbnail) content.imageUrl = String(c.thumbnail);
    if (!content.videoUrl && c.video_link) content.videoUrl = String(c.video_link);
  }
  return { regions, content };
}

/**
 * Orquestador principal. Devuelve null si SERPAPI_KEY no esta seteada.
 * fast: solo listas. deep: listas + hasta `globalDetailCap` detalles (los mas recientes a nivel global).
 */
export async function fetchGoogleAds(map: AdvertiserMap, opts: { mode: 'fast' | 'deep' }): Promise<GoogleAdsBundle | null> {
  if (!adsEnabled()) return null;

  const mode = opts.mode;
  const perAdvertiserList = 5;
  const globalDetailCap = mode === 'deep' ? 14 : 0; // fast = SIN detalles. Deep: mas detalles = mas thumbnails de video + copy.
  const concurrency = 3;
  const timeBudgetMs = mode === 'deep' ? 90_000 : 20_000;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeBudgetMs);

  try {
    const groups: { group: 'self' | string; id: string }[] = [];
    for (const id of map.self || []) groups.push({ group: 'self', id });
    for (const [name, ids] of Object.entries(map.competitors || {})) {
      for (const id of ids || []) groups.push({ group: name, id });
    }
    if (!groups.length) return null;

    const listed = await pMap(
      groups,
      async (g) => ({ group: g.group, ads: await fetchList(g.id, perAdvertiserList, ctrl.signal) }),
      concurrency,
    );

    const self: AdvertiserAds[] = [];
    const competitors: Record<string, AdvertiserAds[]> = {};
    const allCreatives: AdCreative[] = [];
    for (const entry of listed) {
      if (!entry || !entry.ads) continue;
      if (entry.group === 'self') self.push(entry.ads);
      else (competitors[entry.group] ||= []).push(entry.ads);
      allCreatives.push(...entry.ads.creatives);
    }

    let detailsFetched = 0;
    if (globalDetailCap > 0 && allCreatives.length) {
      const byRecency = (arr: AdCreative[]) => [...arr].sort((a, b) => (b.lastShown || '').localeCompare(a.lastShown || ''));
      const seen = new Set<string>();
      const pick: AdCreative[] = [];
      // 1) Garantizar al menos 1 detalle por advertiser (asi ningun competidor queda sin vista previa).
      const perAdv = new Map<string, AdCreative[]>();
      for (const c of allCreatives) {
        if (!c.id) continue;
        const arr = perAdv.get(c.advertiserId) || [];
        arr.push(c);
        perAdv.set(c.advertiserId, arr);
      }
      for (const arr of perAdv.values()) {
        const top = byRecency(arr)[0];
        if (top && !seen.has(top.id)) { seen.add(top.id); pick.push(top); }
      }
      // 2) Llenar el resto del cupo por recencia global.
      for (const c of byRecency(allCreatives)) {
        if (pick.length >= Math.max(globalDetailCap, perAdv.size)) break;
        if (c.id && !seen.has(c.id)) { seen.add(c.id); pick.push(c); }
      }
      const ranked = pick;
      await pMap(
        ranked,
        async (c) => {
          if (ctrl.signal.aborted) return;
          const d = await fetchDetail(c.advertiserId, c.id, ctrl.signal);
          c.regions = d.regions;
          c.content = { ...c.content, ...d.content };
          detailsFetched++;
        },
        concurrency,
      );
    }

    return { self, competitors, fetchedAt: new Date().toISOString(), mode, detailsFetched };
  } finally {
    clearTimeout(timer);
  }
}
