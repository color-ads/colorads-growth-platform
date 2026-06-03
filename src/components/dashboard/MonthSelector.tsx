'use client'
import { useRouter } from 'next/navigation'

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// Selector de mes. Navega a /dashboard?y=&m= y fuerza el refetch del server
// (router.refresh) para que la data del mes elegido se recargue de verdad.
export function MonthSelector({ year, upTo, selected }: { year: number; upTo: number; selected: number }) {
  const router = useRouter()
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      {Array.from({ length: upTo }, (_, i) => i + 1).map((m) => {
        const active = selected === m
        return (
          <button
            key={m}
            type="button"
            onClick={() => {
              router.push(`/dashboard?y=${year}&m=${m}`)
              router.refresh()
            }}
            className={`px-3 py-1 rounded-md text-[12px] cursor-pointer transition-all ${
              active
                ? 'bg-white text-gray-900 font-medium shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {MONTHS_ES[m - 1]}
          </button>
        )
      })}
    </div>
  )
}
