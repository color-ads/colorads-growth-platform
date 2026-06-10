'use client';

import { useEffect, useState, type ReactNode } from 'react';

type Evidence = { label?: string; url?: string };
type Finding = {
  title?: string; competitor?: string; category?: string;
  whatTheyDo?: string; weDont?: string; opportunity?: string;
  evidence?: Evidence[]; confidence?: string;
};
type StoredCreative = {
  format: string; headline: string | null; description: string | null; cta: string | null;
  landing: string | null; firstShown: string | null; lastShown: string | null;
  totalDaysShown: number | null; regions: string[]; imageUrl: string | null; detailsLink: string | null;
};
type StoredAdvertiser = { group: string; advertiserName: string; totalResults: number; creatives: StoredCreative[] };
type StoredGoogleAds = { fetchedAt?: string; mode?: string; advertisers?: StoredAdvertiser[] };
type HotelSnap = {
  label: string; name: string; ratePerNight: number | null; currency: string | null;
  rating: number | null; reviews: number | null; hotelClass: string | null;
  amenities: string[]; image: string | null; link: string | null;
};
type TextAttr = { attribute?: string; value?: string; takeaway?: string };
type AdAnalysisItem = { competitor?: string; textAttributes?: TextAttr[]; visualNote?: string };
type Data = {
  ourHotel?: { name?: string; url?: string; alreadyDoing?: string[] };
  findings?: Finding[];
  alsoChecked?: string[];
  diggingNote?: string;
  summary?: string;
  generatedAt?: string;
  googleAds?: StoredGoogleAds | null;
  hotelSnapshot?: HotelSnap[];
  adAnalysis?: AdAnalysisItem[];
};

const BLUE = '#457B9D';
const INK = '#1d3557';
const AMBER = '#b07400';
const GREEN = '#1b7a44';

function hostOf(u: string) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } }

function confColor(c?: string) {
  const v = (c || '').toLowerCase();
  if (v.startsWith('alta')) return { bg: '#e7f5ec', fg: '#1b7a44' };
  if (v.startsWith('media')) return { bg: '#fdf3e0', fg: '#b07400' };
  return { bg: '#eef1f5', fg: '#6b7686' };
}

function fmtBadge(format: string) {
  const f = (format || '').toUpperCase();
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    IMAGE: { bg: '#eef4f8', fg: BLUE, label: 'Imagen' },
    VIDEO: { bg: '#f3eefb', fg: '#6b4ea0', label: 'Video' },
    TEXT: { bg: '#eef1f5', fg: '#5b6776', label: 'Texto' },
  };
  return map[f] || { bg: '#eef1f5', fg: '#6b7686', label: format || '—' };
}

// Normaliza nombres de hotel para emparejar (ads group / hotel snapshot / adAnalysis competitor).
function norm(s: string) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\bhotel\b|\bhostel\b|\bby .*/g, '').replace(/[^a-z0-9]/g, '').trim();
}
function matchName(a: string, b: string) {
  const na = norm(a), nb = norm(b);
  return !!na && !!nb && (na.includes(nb) || nb.includes(na));
}

function Header({ updated }: { updated: string | null }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <span style={{ width: 4, height: 26, background: BLUE, borderRadius: 4, display: 'inline-block' }} />
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: INK }}>Acciones destacadas — Competencia</h2>
        {updated && <span style={{ fontSize: 12, color: '#7a8699', marginLeft: 'auto' }}>Investigación · {updated}</span>}
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#5b6776', maxWidth: 760, lineHeight: 1.5 }}>
        Solo lo que mueve la aguja: rutas concretas para mejorar conversión, con evidencia verificada. Máximo 3 por mes.
      </p>
    </>
  );
}

function Block({ label, color, accent, children }: { label: string; color: string; accent?: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: '#3d4654', lineHeight: 1.6, background: accent || 'transparent', borderRadius: accent ? 8 : 0, padding: accent ? '8px 12px' : 0 }}>{children}</div>
    </div>
  );
}

