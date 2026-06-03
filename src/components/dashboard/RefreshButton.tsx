'use client'

import { useState } from 'react'

// Boton "Actualizar": recalcula el mes que se esta viendo (pega a Cloudbeds via
// /api/cloudbeds/sync, que reescribe la cache) y recarga para leer el dato fresco.
export function RefreshButton({ year, month }: { year: number; month: number }) {
  const [loading, setLoading] = useState(false)

  async function refresh() {
    if (loading) return
    setLoading(true)
    try {
      await fetch(`/api/cloudbeds/sync?slug=h98&year=${year}&month=${month}`, { cache: 'no-store' })
    } catch {}
    window.location.reload()
  }

  return (
    <button
      onClick={refresh}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-60 transition-all"
    >
      {loading ? <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" /> : null}
      {loading ? 'Actualizando...' : 'Actualizar'}
    </button>
  )
}
