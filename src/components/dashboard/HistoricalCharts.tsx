'use client'
import { BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { MonthlyReport, Property } from '@/types'
import { formatCOP, monthName } from '@/lib/utils'

interface HistoricalChartsProps {
  reports: Partial<MonthlyReport>[]
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
      {payload.length === 2 && payload[0]?.value && payload[1]?.value && (
        <div className="mt-1.5 pt-1.5 border-t border-gray-100 text-gray-500">
          Participación directa: {((payload[0].value / payload[1].value) * 100).toFixed(1)}%
        </div>
      )}
    </div>
  )
}

export function HistoricalCharts({ reports, property }: HistoricalChartsProps) {
  const primary = property.primary_color || '#0ea5e9'

  const revenueData = reports.map(r => ({
    name: monthName(r.month!, r.year!),
    'Atribuible': r.attributable_revenue || 0,
    'Total hotel': r.total_hotel_revenue || 0,
  }))

  const bookingsData = reports.map(r => ({
    name: monthName(r.month!, r.year!),
    'Volumen': r.booking_volume || 0,
    'Reservas': r.total_bookings || 0,
  }))

  return (
    <div className="space-y-4">
      {/* Chart 1: Atribuible vs Total */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[13px] font-medium text-gray-900">Facturación atribuible vs total del hotel</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Canal directo vs negocio completo — {reports.length} meses</p>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: primary }} />
              Atribuible
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-gray-200" />
              Total hotel
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={revenueData} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => formatCOP(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={52} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="Total hotel" fill="#e2e8f0" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Atribuible" fill={primary} radius={[3, 3, 0, 0]} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Volumen reservas + nº reservas */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[13px] font-medium text-gray-900">Volumen de reservas + número de reservas</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Valor económico y cantidad mensual</p>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-indigo-400" />
              Volumen COP
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-6 border-t-2 border-dashed border-indigo-200" />
              N° reservas
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={bookingsData} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" tickFormatter={(v) => formatCOP(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={52} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#c7d2fe' }} axisLine={false} tickLine={false} width={36} />
            <Tooltip content={<CustomTooltip />} />
            <Bar yAxisId="left" dataKey="Volumen" fill="#818cf8" radius={[3, 3, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="Reservas" stroke="#c7d2fe" strokeWidth={2} dot={{ r: 2.5, fill: '#c7d2fe' }} strokeDasharray="4 2" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
