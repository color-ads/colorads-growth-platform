'use client'
import { Users, Moon, DollarSign, Percent, TrendingUp } from 'lucide-react'
import { formatCOP, formatNumber, formatPct } from '@/lib/utils'
import { MonthlyReport, Property } from '@/types'
import { cn } from '@/lib/utils'

interface KPIStripProps {
  report: Partial<MonthlyReport>
  prevReport?: Partial<MonthlyReport>
  property: Property
}

function Delta({ current, prev, format = 'pct' }: { current: number, prev?: number, format?: 'pct' | 'abs' }) {
  if (!prev || prev === 0) return null
  const delta = ((current - prev) / prev) * 100
  const isPositive = delta > 0
  return (
    <span className={cn('text-[11px] flex items-center gap-0.5', isPositive ? 'text-green-600' : 'text-red-500')}>
      {isPositive ? '↑' : '↓'}{Math.abs(delta).toFixed(1)}% vs mes ant.
    </span>
  )
}

export function KPIStrip({ report, prevReport, property }: KPIStripProps) {
  const primary = property.primary_color || '#0ea5e9'

  const kpis = [
    {
      label: 'Huéspedes',
      value: formatNumber(report.total_guests || 0),
      icon: Users,
      delta: <Delta current={report.total_guests || 0} prev={prevReport?.total_guests} />,
    },
    {
      label: 'Noches',
      value: formatNumber(report.total_nights || 0),
      icon: Moon,
      delta: <Delta current={report.total_nights || 0} prev={prevReport?.total_nights} />,
    },
    {
      label: 'Inversión total',
      value: formatCOP(report.total_investment || 0),
      icon: DollarSign,
      delta: null,
    },
    {
      label: 'Coste publicitario',
      value: formatPct(report.ad_cost_pct || 0),
      icon: Percent,
      delta: report.ad_cost_pct && prevReport?.ad_cost_pct ? (
        <span className={cn('text-[11px]', report.ad_cost_pct < prevReport.ad_cost_pct ? 'text-green-600' : 'text-red-500')}>
          {report.ad_cost_pct < prevReport.ad_cost_pct ? '↓' : '↑'}
          {Math.abs(report.ad_cost_pct - prevReport.ad_cost_pct).toFixed(1)}pp
        </span>
      ) : null,
    },
    {
      label: 'Facturación atribuible',
      value: formatCOP(report.attributable_revenue || 0),
      icon: TrendingUp,
      delta: <Delta current={report.attributable_revenue || 0} prev={prevReport?.attributable_revenue} />,
      accent: true,
    },
  ]

  return (
    <div className="grid grid-cols-5 border-b border-gray-100">
      {kpis.map((kpi, i) => (
        <div
          key={kpi.label}
          className={cn(
            'bg-white px-5 py-4',
            i < kpis.length - 1 && 'border-r border-gray-100',
            kpi.accent && 'border-t-2'
          )}
          style={kpi.accent ? { borderTopColor: primary } : {}}
        >
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-2">
            <kpi.icon className="w-3.5 h-3.5" />
            {kpi.label}
          </div>
          <div className="text-2xl font-medium text-gray-900 leading-none tracking-tight">
            {kpi.value}
          </div>
          <div className="mt-1.5 h-4">
            {kpi.delta}
          </div>
        </div>
      ))}
    </div>
  )
}
