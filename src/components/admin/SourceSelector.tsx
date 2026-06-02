'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { formatCOP } from '@/lib/utils'

const SLUG = 'h98'

interface SourceRow {
  year: number; month: number; source: string; category: string
  stay_revenue: number; booking_volume: number; booking_count: number
}

export function SourceSelector() {
  const [rows, setRows] = useState<SourceRow[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/sources?slug=${SLUG}`)
      const d = await res.json()
      setRows(d.rows ?? [])
      setSelected(new Set(d.attributable ?? []))
    } catch {}
    setLoaded(true)
  }, [])
  useEffect(() => { load() }, [load])

  // distinct sources w/ category + lifetime stay totals
  const sources = useMemo(() => {
    const map = new Map<string, { category: string; stay: number }>()
    for (const r of rows) {
      const cur = map.get(r.source) ?? { category: r.category || 'Direct', stay: 0 }
      cur.stay += r.stay_revenue
      if (r.category && r.category !== '-') cur.category = r.category
      map.set(r.source, cur)
    }
    return [...map.entries()].map(([source, d]) => ({ source, ...d })).sort((a, b) => b.stay - a.stay)
  }, [rows])

  const direct = sources.filter(s => s.category !== 'OTA')
  const ota = sources.filter(s => s.category === 'OTA')

  // live preview: attributable share of lifetime facturación
  const totals = useMemo(() => {
    let attr = 0, all = 0
    for (const s of sources) { all += s.stay; if (selected.has(s.source)) attr += s.stay }
    return { attr, all, pct: all > 0 ? Math.round((attr / all) * 1000) / 10 : 0 }
  }, [sources, selected])

  function toggle(src: string) {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(src) ? n.delete(src) : n.add(src)
      return n
    })
    setMsg('')
  }
  function setGroup(list: { source: string }[], on: boolean) {
    setSelected(prev => {
      const n = new Set(prev)
      list.forEach(s => (on ? n.add(s.source) : n.delete(s.source)))
      return n
    })
    setMsg('')
  }

  async function save() {
    setSaving(true); setMsg('')
    try {
      const res = await fetch('/api/admin/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: SLUG, sources: [...selected] }),
      })
      const d = await res.json()
      if (res.ok) { setMsg('Guardado ✓'); await load() }
      else setMsg(d.error || 'Error al guardar')
    } catch {
      setMsg('Error de red')
    }
    setSaving(false)
  }

  const Row = ({ s }: { s: { source: string; category: string; stay: number } }) => (
    <label className="flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-50 cursor-pointer text-[12px]">
      <input type="checkbox" checked={selected.has(s.source)} onChange={() => toggle(s.source)} className="rounded border-gray-300" />
      <span className="flex-1 text-gray-700 truncate">{s.source}</span>
      <span className="text-gray-400 tabular-nums">{formatCOP(s.stay)}</span>
    </label>
  )

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 mt-5">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h3 className="text-[13px] font-medium text-gray-900 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            Fuentes atribuibles
          </h3>
          <p className="text-[11px] text-gray-400 mt-0.5">Define qué canales cuentan como marketing. Afecta facturación atribuible y ROAS del dashboard.</p>
        </div>
        <span className="text-[11px] text-gray-400">{selected.size} seleccionadas</span>
      </div>

      {!loaded ? (
        <div className="py-8 text-center text-[12px] text-gray-400">Cargando fuentes…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Directo</span>
                <div className="flex gap-2 text-[11px]">
                  <button onClick={() => setGroup(direct, true)} className="text-gray-500 hover:text-gray-900">Todo</button>
                  <button onClick={() => setGroup(direct, false)} className="text-gray-500 hover:text-gray-900">Nada</button>
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto">{direct.map(s => <Row key={s.source} s={s} />)}</div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">OTA</span>
                <div className="flex gap-2 text-[11px]">
                  <button onClick={() => setGroup(ota, true)} className="text-gray-500 hover:text-gray-900">Todo</button>
                  <button onClick={() => setGroup(ota, false)} className="text-gray-500 hover:text-gray-900">Nada</button>
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto">{ota.map(s => <Row key={s.source} s={s} />)}</div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
            <span className="text-[11px] text-gray-400">
              Atribuible: <span className="font-medium text-gray-700">{formatCOP(totals.attr)}</span> de {formatCOP(totals.all)} ({totals.pct}%) · histórico total
            </span>
            <div className="flex items-center gap-3">
              {msg && <span className={`text-[12px] ${msg.includes('✓') ? 'text-green-600' : 'text-red-500'}`}>{msg}</span>}
              <button onClick={save} disabled={saving}
                className="px-4 py-1.5 rounded-lg text-[12px] font-medium text-white disabled:opacity-50"
                style={{ background: '#1a1a1a' }}>
                {saving ? 'Guardando…' : 'Guardar selección'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
