'use client';

import { useEffect, useState } from 'react';
import type { Property } from '@/types';

// ── tipos ──────────────────────────────────────────────────────────────────────
type Row = { label: string; impressions: number; clicks: number; conversions: number; cost?: number };
type SearchTerm = { term: string; impressions: number; clicks: number; conversions: number };
type Campaign = { name: string; channel: string; clicks: number; conversions: number; cost: number };
type Totals = { impressions: number; clicks: number; ctr: number; avgCpc: number; cost: number; conversions: number };
type Audience = { totals?: Totals; campaigns?: Campaign[]; devices: Row[]; ageRanges: Row[]; genders: Row[]; geo: Row[]; searchTerms: SearchTerm[] };
type GA4Count = { label: string; value: number };
type GA4Channel = { label: string; engineVisits: number };
type GA4 = {
  funnel?: { sessions: number; users: number; newUsers: number };
  channels?: GA4Channel[];
  bookingsByCountry?: GA4Count[]; bookingsByDevice?: GA4Count[]; bookingsByCity?: GA4Count[];
  bookingsByDayOfWeek?: GA4Count[]; bookingsTrend?: { date: string; value: number }[];
  newVsReturning?: { newBookings: number; returningBookings: number; newSessions: number; returningSessions: number };
  engineLandingPages?: GA4Count[];
  totalEngineVisits?: number; totalBookings?: number; totalPurchases?: number;
};
type Insight = { title?: string; finding?: string; action?: string; impact?: string };
type Analysis = {
  headline?: string; tldr?: string; whoBuys?: string; funnelInsight?: string; loyaltyInsight?: string;
  timingInsight?: string; channelMix?: string; landingInsight?: string; adsInsight?: string;
  opportunityInsight?: string; insights?: Insight[]; trackingNote?: string;
};
type Payload = { audience?: Audience; ga4?: GA4 | null; analysis?: Analysis | null; generatedAt?: string };

// ── paleta ──────────────────────────────────────────────────────────────────────
const INK = '#1d3557', BLUE = '#457B9D', GREEN = '#1b7a44', RED = '#E63946', AMBER = '#b07400';
const GREY = '#c9d4de';

const fmt = (v: number) => Math.round(v).toLocaleString('es-CO');
const pct = (v: number, t: number) => (t > 0 ? Math.round((v / t) * 100) : 0);
const cop = (v: number) => `$${fmt(v)}`;
const impactColor = (i?: string) => { const s = (i || '').toLowerCase(); return s === 'alto' ? GREEN : s === 'medio' ? AMBER : '#8a93a1'; };