function AdCard({ c }: { c: StoredCreative }) {
  const [imgOk, setImgOk] = useState(true);
  const badge = fmtBadge(c.format);
  const text = c.headline || c.description || '';
  const period = c.firstShown || c.lastShown ? `${c.firstShown || '?'} → ${c.lastShown || '?'}` : '';
  const hasImg = !!c.imageUrl && imgOk;
  const fmt = (c.format || '').toUpperCase();
  // IMAGE = foto del creativo, VIDEO = thumbnail de YouTube: ambos rellenan con cover.
  // TEXT = preview renderizado (favicon + titulo + chips): se muestra COMPLETO con contain, sin recortar.
  const isPhoto = fmt === 'IMAGE' || fmt === 'VIDEO';
  const isVideo = fmt === 'VIDEO';
  const card = (
    <div style={{ width: 200, border: '1px solid #e6eaf0', borderRadius: 12, overflow: 'hidden', background: '#fff', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 150, background: '#f4f6f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
        {hasImg ? (
          <img
            src={c.imageUrl as string}
            alt=""
            onError={() => setImgOk(false)}
            style={{ width: '100%', height: '100%', objectFit: isPhoto ? 'cover' : 'contain', objectPosition: 'center', background: '#fff' }}
          />
        ) : (
          <div style={{ padding: 12, textAlign: 'center', maxHeight: 126, overflow: 'hidden' }}>
            <div style={{ fontSize: 12, color: '#3d4654', lineHeight: 1.45 }}>{text || `Anuncio de ${badge.label.toLowerCase()}`}</div>
          </div>
        )}
        {isVideo && hasImg && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 38, height: 38, borderRadius: 999, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontSize: 15, marginLeft: 2 }}>▶</span>
          </div>
        )}
      </div>
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ alignSelf: 'flex-start', fontSize: 10, fontWeight: 700, color: badge.fg, background: badge.bg, borderRadius: 6, padding: '2px 7px' }}>{badge.label}</span>
        {period && <div style={{ fontSize: 10, color: '#8a93a1' }}>{period}{c.totalDaysShown ? ` · ${c.totalDaysShown}d` : ''}</div>}
        {c.regions?.length > 0 && <div style={{ fontSize: 10, color: '#8a93a1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.regions.slice(0, 4).join(', ')}{c.regions.length > 4 ? '…' : ''}</div>}
      </div>
    </div>
  );
  return c.detailsLink
    ? <a href={c.detailsLink} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>{card}</a>
    : card;
}

type Entity = {
  key: string; name: string; isSelf: boolean;
  total: number; creatives: StoredCreative[];
  hotel: HotelSnap | null; analysis: AdAnalysisItem | null;
};

function buildEntities(data: Data): Entity[] {
  const ads = data.googleAds?.advertisers || [];
  const hotels = data.hotelSnapshot || [];
  const analyses = data.adAnalysis || [];

  const mergeAds = (advs: StoredAdvertiser[]) => {
    let total = 0; const creatives: StoredCreative[] = [];
    for (const a of advs) { total += a.totalResults || 0; creatives.push(...a.creatives); }
    return { total, creatives };
  };

  const entities: Entity[] = [];
  // self
  const self = mergeAds(ads.filter((a) => a.group === 'self'));
  const selfHotel = hotels.find((h) => h.label === 'self') || null;
  const selfName = data.ourHotel?.name || selfHotel?.name || 'Nuestro hotel';
  entities.push({
    key: 'self', name: selfName, isSelf: true, ...self,
    hotel: selfHotel,
    analysis: analyses.find((an) => matchName(an.competitor || '', selfName)) || null,
  });

  // competidores: union de groups de ads (no-self) + labels de hoteles (no-self)
  const compNames: string[] = [];
  for (const a of ads) if (a.group !== 'self' && !compNames.includes(a.group)) compNames.push(a.group);
  for (const h of hotels) if (h.label !== 'self' && !compNames.includes(h.label)) compNames.push(h.label);

  for (const name of compNames) {
    const m = mergeAds(ads.filter((a) => a.group === name));
    entities.push({
      key: name, name, isSelf: false, ...m,
      hotel: hotels.find((h) => h.label === name) || null,
      analysis: analyses.find((an) => matchName(an.competitor || '', name)) || null,
    });
  }
  return entities;
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#8a93a1', textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: INK }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: '#8a93a1' }}>{sub}</div>}
    </div>
  );
}

