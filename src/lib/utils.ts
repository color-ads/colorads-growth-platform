import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCOP(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

export function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString('es-CO')
}

export function formatPct(value: number): string {
  return `${value.toFixed(1)}%`
}

export function formatROAS(value: number): string {
  return `${value.toFixed(1)}×`
}

export function monthName(month: number, year: number): string {
  return new Date(year, month - 1).toLocaleDateString('es-CO', {
    month: 'short',
    year: '2-digit'
  })
}

export function getDeltaColor(delta: number): string {
  if (delta > 0) return 'text-green-600'
  if (delta < 0) return 'text-red-500'
  return 'text-gray-400'
}

export function getDeltaIcon(delta: number): string {
  if (delta > 0) return '↑'
  if (delta < 0) return '↓'
  return '→'
}

export function calcSuccessFee(revenue: number, feePct: number): number {
  return (revenue * feePct) / 100
}

export function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#0f172a' : '#ffffff'
}
