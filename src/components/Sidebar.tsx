'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Package, Users, TrendingUp, Settings, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/', label: 'Clientes', icon: Users },
  { href: '/ventas', label: 'Ventas', icon: TrendingUp },
  { href: '/settings', label: 'Configuración', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside style={{
      width: '220px', flexShrink: 0,
      background: '#0d1526', borderRight: '1px solid #1e2d45',
      display: 'flex', flexDirection: 'column', height: '100vh',
      position: 'sticky', top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid #1e2d45' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Package size={18} color="#f97316" />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>Maidana</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>CRM</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px' }}>
        {NAV.map(item => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 12px', borderRadius: '8px', marginBottom: '2px',
                textDecoration: 'none', fontSize: '13px', fontWeight: active ? 600 : 400,
                background: active ? 'rgba(249,115,22,0.1)' : 'transparent',
                color: active ? '#f97316' : '#94a3b8',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLAnchorElement).style.color = '#f8fafc' } }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = '#94a3b8' } }}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid #1e2d45' }}>
        <button
          onClick={handleLogout}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
            padding: '9px 12px', borderRadius: '8px', border: 'none',
            background: 'transparent', color: '#64748b', fontSize: '13px', cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)'; (e.currentTarget as HTMLButtonElement).style.color = '#ef4444' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#64748b' }}
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