const FLAG: Record<string, string> = {
  'United States': '🇺🇸', 'Colombia': '🇨🇴', 'Dominican Republic': '🇩🇴', 'Puerto Rico': '🇵🇷',
  'Mexico': '🇲🇽', 'Guatemala': '🇬🇹', 'Israel': '🇮🇱', 'Italy': '🇮🇹', 'Jamaica': '🇯🇲', 'Spain': '🇪🇸',
  'Canada': '🇨🇦', 'Brazil': '🇧🇷', 'Argentina': '🇦🇷', 'Chile': '🇨🇱', 'Peru': '🇵🇪', 'Venezuela': '🇻🇪',
};
const DOW_ES: Record<string, string> = { Monday: 'Lun', Tuesday: 'Mar', Wednesday: 'Mié', Thursday: 'Jue', Friday: 'Vie', Saturday: 'Sáb', Sunday: 'Dom' };
const DOW_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ── sub-componentes ──────────────────────────────────────────────────────────────
function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, color: INK, marginBottom: sub ? 2 : 12 }}>{title}</div>
      {sub && <div style={{ fontSize: 11.5, color: '#8a93a1', marginBottom: 12, maxWidth: 720, lineHeight: 1.4 }}>{sub}</div>}
      {children}
    </div>
  );
}
function Insight({ text }: { text?: string }) {
  if (!text) return null;
  return <div style={{ fontSize: 12.5, color: '#3d4654', lineHeight: 1.55, marginTop: 12, background: '#f6f9fb', borderLeft: `3px solid ${BLUE}`, borderRadius: 6, padding: '9px 13px' }}>{text}</div>;
}
function Distro({ rows, total, color = BLUE, suffix }: { rows: { label: string; value: number; flag?: string }[]; total: number; color?: string; suffix?: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
          <span style={{ flexShrink: 0, width: 130, fontSize: 12, color: '#3d4654', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.flag ? `${r.flag} ` : ''}{r.label}</span>
          <div style={{ flex: 1, height: 15, background: '#eef2f6', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ width: `${Math.max((r.value / max) * 100, 3)}%`, height: '100%', background: color, borderRadius: 8 }} />
          </div>
          <span style={{ flexShrink: 0, width: 92, fontSize: 12, textAlign: 'right', fontWeight: 700, color: INK }}>{pct(r.value, total)}% <span style={{ color: '#8a93a1', fontWeight: 400 }}>· {fmt(r.value)}{suffix || ''}</span></span>
        </div>
      ))}
    </div>
  );
}
function Donut({ segments, centerLabel, centerSub, size = 130 }: { segments: { value: number; color: string; label: string }[]; centerLabel: string; centerSub?: string; size?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = size / 2 - 12, c = 2 * Math.PI * r, cx = size / 2;
  let off = 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        <g transform={`rotate(-90 ${cx} ${cx})`}>
          {segments.map((s, i) => {
            const frac = s.value / total, len = frac * c, el = (<circle key={i} cx={cx} cy={cx} r={r} fill="none" stroke={s.color} strokeWidth={14} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-off} />);
            off += len; return el;
          })}
        </g>
        <text x={cx} y={cx - 2} textAnchor="middle" fontSize={22} fontWeight={800} fill={INK}>{centerLabel}</text>
        {centerSub && <text x={cx} y={cx + 16} textAnchor="middle" fontSize={10} fill="#8a93a1">{centerSub}</text>}
      </svg>
      <div>
        {segments.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, fontSize: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
            <span style={{ color: '#3d4654' }}>{s.label}</span>
            <strong style={{ color: INK }}>{pct(s.value, total)}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
function DowBars({ rows }: { rows: GA4Count[] }) {
  const map = new Map(rows.map((r) => [r.label, r.value]));
  const data = DOW_ORDER.map((d) => ({ day: DOW_ES[d], value: map.get(d) || 0 }));
  const max = Math.max(...data.map((d) => d.value), 1);
  const peak = Math.max(...data.map((d) => d.value));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 130, paddingTop: 6 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: d.value === peak ? RED : INK }}>{d.value}</span>
          <div style={{ width: '100%', height: `${(d.value / max) * 90}px`, minHeight: 3, background: d.value === peak ? RED : BLUE, borderRadius: '5px 5px 0 0' }} />
          <span style={{ fontSize: 10.5, color: '#8a93a1' }}>{d.day}</span>
        </div>
      ))}
    </div>
  );
}
function TrendArea({ points }: { points: { date: string; value: number }[] }) {
  if (points.length < 2) return null;
  const W = 560, H = 70, pad = 6;
  const max = Math.max(...points.map((p) => p.value), 1);
  const xs = (i: number) => pad + (i / (points.length - 1)) * (W - 2 * pad);
  const ys = (v: number) => H - pad - (v / max) * (H - 2 * pad);
  const line = points.map((p, i) => `${xs(i)},${ys(p.value)}`).join(' ');
  const area = `${pad},${H - pad} ${line} ${W - pad},${H - pad}`;
  const peakIdx = points.reduce((mi, p, i, a) => (p.value > a[mi].value ? i : mi), 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }}>
      <polygon points={area} fill="rgba(69,123,157,0.12)" />
      <polyline points={line} fill="none" stroke={BLUE} strokeWidth={2} />
      <circle cx={xs(peakIdx)} cy={ys(points[peakIdx].value)} r={4} fill={RED} />
      <text x={Math.min(xs(peakIdx) + 6, W - 60)} y={ys(points[peakIdx].value) - 6} fontSize={10} fontWeight={700} fill={RED}>{points[peakIdx].value} · {points[peakIdx].date.slice(8)}</text>
    </svg>
  );
}
function KpiCard({ label, value, sub, hero }: { label: string; value: string; sub?: string; hero?: boolean }) {
  return (
    <div style={{ flex: '1 1 150px', background: hero ? GREEN : '#fff', color: hero ? '#fff' : INK, border: hero ? 'none' : '1px solid #e6eaf0', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, opacity: hero ? 0.85 : 0.55, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: hero ? 34 : 24, fontWeight: 800, lineHeight: 1.1, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, opacity: hero ? 0.8 : 0.5, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── panel ────────────────────────────────────────────────────────────────────────
export function AudiencePanel({ property, year, month, periodLabel, canGenerate }: {
  property: Property; year: number; month: number; periodLabel: string; canGenerate: boolean;
}) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const accent = property.primary_color || RED;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/research/audience?slug=${property.slug}&y=${year}&m=${month}`, { cache: 'no-store' });
        const j = await r.json();
        if (alive) { setPayload(j?.data || null); setEnabled(j?.enabled !== false); }
      } catch { if (alive) setPayload(null); } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [property.slug, year, month]);

  async function generate() {
    setGenerating(true); setErr(null);
    try {
      const r = await fetch('/api/research/audience', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug: property.slug, year, month }) });
      const j = await r.json();
      if (j?.ok && j.data) setPayload(j.data); else setErr(j?.error || 'No se pudo generar');
    } catch (e: any) { setErr(String(e?.message || e)); } finally { setGenerating(false); }
  }

  if (loading) return <section style={{ margin: '28px 0' }}><div style={{ height: 200, background: '#f6f8fa', borderRadius: 12 }} /></section>;

  const Header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
          <p style={{ fontSize: 13, color: '#7a8699', maxWidth: 480, margin: '0 auto 16px', lineHeight: 1.5 }}>Reporte completo: embudo, quién reserva (país/dispositivo/lealtad), cuándo decide, intención por canal y eficiencia de la pauta.</p>
          {!enabled ? <div style={{ fontSize: 12.5, color: '#8a93a1' }}>Google Ads / GA4 aún no configurados.</div>
            : canGenerate ? <button onClick={generate} disabled={generating} style={{ background: accent, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{generating ? 'Analizando…' : 'Generar análisis de audiencia'}</button>
            : <div style={{ fontSize: 12.5, color: '#8a93a1' }}>Sin análisis para este mes.</div>}
          {err && <div style={{ marginTop: 10, fontSize: 12, color: RED }}>{err}</div>}
        </div>
      </section>
    );
  }

  const a = payload.audience || ({} as Audience);
  const g = payload.ga4 || ({} as GA4);
  const an = payload.analysis || ({} as Analysis);
  const bookings = g.totalBookings || 0;
  const sessions = g.funnel?.sessions || 0;
  const users = g.funnel?.users || 0;
  const engine = g.totalEngineVisits || 0;
  const totals = a.totals;
  const nvr = g.newVsReturning;
  // métricas derivadas
  const cpa = totals && bookings ? totals.cost / bookings : 0;
  const sessToBook = sessions ? (bookings / sessions) * 100 : 0;
  const intentIdx = sessions ? engine / sessions : 0;
  const newCvr = nvr && nvr.newSessions ? (nvr.newBookings / nvr.newSessions) * 100 : 0;
  const retCvr = nvr && nvr.returningSessions ? (nvr.returningBookings / nvr.returningSessions) * 100 : 0;
  const loyalty = newCvr > 0 ? retCvr / newCvr : 0;
  const adClicks = (a.geo || []).reduce((s, r) => s + r.clicks, 0);

  const funnelSteps = [
    { label: 'Usuarios', value: users, color: BLUE },
    { label: 'Sesiones', value: sessions, color: '#5b8fab' },
    { label: 'Reservas', value: bookings, color: GREEN },
  ].filter((s) => s.value > 0);
  const funnelMax = Math.max(...funnelSteps.map((s) => s.value), 1);

  return (
    <section style={{ margin: '28px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        {Header}
        {canGenerate && <button onClick={generate} disabled={generating} style={{ background: '#fff', color: INK, border: '1px solid #d8dee7', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{generating ? 'Actualizando…' : '↻ Actualizar'}</button>}
      </div>
      {err && <div style={{ marginBottom: 10, fontSize: 12, color: RED }}>{err}</div>}

      {/* HERO */}
      <div style={{ background: INK, color: '#fff', borderRadius: 16, padding: '20px 24px', marginBottom: 22 }}>
        {an.headline && <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.4, borderLeft: `3px solid ${accent}`, paddingLeft: 12, marginBottom: an.tldr ? 8 : 14 }}>{an.headline}</div>}
        {an.tldr && <div style={{ fontSize: 13, opacity: 0.88, lineHeight: 1.5, marginBottom: 14, maxWidth: 820 }}>{an.tldr}</div>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <KpiCard hero label="Reservas directas" value={String(bookings)} sub="venta real medible" />
          <KpiCard label="Intención (motor)" value={fmt(engine)} sub={`${intentIdx.toFixed(1)}x por sesión`} />
          <KpiCard label="Sesiones" value={fmt(sessions)} sub={`${fmt(users)} personas`} />
          {cpa > 0 && <KpiCard label="Inversión / reserva" value={cop(cpa)} sub="CPA real" />}
          <KpiCard label="Conversión a reserva" value={`${sessToBook.toFixed(2)}%`} sub="sesión → reserva" />
        </div>
      </div>

      {/* 1. EMBUDO */}
      {funnelSteps.length >= 2 && (
        <Section title="1 · Embudo de venta directa" sub="El reto no es atraer tráfico (la intención es alta) sino cerrar la reserva en el motor.">
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 2, minWidth: 320 }}>
              {funnelSteps.map((s, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 3 }}>
                    <span style={{ color: INK, fontWeight: 600 }}>{s.label}</span>
                    <span style={{ color: '#8a93a1' }}>{fmt(s.value)}{i > 0 && funnelSteps[i - 1].value ? ` · ${((s.value / funnelSteps[i - 1].value) * 100).toFixed(i === funnelSteps.length - 1 ? 2 : 1)}%` : ''}</span>
                  </div>
                  <div style={{ height: 22, background: '#eef2f6', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max((s.value / funnelMax) * 100, 4)}%`, height: '100%', background: s.color, borderRadius: 6 }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ flex: 1, minWidth: 180, background: '#f6f9fb', border: '1px solid #e4eef4', borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 10.5, color: BLUE, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700 }}>Índice de intención</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: INK }}>{intentIdx.toFixed(1)}x</div>
              <div style={{ fontSize: 11, color: '#8a93a1', lineHeight: 1.4 }}>cada visita abre el motor {intentIdx.toFixed(1)} veces · {fmt(engine)} aperturas</div>
            </div>
          </div>
          <Insight text={an.funnelInsight} />
        </Section>
      )}

      {/* 2. QUIÉN COMPRA */}
      {(g.bookingsByCountry?.length || 0) > 0 && (
        <Section title={`2 · Quién compra — perfil de las ${bookings} reservas`} sub="Datos reales del motor (país, dispositivo, lealtad de quien completa la reserva).">
          <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: 300 }}>
              <div style={{ fontSize: 10.5, color: '#8a93a1', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>Por país</div>
              <Distro rows={g.bookingsByCountry!.slice(0, 6).map((r) => ({ label: r.label, value: r.value, flag: FLAG[r.label] }))} total={bookings} color={GREEN} suffix=" res" />
            </div>
            {(g.bookingsByDevice?.length || 0) > 0 && (
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 10.5, color: '#8a93a1', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>Dispositivo</div>
                <Donut segments={g.bookingsByDevice!.map((d, i) => ({ label: d.label, value: d.value, color: [GREEN, BLUE, GREY][i] || GREY }))} centerLabel={`${pct(g.bookingsByDevice![0]?.value || 0, bookings)}%`} centerSub={g.bookingsByDevice![0]?.label} size={120} />
              </div>
            )}
          </div>
          {/* lealtad */}
          {nvr && (nvr.newBookings + nvr.returningBookings) > 0 && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginTop: 16, background: '#f3faf5', border: '1px solid #d6ebdd', borderRadius: 12, padding: '14px 18px' }}>
              <Donut segments={[{ label: 'Nuevos', value: nvr.newBookings, color: BLUE }, { label: 'Recurrentes', value: nvr.returningBookings, color: GREEN }]} centerLabel={`${pct(nvr.newBookings, nvr.newBookings + nvr.returningBookings)}%`} centerSub="nuevos" size={120} />
              {loyalty > 1 && (
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 40, fontWeight: 800, color: GREEN, lineHeight: 1 }}>~{loyalty.toFixed(1)}x</div>
                  <div style={{ fontSize: 12.5, color: '#3d4654', lineHeight: 1.5, marginTop: 4 }}>El huésped recurrente convierte <strong>{loyalty.toFixed(1)}x más</strong> que uno nuevo ({retCvr.toFixed(2)}% vs {newCvr.toFixed(2)}%). Activarlo (remarketing + CRM) es la inversión más eficiente.</div>
                </div>
              )}
            </div>
          )}
          {(g.bookingsByCity?.length || 0) > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10.5, color: '#8a93a1', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 }}>Ciudades top</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{g.bookingsByCity!.slice(0, 7).map((c, i) => <span key={i} style={{ fontSize: 11.5, color: '#3d4654', background: '#f4f6f9', borderRadius: 999, padding: '3px 10px' }}>{c.label} · <strong>{c.value}</strong></span>)}</div>
            </div>
          )}
          <Insight text={an.whoBuys} />
          {an.loyaltyInsight && <Insight text={an.loyaltyInsight} />}
        </Section>
      )}

      {/* 3. CUÁNDO */}
      {(g.bookingsByDayOfWeek?.length || 0) > 0 && (
        <Section title="3 · Cuándo se decide la reserva" sub="El día en que se concreta la reserva — para sincronizar pauta, ofertas y email.">
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 280 }}><DowBars rows={g.bookingsByDayOfWeek!} /></div>
            {(g.bookingsTrend?.length || 0) > 2 && (
              <div style={{ flex: 1, minWidth: 280 }}>
                <div style={{ fontSize: 10.5, color: '#8a93a1', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>Tendencia diaria</div>
                <TrendArea points={g.bookingsTrend!} />
              </div>
            )}
          </div>
          <Insight text={an.timingInsight} />
        </Section>
      )}

      {/* 4. INTENCIÓN POR CANAL */}
      {(g.channels?.length || 0) > 0 && (
        <Section title="4 · De dónde nace el interés (intención por canal)" sub="GA4 ve canales que Google Ads no atribuye — sobre todo Meta/Instagram, orgánico y directo. La atribución de reservas por canal no es confiable (cross-domain).">
          <div style={{ display: 'flex', height: 26, borderRadius: 7, overflow: 'hidden', marginBottom: 10 }}>
            {g.channels!.filter((c) => c.engineVisits > 0).slice(0, 6).map((c, i) => {
              const l = c.label.toLowerCase();
              const col = l.includes('google / cpc') ? BLUE : (l.startsWith('ig') || l.includes('facebook')) ? '#6b4ea0' : [GREEN, '#7aa3bd', AMBER, GREY][i] || GREY;
              const w = pct(c.engineVisits, engine);
              return <div key={i} title={`${c.label} ${w}%`} style={{ width: `${w}%`, background: col }} />;
            })}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {g.channels!.filter((c) => c.engineVisits > 0).slice(0, 6).map((c, i) => {
              const l = c.label.toLowerCase();
              const isMeta = l.startsWith('ig') || l.includes('facebook');
              const isAds = l.includes('google / cpc');
              const col = isAds ? BLUE : isMeta ? '#6b4ea0' : GREEN;
              return <span key={i} style={{ fontSize: 11.5, color: '#3d4654' }}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: col, marginRight: 5 }} />{c.label} <strong>{pct(c.engineVisits, engine)}%</strong>{!isAds && <span style={{ color: '#8a93a1' }}> · no visible en Ads</span>}</span>;
            })}
          </div>
          <Insight text={an.channelMix} />
        </Section>
      )}

      {/* 5. LANDING PAGES */}
      {(g.engineLandingPages?.length || 0) > 0 && (
        <Section title="5 · Puertas de entrada al motor" sub="Qué páginas abren el motor de reservas — dónde una mejora de UX tiene más apalancamiento.">
          <Distro rows={g.engineLandingPages!.slice(0, 6).map((r) => ({ label: r.label, value: r.value }))} total={g.engineLandingPages!.reduce((s, r) => s + r.value, 0)} color={BLUE} />
          <Insight text={an.landingInsight} />
        </Section>
      )}

      {/* 6. PAUTA GOOGLE ADS */}
      {totals && totals.clicks > 0 && (
        <Section title="6 · La pauta que alimenta la demanda (Google Ads)" sub="Eficiencia de la inversión en lenguaje de negocio.">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <KpiCard label="Impresiones" value={fmt(totals.impressions)} />
            <KpiCard label="Clics" value={fmt(totals.clicks)} sub={`CTR ${(totals.ctr * 100).toFixed(1)}%`} />
            <KpiCard label="CTR vs benchmark" value={`${(totals.ctr * 100).toFixed(1)}%`} sub="hotelero ~2-5%" />
            <KpiCard label="CPC" value={cop(totals.avgCpc)} />
            <KpiCard label="Inversión" value={cop(totals.cost)} />
          </div>
          {(a.campaigns?.length || 0) > 0 && (
            <>
              <div style={{ fontSize: 10.5, color: '#8a93a1', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>Clics por campaña</div>
              <Distro rows={a.campaigns!.slice(0, 5).map((c) => ({ label: c.name, value: c.clicks }))} total={a.campaigns!.reduce((s, c) => s + c.clicks, 0)} color={BLUE} />
            </>
          )}
          {/* demografía de la pauta */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 16 }}>
            {(a.ageRanges?.length || 0) > 0 && <div style={{ flex: 1, minWidth: 240 }}><div style={{ fontSize: 10.5, color: '#8a93a1', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>Edad (de clics)</div><Distro rows={a.ageRanges.map((r) => ({ label: r.label, value: r.clicks }))} total={a.ageRanges.reduce((s, r) => s + r.clicks, 0)} /></div>}
            {(a.genders?.length || 0) > 0 && <div style={{ flex: 1, minWidth: 240 }}><div style={{ fontSize: 10.5, color: '#8a93a1', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>Género (de clics)</div><Distro rows={a.genders.map((r) => ({ label: r.label, value: r.clicks }))} total={a.genders.reduce((s, r) => s + r.clicks, 0)} /></div>}
          </div>
          <Insight text={an.adsInsight} />
        </Section>
      )}

      {/* 7. OPORTUNIDAD (alineación demanda↔inversión, cliente-facing positivo) */}
      {(an.opportunityInsight || (g.bookingsByCountry?.length || 0) > 0) && (
        <Section title="7 · Mercados de oportunidad" sub="Dónde están las reservas reales vs dónde llega hoy la pauta — para enfocar el crecimiento.">
          {(g.bookingsByCountry?.length || 0) > 0 && adClicks > 0 && (
            <div style={{ border: '1px solid #e6eaf0', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'flex', padding: '7px 14px', background: '#f6f8fa', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, color: '#8a93a1' }}>
                <span style={{ flex: 1 }}>País</span><span style={{ width: 110, textAlign: 'right' }}>% reservas</span><span style={{ width: 110, textAlign: 'right' }}>% pauta (clics)</span>
              </div>
              {g.bookingsByCountry!.slice(0, 5).map((b, i) => {
                const adRow = (a.geo || []).find((x) => x.label === b.label);
                const adPctV = adRow ? pct(adRow.clicks, adClicks) : 0;
                const resPctV = pct(b.value, bookings);
                const gap = resPctV - adPctV;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '9px 14px', borderTop: '1px solid #eef1f5' }}>
                    <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: INK }}>{FLAG[b.label] ? `${FLAG[b.label]} ` : ''}{b.label}{gap >= 15 && <span style={{ marginLeft: 8, fontSize: 9.5, fontWeight: 700, color: GREEN, background: '#e7f5ec', borderRadius: 999, padding: '1px 7px' }}>OPORTUNIDAD</span>}</span>
                    <span style={{ width: 110, textAlign: 'right', fontSize: 13, fontWeight: 700, color: GREEN }}>{resPctV}%</span>
                    <span style={{ width: 110, textAlign: 'right', fontSize: 12, color: '#8a93a1' }}>{adPctV}%</span>
                  </div>
                );
              })}
            </div>
          )}
          <Insight text={an.opportunityInsight} />
        </Section>
      )}

      {/* 8. CONCLUSIONES / PLAN */}
      {(an.insights?.length || 0) > 0 && (
        <Section title="8 · Conclusiones y plan de acción">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
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
        </Section>
      )}

      {/* 9. METODOLOGÍA */}
      <div style={{ fontSize: 11, color: '#8a93a1', lineHeight: 1.5, background: '#fbfcfd', border: '1px solid #eef1f5', borderRadius: 10, padding: '12px 16px', marginTop: 6 }}>
        <strong style={{ color: '#5b6776' }}>Metodología:</strong> Fuentes Google Ads API + Google Analytics 4. Conversión = evento de confirmación de reserva del motor (GA4) = {bookings}.
        Confiable: embudo, perfil del comprador (país/ciudad/dispositivo/día), intención por canal. No atribuible por canal: reservas (cross-domain). No incluye reservas de OTAs (Booking/Expedia), que están en Cloudbeds.
        {an.trackingNote && <> · {an.trackingNote}</>}
        {payload.generatedAt && <> · generado {new Date(payload.generatedAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}</>}
      </div>
    </section>
  );
}
