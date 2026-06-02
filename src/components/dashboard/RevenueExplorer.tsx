'use client'
import { useMemo } from 'react'
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

// Read-only charts. The attributable source list is configured by growth in /admin.
export function RevenueExplorer({ rows, attributable }: Props) {
  const months = useMemo(() => {
    const s = new Set<string>()
    for (const r of rows) s.add(`${r.year}-${String(r.month).padStart(2, '0')}`)
    return [...s].sort()
  }, [rows])

  const data = useMemo(() => {
    const attr = new Set(attributable)
    return months.map(ym => {
      const [y, m] = ym.split('-').map(Number)
      let fact = 0, vol = 0, cnt = 0, factAll = 0
      for (const r of rows) {
        if (r.year !== y || r.month !== m) continue
        factAll += r.stay_revenue
        if (attr.has(r.source)) {
          fact += r.stay_revenue
          vol += r.booking_volume
          cnt += r.booking_count
        }
      }
      return { name: monthName(m, y), Facturación: fact, Reservas: vol, 'N° reservas': cnt, 'Total hotel': factAll }
    })
  }, [rows, months, attributable])

  return (
    <div className="space-y-4">
      {/* Chart 1: Facturación (negra) + línea hotel */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[13px] font-medium text-gray-900">Facturación</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Ingresos por estadía del mes — atribuible vs total hotel</p>
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
