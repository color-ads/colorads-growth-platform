'use client';

import { useEffect, useState } from 'react';

type Action = { title?: string; body?: string; competitor?: string; ref?: string };
type Competitor = {
  name?: string; url?: string; edge?: string; detail?: string;
  image?: string | null; favicon?: string | null; domain?: string;
};
type Data = {
  competitors?: Competitor[]; actions?: Action[]; references?: string[];
  generatedAt?: string; summary?: string;
};

const BLUE = '#457B9D';
const INK = '#1d3557';

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
        <div style={{ height: 18, width: 300, background: '#eef1f5', borderRadius: 6 }} />
        <div style={{ marginTop: 12, height: 110, background: '#f6f8fa', borderRadius: 12 }} />
      </section>
    );
  }
  if (!data) return null;

  const actions = (data.actions || []).filter((a) => a && (a.title || a.body));
  const competitors = (data.competitors || []).filter((c) => c && c.name);
  const refs = (data.references || []).filter(Boolean);
  if (!actions.length && !competitors.length && !data.summary) return null;

  const updated = data.generatedAt
    ? new Date(data.generatedAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };

  return (
    <section style={{ margin: '28px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span style={{ width: 4, height: 26, background: BLUE, borderRadius: 4, display: 'inline-block' }} />
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: INK }}>Acciones destacadas — Competencia</h2>
        {updated && (
          <span style={{ fontSize: 12, color: '#7a8699', marginLeft: 'auto' }}>
            Investigación · {updated}
          </span>
        )}
      </div>
      <p style={{ margin: '0 0 18px', fontSize: 13, color: '#5b6776', maxWidth: 740, lineHeight: 1.5 }}>
        Qué están haciendo los competidores directos en El Poblado y cómo capitalizarlo con venta directa.
      </p>

      {actions.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 24 }}>
          {actions.map((a, i) => (
            <div key={i} style={{ border: '1px solid #e6eaf0', borderLeft: `3px solid ${BLUE}`, borderRadius: 12, padding: '16px 18px', background: '#fff' }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: INK, marginBottom: 6 }}>{a.title}</div>
              <div style={{ fontSize: 13, color: '#4a5564', lineHeight: 1.55 }}>{a.body}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                {a.competitor && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: BLUE, background: '#eef4f8', border: '1px solid rgba(69,123,157,0.25)', borderRadius: 999, padding: '3px 10px' }}>
                    ↳ inspirado en {a.competitor}
                  </span>
                )}
                {a.ref && (
                  <a href={a.ref} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#7a8699', textDecoration: 'none' }}>
                    ver fuente ↗
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {competitors.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: '#7a8699', margin: '4px 0 10px' }}>
            Competidores analizados
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12, marginBottom: 18 }}>
            {competitors.map((c, i) => {
              const img = c.image || c.favicon || null;
              return (
                <div key={i} style={{ display: 'flex', gap: 12, border: '1px solid #e6eaf0', borderRadius: 12, padding: 12, background: '#fff' }}>
                  <div style={{ width: 54, height: 54, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: '#f1f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {img ? (
                      <img src={img} alt={c.name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <span style={{ fontWeight: 700, color: BLUE }}>{(c.name || '?').slice(0, 1)}</span>
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: INK }}>{c.name}</div>
                    {c.edge && <div style={{ fontSize: 12, color: '#5b6776', lineHeight: 1.4, marginTop: 2 }}>{c.edge}</div>}
                    {c.url && (
                      <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: BLUE, textDecoration: 'none', display: 'inline-block', marginTop: 5 }}>
                        {c.domain || hostOf(c.url)} ↗
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {refs.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#7a8699', fontWeight: 600 }}>Referencias:</span>
          {refs.map((u, i) => {
            const host = hostOf(u);
            return (
              <a key={i} href={u} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#5b6776', textDecoration: 'none', background: '#f4f6f9', borderRadius: 999, padding: '3px 9px' }}>
                <img src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`} alt="" style={{ width: 13, height: 13 }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                {host}
              </a>
            );
          })}
        </div>
      )}
    </section>
  );
}
