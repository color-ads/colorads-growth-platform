import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ColorADS Growth Platform',
  description: 'Growth marketing platform for hotels',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
