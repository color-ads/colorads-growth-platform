'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Property } from '@/types'

interface SidebarProps {
  property: Property
}

// Solo se listan secciones con pagina real. Los destinos que aun no existen
// no se muestran para evitar links rotos (404) en el tablero del cliente.
const navItems = [
  { label: 'Reportes', items: [
    { href: '/dashboard', label: 'Performance', icon: LayoutDashboard },
  ]},
]

export function Sidebar({ property }: SidebarProps) {
  const pathname = usePathname()
  const primaryColor = property.primary_color || '#0ea5e9'

  return (
    <aside className="w-[220px] min-w-[220px] bg-white border-r border-gray-100 flex flex-col h-screen sticky top-0">
      {/* Brand */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
            style={{ background: property.secondary_color || '#0f172a' }}
          >
            {property.logo_url
              ? <img src={property.logo_url} alt={property.name} className="w-full h-full object-cover rounded-lg" />
              : property.name.slice(0, 3).toUpperCase()
            }
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">{property.name}</div>
            <div className="text-[11px] text-gray-400 truncate">{property.location}</div>
          </div>
        </div>
        <div className="mt-2 text-[10px] text-gray-300">
          powered by <span className="text-gray-400 font-medium">colorADS</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navItems.map((group) => (
          <div key={group.label} className="mb-1">
            <div className="px-4 py-1.5 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
              {group.label}
            </div>
            {group.items.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 px-4 py-2 text-[13px] transition-colors relative',
                    isActive
                      ? 'text-white font-medium'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  )}
                  style={isActive ? { background: primaryColor } : {}}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{item.label}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}
