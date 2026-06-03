// Fuente UNICA de verdad para las metricas derivadas del canal directo.
// ROAS y % de coste se calculan SIEMPRE con estas funciones, en todo el tablero
// y en las conclusiones IA. NO duplicar estas formulas en ningun otro lado.

/** ROAS = facturacion atribuible / inversion. Redondeado a 2 decimales. */
export function roasFrom(attrRevenue: number, investment: number): number {
  return investment > 0 ? Math.round((attrRevenue / investment) * 100) / 100 : 0
}

/** Coste publicitario como % de la facturacion atribuible. Redondeado a 2 decimales. */
export function adCostPctFrom(attrRevenue: number, investment: number): number {
  return attrRevenue > 0 ? Math.round((investment / attrRevenue) * 10000) / 100 : 0
}
