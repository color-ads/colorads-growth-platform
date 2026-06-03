'use client'
import { TrendingUp, BarChart3 } from 'lucide-react'
import { MonthlyReport, Property } from '@/types'
import { formatCOP, formatROAS, calcSuccessFee } from '@/lib/utils'

interface InsightsPanelProps {
  report: Partial<MonthlyReport>
  property: Property
}

const TONE = {
  good:   { box: 'bg-green-50 border-green-400', title: 'text-green-800', body: 'text-green-700' },
  watch:  { box: 'bg-amber-50 border-amber-400', title: 'text-amber-800', body: 'text-amber-700' },
  action: { box: 'bg-blue-50 border-blue-400',   title: 'text-blue-800',  body: 'text-blue-700' },
} as const

// Conclusiones (full-width, abajo). Muestra los comentarios IA en grilla 2x2.
export function InsightsPanel({ report }: InsightsPanelProps) {
  const insights = report.ai_insights
  const cards: { title: string; body: string; tone: keyof typeof TONE }[] = []
  if (insights) {
    (insights.positive || []).forEach((it) => cards.push({ title: it.title, body: it.body, tone: 'good' }))
    ;(insights.attention || []).forEach((it) => cards.push({ title: it.title, body: it.body, tone: 'watch' }))
    ;(insights.strategic || []).forEach((it) => cards.push({ title: it.title, body: it.body, tone: 'action' }))
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[13px] font-medium text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-gray-400" />
          Conclusiones y propuestas — {report.month}/{report.year}
        </h3>
        <span className="text-[10px] font-medium bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">análisis IA</span>
      </div>

      {cards.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {cards.map((c, i) => (
            <div key={i} className={`rounded-lg p-3 border-l-[3px] ${TONE[c.tone].box}`}>
              <div className={`text-[12px] font-medium mb-1 ${TONE[c.tone].title}`}>{c.title}</div>
              <div className={`text-[11px] leading-relaxed ${TONE[c.tone].body}`}>{c.body}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-400">
          <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-[12px]">Generando análisis IA...</p>
        </div>
      )}
    </div>
  )
}

/* ROI strip - franja horizontal full-width (va despues de los 2 graficos) */
export function RoiStrip({ report, property }: InsightsPanelProps) {
  const successFee = calcSuccessFee(report.attributable_revenue || 0, property.success_fee_pct)
  const ratio = ((report.attributable_revenue || 0) / (report.total_investment || 1)).toFixed(1)
  const metrics = [
    { label: 'Facturación atribuible', value: formatCOP(report.attributable_revenue || 0), color: '#111827' },
    { label: 'Inversión total', value: formatCOP(report.total_investment || 0), color: '#111827' },
    { label: 'ROAS', value: formatROAS(report.roas || 0), color: property.primary_color },
    { label: `Fee de éxito (${property.success_fee_pct}%)`, value: formatCOP(successFee), color: '#111827' },
  ]

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5" style={{ borderTopColor: property.primary_color, borderTopWidth: 2 }}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-[13px] font-medium text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-gray-400" />
          ROI de la inversión
        </h3>
        <span className="text-[11px] text-gray-400">
          Por cada $1 invertido en marketing → se generaron ${ratio} en ventas
        </span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map((mt) => (
          <div key={mt.label} className="bg-gray-50 rounded-lg px-4 py-3">
            <div className="text-[11px] text-gray-400 mb-1">{mt.label}</div>
            <div className="text-2xl font-semibold whitespace-nowrap" style={{ color: mt.color }}>{mt.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* Inversion por canal (full-width, 4 canales en fila) */
export function ChannelBreakdown({ report }: InsightsPanelProps) {
  const total = report.total_investment || 1
  const channels = [
    { name: 'Google Ads', value: report.google_investment || 0, color: '#3b82f6', sub: `${(report.total_clicks || 0).toLocaleString()} clics · CPC ${formatCOP(report.avg_cpc || 0)}` },
    { name: 'Meta Ads',   value: report.meta_investment || 0,   color: '#6366f1', sub: `${(report.total_impressions || 0).toLocaleString()} impresiones` },
    { name: 'Contenido',  value: report.content_investment || 0, color: '#f59e0b', sub: '5 reels · 3 carruseles' },
    { name: 'Honorarios', value: report.fees_investment || 0,    color: '#94a3b8', sub: 'Fee gestión + éxito' },
  ]

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <h3 className="text-[13px] font-medium text-gray-900 mb-4">Inversión por canal</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {channels.map((ch) => (
          <div key={ch.name}>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ch.color }} />
              <span className="text-[12px] font-medium text-gray-800">{ch.name}</span>
            </div>
            <div className="text-xl font-semibold text-gray-900">{formatCOP(ch.value)}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{ch.sub}</div>
            <div className="h-1 bg-gray-100 rounded-full mt-2">
              <div className="h-1 rounded-full" style={{ width: `${(ch.value / total) * 100}%`, background: ch.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
