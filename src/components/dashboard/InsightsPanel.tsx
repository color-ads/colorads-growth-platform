'use client'
import { CheckCircle2, Clock, Star, TrendingUp, Target, BarChart3 } from 'lucide-react'
import { MonthlyReport, Property } from '@/types'
import { formatCOP, formatROAS, calcSuccessFee } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface InsightsPanelProps {
  report: Partial<MonthlyReport>
  property: Property
}

export function InsightsPanel({ report, property }: InsightsPanelProps) {
  const insights = report.ai_insights
  const milestones = report.milestones || []
  const successFee = calcSuccessFee(report.attributable_revenue || 0, property.success_fee_pct)

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Conclusions */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[13px] font-medium text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gray-400" />
            Conclusiones — {report.month}/{report.year}
          </h3>
          <span className="text-[10px] font-medium bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">análisis IA</span>
        </div>

        {insights ? (
          <div className="space-y-3">
            {insights.positive.map((item, i) => (
              <div key={i} className="rounded-lg p-3 bg-green-50 border-l-[3px] border-green-400">
                <div className="text-[12px] font-medium text-green-800 mb-1">{item.title}</div>
                <div className="text-[11px] text-green-700 leading-relaxed">{item.body}</div>
              </div>
            ))}
            {insights.attention.map((item, i) => (
              <div key={i} className="rounded-lg p-3 bg-amber-50 border-l-[3px] border-amber-400">
                <div className="text-[12px] font-medium text-amber-800 mb-1">{item.title}</div>
                <div className="text-[11px] text-amber-700 leading-relaxed">{item.body}</div>
              </div>
            ))}
            {insights.strategic.map((item, i) => (
              <div key={i} className="rounded-lg p-3 bg-blue-50 border-l-[3px] border-blue-400">
                <div className="text-[12px] font-medium text-blue-800 mb-1">{item.title}</div>
                <div className="text-[11px] text-blue-700 leading-relaxed">{item.body}</div>
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

      {/* Milestones + Fee */}
      <div className="space-y-4">
        {/* Milestones */}
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <h3 className="text-[13px] font-medium text-gray-900 flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-gray-400" />
            Hitos del mes
          </h3>
          <div className="space-y-0 divide-y divide-gray-50">
            {milestones.map((m) => (
              <div key={m.id} className="flex items-start gap-3 py-2.5">
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                  m.status === 'completed' && m.type === 'achievement' && 'bg-green-100',
                  m.status === 'in_progress' && 'bg-amber-100',
                  m.type === 'highlight' && 'bg-purple-100',
                )}>
                  {m.status === 'completed' && m.type !== 'highlight' && <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />}
                  {m.status === 'in_progress' && <Clock className="w-3.5 h-3.5 text-amber-600" />}
                  {m.type === 'highlight' && <Star className="w-3.5 h-3.5 text-purple-600" />}
                </div>
                <div>
                  <div className="text-[12px] font-medium text-gray-800 leading-snug">{m.title}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{m.subtitle}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ROI del fee */}
        <div className="bg-white border border-gray-100 rounded-xl p-5" style={{ borderTopColor: property.primary_color, borderTopWidth: 2 }}>
          <h3 className="text-[13px] font-medium text-gray-900 flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-gray-400" />
            ROI de la inversión
          </h3>
          <div className="grid grid-cols-1 gap-2">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-[10px] text-gray-400 mb-1">Facturación atribuible</div>
              <div className="text-lg font-medium text-gray-900">{formatCOP(report.attributable_revenue || 0)}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-[10px] text-gray-400 mb-1">Inversión total</div>
              <div className="text-lg font-medium text-gray-900">{formatCOP(report.total_investment || 0)}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-[10px] text-gray-400 mb-1">ROAS</div>
              <div className="text-lg font-medium" style={{ color: property.primary_color }}>{formatROAS(report.roas || 0)}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-[10px] text-gray-400 mb-1">Fee de éxito ({property.success_fee_pct}%)</div>
              <div className="text-lg font-medium text-gray-900">{formatCOP(successFee)}</div>
            </div>
          </div>
          <div className="mt-3 text-[10px] text-gray-400 text-center">
            Por cada $1 invertido en marketing → se generaron ${((report.attributable_revenue || 0) / (report.total_investment || 1)).toFixed(1)} en ventas
          </div>
        </div>
      </div>
    </div>
  )
}

/* Channel breakdown */
export function ChannelBreakdown({ report, property }: InsightsPanelProps) {
  const campaigns = report.campaign_breakdown || []

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Investment by channel */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <h3 className="text-[13px] font-medium text-gray-900 mb-4">Inversión por canal</h3>
        <div className="space-y-3">
          {[
            { name: 'Google Ads', value: report.google_investment || 0, color: '#3b82f6', sub: `${(report.total_clicks || 0).toLocaleString()} clics · CPC ${formatCOP(report.avg_cpc || 0)}` },
            { name: 'Meta Ads', value: report.meta_investment || 0, color: '#6366f1', sub: `${(report.total_impressions || 0).toLocaleString()} impresiones` },
            { name: 'Contenido', value: report.content_investment || 0, color: '#f59e0b', sub: '5 reels · 3 carruseles' },
            { name: 'Honorarios', value: report.fees_investment || 0, color: '#94a3b8', sub: 'Fee gestión + éxito' },
          ].map((ch) => (
            <div key={ch.name} className="flex items-center gap-3">
              <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ background: ch.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-gray-800">{ch.name}</span>
                  <span className="text-[13px] font-medium text-gray-900">{formatCOP(ch.value)}</span>
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">{ch.sub}</div>
                <div className="h-1 bg-gray-100 rounded-full mt-1.5">
                  <div className="h-1 rounded-full" style={{ width: `${(ch.value / (report.total_investment || 1)) * 100}%`, background: ch.color }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ROAS by campaign */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <h3 className="text-[13px] font-medium text-gray-900 mb-4">ROAS por campaña Google</h3>
        <div className="space-y-4">
          {campaigns.map((c) => {
            const maxROAS = Math.max(...campaigns.map(x => x.roas), 1)
            return (
              <div key={c.campaign_name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] text-gray-600">{c.campaign_name}</span>
                  <span className="text-[13px] font-medium" style={{ color: property.primary_color }}>{formatROAS(c.roas)}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full">
                  <div
                    className="h-2 rounded-full"
                    style={{ width: `${(c.roas / maxROAS) * 100}%`, background: property.primary_color }}
                  />
                </div>
                <div className="flex gap-3 mt-1 text-[10px] text-gray-400">
                  <span>{formatCOP(c.investment)}</span>
                  <span>·</span>
                  <span>{c.clicks.toLocaleString()} clics</span>
                  <span>·</span>
                  <span>CPC {formatCOP(c.cpc)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
