'use client';

import { useEffect, useState } from 'react';
import type { Property } from '@/types';

type Row = { label: string; impressions: number; clicks: number; conversions: number; cost?: number };
type SearchTerm = { term: string; impressions: number; clicks: number; conversions: number };
type Audience = { devices: Row[]; ageRanges: Row[]; genders: Row[]; geo: Row[]; searchTerms: SearchTerm[] };
type GA4Channel = { label: string; sessions: number; engineVisits: number };
type GA4Count = { label: string; bookings: number };
type GA4 = {
  channels?: GA4Channel[];
  bookingsByCountry?: GA4Count[]; bookingsByDevice?: GA4Count[]; bookingsByCity?: GA4Count[];
  totalEngineVisits?: number; totalBookings?: number;
};
type Insight = { title?: string; finding?: string; action?: string; impact?: string };
type Analysis = { headline?: string; whoBuys?: string; internalNote?: string; insights?: Insight[]; channelMix?: string; trackingNote?: string };
type Payload = { audience?: Audience; ga4?: GA4 | null; analysis?: Analysis | null; generatedAt?: string };

const INK = '#1d3557';
const BLUE = '#457B9D';
const GREEN = '#1b7a44';

function pct(v: number, total: number) { return total > 0 ? Math.round((v / total) * 100) : 0; }
function impactColor(i?: string) { const s = (i || '').toLowerCase(); return s === 'alto' ? GREEN : s === 'medio' ? '#b07400' : '#8a93a1'; }
const num = (v: number) => v.toLocaleString('es-CO');

// Barras de distribución con porcentaje sobre un total.
function Distro({ rows, total, color = BLUE, unit }: { rows: { label: string; value: number }[]; total: number; color?: string; unit?: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ flexShrink: 0, width: 116, fontSize: 12, color: '#3d4654', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
          <div style={{ flex: 1, height: 14, background: '#f0f3f7', borderRadius: 7, overflow: 'hidden' }}>
            <div style={{ width: `${Math.max((r.value / max) * 100, 3)}%`, height: '100%', background: color, borderRadius: 7 }} />
          </div>
          <span style={{ flexShrink: 0, width: 88, fontSize: 11.5, textAlign: 'right', color: INK, fontWeight: 600 }}>
            <strong style={{ color }}>{pct(r.value, total)}%</strong> <span style={{ color: '#8a93a1', fontWeight: 400 }}>· {num(r.value)}{unit ? ` ${unit}` : ''}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: INK, marginBottom: sub ? 2 : 10 }}>{title}</div>
      {sub && <div style={{ fontSize: 11.5, color: '#8a93a1', marginBottom: 10 }}>{sub}</div>}
      {children}
    </div>
  );
}

