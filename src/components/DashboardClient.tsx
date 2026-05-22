'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Settings, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ContactCard from './ContactCard'
import type { Contact, ContactStatus } from '@/lib/types'

const TABS: { key: ContactStatus | 'all'; label: string }[] = [
  { key: 'nuevo', label: 'Nuevos' },
  { key: 'caliente', label: 'Calientes' },
  { key: 'verificar_pago', label: 'Verificar' },
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
        // Sonido de notificación
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

    // Auto-sync Google Sheets cada 5 minutos
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#0f172a' }}>
      {/* Header */}
      <div style={{ padding: '1rem 1rem 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f97316' }}>📦 Maidana CRM</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={refreshContacts}
            style={{ padding: '0.5rem', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
          >
            <RefreshCw size={18} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button
            onClick={() => router.push('/settings')}
            style={{ padding: '0.5rem', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '0.75rem 1rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por número o nombre..."
            style={{
              width: '100%', padding: '0.625rem 0.75rem 0.625rem 2.25rem',
              background: '#1e293b', border: '1px solid #334155',
              borderRadius: '0.5rem', color: '#f8fafc', fontSize: '0.875rem', outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', overflowX: 'auto', padding: '0 1rem',
        gap: '0.375rem', scrollbarWidth: 'none', flexShrink: 0,
      }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flexShrink: 0,
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              border: activeTab === tab.key ? '1px solid #f97316' : '1px solid #334155',
              background: activeTab === tab.key ? 'rgba(249, 115, 22, 0.15)' : 'transparent',
              color: activeTab === tab.key ? '#f97316' : '#94a3b8',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
            }}
          >
            {tab.label}
            {counts[tab.key] > 0 && (
              <span style={{
                background: activeTab === tab.key ? '#f97316' : '#334155',
                color: activeTab === tab.key ? '#fff' : '#94a3b8',
                borderRadius: '999px',
                padding: '0 0.375rem',
                fontSize: '0.7rem',
                fontWeight: 700,
                minWidth: '1.25rem',
                textAlign: 'center',
              }}>
                {counts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Contacts list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#64748b', padding: '3rem 0', fontSize: '0.875rem' }}>
            {search ? 'Sin resultados' : 'No hay contactos en esta categoría'}
          </div>
        ) : (
          filtered.map(contact => (
            <ContactCard key={contact.id} contact={contact} />
          ))
        )}
      </div>

      <BottomNav active="clientes" />
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

function BottomNav({ active }: { active: 'clientes' | 'ventas' }) {
  const router = useRouter()
  return (
    <div style={{ background: '#1e293b', borderTop: '1px solid #334155', display: 'flex', flexShrink: 0 }}>
      {[
        { key: 'clientes', label: '📋 Clientes', path: '/' },
        { key: 'ventas', label: '💰 Ventas', path: '/ventas' },
      ].map(item => (
        <button
          key={item.key}
          onClick={() => router.push(item.path)}
          style={{
            flex: 1, padding: '0.75rem',
            background: 'none', border: 'none',
            color: active === item.key ? '#f97316' : '#94a3b8',
            fontSize: '0.8rem', fontWeight: active === item.key ? 700 : 400,
            cursor: 'pointer', borderTop: active === item.key ? '2px solid #f97316' : '2px solid transparent',
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
