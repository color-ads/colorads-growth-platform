'use client'
import { useState, useMemo } from 'react'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts'
import { formatCOP, monthName } from '@/lib/utils'
import type { Property } from '@/types'

export interface SourceRow {
  year: number
  month: number
  source: string
  category: string
  stay_revenue: number
  booking_volume: number
  booking_count: number
}

interface Props {
  rows: SourceRow[]
  attributable: string[]
  property: Property
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-lg shadow-sm p-3 text-xs">
      <div className="font-medium text-gray-700 mb-2">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-gray-600">
          <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: p.color }} />
          <span>{p.name}:</span>
          <span className="font-medium text-gray-900">
            {typeof p.value === 'number' && p.value > 10000 ? formatCOP(p.value) : p.value?.toLocaleString('es-CO')}
          </span>
        </div>
      ))}
    </div>
  )
}

const barLabel = (props: any) => {
  const { x, y, width, value } = props
  if (!value || width < 14) return null
  return (
    <text x={x + width / 2} y={y - 4} fill="#475569" fontSize={8.5} textAnchor="middle">
      {formatCOP(value)}
    </text>
  )
}

export function RevenueExplorer({ rows, attributable, property }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(attributable))
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  // distinct sources w/ category + lifetime totals (for the selector)
  const sources = useMemo(() => {
    const map = new Map<string, { category: string; stay: number; vol: number }>()
    for (const r of rows) {
      const cur = map.get(r.source) ?? { category: r.category || 'Direct', stay: 0, vol: 0 }
      cur.stay += r.stay_revenue
      cur.vol += r.booking_volume
      if (r.category && r.category !== '-') cur.category = r.category
      map.set(r.source, cur)
    }
    return [...map.entries()]
      .map(([source, d]) => ({ source, ...d }))
      .sort((a, b) => b.stay - a.stay)
  }, [rows])

  const months = useMemo(() => {
    const s = new Set<string>()
    for (const r of rows) s.add(`${r.year}-${String(r.month).padStart(2, '0')}`)
    return [...s].sort()
  }, [rows])

  // per-month sums based on current selection
  const data = useMemo(() => {
    return months.map(ym => {
      const [y, m] = ym.split('-').map(Number)
      let fact = 0, vol = 0, cnt = 0, factAll = 0
      for (const r of rows) {
        if (r.year !== y || r.month !== m) continue
        factAll += r.stay_revenue
        if (selected.has(r.source)) {
          fact += r.stay_revenue
          vol += r.booking_volume
          cnt += r.booking_count
        }
      }
      return { name: monthName(m, y), Facturación: fact, Reservas: vol, 'N° reservas': cnt, 'Total hotel': factAll }
    })
  }, [rows, months, selected])

  function toggle(src: string) {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(src) ? n.delete(src) : n.add(src)
      return n
    })
    setMsg('')
  }
  function setGroup(list: { source: string }[], on: boolean) {
    setSelected(prev => {
      const n = new Set(prev)
      list.forEach(s => (on ? n.add(s.source) : n.delete(s.source)))
      return n
    })
    setMsg('')
  }

  async function save() {
    setSaving(true); setMsg('')
    try {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: property.slug, sources: [...selected] }),
      })
      setMsg(res.ok ? 'Guardado ✓' : 'Error al guardar')
    } catch {
      setMsg('Error al guardar')
    }
    setSaving(false)
  }

  const direct = sources.filter(s => s.category !== 'OTA')
  const ota = sources.filter(s => s.category === 'OTA')

  const Row = ({ s }: { s: { source: string; category: string; stay: number } }) => (
    <label className="flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-50 cursor-pointer text-[12px]">
      <input
        type="checkbox"
        checked={selected.has(s.source)}
        onChange={() => toggle(s.source)}
        className="rounded border-gray-300"
      />
      <span className="flex-1 text-gray-700 truncate">{s.source}</span>
      <span className="text-gray-400 tabular-nums">{formatCOP(s.stay)}</span>
    </label>
  )

  return (
    <div className="space-y-4">
      {/* Selector */}
      <div className="bg-white border border-gray-100 rounded-xl">
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            <span className="text-[13px] font-medium text-gray-900">Fuentes atribuibles</span>
            <span className="text-[11px] text-gray-400">{selected.size} seleccionadas</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {open && (
          <div className="px-5 pb-4 border-t border-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Directo</span>
                  <div className="flex gap-2 text-[11px]">
                    <button onClick={() => setGroup(direct, true)} className="text-gray-500 hover:text-gray-900">Todo</button>
                    <button onClick={() => setGroup(direct, false)} className="text-gray-500 hover:text-gray-900">Nada</button>
                  </div>
                </div>
                <div className="max-h-52 overflow-y-auto">
                  {direct.map(s => <Row key={s.source} s={s} />)}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">OTA</span>
                  <div className="flex gap-2 text-[11px]">
                    <button onClick={() => setGroup(ota, true)} className="text-gray-500 hover:text-gray-900">Todo</button>
                    <button onClick={() => setGroup(ota, false)} className="text-gray-500 hover:text-gray-900">Nada</button>
                  </div>
                </div>
                <div className="max-h-52 overflow-y-auto">
                  {ota.map(s => <Row key={s.source} s={s} />)}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-3 pt-3 border-t border-gray-50">
              {msg && <span className="text-[12px] text-gray-500">{msg}</span>}
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-1.5 rounded-lg text-[12px] font-medium text-white disabled:opacity-50"
                style={{ background: '#1a1a1a' }}
              >
                {saving ? 'Guardando…' : 'Guardar selección'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Chart 1: Facturación (negra) + línea hotel */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[13px] font-medium text-gray-900">Facturación</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Ingresos por estadía del mes — fuentes atribuibles vs total hotel</p>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#1a1a1a' }} />
              Facturación atribuible
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-6 border-t-2" style={{ borderColor: '#f59e0b' }} />
              Total hotel
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={230}>
          <ComposedChart data={data} barCategoryGap="22%" margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => formatCOP(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={52} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="Facturación" fill="#1a1a1a" radius={[3, 3, 0, 0]}>
              <LabelList dataKey="Facturación" content={barLabel} />
            </Bar>
            <Line type="monotone" dataKey="Total hotel" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2, fill: '#f59e0b' }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Reservas (gris) + N° reservas */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[13px] font-medium text-gray-900">Reservas</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Valor de reservas hechas en el mes (por fecha de reserva)</p>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#9ca3af' }} />
              Volumen COP
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-6 border-t-2 border-dashed" style={{ borderColor: '#1a1a1a' }} />
              N° reservas
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={230}>
          <ComposedChart data={data} barCategoryGap="22%" margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" tickFormatter={(v) => formatCOP(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={52} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} />
            <Tooltip content={<CustomTooltip />} />
            <Bar yAxisId="left" dataKey="Reservas" fill="#9ca3af" radius={[3, 3, 0, 0]}>
              <LabelList dataKey="Reservas" content={barLabel} />
            </Bar>
            <Line yAxisId="right" type="monotone" dataKey="N° reservas" stroke="#1a1a1a" strokeWidth={2} dot={{ r: 2.5, fill: '#1a1a1a' }} strokeDasharray="4 2" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
