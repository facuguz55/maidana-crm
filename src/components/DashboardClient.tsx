'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Settings, RefreshCw, Package, Users, TrendingUp, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ContactCard from './ContactCard'
import type { Contact, ContactStatus } from '@/lib/types'

const TABS: { key: ContactStatus | 'all'; label: string }[] = [
  { key: 'nuevo', label: 'Nuevos' },
  { key: 'caliente', label: 'Calientes' },
  { key: 'verificar_pago', label: 'Verificar pago' },
  { key: 'pagado', label: 'Pagados' },
  { key: 'frio', label: 'Fríos' },
]

interface Props {
  initialContacts: Contact[]
}

export default function DashboardClient({ initialContacts }: Props) {
  const router = useRouter()
  const [contacts, setContacts] = useState<Contact[]>(initialContacts)
  const [activeTab, setActiveTab] = useState<ContactStatus | 'all'>('nuevo')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const refreshContacts = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .order('last_message_at', { ascending: false })
    if (data) setContacts(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('contacts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => {
        refreshContacts()
        try {
          const ctx = new AudioContext()
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.frequency.value = 520
          gain.gain.setValueAtTime(0.1, ctx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
          osc.start(ctx.currentTime)
          osc.stop(ctx.currentTime + 0.3)
        } catch {}
      })
      .subscribe()

    const syncInterval = setInterval(() => {
      fetch('/api/sync-sheets', { method: 'POST' }).catch(() => {})
    }, 5 * 60 * 1000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(syncInterval)
    }
  }, [refreshContacts])

  const counts: Record<string, number> = {}
  for (const tab of TABS) {
    counts[tab.key] = contacts.filter(c => tab.key === 'all' ? true : c.status === tab.key).length
  }

  const filtered = contacts
    .filter(c => activeTab === 'all' ? true : c.status === activeTab)
    .filter(c => {
      if (!search) return true
      const q = search.toLowerCase()
      return c.phone.includes(q) || (c.name?.toLowerCase().includes(q) ?? false)
    })

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0f172a' }}>
      {/* Sidebar */}
      <aside style={{
        width: '220px', flexShrink: 0,
        background: '#0d1526',
        borderRight: '1px solid #1e2d45',
        display: 'flex', flexDirection: 'column',
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
          <NavItem icon={Users} label="Clientes" active onClick={() => router.push('/')} />
          <NavItem icon={TrendingUp} label="Ventas" onClick={() => router.push('/ventas')} />
          <NavItem icon={Settings} label="Configuración" onClick={() => router.push('/settings')} />
        </nav>

        {/* Bottom */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid #1e2d45' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
              padding: '9px 12px', borderRadius: '8px', border: 'none',
              background: 'transparent', color: '#64748b', fontSize: '13px',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)'; (e.currentTarget as HTMLButtonElement).style.color = '#ef4444' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#64748b' }}
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <div style={{
          padding: '16px 24px', borderBottom: '1px solid #1e2d45',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#0f172a', flexShrink: 0,
        }}>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>Contactos</h1>
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              {contacts.length} contactos en total
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar contacto..."
                style={{
                  paddingLeft: '36px', paddingRight: '16px', paddingTop: '8px', paddingBottom: '8px',
                  background: '#1e293b', border: '1px solid #1e2d45',
                  borderRadius: '8px', color: '#f8fafc', fontSize: '13px',
                  outline: 'none', width: '260px',
                }}
              />
            </div>
            <button
              onClick={refreshContacts}
              style={{
                padding: '8px', background: '#1e293b', border: '1px solid #1e2d45',
                borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', display: 'flex',
              }}
            >
              <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: '4px', padding: '12px 24px',
          borderBottom: '1px solid #1e2d45', background: '#0f172a', flexShrink: 0,
        }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 14px', borderRadius: '7px', fontSize: '13px', fontWeight: 500,
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: isActive ? 'rgba(249,115,22,0.12)' : 'transparent',
                  border: isActive ? '1px solid rgba(249,115,22,0.35)' : '1px solid transparent',
                  color: isActive ? '#f97316' : '#64748b',
                }}
              >
                {tab.label}
                {counts[tab.key] > 0 && (
                  <span style={{
                    background: isActive ? '#f97316' : '#1e293b',
                    color: isActive ? '#fff' : '#64748b',
                    borderRadius: '999px', padding: '1px 7px',
                    fontSize: '11px', fontWeight: 700,
                  }}>
                    {counts[tab.key]}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Contact grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {filtered.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '12px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: '#1e293b', border: '1px solid #1e2d45', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={22} color="#475569" />
              </div>
              <p style={{ color: '#64748b', fontSize: '14px' }}>
                {search ? `Sin resultados para "${search}"` : 'No hay contactos en esta categoría'}
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '12px',
            }}>
              {filtered.map(contact => (
                <ContactCard key={contact.id} contact={contact} />
              ))}
            </div>
          )}
        </div>
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function NavItem({ icon: Icon, label, active, onClick }: {
  icon: React.ElementType
  label: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
        padding: '9px 12px', borderRadius: '8px', marginBottom: '2px',
        border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: active ? 600 : 400,
        background: active ? 'rgba(249,115,22,0.1)' : 'transparent',
        color: active ? '#f97316' : '#94a3b8',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLButtonElement).style.color = '#f8fafc' } }}
      onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8' } }}
    >
      <Icon size={16} />
      {label}
    </button>
  )
}
