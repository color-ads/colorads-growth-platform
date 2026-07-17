'use client';

/**
 * Heiss Hotel — motor de reservas en vivo (Mirai).
 * Se actualiza solo: refetch cada 60s del endpoint /api/heiss/report (GA4 + Google Ads en vivo).
 */

import { useCallback, useEffect, useState } from 'react';
import type { HeissReport } from '@/lib/heiss/report';

const VERDE = '#1E4D3D';
const RAMP = ['#F3EADB', '#EBCB8F', '#DE9A4E', '#CF6A2E', '#AC3B1D'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const REFRESH_MS = 60_000;

const fN = (x: number) => x.toLocaleString('es-CO', { maximumFractionDigits: 1 });
const fCOP = (x: number) => 'COP ' + Math.round(x).toLocaleString('es-CO');

function Mes({ year, month, heatmap, max }: { year: number; month: number; heatmap: HeissReport['heatmap']; max: number }) {
  const first = new Date(Date.UTC(year, month, 1));
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const pad = (first.getUTCDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < pad; i++) cells.push(<div key={`p${i}`} />);
  for (let d = 1; d <= days; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const cell = heatmap[iso];
    const total = cell ? cell.yes + cell.no : 0;
    const color = total ? RAMP[Math.min(RAMP.length - 1, Math.ceil((total / max) * (RAMP.length - 1)))] : undefined;
    cells.push(
      <div
        key={iso}
        title={total ? `${iso}: ${total} búsqueda${total > 1 ? 's' : ''} (${cell!.yes} con disp. · ${cell!.no} sin disp.)` : iso}
        className={`aspect-square flex items-center justify-center text-[10px] ${total ? 'font-semibold' : 'text-gray-400'}`}
        style={{ background: color || '#F4F4F0', color: total && total / max > 0.6 ? '#FAF9F6' : undefined }}
      >
        {d}
      </div>,
    );
  }
  return (
    <div>
      <div className="text-xs font-semibold capitalize mb-1.5" style={{ color: VERDE }}>{MESES[month]} {year}</div>
      <div className="grid grid-cols-7 gap-[3px]">
        {DOW.map((d) => <div key={d} className="text-center text-[9px] text-gray-400">{d}</div>)}
        {cells}
      </div>
    </div>
  );
}

export default function HeissPage() {
  const [report, setReport] = useState<HeissReport | null>(null);
  const [days, setDays] = useState(7);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const load = useCallback(async (d: number) => {
    try {
      const res = await fetch(`/api/heiss/report?days=${d}`, { cache: 'no-store' });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setReport(j.report);
      setError(null);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    setCargando(true);
    load(days);
    const t = setInterval(() => load(days), REFRESH_MS);
    return () => clearInterval(t);
  }, [days, load]);

  const k = report?.kpis;
  const rt = report?.realtime.events || {};
  const rtMotor = (rt['engine_visit'] || 0) + (rt['engine_search'] || 0);
  const heat = report?.heatmap || {};
  const totalBusquedas = Object.values(heat).reduce((a, c) => a + c.yes + c.no, 0);
  const maxDia = Math.max(1, ...Object.values(heat).map((c) => c.yes + c.no));
  const maxNights = Math.max(1, ...(report?.nights.map((x) => x.count) || [1]));
  const roas = report && report.ads.totals.cost > 0 && report.ads.totals.value > 0 ? report.ads.totals.value / report.ads.totals.cost : null;
  const hoy = new Date();

  return (
    <div className="min-h-screen bg-gray-50 text-slate-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 pb-5 mb-8" style={{ borderColor: VERDE }}>
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] font-semibold" style={{ color: VERDE }}>Color Ads · Motor de reservas en vivo</div>
            <h1 className="text-2xl sm:text-3xl font-bold mt-1">Heiss Hotel</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-gray-200 bg-white p-0.5 text-xs">
              {[7, 28, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-3 py-1.5 rounded-md font-medium ${days === d ? 'text-white' : 'text-gray-500 hover:text-gray-800'}`}
                  style={days === d ? { background: VERDE } : {}}
                >
                  {d} días
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              en vivo
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            No pude actualizar los datos: {error}. Reintento automático en 60s.
          </div>
        )}
        {cargando && !report && <div className="py-24 text-center text-gray-400 text-sm">Consultando GA4 y Google Ads…</div>}

        {report && k && (
          <>
            {/* Ahora mismo */}
            <section className="mb-8">
              <div className="rounded-xl border border-gray-100 bg-white px-5 py-4 flex flex-wrap items-center gap-x-8 gap-y-2">
                <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-gray-400">Últimos 30 min</div>
                <div className="text-sm"><b className="text-lg tabular-nums">{rt['page_view'] || 0}</b> <span className="text-gray-500">vistas de página</span></div>
                <div className="text-sm"><b className="text-lg tabular-nums" style={{ color: VERDE }}>{rtMotor}</b> <span className="text-gray-500">actividad en el motor</span></div>
                <div className="text-sm"><b className="text-lg tabular-nums" style={{ color: '#AC3B1D' }}>{rt['purchase'] || 0}</b> <span className="text-gray-500">reservas</span></div>
                <div className="ml-auto text-[11px] text-gray-400">
                  actualizado {new Date(report.fetchedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · se refresca solo cada 60s
                </div>
              </div>
            </section>

            {/* KPIs del rango */}
            <section className="mb-8">
              <h2 className="text-[11px] uppercase tracking-[0.14em] font-semibold mb-3" style={{ color: VERDE }}>Últimos {report.range.days} días</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-gray-200 border border-gray-200 rounded-xl overflow-hidden">
                {[
                  { v: fN(k.engineVisit), l: 'visitas al motor' },
                  { v: fN(k.engineSearch), l: 'búsquedas de fechas', s: k.noAvailability ? `${fN(k.noAvailability)} sin disponibilidad` : undefined },
                  { v: fN(k.purchases), l: 'reservas (GA4)', s: k.revenue ? fCOP(k.revenue) : undefined },
                  { v: fN(report.ads.totals.conversions), l: 'conversiones Ads', s: report.ads.totals.value ? fCOP(report.ads.totals.value) : undefined },
                  { v: fCOP(report.ads.totals.cost), l: 'inversión Ads', s: roas ? `ROAS ${roas.toFixed(1)}` : undefined },
                ].map((kpi, i) => (
                  <div key={i} className="bg-white px-4 py-3.5">
                    <div className="text-[22px] font-bold tabular-nums leading-tight">{kpi.v}</div>
                    <div className="text-xs text-gray-500">{kpi.l}</div>
                    {kpi.s && <div className="text-xs font-medium tabular-nums mt-0.5" style={{ color: VERDE }}>{kpi.s}</div>}
                  </div>
                ))}
              </div>
            </section>

            {/* Embudo */}
            <section className="mb-8">
              <h2 className="text-[11px] uppercase tracking-[0.14em] font-semibold mb-3" style={{ color: VERDE }}>Embudo del motor</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { v: k.sessions, l: 'sesiones web' },
                  { v: k.engineVisit, l: 'entraron al motor', pct: k.sessions ? (k.engineVisit / k.sessions) * 100 : null },
                  { v: k.beginCheckout, l: 'iniciaron checkout', pct: k.engineVisit ? (k.beginCheckout / k.engineVisit) * 100 : null },
                  { v: k.purchases, l: 'reservaron', pct: k.engineVisit ? (k.purchases / k.engineVisit) * 100 : null },
                ].map((p, i) => (
                  <div key={i} className="rounded-lg border border-gray-100 bg-white px-4 py-3">
                    <div className="text-xl font-bold tabular-nums">{fN(p.v)}</div>
                    <div className="text-xs text-gray-500">{p.l}</div>
                    {p.pct != null && p.pct > 0 && <div className="text-[11px] font-semibold" style={{ color: '#CF6A2E' }}>{p.pct.toFixed(1)}%</div>}
                  </div>
                ))}
              </div>
            </section>

            {/* Mapa de calor */}
            <section className="mb-8">
              <h2 className="text-[11px] uppercase tracking-[0.14em] font-semibold mb-3" style={{ color: VERDE }}>Mapa de calor · fechas de check-in buscadas</h2>
              <div className="rounded-xl border border-gray-100 bg-white p-5">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  {Array.from({ length: 6 }, (_, i) => {
                    const m = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + i, 1));
                    return <Mes key={i} year={m.getUTCFullYear()} month={m.getUTCMonth()} heatmap={heat} max={maxDia} />;
                  })}
                </div>
                {totalBusquedas === 0 ? (
                  <div className="mt-5 border-l-2 pl-4 py-1 text-sm text-gray-500" style={{ borderColor: '#CF6A2E' }}>
                    Aún no hay búsquedas registradas en el rango — la medición de búsquedas inició el {report.medicionDesde}. El mapa se puebla solo.
                  </div>
                ) : (
                  <div className="mt-5 flex items-center gap-1.5 text-xs text-gray-500">
                    menos {RAMP.map((c) => <i key={c} className="inline-block w-4 h-4" style={{ background: c }} />)} más
                    <span className="ml-2">· {fN(totalBusquedas)} búsquedas en {report.range.days} días · pico {fN(maxDia)}/fecha</span>
                  </div>
                )}
              </div>
            </section>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Noches buscadas */}
              <section>
                <h2 className="text-[11px] uppercase tracking-[0.14em] font-semibold mb-3" style={{ color: VERDE }}>Noches por búsqueda</h2>
                <div className="rounded-xl border border-gray-100 bg-white p-5 space-y-2">
                  {report.nights.length === 0 && <div className="text-sm text-gray-400">Sin datos aún.</div>}
                  {report.nights.slice(0, 8).map((x) => (
                    <div key={x.label} className="flex items-center gap-3 text-sm">
                      <div className="w-16 text-gray-500 tabular-nums">{x.label} noche{x.label !== '1' ? 's' : ''}</div>
                      <div className="flex-1 h-4 bg-gray-100 rounded-sm overflow-hidden">
                        <div className="h-full" style={{ width: `${(x.count / maxNights) * 100}%`, background: VERDE }} />
                      </div>
                      <div className="w-10 text-right tabular-nums font-medium">{fN(x.count)}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Fuentes */}
              <section>
                <h2 className="text-[11px] uppercase tracking-[0.14em] font-semibold mb-3" style={{ color: VERDE }}>Origen de visitas al motor</h2>
                <div className="rounded-xl border border-gray-100 bg-white p-5">
                  {report.sources.length === 0 && <div className="text-sm text-gray-400">Sin datos aún — la medición del motor inició el {report.medicionDesde}.</div>}
                  <table className="w-full text-sm">
                    <tbody>
                      {report.sources.map((s) => (
                        <tr key={s.label} className="border-b border-gray-50 last:border-0">
                          <td className="py-1.5 text-gray-700">{s.label}</td>
                          <td className="py-1.5 text-right tabular-nums font-medium">{fN(s.count)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            {/* Ads */}
            <section className="mb-10">
              <h2 className="text-[11px] uppercase tracking-[0.14em] font-semibold mb-3" style={{ color: VERDE }}>Campañas Google Ads · últimos {report.range.days} días</h2>
              <div className="rounded-xl border border-gray-100 bg-white overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                      <th className="text-left px-5 py-2.5 font-semibold">Campaña</th>
                      <th className="text-right px-3 py-2.5 font-semibold">Clics</th>
                      <th className="text-right px-3 py-2.5 font-semibold">Inversión</th>
                      <th className="text-right px-3 py-2.5 font-semibold">Conv.</th>
                      <th className="text-right px-3 py-2.5 font-semibold">Valor</th>
                      <th className="text-right px-5 py-2.5 font-semibold">ROAS</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {report.ads.campaigns.map((c) => (
                      <tr key={c.name} className="border-b border-gray-50 last:border-0">
                        <td className="px-5 py-2.5 text-gray-800">{c.name}</td>
                        <td className="px-3 py-2.5 text-right">{fN(c.clicks)}</td>
                        <td className="px-3 py-2.5 text-right">{fCOP(c.cost)}</td>
                        <td className="px-3 py-2.5 text-right">{fN(c.conversions)}</td>
                        <td className="px-3 py-2.5 text-right">{c.value ? fCOP(c.value) : '—'}</td>
                        <td className="px-5 py-2.5 text-right font-semibold">{c.cost && c.value ? (c.value / c.cost).toFixed(1) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <footer className="border-t border-gray-200 pt-4 text-xs text-gray-400 leading-relaxed">
              GA4 (medición Mirai en vivo desde el {report.medicionDesde}) · Google Ads (conversión &quot;Compra&quot;, atribuida a clics en anuncios; GA4 mide el total del motor).
              {report.errors.length > 0 && <span> · Avisos: {report.errors.join(' · ')}</span>}
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
