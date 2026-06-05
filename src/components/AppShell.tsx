'use client'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import MobileNav from './MobileNav'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const hideSidebar = pathname === '/ventas'

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#070c14', overflow: 'hidden' }}>
      {!hideSidebar && <Sidebar />}
      <main className="app-main" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
      <MobileNav />
    </div>
  )
}
