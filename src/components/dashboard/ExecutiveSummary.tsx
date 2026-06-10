'use client';

import { useEffect, useState } from 'react';
import type { MonthlyReport, Property } from '@/types';

type Highlight = { label?: string; value?: string; delta?: string; tone?: string };
type Action = { action?: string; rationale?: string; impact?: string; effort?: string; when?: string; committed?: boolean };
type Summary = {
  headline?: string;
  tldr?: string;
  northStar?: { metric?: string; value?: string; note?: string };
  highlights?: Highlight[];
  conclusions?: string[];
  actions?: Action[];
  competitivePositioning?: string;
  nextMonthFocus?: string;
  generatedAt?: string;
  period?: string;
};

const INK = '#1d3557';
const BLUE = '#457B9D';

function toneColor(t?: string) {
  const v = (t || '').toLowerCase();
  if (v === 'good') return { fg: '#1b7a44', bg: '#e7f5ec' };
  if (v === 'bad') return { fg: '#b4232f', bg: '#fdeaec' };
  if (v === 'watch') return { fg: '#b07400', bg: '#fdf3e0' };
  return { fg: '#5b6776', bg: '#eef1f5' };
}
function levelColor(v?: string) {
  const s = (v || '').toLowerCase();
  if (s === 'alto') return '#1b7a44';
  if (s === 'medio') return '#b07400';
  return '#8a93a1';
}

function buildContext(report: MonthlyReport, prev: MonthlyReport | null, property: Property, periodLabel: string, competition: any, tracking: Record<number, { will_execute: string; period: string; comment: string }>) {
  const topCountries = (report.geo_breakdown || []).slice(0, 4).map((c: any) => ({ country: c.country, pct: c.pct }));
  const committed = Object.values(tracking || {}).filter((t) => t?.will_execute === 'yes').map((t) => ({ period: t.period, comment: t.comment }));
  const ai = report.ai_insights as any;
  return {
    hotelName: property.name,
    location: property.location,
    periodLabel,
    kpis: {
      attributableRevenue: report.attributable_revenue,
      totalRevenue: report.total_hotel_revenue,
      investment: report.total_investment,
      roas: report.roas,
      adCostPct: report.ad_cost_pct,
      bookings: report.total_bookings,
      bookingVolume: report.booking_volume,
      avgTicket: report.avg_ticket,
      avgStay: report.avg_stay,
      impressions: report.total_impressions,
      clicks: report.total_clicks,
      cpc: report.avg_cpc,
      topCountries,
    },
    prevKpis: prev ? { roas: prev.roas, attributableRevenue: prev.attributable_revenue } : null,
    insights: ai ? {
      executive_summary: ai.executive_summary,
      next_month_recommendation: ai.next_month_recommendation,
      strategic: ai.strategic, attention: ai.attention, positive: ai.positive,
    } : null,
    competition: competition ? {
      findings: (competition.findings || []).map((f: any) => ({ title: f.title, competitor: f.competitor, category: f.category, opportunity: f.opportunity })),
      hotels: (competition.hotelSnapshot || []).map((h: any) => ({ label: h.label, name: h.name, ratePerNight: h.ratePerNight, rating: h.rating, reviews: h.reviews, hotelClass: h.hotelClass })),
    } : null,
    committed,
  };
}

