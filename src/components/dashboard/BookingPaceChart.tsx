'use client'

import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts'
import { formatCOP } from '@/lib/utils'

export interface StayBucket {
  key: string
  label: string
  revenue: number
  bookings: number
  self: boolean
}

const Tip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-gray-100 rounded-lg shadow-sm p-3 text-xs">
      <div className="font-medium text-gray-700 mb-1">{d.label}{d.self ? ' (mismo mes)' : ''}</div>
      <div className="text-gray-600">Venta de reservas: <span className="font-medium text-gray-900">{formatCOP(d.revenue)}</span></div>
      <div className="text-gray-600">N° reservas: <span className="font-medium text-gray-900">{d.bookings}</span></div>
    </div>
  )
}

const barLabel = (props: any) => {
  const { x, y, width, value } = props
  if (!value || width < 18) return null
  return (
    <text x={x + width / 2} y={y - 5} fill="#475569" fontSize={9} textAnchor="middle">{formatCOP(value)}</text>
  )
}

export function BookingPaceChart({ distribution, monthLabel }: { distribution: StayBucket[]; monthLabel: string }) {
  const total = distribution.reduce((a, b) => a + b.revenue, 0)
  const self = distribution.find((d) => d.self)
  const selfPct = total > 0 && self ? Math.round((self.revenue / total) * 100) : 0
  const futures = distribution.filter((d) => !d.self)
  const futureRange = futures.length
    ? `${futures[0].label}${futures.length > 1 ? '–' + futures[futures.length - 1].label : ''}`
    : null
  const mes = (monthLabel.split(' ')[0] || monthLabel)
  const mesLow = mes.toLowerCase()

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[13px] font-medium text-gray-900">¿Para qué meses se reservó en {mes}?</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">Venta de reservas directa hecha en {mesLow}, según el mes de estadía</p>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#1a1a1a' }} /> Mismo mes</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#f59e0b' }} /> Meses siguientes</span>
        </div>
      </div>

      {distribution.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
          Sin datos de reservas para este mes todavía.
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={distribution} barCategoryGap="28%" margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => formatCOP(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={52} />
              <Tooltip content={<Tip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
              <Bar dataKey="revenue" radius={[3, 3, 0, 0]}>
                {distribution.map((d, i) => <Cell key={i} fill={d.self ? '#1a1a1a' : '#f59e0b'} />)}
                <LabelList dataKey="revenue" content={barLabel} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {selfPct > 0 && (
            <div className="text-[12px] text-gray-600 mt-3 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5 leading-relaxed">
              El <b className="text-gray-900">{selfPct}%</b> de la venta de reservas de {mesLow} es para <b className="text-gray-900">{mesLow}</b>
              {futureRange ? <> ; el resto ya está llenando <b className="text-gray-900">{futureRange}</b>.</> : '.'}
            </div>
          )}
        </>
      )}
    </div>
  )
}
