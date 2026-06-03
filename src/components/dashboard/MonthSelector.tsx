const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// Selector de mes. Usa <a> normal (navegación dura): recarga la página completa
// contra el servidor con el mes elegido. Sin caché de cliente ni soft-nav, así
// que la data SIEMPRE se refresca. Es a prueba de balas (un hipervínculo).
export function MonthSelector({ year, upTo, selected }: { year: number; upTo: number; selected: number }) {
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      {Array.from({ length: upTo }, (_, i) => i + 1).map((m) => {
        const active = selected === m
        return (
          
            key={m}
            href={`/dashboard?y=${year}&m=${m}`}
            className={`px-3 py-1 rounded-md text-[12px] cursor-pointer transition-all ${
              active
                ? 'bg-white text-gray-900 font-medium shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {MONTHS_ES[m - 1]}
          </a>
        )
      })}
    </div>
  )
}
