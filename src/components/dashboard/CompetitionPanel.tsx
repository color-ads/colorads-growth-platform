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
type Data = {
  ourHotel?: { name?: string; url?: string; alreadyDoing?: string[] };
  findings?: Finding[];
  alsoChecked?: string[];
  diggingNote?: string;
  summary?: string;
  generatedAt?: string;
  googleAds?: StoredGoogleAds | null;
};

const BLUE = '#457B9D';
const INK = '#1d3557';
const AMBER = '#b07400';

function hostOf(u: string) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } }

function confColor(c?: string) {
  const v = (c || '').toLowerCase();
  if (v.startsWith('alta')) return { bg: '#e7f5ec', fg: '#1b7a44' };
  if (v.startsWith('media')) return { bg: '#fdf3e0', fg: '#b07400' };
  return { bg: '#eef1f5', fg: '#6b7686' };
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
        Solo lo que mueve la aguja: qué hacen los competidores que <strong>nosotros no</strong>, con evidencia y una prueba concreta. Máximo 3 por mes.
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

function fmtBadge(format: string) {
  const f = (format || '').toUpperCase();
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    IMAGE: { bg: '#eef4f8', fg: BLUE, label: 'Imagen' },
    VIDEO: { bg: '#f3eefb', fg: '#6b4ea0', label: 'Video' },
    TEXT: { bg: '#eef1f5', fg: '#5b6776', label: 'Texto' },
  };
  return map[f] || { bg: '#eef1f5', fg: '#6b7686', label: format || '—' };
}

function AdCard({ c }: { c: StoredCreative }) {
  const [imgOk, setImgOk] = useState(true);
  const badge = fmtBadge(c.format);
  const text = c.headline || c.description || '';
  const period = c.firstShown || c.lastShown ? `${c.firstShown || '?'} → ${c.lastShown || '?'}` : '';
  const showImg = !!c.imageUrl && imgOk;
  const card = (
    <div style={{ width: 190, border: '1px solid #e6eaf0', borderRadius: 12, overflow: 'hidden', background: '#fff', display: 'flex', flexDirection: 'column' }}>
      {showImg ? (
        <img src={c.imageUrl as string} alt="" onError={() => setImgOk(false)} style={{ width: '100%', height: 120, objectFit: 'cover', background: '#f4f6f9' }} />
      ) : (
        <div style={{ height: 120, background: '#f4f6f9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 12px' }}>
          <span style={{ fontSize: 12, color: '#5b6776', lineHeight: 1.4, textAlign: 'center', maxHeight: 100, overflow: 'hidden' }}>{text || '(creativo sin vista previa)'}</span>
        </div>
      )}
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ alignSelf: 'flex-start', fontSize: 10, fontWeight: 700, color: badge.fg, background: badge.bg, borderRadius: 6, padding: '2px 7px' }}>{badge.label}</span>
        {text && showImg && <div style={{ fontSize: 11.5, color: '#3d4654', lineHeight: 1.35, maxHeight: 48, overflow: 'hidden' }}>{text}</div>}
        {period && <div style={{ fontSize: 10, color: '#8a93a1' }}>{period}{c.totalDaysShown ? ` · ${c.totalDaysShown}d` : ''}</div>}
        {c.regions?.length > 0 && <div style={{ fontSize: 10, color: '#8a93a1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.regions.slice(0, 4).join(', ')}{c.regions.length > 4 ? '…' : ''}</div>}
      </div>
    </div>
  );
  return c.detailsLink
    ? <a href={c.detailsLink} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>{card}</a>
    : card;
}

function AdGallery({ ads, hotelName }: { ads: StoredGoogleAds; hotelName?: string }) {
  const advertisers = (ads.advertisers || []).filter((a) => a.creatives && a.creatives.length);
  const byGroup = new Map<string, { name: string; total: number; creatives: StoredCreative[] }>();
  for (const a of advertisers) {
    const g = byGroup.get(a.group) || { name: a.group === 'self' ? (hotelName || 'Nuestro hotel') : a.group, total: 0, creatives: [] };
    g.total += a.totalResults || 0;
    g.creatives.push(...a.creatives);
    byGroup.set(a.group, g);
  }
  const groups = [...byGroup.entries()].sort((a, b) => (a[0] === 'self' ? -1 : b[0] === 'self' ? 1 : 0));
  if (!groups.length) return null;
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: INK, marginBottom: 3 }}>Anuncios en Google Ads — datos verificados de Transparencia</div>
      <p style={{ margin: '0 0 14px', fontSize: 12, color: '#7a8699', maxWidth: 760, lineHeight: 1.5 }}>
        Ejemplos reales de lo que pauta cada actor hoy. Clic en un anuncio para verlo en el Centro de Transparencia de Anuncios de Google.
      </p>
      {groups.map(([key, g]) => {
        const creatives = [...g.creatives].sort((x, y) => (y.lastShown || '').localeCompare(x.lastShown || '')).slice(0, 4);
        return (
          <div key={key} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: key === 'self' ? BLUE : INK, marginBottom: 8 }}>
              {g.name}{g.total > 0 && <span style={{ fontWeight: 500, color: '#8a93a1' }}> · {g.total} anuncios activos</span>}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {creatives.map((c, i) => <AdCard key={i} c={c} />)}
            </div>
          </div>
        );
      })}
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
  const updated = data.generatedAt
    ? new Date(data.generatedAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  if (findings.length === 0 && !data.diggingNote && !data.summary) {
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
            {f.weDont && <Block label="Qué NO hacemos" color={AMBER} accent="#fbe9cf">{f.weDont}</Block>}
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

      {data.googleAds && Array.isArray(data.googleAds.advertisers) && data.googleAds.advertisers.length > 0 && (
        <AdGallery ads={data.googleAds} hotelName={data.ourHotel?.name} />
      )}
    </section>
  );
}
