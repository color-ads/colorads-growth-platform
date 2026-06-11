'use client';

import { useEffect, useState } from 'react';
import type { Property } from '@/types';

type Row = { label: string; impressions: number; clicks: number; conversions: number; cost?: number };
type SearchTerm = { term: string; impressions: number; clicks: number; conversions: number };
type Audience = { devices: Row[]; ageRanges: Row[]; genders: Row[]; geo: Row[]; searchTerms: SearchTerm[]; range?: { since: string; until: string } };
type Insight = { title?: string; finding?: string; action?: string; impact?: string };
type Analysis = { headline?: string; whoConverts?: string; insights?: Insight[]; searchRead?: string };
type Payload = { audience?: Audience; analysis?: Analysis | null; generatedAt?: string };

const INK = '#1d3557';
const BLUE = '#457B9D';
const GREEN = '#1b7a44';

function cvr(r: Row) { return r.clicks > 0 ? (r.conversions / r.clicks) * 100 : 0; }
function impactColor(i?: string) { const s = (i || '').toLowerCase(); return s === 'alto' ? GREEN : s === 'medio' ? '#b07400' : '#8a93a1'; }

function Bars({ rows, valueKey, max }: { rows: Row[]; valueKey: 'clicks' | 'conversions'; max: number }) {
  return (
    <div>
      {rows.map((r, i) => {
        const v = r[valueKey];
        const conv = r.conversions;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ flexShrink: 0, width: 96, fontSize: 11.5, color: '#3d4654', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
            <div style={{ flex: 1, height: 13, background: '#f0f3f7', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ width: `${Math.max((v / max) * 100, 2)}%`, height: '100%', background: conv > 0 ? BLUE : '#c9d4de', borderRadius: 6 }} />
            </div>
            <span style={{ flexShrink: 0, width: 96, fontSize: 10.5, color: '#8a93a1', textAlign: 'right' }}>
              {v.toLocaleString('es-CO')} clk · <strong style={{ color: conv > 0 ? GREEN : '#8a93a1' }}>{conv} conv</strong>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: INK, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

export function AudiencePanel({ property, year, month, periodLabel, canGenerate }: {
  property: Property; year: number; month: number; periodLabel: string; canGenerate: boolean;
}) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const accent = property.primary_color || '#E63946';

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/research/audience?slug=${property.slug}&y=${year}&m=${month}`, { cache: 'no-store' });
        const j = await r.json();
        if (alive) { setPayload(j?.data || null); setEnabled(j?.enabled !== false); }
      } catch { if (alive) setPayload(null); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [property.slug, year, month]);

  async function generate() {
    setGenerating(true); setErr(null);
    try {
      const r = await fetch('/api/research/audience', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: property.slug, year, month }),
      });
      const j = await r.json();
      if (j?.ok && j.data) setPayload(j.data);
      else setErr(j?.error || 'No se pudo generar');
    } catch (e: any) { setErr(String(e?.message || e)); }
    finally { setGenerating(false); }
  }

  if (loading) return <section style={{ margin: '28px 0' }}><div style={{ height: 160, background: '#f6f8fa', borderRadius: 12 }} /></section>;

  const Header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
      <span style={{ width: 4, height: 26, background: BLUE, borderRadius: 4 }} />
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: INK }}>Audiencia — Google Ads</h2>
      <span style={{ fontSize: 12, color: '#7a8699' }}>{periodLabel}</span>
    </div>
  );

  if (!payload) {
    return (
      <section style={{ margin: '28px 0' }}>
        {Header}
        <div style={{ border: '1px dashed #d8dee7', borderRadius: 14, padding: '28px 24px', textAlign: 'center', marginTop: 12 }}>
          <p style={{ fontSize: 13, color: '#7a8699', maxWidth: 480, margin: '0 auto 16px', lineHeight: 1.5 }}>
            Análisis demográfico real de tus campañas de Google Ads: quién convierte, dónde, en qué dispositivo, y oportunidades accionables.
          </p>
          {!enabled ? (
            <div style={{ fontSize: 12.5, color: '#8a93a1' }}>Google Ads aún no está configurado en este entorno.</div>
          ) : canGenerate ? (
            <button onClick={generate} disabled={generating} style={{ background: accent, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: generating ? 'wait' : 'pointer' }}>
              {generating ? 'Analizando audiencia…' : 'Generar análisis de audiencia'}
            </button>
          ) : <div style={{ fontSize: 12.5, color: '#8a93a1' }}>Sin análisis para este mes.</div>}
          {err && <div style={{ marginTop: 10, fontSize: 12, color: '#b4232f' }}>{err}</div>}
        </div>
      </section>
    );
  }

  const a = payload.audience || ({} as Audience);
  const an = payload.analysis || ({} as Analysis);
  const maxAge = Math.max(...(a.ageRanges || []).map((r) => r.clicks), 1);
  const maxGen = Math.max(...(a.genders || []).map((r) => r.clicks), 1);

  return (
    <section style={{ margin: '28px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {Header}
        {canGenerate && (
          <button onClick={generate} disabled={generating} style={{ background: '#fff', color: INK, border: '1px solid #d8dee7', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: generating ? 'wait' : 'pointer' }}>
            {generating ? 'Actualizando…' : '↻ Actualizar'}
          </button>
        )}
      </div>
      {err && <div style={{ marginBottom: 10, fontSize: 12, color: '#b4232f' }}>{err}</div>}

      {/* Análisis IA */}
      {an.headline && (
        <div style={{ background: INK, color: '#fff', borderRadius: 14, padding: '18px 22px', margin: '8px 0 18px' }}>
          <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.4, borderLeft: `3px solid ${accent}`, paddingLeft: 12 }}>{an.headline}</div>
          {an.whoConverts && <div style={{ fontSize: 13, opacity: 0.9, marginTop: 10, lineHeight: 1.5 }}><strong>Quién convierte mejor:</strong> {an.whoConverts}</div>}
        </div>
      )}
      {(an.insights?.length || 0) > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 24 }}>
          {an.insights!.map((ins, i) => (
            <div key={i} style={{ border: '1px solid #e6eaf0', borderRadius: 12, padding: '14px 16px', background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>{ins.title}</span>
                <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', color: impactColor(ins.impact), background: '#f4f6f9', borderRadius: 999, padding: '2px 8px' }}>{ins.impact}</span>
              </div>
              {ins.finding && <div style={{ fontSize: 12, color: '#5b6776', lineHeight: 1.45, marginBottom: 6 }}>{ins.finding}</div>}
              {ins.action && <div style={{ fontSize: 12.5, color: '#3d4654', lineHeight: 1.45 }}><strong style={{ color: BLUE }}>Acción:</strong> {ins.action}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Geo: convierte vs no convierte */}
      {(a.geo?.length || 0) > 0 && (
        <Section title="Por país — dónde se concentran las conversiones">
          <div style={{ border: '1px solid #e6eaf0', borderRadius: 10, overflow: 'hidden' }}>
            {a.geo.map((g, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px', borderTop: i === 0 ? 'none' : '1px solid #eef1f5', background: g.conversions > 0 ? '#f3faf5' : '#fff' }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: g.conversions > 0 ? 700 : 500, color: g.conversions > 0 ? GREEN : '#3d4654' }}>{g.label}</span>
                <span style={{ fontSize: 11, color: '#8a93a1' }}>{g.clicks.toLocaleString('es-CO')} clics</span>
                <span style={{ flexShrink: 0, width: 90, textAlign: 'right', fontSize: 12, fontWeight: 700, color: g.conversions > 0 ? GREEN : '#b0b7c1' }}>{g.conversions} conv</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Dispositivos */}
      {(a.devices?.length || 0) > 0 && (
        <Section title="Por dispositivo">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {a.devices.map((d, i) => (
              <div key={i} style={{ flex: '1 1 150px', border: '1px solid #e6eaf0', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>{d.label}</div>
                <div style={{ fontSize: 11, color: '#8a93a1', margin: '2px 0' }}>{d.clicks.toLocaleString('es-CO')} clics · {d.conversions} conv</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: cvr(d) >= 1 ? GREEN : '#8a93a1' }}>CVR {cvr(d).toFixed(2)}%</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Demografía */}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {(a.ageRanges?.length || 0) > 0 && <div style={{ flex: 1, minWidth: 280 }}><Section title="Por edad"><Bars rows={a.ageRanges} valueKey="clicks" max={maxAge} /></Section></div>}
        {(a.genders?.length || 0) > 0 && <div style={{ flex: 1, minWidth: 280 }}><Section title="Por género"><Bars rows={a.genders} valueKey="clicks" max={maxGen} /></Section></div>}
      </div>

      {/* Search terms */}
      {(a.searchTerms?.length || 0) > 0 && (
        <Section title="Términos de búsqueda reales">
          {an.searchRead && <div style={{ fontSize: 12.5, color: '#5b6776', lineHeight: 1.5, marginBottom: 10, background: '#f6f9fb', borderRadius: 8, padding: '8px 12px' }}>{an.searchRead}</div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {a.searchTerms.slice(0, 12).map((s, i) => (
              <span key={i} style={{ fontSize: 11.5, color: '#3d4654', background: s.conversions > 0 ? '#e7f5ec' : '#f4f6f9', borderRadius: 999, padding: '3px 10px' }}>
                {s.term} <span style={{ color: '#8a93a1' }}>· {s.clicks}clk{s.conversions > 0 ? ` · ${s.conversions}c` : ''}</span>
              </span>
            ))}
          </div>
        </Section>
      )}

      {payload.generatedAt && (
        <div style={{ fontSize: 10.5, color: '#a0a8b3', marginTop: 8 }}>Datos reales de Google Ads · generado {new Date(payload.generatedAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
      )}
    </section>
  );
}
