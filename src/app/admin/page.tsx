'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SourceSelector } from '@/components/admin/SourceSelector'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const SLUG = 'h98'

interface Row {
  year: number; month: number
  total_revenue: number; google_investment: number; meta_investment: number
  content_investment: number; fees: number; total_investment: number
  ad_cost_pct: number; roas: number; clicks: number; impressions: number; cpc: number
}

const fmt = (n: number) => new Intl.NumberFormat('es-CO').format(Math.round(n || 0))

export default function AdminPage() {
  const router = useRouter()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [rows, setRows] = useState<Row[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const [form, setForm] = useState({
    google_investment: '', meta_investment: '',
    content_investment: '', fees: '', clicks: '', impressions: '',
  })

  const [competitors, setCompetitors] = useState('')
  const [compMsg, setCompMsg] = useState('')
  const [compSaving, setCompSaving] = useState(false)
  const [researching, setResearching] = useState(false)
  const [researchMsg, setResearchMsg] = useState('')

  // Nota interna de audiencia (Google Ads + GA4) — solo para el equipo
  const [audInternal, setAudInternal] = useState('')
  const [audBookings, setAudBookings] = useState<number | null>(null)
  const [audAt, setAudAt] = useState('')
  const [audMsg, setAudMsg] = useState('')
  const [audGenerating, setAudGenerating] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/billing?slug=${SLUG}`)
      const d = await res.json()
      setRows(d.rows ?? [])
    } catch {}
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch(`/api/admin/competitors?slug=${SLUG}`)
      .then(r => r.json())
      .then(d => setCompetitors((d.competitors ?? []).join('\n')))
      .catch(() => {})
  }, [])

  // Cargar la nota interna de audiencia para el mes seleccionado
  useEffect(() => {
    setAudInternal(''); setAudBookings(null); setAudAt(''); setAudMsg('')
    fetch(`/api/research/audience?slug=${SLUG}&y=${year}&m=${month}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        const data = d?.data
        if (data) {
          setAudInternal(data.analysis?.internalNote || '')
          setAudBookings(typeof data.ga4?.totalBookings === 'number' ? data.ga4.totalBookings : null)
          setAudAt(data.generatedAt || '')
        }
      })
      .catch(() => {})
  }, [year, month])

  // Prefill form when selecting a month that already has data
  useEffect(() => {
    const r = rows.find(x => x.year === year && x.month === month)
    setForm({
      google_investment:  r ? String(r.google_investment) : '',
      meta_investment:    r ? String(r.meta_investment) : '',
      content_investment: r ? String(r.content_investment) : '',
      fees:               r ? String(r.fees) : '',
      clicks:             r ? String(r.clicks) : '',
      impressions:        r ? String(r.impressions) : '',
    })
    setMsg('')
  }, [rows, year, month])

  const n = (v: string) => { const x = parseFloat(String(v).replace(/[,$\s]/g, '')); return isNaN(x) ? 0 : x }
  const totalInv = n(form.google_investment) + n(form.meta_investment) + n(form.content_investment) + n(form.fees)
  const adSpend = n(form.google_investment) + n(form.meta_investment)
  const cpc = n(form.clicks) > 0 ? adSpend / n(form.clicks) : 0
  const existing = rows.find(r => r.year === year && r.month === month)

  async function save() {
    setSaving(true); setMsg('')
    try {
      const res = await fetch('/api/admin/billing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: SLUG, year, month, ...form }),
      })
      const d = await res.json()
      if (res.ok) { setMsg(`Guardado ✓ — ${existing ? 'mes reemplazado' : 'mes creado'}`); await load() }
      else setMsg(d.error || 'Error al guardar')
    } catch { setMsg('Error de red') }
    setSaving(false)
  }

  async function saveCompetitors() {
    setCompSaving(true); setCompMsg('')
    try {
      const lines = competitors.split('\n').map(s => s.trim()).filter(Boolean)
      const res = await fetch('/api/admin/competitors', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: SLUG, competitors: lines }),
      })
      const d = await res.json()
      setCompMsg(res.ok ? 'Competidores guardados \u2713' : (d.error || 'Error al guardar'))
    } catch { setCompMsg('Error de red') }
    setCompSaving(false)
  }

  async function runResearch() {
    setResearching(true); setResearchMsg('Investigando la web... (~30-60s)')
    try {
      const res = await fetch(`/api/research/competition?slug=${SLUG}`)
      const d = await res.json()
      setResearchMsg(res.ok ? `Investigacion actualizada \u2713 (${d.length} car.)` : (d.error || 'Error en la investigacion'))
    } catch { setResearchMsg('Error de red / timeout') }
    setResearching(false)
  }

  async function generateAudience() {
    setAudGenerating(true); setAudMsg('Analizando audiencia (Google Ads + GA4)... (~40s)')
    try {
      const res = await fetch('/api/research/audience', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: SLUG, year, month }),
      })
      const d = await res.json()
      if (d?.ok && d.data) {
        setAudInternal(d.data.analysis?.internalNote || '')
        setAudBookings(typeof d.data.ga4?.totalBookings === 'number' ? d.data.ga4.totalBookings : null)
        setAudAt(d.data.generatedAt || '')
        setAudMsg('Audiencia actualizada ✓')
      } else setAudMsg(d?.error || 'Error al generar')
    } catch { setAudMsg('Error de red / timeout') }
    setAudGenerating(false)
  }

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const field = (key: keyof typeof form, label: string, hint?: string) => (
    <div>
      <label className="block text-[12px] font-medium text-gray-600 mb-1">{label}</label>
      <input
        value={form[key]}
        onChange={e => { setForm(f => ({ ...f, [key]: e.target.value })); setMsg('') }}
        inputMode="numeric"
        placeholder="0"
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
      />
      {hint && <p className="text-[10px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
  )

  const Derived = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between text-[12px] py-1">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 tabular-nums">{value}</span>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Admin · KPIs de marketing</h1>
            <p className="text-[12px] text-gray-400">Hashtag 98 Hotel — carga mensual de inversión y métricas</p>
          </div>
          <div className="flex items-center gap-4">
            <a href="/dashboard" className="text-[12px] text-gray-500 hover:text-gray-900">← Dashboard</a>
            <button onClick={logout} className="text-[12px] text-gray-500 hover:text-red-600">Cerrar sesión</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Form */}
          <div className="md:col-span-2 bg-white border border-gray-100 rounded-xl p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-gray-600 mb-1">Año</label>
                <select value={year} onChange={e => setYear(parseInt(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bg-white">
                  {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-600 mb-1">Mes</label>
                <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bg-white">
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
            </div>

            <div className={`flex items-center gap-2 text-[11px] px-3 py-2 rounded-lg ${existing ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: existing ? '#d97706' : '#2563eb' }} />
              {existing
                ? 'Editando datos ya guardados de este mes — al guardar se reemplazan.'
                : 'Mes nuevo, sin datos guardados todavía.'}
            </div>

            <div className="h-px bg-gray-100" />

            <div className="grid grid-cols-2 gap-3">
              {field('google_investment', 'Inversión Google (COP)')}
              {field('meta_investment', 'Inversión Meta (COP)')}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {field('content_investment', 'Inversión Contenido (COP)')}
              {field('fees', 'Fees / Honorarios (COP)')}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {field('clicks', 'Clics')}
              {field('impressions', 'Impresiones')}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              {msg && <span className={`text-[12px] ${msg.includes('✓') ? 'text-green-600' : 'text-red-500'}`}>{msg}</span>}
              <button onClick={save} disabled={saving}
                className="px-5 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50"
                style={{ background: '#1a1a1a' }}>
                {saving ? 'Guardando…' : 'Guardar mes'}
              </button>
            </div>
          </div>

          {/* Live derived preview */}
          <div className="bg-white border border-gray-100 rounded-xl p-5 h-fit">
            <h3 className="text-[12px] font-medium text-gray-900 mb-3">Cálculo automático</h3>
            <Derived label="Inversión total (suma rubros)" value={`$${fmt(totalInv)}`} />
            <Derived label="CPC (ads pagas)" value={`$${fmt(cpc)}`} />
            <p className="text-[10px] text-gray-400 mt-3 leading-relaxed">
              La facturación y el ROAS salen de Cloudbeds en el dashboard (no se cargan acá). CPC usa Google + Meta ÷ clics.
            </p>
          </div>
        </div>

        {/* Source selector (growth only) */}
        <SourceSelector />

        {/* Competencia */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 mt-5">
          <h3 className="text-[12px] font-medium text-gray-900 mb-1">Competencia</h3>
          <p className="text-[11px] text-gray-400 mb-3">Un competidor por linea. Al actualizar la investigacion se analizan estos hoteles (innovacion, promos, viralidad) y el resultado nutre las conclusiones del mes en curso.</p>
          <textarea
            value={competitors}
            onChange={e => { setCompetitors(e.target.value); setCompMsg('') }}
            rows={5}
            placeholder={'Diez Hotel\nThe Somos\nBinn Hotel\nMarquee'}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
          />
          <div className="flex items-center justify-end gap-3 pt-3 flex-wrap">
            {compMsg && <span className={`text-[12px] ${compMsg.includes('\u2713') ? 'text-green-600' : 'text-red-500'}`}>{compMsg}</span>}
            {researchMsg && <span className={`text-[12px] ${researchMsg.includes('\u2713') ? 'text-green-600' : 'text-gray-500'}`}>{researchMsg}</span>}
            <button onClick={saveCompetitors} disabled={compSaving}
              className="px-4 py-2 rounded-lg text-[13px] font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              {compSaving ? 'Guardando...' : 'Guardar competidores'}
            </button>
            <button onClick={runResearch} disabled={researching}
              className="px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50"
              style={{ background: '#1a1a1a' }}>
              {researching ? 'Investigando...' : 'Actualizar investigacion'}
            </button>
          </div>
        </div>

        {/* Nota interna — Audiencia (solo equipo, no la ve el cliente) */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 mt-5">
          <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
            <h3 className="text-[12px] font-medium text-gray-900">
              Nota interna · Audiencia (Google Ads + GA4)
              <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">Solo equipo</span>
            </h3>
            <div className="flex items-center gap-3">
              {audMsg && <span className={`text-[12px] ${audMsg.includes('✓') ? 'text-green-600' : 'text-gray-500'}`}>{audMsg}</span>}
              <button onClick={generateAudience} disabled={audGenerating}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50"
                style={{ background: '#1a1a1a' }}>
                {audGenerating ? 'Analizando...' : 'Actualizar audiencia'}
              </button>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mb-3">
            Cruce candido de pauta vs comprador real para {MONTHS[month - 1]} {year}. El cliente NO ve esto en su tablero.
            {audBookings !== null && <span className="text-gray-600 font-medium"> · {audBookings} reservas directas</span>}
            {audAt && <span> · {new Date(audAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</span>}
          </p>
          {audInternal ? (
            <div className="text-[13px] text-gray-700 leading-relaxed bg-amber-50/40 border border-amber-100 rounded-lg p-4 whitespace-pre-line">
              {audInternal}
            </div>
          ) : (
            <div className="text-[12px] text-gray-400 border border-dashed border-gray-200 rounded-lg p-4">
              Sin nota para este mes. Tocá &quot;Actualizar audiencia&quot; para generarla (requiere Google Ads + GA4 configurados).
            </div>
          )}
        </div>

        {/* Existing months table */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 mt-5">
          <h3 className="text-[12px] font-medium text-gray-900 mb-3">Meses cargados</h3>
          <div className="overflow-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="text-left py-1.5 px-2 font-medium">Mes</th>
                  <th className="text-right py-1.5 px-2 font-medium">Inversión</th>
                  <th className="text-right py-1.5 px-2 font-medium">CPC</th>
                  <th className="text-right py-1.5 px-2 font-medium">Clics</th>
                  <th className="py-1.5 px-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map(r => (
                  <tr key={`${r.year}-${r.month}`} className="hover:bg-gray-50">
                    <td className="py-1.5 px-2 text-gray-600">{MONTHS[r.month - 1].slice(0, 3)} {r.year}</td>
                    <td className="py-1.5 px-2 text-right text-gray-600">${fmt(r.total_investment)}</td>
                    <td className="py-1.5 px-2 text-right text-gray-600">${fmt(r.cpc)}</td>
                    <td className="py-1.5 px-2 text-right text-gray-600">{fmt(r.clicks)}</td>
                    <td className="py-1.5 px-2 text-right">
                      <button onClick={() => { setYear(r.year); setMonth(r.month) }}
                        className="text-gray-400 hover:text-gray-900 text-[11px]">editar</button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="py-4 text-center text-gray-400">Sin datos aún</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
