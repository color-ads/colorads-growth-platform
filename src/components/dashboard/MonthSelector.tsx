const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// Selector de mes con <a> (navegacion dura): recarga la pagina completa contra el
// servidor con el mes elegido. Sin cache de cliente ni soft-nav, data siempre fresca.
export function MonthSelector({ year, upTo, selected, tab }: { year: number; upTo: number; selected: number; tab?: string }) {
  const tabQs = tab ? `&tab=${encodeURIComponent(tab)}` : ''
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      {Array.from({ length: upTo }, (_, i) => i + 1).map((m) => {
        const active = selected === m
        const cls = active ? 'bg-white text-gray-900 font-medium shadow-sm' : 'text-gray-500 hover:text-gray-700'
        return (
          <a key={m} href={`/dashboard?y=${year}&m=${m}${tabQs}`} className={`px-3 py-1 rounded-md text-[12px] cursor-pointer transition-all ${cls}`}>{MONTHS_ES[m - 1]}</a>
        )
      })}
    </div>
  )
}