function EntityView({ e, selfHotel }: { e: Entity; selfHotel: HotelSnap | null }) {
  const usable = e.creatives.filter((c) => c.imageUrl || c.headline || c.description)
    .sort((x, y) => (y.lastShown || '').localeCompare(x.lastShown || '')).slice(0, 6);
  const h = e.hotel;
  let rateDelta: ReactNode = null;
  if (h?.ratePerNight && !e.isSelf && selfHotel?.ratePerNight) {
    const d = h.ratePerNight - selfHotel.ratePerNight;
    const c = d === 0 ? '#8a93a1' : d > 0 ? GREEN : AMBER;
    rateDelta = <span style={{ color: c, fontWeight: 600 }}>{d > 0 ? `+US$${d}` : d < 0 ? `-US$${Math.abs(d)}` : '='} vs nuestro</span>;
  }

  return (
    <div>
      {/* Snapshot de hotel */}
      {h && (
        <div style={{ display: 'flex', gap: 14, border: '1px solid #e6eaf0', borderRadius: 12, padding: 14, marginBottom: 14, background: '#fff' }}>
          {h.image && <img src={h.image} alt="" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: INK, marginBottom: 8 }}>{h.name}</div>
            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginBottom: 8 }}>
              <Metric label="Tarifa/noche" value={h.ratePerNight ? `US$${h.ratePerNight}` : 'n/d'} sub={rateDelta ? undefined : (h.currency || undefined)} />
              <Metric label="Rating" value={h.rating ? `${h.rating}★` : 'n/d'} sub={h.reviews ? `${h.reviews} reviews` : undefined} />
              <Metric label="Clase" value={h.hotelClass || '—'} />
            </div>
            {rateDelta && <div style={{ fontSize: 11.5, marginBottom: 6 }}>{rateDelta}</div>}
            {h.amenities?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {h.amenities.slice(0, 6).map((a, i) => (
                  <span key={i} style={{ fontSize: 10.5, color: '#5b6776', background: '#f4f6f9', borderRadius: 999, padding: '2px 8px' }}>{a}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Análisis de estructura de anuncios */}
      {e.analysis && ((e.analysis.textAttributes?.length || 0) > 0 || e.analysis.visualNote) && (
        <div style={{ border: '1px solid #e6eaf0', borderRadius: 12, padding: '14px 16px', marginBottom: 14, background: '#fbfcfd' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: BLUE, marginBottom: 8 }}>Estructura del anuncio — qué rescatar</div>
          {e.analysis.visualNote && (
            <div style={{ fontSize: 12.5, color: '#5b6776', lineHeight: 1.5, marginBottom: (e.analysis.textAttributes?.length || 0) > 0 ? 10 : 0 }}>
              <strong style={{ color: INK }}>Composición:</strong> {e.analysis.visualNote}
            </div>
          )}
          {(e.analysis.textAttributes || []).map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderTop: i === 0 ? 'none' : '1px solid #eef1f5' }}>
              <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 700, color: INK, background: '#eef4f8', borderRadius: 6, padding: '2px 8px', height: 'fit-content' }}>{a.attribute}</span>
              <div style={{ fontSize: 12.5, color: '#3d4654', lineHeight: 1.45 }}>
                {a.value && <span style={{ fontWeight: 600, color: INK }}>&ldquo;{a.value}&rdquo;</span>}
                {a.takeaway && <span style={{ color: '#5b6776' }}>{a.value ? ' → ' : ''}{a.takeaway}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Galería de anuncios */}
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: '#7a8699', marginBottom: 8 }}>
        Anuncios en Google Ads{e.total > 0 ? ` · ${e.total} activos` : ''}
      </div>
      {usable.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {usable.map((c, i) => <AdCard key={i} c={c} />)}
        </div>
      ) : (
        <div style={{ fontSize: 11.5, color: '#8a93a1' }}>Sin vista previa de anuncios disponible este mes.</div>
      )}
    </div>
  );
}

function CompetitorTabs({ entities }: { entities: Entity[] }) {
  const [sel, setSel] = useState(0);
  if (!entities.length) return null;
  const idx = Math.min(sel, entities.length - 1);
  const e = entities[idx];
  const selfHotel = entities.find((x) => x.isSelf)?.hotel || null;

  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: INK, marginBottom: 3 }}>Análisis por competidor</div>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: '#7a8699', maxWidth: 760, lineHeight: 1.5 }}>
        Tarifa, posicionamiento y estructura de anuncios de cada actor — datos verificados de Google (Transparencia + Hotels).
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, borderBottom: '1px solid #e6eaf0', marginBottom: 16 }}>
        {entities.map((en, i) => {
          const active = i === idx;
          return (
            <button
              key={en.key}
              onClick={() => setSel(i)}
              style={{
                border: 'none', background: 'transparent', cursor: 'pointer',
                padding: '7px 12px', fontSize: 12.5, marginBottom: -1,
                borderBottom: `2px solid ${active ? BLUE : 'transparent'}`,
                color: active ? BLUE : '#7a8699', fontWeight: active ? 700 : 500,
              }}
            >
              {en.isSelf ? `${en.name} (nuestro)` : en.name}
            </button>
          );
        })}
      </div>
      <EntityView e={e} selfHotel={selfHotel} />
    </div>
  );
}

