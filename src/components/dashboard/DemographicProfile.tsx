'use client'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { MonthlyReport, Property } from '@/types'
import { formatCOP, monthName } from '@/lib/utils'

interface DemographicsProps {
  report: Partial<MonthlyReport>
  historicalReports: Partial<MonthlyReport>[]
  property: Property
}

const STATUS_COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#a78bfa']
const LEAD_COLORS = ['#0f172a', '#0ea5e9', '#22c55e', '#6366f1', '#f59e0b']
const GEO_COLOR = '#0ea5e9'

const CustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.06) return null
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={500}>{`${(percent * 100).toFixed(0)}%`}</text>
}

function DonutCard({ title, data, colors }: { title: string, data: { name: string, value: number, pct: number }[], colors: string[] }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <h4 className="text-[12px] font-medium text-gray-900 mb-3">{title}</h4>
      <div className="flex items-center gap-3">
        <PieChart width={110} height={110}>
          <Pie data={data} cx={50} cy={50} innerRadius={30} outerRadius={52} dataKey="value" labelLine={false} label={<CustomPieLabel />}>
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
        </PieChart>
        <div className="flex flex-col gap-1.5 flex-1">
          {data.map((item, i) => (
            <div key={item.name} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: colors[i % colors.length] }} />
                {item.name}
              </span>
              <span className="text-[11px] font-medium text-gray-800">{item.pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function DemographicProfile({ report, historicalReports, property }: DemographicsProps) {
  const statusData = (report.booking_status_breakdown || []).map(s => ({ name: s.status, value: s.count, pct: s.pct })).sort((a, b) => b.value - a.value)
  const leadData = (report.booking_lead_time_breakdown || []).map(s => ({ name: s.range, value: s.count, pct: s.pct })).sort((a, b) => b.value - a.value)
  const geoData = (report.geo_breakdown || []).filter(g => g.country && g.country !== 'Otros').map(g => ({ name: g.country, value: g.revenue, pct: g.pct })).sort((a, b) => b.value - a.value)
  const roomData = (report.room_category_breakdown || []).slice(0, 8)

  // Eficiencia de marketing por mes: solo meses con inversion. Total = combinado (real).
  const marketingMonths = historicalReports.filter((r) => (r.total_investment || 0) > 0)
  const totalInv = marketingMonths.reduce((a, r) => a + (r.total_investment || 0), 0)
  const totalAttr = marketingMonths.reduce((a, r) => a + (r.attributable_revenue || 0), 0)
  const blendedRoas = totalInv > 0 ? totalAttr / totalInv : 0
  const blendedCost = totalAttr > 0 ? (totalInv / totalAttr) * 100 : 0

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-100" />
        <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider px-2">Perfil demográfico del canal</span>
        <div className="flex-1 h-px bg-gray-100" />
      </div>

      {/* Donuts + Geo row */}
      <div className="grid grid-cols-3 gap-4">
        <DonutCard title="Estado de reservas" data={statusData} colors={STATUS_COLORS} />
        <DonutCard title="Antelación de reservas" data={leadData} colors={LEAD_COLORS} />

        {/* Geo bar chart */}
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h4 className="text-[12px] font-medium text-gray-900 mb-3">Venta de reservas × país</h4>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={geoData} layout="vertical" margin={{ left: 4, right: 8 }}>
              <XAxis type="number" tickFormatter={v => formatCOP(v)} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={84} interval={0} />
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <Tooltip formatter={(v: any) => [formatCOP(Number(v)), 'Venta']} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #f1f5f9' }} />
              <Bar dataKey="value" fill={property.primary_color || GEO_COLOR} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Room categories + Marketing efficiency table */}
      <div className="grid grid-cols-2 gap-4">
        {/* Room ranking */}
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h4 className="text-[12px] font-medium text-gray-900 mb-3">Venta × categoría de habitación</h4>
          <div className="space-y-2">
            {roomData.map((room, i) => (
              <div key={room.category_name} className="flex items-center gap-2">
                <span className="text-[10px] text-gray-300 w-4 text-right flex-shrink-0">{i + 1}</span>
                <span className="text-[11px] text-gray-600 flex-1 truncate">{room.category_name}</span>
                <div className="w-20 h-1.5 bg-gray-100 rounded-full flex-shrink-0">
                  <div
                    className="h-1.5 rounded-full"
                    style={{ width: `${room.pct / roomData[0].pct * 100}%`, background: property.primary_color || GEO_COLOR }}
                  />
                </div>
                <span className="text-[11px] font-medium text-gray-800 w-16 text-right flex-shrink-0">{formatCOP(room.revenue)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Marketing efficiency table */}
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h4 className="text-[12px] font-medium text-gray-900 mb-3">Eficiencia de marketing por mes</h4>
          <div className="overflow-auto max-h-[220px]">
            <table className="w-full text-[11px]" style={{ tableLayout: 'fixed' }}>
              <thead className="sticky top-0 bg-gray-50">
                <tr>
                  <th className="text-left py-1.5 px-2 font-medium text-gray-500 w-14">Mes</th>
                  <th className="text-right py-1.5 px-2 font-medium text-gray-500">Inversión</th>
                  <th className="text-right py-1.5 px-2 font-medium text-gray-500">ROAS</th>
                  <th className="text-right py-1.5 px-2 font-medium text-gray-500">% Coste</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {marketingMonths.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="py-1.5 px-2 text-gray-500">{monthName(r.month!, r.year!)}</td>
                    <td className="py-1.5 px-2 text-right text-gray-600">{formatCOP(r.total_investment || 0)}</td>
                    <td className="py-1.5 px-2 text-right font-medium" style={{ color: (r.roas || 0) >= 7 ? '#16a34a' : (r.roas || 0) >= 5 ? '#d97706' : '#dc2626' }}>
                      {r.roas?.toFixed(1)}×
                    </td>
                    <td className="py-1.5 px-2 text-right text-gray-600">{(((r.total_investment || 0) / (r.attributable_revenue || 1)) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-white border-t border-gray-200">
                <tr>
                  <td className="py-1.5 px-2 font-medium text-gray-700">Total</td>
                  <td className="py-1.5 px-2 text-right font-medium text-gray-900">{formatCOP(totalInv)}</td>
                  <td className="py-1.5 px-2 text-right font-medium text-gray-900">{blendedRoas.toFixed(1)}×</td>
                  <td className="py-1.5 px-2 text-right font-medium text-gray-900">{blendedCost.toFixed(1)}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
