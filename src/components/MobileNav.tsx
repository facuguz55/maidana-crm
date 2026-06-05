'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { TrendingUp, BarChart2, MessageSquare, Settings } from 'lucide-react'

const NAV = [
  { href: '/ventas', label: 'Ventas', icon: TrendingUp },
  { href: '/analisis', label: 'Análisis', icon: BarChart2 },
  { href: '/chat', label: 'IA', icon: MessageSquare },
  { href: '/settings', label: 'Config', icon: Settings },
]

export default function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="mobile-nav">
      {NAV.map(item => {
        const active = pathname === item.href || (item.href !== '/ventas' && pathname.startsWith(item.href))
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={true}
            className="mobile-nav-item"
            style={{ color: active ? '#f97316' : '#64748b' }}
          >
            <Icon size={22} strokeWidth={active ? 2.5 : 1.75} />
            <span style={{ fontSize: '10px', fontWeight: active ? 700 : 400, marginTop: '2px' }}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