export default function CompetitionPanel({ slug = 'h98' }: { slug?: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/competition/data?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' });
        const j = await r.json();
        if (alive) setData(j && j.ok ? j.data : null);
      } catch {
        if (alive) setData(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [slug]);

  if (loading) {
    return (
      <section style={{ margin: '28px 0' }}>
        <div style={{ height: 18, width: 320, background: '#eef1f5', borderRadius: 6 }} />
        <div style={{ marginTop: 12, height: 140, background: '#f6f8fa', borderRadius: 12 }} />
      </section>
    );
  }
  if (!data) return null;

  const findings = (data.findings || []).filter((f) => f && (f.title || f.whatTheyDo));
  const already = (data.ourHotel?.alreadyDoing || []).filter(Boolean);
  const entities = buildEntities(data);
  const updated = data.generatedAt
    ? new Date(data.generatedAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  if (findings.length === 0 && !data.diggingNote && !data.summary && entities.length <= 1) {
    return (
      <section style={{ margin: '28px 0' }}>
        <Header updated={updated} />
        <div style={{ fontSize: 13, color: '#7a8699', border: '1px dashed #d8dee7', borderRadius: 12, padding: '14px 16px' }}>
          Tocá &quot;Actualizar investigacion&quot; en el admin para correr el análisis de hallazgos.
        </div>
      </section>
    );
  }

  return (
    <section style={{ margin: '28px 0' }}>
      <Header updated={updated} />

      {already.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', margin: '0 0 18px' }}>
          <span style={{ fontSize: 11, color: '#7a8699', fontWeight: 600 }}>Ya hacemos (no se repite acá):</span>
          {already.map((a, i) => (
            <span key={i} style={{ fontSize: 11, color: '#5b6776', background: '#f4f6f9', borderRadius: 999, padding: '3px 9px' }}>{a}</span>
          ))}
        </div>
      )}

      {findings.map((f, i) => {
        const cc = confColor(f.confidence);
        const ev = Array.isArray(f.evidence) ? f.evidence : [];
        return (
          <div key={i} style={{ border: '1px solid #e6eaf0', borderRadius: 14, padding: '18px 20px', background: '#fff', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              {f.category && <span style={{ fontSize: 11, fontWeight: 700, color: BLUE, background: '#eef4f8', borderRadius: 6, padding: '3px 8px' }}>{f.category}</span>}
              {f.competitor && <span style={{ fontSize: 12, color: '#5b6776' }}>via <strong style={{ color: INK }}>{f.competitor}</strong></span>}
              {f.confidence && <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, color: cc.fg, background: cc.bg, borderRadius: 999, padding: '2px 8px' }}>confianza {f.confidence}</span>}
            </div>

            <div style={{ fontWeight: 700, fontSize: 17, color: INK, lineHeight: 1.35, marginBottom: 12 }}>{f.title}</div>

            {f.whatTheyDo && <Block label="Qué hacen" color={INK}>{f.whatTheyDo}</Block>}
            {f.weDont && <Block label="Espacio de mejora" color={AMBER} accent="#fbe9cf">{f.weDont}</Block>}
            {f.opportunity && <Block label="Oportunidad — qué probar" color={BLUE} accent="#e4eef4">{f.opportunity}</Block>}

            {ev.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 12 }}>
                <span style={{ fontSize: 11, color: '#7a8699', fontWeight: 600 }}>Evidencia:</span>
                {ev.map((e, k) => e.url ? (
                  <a key={k} href={e.url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#3d5a73', textDecoration: 'none', background: '#f4f6f9', borderRadius: 999, padding: '3px 9px' }}>
                    <img src={`https://www.google.com/s2/favicons?domain=${hostOf(e.url)}&sz=32`} alt="" style={{ width: 13, height: 13 }}
                      onError={(ev2) => { (ev2.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    {e.label || hostOf(e.url)}
                  </a>
                ) : null)}
              </div>
            )}
          </div>
        );
      })}

      {data.diggingNote && (
        <div style={{ borderLeft: `3px solid ${AMBER}`, background: '#fdf8ef', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: AMBER, marginBottom: 4 }}>Dónde meter el dedo el próximo mes</div>
          <div style={{ fontSize: 13, color: '#5b5240', lineHeight: 1.55 }}>{data.diggingNote}</div>
        </div>
      )}

      {entities.length > 1 && <CompetitorTabs entities={entities} />}
    </section>
  );
}
