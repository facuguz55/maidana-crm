'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Settings, RefreshCw, Package, Users, TrendingUp } from 'lucide-react'
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

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-950 overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
            <Package size={15} className="text-orange-500" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100 leading-none">Maidana CRM</h1>
            <p className="text-[10px] text-slate-500 mt-0.5">{contacts.length} contactos</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={refreshContacts}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all active:scale-95"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => router.push('/settings')}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all active:scale-95"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3 flex-shrink-0">
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por número o nombre..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-sm placeholder:text-slate-600 outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all"
          />
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-2 px-4 pb-3 overflow-x-auto flex-shrink-0"
        style={{ scrollbarWidth: 'none' }}
      >
        {TABS.map(tab => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all duration-150 ${
                isActive
                  ? 'bg-orange-500/15 border-orange-500/40 text-orange-400'
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'
              }`}
            >
              {tab.label}
              {counts[tab.key] > 0 && (
                <span
                  className={`rounded-full px-1.5 py-px text-[10px] font-bold leading-none ${
                    isActive ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {counts[tab.key]}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Contact list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2.5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
              <Users size={22} className="text-slate-600" />
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">
                {search ? 'Sin resultados' : 'Esta categoría está vacía'}
              </p>
              {search && (
                <p className="text-slate-600 text-xs mt-1">&quot;{search}&quot; no encontrado</p>
              )}
            </div>
          </div>
        ) : (
          filtered.map(contact => (
            <ContactCard key={contact.id} contact={contact} />
          ))
        )}
      </div>

      <BottomNav active="clientes" />
    </div>
  )
}

function BottomNav({ active }: { active: 'clientes' | 'ventas' }) {
  const router = useRouter()
  const items = [
    { key: 'clientes' as const, label: 'Clientes', icon: Users, path: '/' },
    { key: 'ventas' as const, label: 'Ventas', icon: TrendingUp, path: '/ventas' },
  ]
  return (
    <div className="flex-shrink-0 bg-slate-900 border-t border-slate-800">
      <div className="flex">
        {items.map(item => {
          const Icon = item.icon
          const isActive = active === item.key
          return (
            <button
              key={item.key}
              onClick={() => router.push(item.path)}
              className={`relative flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
                isActive ? 'text-orange-500' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-orange-500 rounded-b-full" />
              )}
              <Icon size={18} strokeWidth={isActive ? 2.5 : 1.75} />
              <span className="text-[10px] font-semibold tracking-wide">{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
