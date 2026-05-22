import Sidebar from '@/components/Sidebar'
import MobileNav from '@/components/MobileNav'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0f172a', overflow: 'hidden' }}>
      <Sidebar />
      <main className="app-main" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
      <MobileNav />
    </div>
  )
}
