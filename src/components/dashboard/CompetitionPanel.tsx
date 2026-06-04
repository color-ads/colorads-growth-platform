'use client';

import { useEffect, useState, type ReactNode } from 'react';

type Evidence = { label?: string; url?: string };
type Finding = {
  title?: string; competitor?: string; category?: string;
  whatTheyDo?: string; weDont?: string; opportunity?: string;
  evidence?: Evidence[]; confidence?: string;
};
type Data = {
  ourHotel?: { name?: string; url?: string; alreadyDoing?: string[] };
  findings?: Finding[];
  alsoChecked?: string[];
  diggingNote?: string;
  summary?: string;
  generatedAt?: string;
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
  const also = (data.alsoChecked || []).filter(Boolean);
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

      {also.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#7a8699', marginBottom: 6 }}>También revisado (sin acción):</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {also.map((x, i) => <li key={i} style={{ fontSize: 12, color: '#8a93a1', lineHeight: 1.5 }}>{x}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