function clicksTotal(rows: Row[]) { return rows.reduce((s, r) => s + r.clicks, 0); }

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
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: INK }}>Audiencia — quién reserva</h2>
      <span style={{ fontSize: 12, color: '#7a8699' }}>{periodLabel}</span>
    </div>
  );

  if (!payload) {
    return (
      <section style={{ margin: '28px 0' }}>
        {Header}
        <div style={{ border: '1px dashed #d8dee7', borderRadius: 14, padding: '28px 24px', textAlign: 'center', marginTop: 12 }}>
          <p style={{ fontSize: 13, color: '#7a8699', maxWidth: 480, margin: '0 auto 16px', lineHeight: 1.5 }}>
            Análisis de quién reserva de verdad: las reservas directas del motor + el perfil de audiencia detrás (país, dispositivo, demografía) e intención por canal.
          </p>
          {!enabled ? <div style={{ fontSize: 12.5, color: '#8a93a1' }}>Google Ads aún no está configurado.</div>
            : canGenerate ? (
              <button onClick={generate} disabled={generating} style={{ background: accent, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: generating ? 'wait' : 'pointer' }}>
                {generating ? 'Analizando…' : 'Generar análisis de audiencia'}
              </button>
            ) : <div style={{ fontSize: 12.5, color: '#8a93a1' }}>Sin análisis para este mes.</div>}
          {err && <div style={{ marginTop: 10, fontSize: 12, color: '#b4232f' }}>{err}</div>}
        </div>
      </section>
    );
  }

  const a = payload.audience || ({} as Audience);
  const g = payload.ga4 || ({} as GA4);
  const an = payload.analysis || ({} as Analysis);
  const bookings = g.totalBookings || 0;
  const adClicks = clicksTotal(a.geo || []);

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

      {/* HERO: reservas directas reales + quién compra */}
      <div style={{ background: INK, color: '#fff', borderRadius: 16, padding: '22px 26px', margin: '10px 0 22px', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.65 }}>Reservas directas del motor</div>
          <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1 }}>{bookings}</div>
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>venta real medible · {periodLabel}</div>
        </div>
        <div style={{ flex: 1, minWidth: 260 }}>
          {an.headline && <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.4, borderLeft: `3px solid ${accent}`, paddingLeft: 12 }}>{an.headline}</div>}
          {an.whoBuys && <div style={{ fontSize: 13, opacity: 0.92, marginTop: 10, lineHeight: 1.5 }}>{an.whoBuys}</div>}
        </div>
      </div>

      {/* QUIÉN COMPRA — perfil real de las reservas (GA4, confiable) */}
      {((g.bookingsByCountry?.length || 0) > 0 || (g.bookingsByDevice?.length || 0) > 0) && (
        <Section title={`Quién compra — perfil de las ${bookings} reservas`} sub="Datos reales del motor (país y dispositivo de quien completa la reserva).">
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {(g.bookingsByCountry?.length || 0) > 0 && (
              <div style={{ flex: 2, minWidth: 300 }}>
                <div style={{ fontSize: 10.5, color: '#8a93a1', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>Por país</div>
                <Distro rows={g.bookingsByCountry!.slice(0, 6).map((r) => ({ label: r.label, value: r.bookings }))} total={bookings} color={GREEN} unit="res" />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 220 }}>
              {(g.bookingsByDevice?.length || 0) > 0 && (
                <>
                  <div style={{ fontSize: 10.5, color: '#8a93a1', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>Por dispositivo</div>
                  <Distro rows={g.bookingsByDevice!.map((r) => ({ label: r.label, value: r.bookings }))} total={bookings} color={GREEN} unit="res" />
                </>
              )}
              {(g.bookingsByCity?.length || 0) > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 10.5, color: '#8a93a1', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 }}>Ciudades top</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {g.bookingsByCity!.slice(0, 6).map((c, i) => (
                      <span key={i} style={{ fontSize: 11, color: '#3d4654', background: '#f4f6f9', borderRadius: 999, padding: '2px 9px' }}>{c.label} · <strong>{c.bookings}</strong></span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* (La nota interna "pauta vs comprador" NO se renderiza: queda en el backend para el equipo). */}
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

      {/* PERFIL DE LA PAUTA (Google Ads) — demografía y geo en % */}
      <Section title="Perfil de la pauta — Google Ads" sub="Demografía y geografía de los clics pagos (en % sobre clics). La edad/género solo está acá; GA4 no la tiene.">
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {(a.ageRanges?.length || 0) > 0 && (
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ fontSize: 10.5, color: '#8a93a1', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>Edad</div>
              <Distro rows={a.ageRanges.map((r) => ({ label: r.label, value: r.clicks }))} total={clicksTotal(a.ageRanges)} unit="clk" />
            </div>
          )}
          {(a.genders?.length || 0) > 0 && (
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ fontSize: 10.5, color: '#8a93a1', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>Género</div>
              <Distro rows={a.genders.map((r) => ({ label: r.label, value: r.clicks }))} total={clicksTotal(a.genders)} unit="clk" />
            </div>
          )}
        </div>
        {(a.geo?.length || 0) > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 10.5, color: '#8a93a1', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>Relevancia de la pauta por país (% de clics)</div>
            <Distro rows={a.geo.slice(0, 6).map((r) => ({ label: r.label, value: r.clicks }))} total={adClicks} unit="clk" />
          </div>
        )}
      </Section>

      {/* INTENCIÓN POR CANAL (GA4) — lo que Google Ads no ve */}
      {(g.channels?.length || 0) > 0 && (
        <Section title="Intención por canal — visitas al motor (Analytics)" sub="GA4 ve canales que Google Ads no atribuye, sobre todo Meta/Instagram, orgánico y directo.">
          {an.channelMix && <div style={{ fontSize: 12.5, color: '#3d4654', lineHeight: 1.5, marginBottom: 10, background: '#fff', border: '1px solid #e6eaf0', borderRadius: 8, padding: '8px 12px' }}><strong style={{ color: BLUE }}>Lectura:</strong> {an.channelMix}</div>}
          <div style={{ border: '1px solid #e6eaf0', borderRadius: 10, overflow: 'hidden' }}>
            {g.channels!.filter((c) => c.engineVisits > 0).slice(0, 8).map((c, i) => {
              const l = c.label.toLowerCase();
              const isAds = l.includes('google / cpc');
              const isMeta = l.startsWith('ig') || l.includes('facebook') || l.startsWith('fb');
              const tag = isAds ? { t: 'Google Ads', c: BLUE } : isMeta ? { t: 'Meta · no visible en Ads', c: '#6b4ea0' } : { t: 'Orgánico/Directo · no visible en Ads', c: GREEN };
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderTop: i === 0 ? 'none' : '1px solid #eef1f5' }}>
                  <span style={{ flex: 1, fontSize: 12.5, color: INK, fontWeight: 600, minWidth: 0 }}>{c.label}{' '}<span style={{ fontSize: 9.5, fontWeight: 700, color: tag.c, background: '#f4f6f9', borderRadius: 999, padding: '1px 7px', whiteSpace: 'nowrap' }}>{tag.t}</span></span>
                  <span style={{ flexShrink: 0, fontSize: 12, color: '#8a93a1', width: 56, textAlign: 'right' }}>{pct(c.engineVisits, g.totalEngineVisits || 0)}%</span>
                  <span style={{ flexShrink: 0, fontSize: 13, color: BLUE, fontWeight: 700, width: 96, textAlign: 'right' }}>{num(c.engineVisits)} al motor</span>
                </div>
              );
            })}
          </div>
          {an.trackingNote && <div style={{ fontSize: 11.5, color: '#8a93a1', marginTop: 8, lineHeight: 1.45 }}>💡 {an.trackingNote}</div>}
        </Section>
      )}

      {payload.generatedAt && (
        <div style={{ fontSize: 10.5, color: '#a0a8b3', marginTop: 4 }}>Datos reales de Google Ads + Analytics · generado {new Date(payload.generatedAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
      )}
    </section>
  );
}