export function ExecutiveSummary({
  report, prevReport, property, periodLabel, tracking, year, month, canGenerate,
}: {
  report: MonthlyReport; prevReport: MonthlyReport | null; property: Property;
  periodLabel: string; tracking: Record<number, { will_execute: string; period: string; comment: string }>;
  year: number; month: number; canGenerate: boolean;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const accent = property.primary_color || '#E63946';

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/research/executive-summary?slug=${property.slug}&y=${year}&m=${month}`, { cache: 'no-store' });
        const j = await r.json();
        if (alive) setSummary(j?.ok ? j.summary : null);
      } catch { if (alive) setSummary(null); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [property.slug, year, month]);

  async function generate() {
    setGenerating(true); setErr(null);
    try {
      const cr = await fetch(`/api/competition/data?slug=${property.slug}`, { cache: 'no-store' });
      const cj = await cr.json();
      const competition = cj?.ok ? cj.data : null;
      const context = buildContext(report, prevReport, property, periodLabel, competition, tracking);
      const r = await fetch('/api/research/executive-summary', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: property.slug, year, month, context }),
      });
      const j = await r.json();
      if (j?.ok && j.summary) setSummary(j.summary);
      else setErr(j?.error || 'No se pudo generar');
    } catch (e: any) { setErr(String(e?.message || e)); }
    finally { setGenerating(false); }
  }

  if (loading) {
    return <section style={{ margin: '28px 0' }}><div style={{ height: 160, background: '#f6f8fa', borderRadius: 12 }} /></section>;
  }

  if (!summary) {
    return (
      <section style={{ margin: '28px 0' }}>
        <div style={{ border: '1px dashed #d8dee7', borderRadius: 14, padding: '28px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: INK, marginBottom: 6 }}>Resumen ejecutivo del mes</div>
          <p style={{ fontSize: 13, color: '#7a8699', maxWidth: 460, margin: '0 auto 16px', lineHeight: 1.5 }}>
            Genera un resumen ejecutivo descargable —conclusiones puntuales y plan de acción— listo para presentar a comité.
          </p>
          {canGenerate ? (
            <button onClick={generate} disabled={generating}
              style={{ background: accent, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: generating ? 'wait' : 'pointer' }}>
              {generating ? 'Generando…' : 'Generar resumen ejecutivo'}
            </button>
          ) : (
            <div style={{ fontSize: 12.5, color: '#8a93a1' }}>Aún no hay resumen para este mes.</div>
          )}
          {err && <div style={{ marginTop: 10, fontSize: 12, color: '#b4232f' }}>{err}</div>}
        </div>
      </section>
    );
  }

  const gen = summary.generatedAt ? new Date(summary.generatedAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

  return (
    <section style={{ margin: '20px 0' }}>
      {/* CSS de impresion: aisla el reporte */}
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #exec-report, #exec-report * { visibility: visible !important; }
        #exec-report { position: absolute; left: 0; top: 0; width: 100%; margin: 0; box-shadow: none !important; border: none !important; }
        .no-print { display: none !important; }
        @page { margin: 14mm; }
      }`}</style>

      {/* Barra de acciones (no se imprime) */}
      <div className="no-print" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginBottom: 14 }}>
        {canGenerate && (
          <button onClick={generate} disabled={generating}
            style={{ background: '#fff', color: INK, border: '1px solid #d8dee7', borderRadius: 8, padding: '8px 16px', fontSize: 12.5, fontWeight: 600, cursor: generating ? 'wait' : 'pointer' }}>
            {generating ? 'Actualizando…' : '↻ Actualizar'}
          </button>
        )}
        <button onClick={() => window.print()}
          style={{ background: accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
          ⬇ Descargar PDF
        </button>
      </div>
      {err && <div className="no-print" style={{ marginBottom: 10, fontSize: 12, color: '#b4232f', textAlign: 'right' }}>{err}</div>}

      {/* REPORTE */}
      <div id="exec-report" style={{ background: '#fff', border: '1px solid #e6eaf0', borderRadius: 16, overflow: 'hidden' }}>
        {/* Header band */}
        <div style={{ background: INK, color: '#fff', padding: '24px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', opacity: 0.7 }}>Resumen Ejecutivo · Venta Directa</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{property.name}</div>
              <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>{periodLabel} · {property.location}</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 10, opacity: 0.7 }}>
              powered by <span style={{ fontWeight: 700 }}>colorADS</span>
              {gen && <div style={{ marginTop: 4 }}>Generado {gen}</div>}
            </div>
          </div>
          {summary.headline && (
            <div style={{ fontSize: 17, fontWeight: 600, marginTop: 16, lineHeight: 1.4, borderLeft: `3px solid ${accent}`, paddingLeft: 12 }}>{summary.headline}</div>
          )}
        </div>

        <div style={{ padding: '24px 32px' }}>
          {/* TL;DR + North Star */}
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 22 }}>
            {summary.tldr && <p style={{ flex: 2, minWidth: 280, margin: 0, fontSize: 14, color: '#3d4654', lineHeight: 1.6 }}>{summary.tldr}</p>}
            {summary.northStar?.value && (
              <div style={{ flex: 1, minWidth: 180, background: '#f6f9fb', border: `1px solid #e4eef4`, borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.4, color: BLUE, fontWeight: 700 }}>{summary.northStar.metric || 'Métrica clave'}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: INK, margin: '2px 0' }}>{summary.northStar.value}</div>
                {summary.northStar.note && <div style={{ fontSize: 11.5, color: '#5b6776', lineHeight: 1.4 }}>{summary.northStar.note}</div>}
              </div>
            )}
          </div>

          {/* Highlights */}
          {(summary.highlights?.length || 0) > 0 && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
              {summary.highlights!.map((h, i) => {
                const tc = toneColor(h.tone);
                return (
                  <div key={i} style={{ flex: '1 1 150px', border: '1px solid #e6eaf0', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 10.5, color: '#8a93a1', textTransform: 'uppercase', letterSpacing: 0.3 }}>{h.label}</div>
                    <div style={{ fontSize: 19, fontWeight: 800, color: INK, margin: '2px 0' }}>{h.value}</div>
                    {h.delta && <span style={{ fontSize: 11, fontWeight: 700, color: tc.fg, background: tc.bg, borderRadius: 999, padding: '1px 8px' }}>{h.delta}</span>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Conclusiones */}
          {(summary.conclusions?.length || 0) > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: INK, marginBottom: 10 }}>Conclusiones</div>
              {summary.conclusions!.map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                  <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 999, background: INK, color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                  <div style={{ fontSize: 13.5, color: '#3d4654', lineHeight: 1.5 }}>{c}</div>
                </div>
              ))}
            </div>
          )}

          {/* Plan de acción */}
          {(summary.actions?.length || 0) > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: INK, marginBottom: 10 }}>Plan de acción</div>
              <div style={{ border: '1px solid #e6eaf0', borderRadius: 10, overflow: 'hidden' }}>
                {summary.actions!.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 14px', borderTop: i === 0 ? 'none' : '1px solid #eef1f5', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>
                        {a.action}
                        {a.committed && <span style={{ marginLeft: 8, fontSize: 9.5, fontWeight: 700, color: '#1b7a44', background: '#e7f5ec', borderRadius: 999, padding: '1px 7px', verticalAlign: 'middle' }}>COMPROMETIDA</span>}
                      </div>
                      {a.rationale && <div style={{ fontSize: 12, color: '#5b6776', lineHeight: 1.45, marginTop: 2 }}>{a.rationale}</div>}
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right', fontSize: 10.5, lineHeight: 1.7 }}>
                      <div><span style={{ color: '#8a93a1' }}>Impacto </span><strong style={{ color: levelColor(a.impact) }}>{a.impact || '—'}</strong></div>
                      <div><span style={{ color: '#8a93a1' }}>Esfuerzo </span><strong style={{ color: levelColor(a.effort) }}>{a.effort || '—'}</strong></div>
                      {a.when && <div style={{ color: BLUE, fontWeight: 600 }}>{a.when}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Posicionamiento competitivo + foco proximo mes */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {summary.competitivePositioning && (
              <div style={{ flex: 1, minWidth: 260, background: '#f6f9fb', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: BLUE, marginBottom: 6 }}>Posicionamiento competitivo</div>
                <div style={{ fontSize: 13, color: '#3d4654', lineHeight: 1.55 }}>{summary.competitivePositioning}</div>
              </div>
            )}
            {summary.nextMonthFocus && (
              <div style={{ flex: 1, minWidth: 260, background: '#fff8f0', border: '1px solid #fbe9cf', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: '#b07400', marginBottom: 6 }}>Foco del próximo mes</div>
                <div style={{ fontSize: 13, color: '#5b5240', lineHeight: 1.55 }}>{summary.nextMonthFocus}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
