import { MOCK_PROPERTY, MOCK_CURRENT_REPORT, MOCK_HISTORICAL } from '@/lib/mock-data'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { KPIStrip } from '@/components/dashboard/KPIStrip'
import { HistoricalCharts } from '@/components/dashboard/HistoricalCharts'
import { DemographicProfile } from '@/components/dashboard/DemographicProfile'
import { InsightsPanel, ChannelBreakdown } from '@/components/dashboard/InsightsPanel'
import { MonthlyReport } from '@/types'

export default function DashboardPage() {
  const property = MOCK_PROPERTY
  const currentReport = MOCK_CURRENT_REPORT as Partial<MonthlyReport>
  const historical = MOCK_HISTORICAL as Partial<MonthlyReport>[]
  const prevReport = historical[historical.length - 2]

  const currentMonth = 4
  const currentYear = 2026

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar property={property} alertCount={2} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-base font-medium text-gray-900">
                Informe de gestión Venta Directa · <span style={{ color: property.primary_color }}>H98</span>
              </h1>
              <p className="text-[11px] text-gray-400">Abril 2026 · El Poblado, Medellín</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Month selector */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {[{m:1,l:'ene'},{m:2,l:'feb'},{m:3,l:'mar'},{m:4,l:'abr'}].map(({m,l}) => (
                <div
                  key={m}
                  className={`px-3 py-1 rounded-md text-[12px] cursor-pointer transition-all ${m === currentMonth ? 'bg-white text-gray-900 font-medium shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {l}
                </div>
              ))}
            </div>
            {/* API status */}
            <div className="flex items-center gap-1.5 text-[11px] text-green-600 bg-green-50 border border-green-100 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              APIs activas
            </div>
            {/* colorADS brand */}
            <div className="flex items-center gap-1 text-[12px] border border-gray-200 px-2.5 py-1 rounded-lg">
              <span className="text-gray-400">color</span>
              <span className="font-medium text-gray-700">ADS</span>
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* KPI Strip */}
          <KPIStrip
            report={currentReport}
            prevReport={prevReport}
            property={property}
          />

          <div className="p-6 space-y-6">
            {/* Historical charts */}
            <HistoricalCharts
              reports={historical}
              property={property}
            />

            {/* Channel breakdown */}
            <ChannelBreakdown
              report={currentReport}
              property={property}
            />

            {/* Demographics */}
            <DemographicProfile
              report={currentReport}
              historicalReports={historical}
              property={property}
            />

            {/* Insights + Milestones + ROI */}
            <InsightsPanel
              report={currentReport}
              property={property}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
