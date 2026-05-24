'use client'
import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react'
import { Search, RefreshCw, Users, Calendar } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ContactRow from './ContactRow'
import type { Contact, ContactStatus } from '@/lib/types'

type TabKey = ContactStatus | 'all' | 'agendado'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'nuevo', label: 'General' },
  { key: 'caliente', label: 'Calientes' },
  { key: 'pagado', label: 'Pagados' },
  { key: 'frio', label: 'Fríos' },
  { key: 'agendado', label: 'Agendados' },
]

const SCROLL_KEY = 'crm_scroll_pos'

type ExtContact = Contact & { unread?: boolean }

function sorted(list: ExtContact[]): ExtContact[] {
  return [...list].sort((a, b) => {
    const au = a.unread ? 1 : 0
    const bu = b.unread ? 1 : 0
    if (bu !== au) return bu - au
    return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
  })
}

interface Props { initialContacts: Contact[] }

export default function DashboardClient({ initialContacts }: Props) {
  // Único source of truth — el orden se deriva siempre desde acá
  const [contactMap, setContactMap] = useState<Record<string, ExtContact>>(() => {
    const m: Record<string, ExtContact> = {}
    for (const c of initialContacts) m[c.id] = c as ExtContact
    return m
  })

  const [activeTab, setActiveTab] = useState<TabKey>('nuevo')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const locallyRead = useRef<Set<string>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)

  // Restaurar scroll + locallyRead antes del primer paint — sin flash visible
  useLayoutEffect(() => {
    const saved = sessionStorage.getItem(SCROLL_KEY)
    if (saved && scrollRef.current) {
      scrollRef.current.scrollTop = parseInt(saved)
    }
    try {
      const stored = sessionStorage.getItem('crm_locally_read')
      if (stored) {
        const ids: string[] = JSON.parse(stored)
        if (ids.length > 0) {
          ids.forEach(id => locallyRead.current.add(id))
          setContactMap(prev => {
            const next = { ...prev }
            for (const id of ids) {
              if (next[id]) next[id] = { ...next[id], unread: false }
            }
            return next
          })
        }
      }
    } catch {}
  }, [])

  const applyLocallyRead = useCallback((list: ExtContact[]): ExtContact[] =>
    list.map(c => locallyRead.current.has(c.id) ? { ...c, unread: false } : c)
  , [])

  const refreshContacts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('contacts').select('*').order('last_message_at', { ascending: false })
    if (data) {
      const withRead = applyLocallyRead(data as ExtContact[])
      setContactMap(() => {
        const m: Record<string, ExtContact> = {}
        for (const c of withRead) m[c.id] = c
        return m
      })
    }
    if (!silent) setLoading(false)
  }, [applyLocallyRead])

  // Refresh silencioso al montar — garantiza datos frescos al volver de un chat
  useEffect(() => {
    refreshContacts(true)
  }, [refreshContacts])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('contacts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, (payload) => {
        refreshContacts(true)
        const isNewMessage = (payload.new as { unread?: boolean })?.unread === true
        if (isNewMessage) {
          try {
            const ctx = new AudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain()
            osc.connect(gain); gain.connect(ctx.destination); osc.frequency.value = 520
            gain.gain.setValueAtTime(0.1, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
            osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3)
          } catch {}
        }
      }).subscribe()
    const syncInterval = setInterval(() => { fetch('/api/sync-sheets', { method: 'POST' }).catch(() => {}) }, 5 * 60 * 1000)
    fetch('/api/sync-sheets', { method: 'POST' }).catch(() => {})
    return () => { supabase.removeChannel(channel); clearInterval(syncInterval) }
  }, [refreshContacts])

  function handleMarkRead(id: string) {
    if (scrollRef.current) {
      sessionStorage.setItem(SCROLL_KEY, String(scrollRef.current.scrollTop))
    }
    locallyRead.current.add(id)
    try {
      sessionStorage.setItem('crm_locally_read', JSON.stringify([...locallyRead.current]))
    } catch {}
    // Marca como leído — el useMemo re-ordena automáticamente
    setContactMap(prev => ({ ...prev, [id]: { ...prev[id], unread: false } }))
    fetch('/api/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId: id }),
    }).catch(() => {})
  }

  // Orden siempre derivado del mapa: no leídos primero, luego por fecha
  const contacts = useMemo(() => sorted(Object.values(contactMap)), [contactMap])

  const unreadCount = useMemo(() => contacts.filter(c => c.unread).length, [contacts])

  const filtered = useMemo(() => {
    let list = contacts.filter(c => {
      if (activeTab === 'all') return true
      if (activeTab === 'agendado') return c.scheduled === true
      return c.status === activeTab
    })
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.phone.includes(q) ||
        (c.name?.toLowerCase().includes(q) ?? false) ||
        (c.last_message_preview?.toLowerCase().includes(q) ?? false)
      )
    }
    return list
  }, [contacts, activeTab, search])

  const tabCounts = useMemo(() => {
    const m: Record<string, number> = {}
    const u: Record<string, number> = {}
    for (const tab of TABS) {
      if (tab.key === 'agendado') {
        m[tab.key] = contacts.filter(c => c.scheduled === true).length
        u[tab.key] = contacts.filter(c => c.scheduled === true && c.unread).length
      } else {
        m[tab.key] = contacts.filter(c => c.status === tab.key).length
        u[tab.key] = contacts.filter(c => c.status === tab.key && c.unread).length
      }
    }
    return { counts: m, unread: u }
  }, [contacts])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid #1e2d45', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '17px', fontWeight: 700, color: '#f8fafc' }}>Contactos</h1>
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '1px' }}>{contacts.length} en total</p>
          </div>
          {unreadCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '999px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f97316' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#f97316' }}>{unreadCount} sin leer</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar número o mensaje..."
              style={{ paddingLeft: '36px', paddingRight: '16px', paddingTop: '8px', paddingBottom: '8px', background: '#1e293b', border: '1px solid #1e2d45', borderRadius: '8px', color: '#f8fafc', fontSize: '13px', outline: 'none', width: '280px' }}
            />
          </div>
          <button
            onClick={() => refreshContacts(false)}
            style={{ padding: '8px', background: '#1e293b', border: '1px solid #1e2d45', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}
          >
            <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2px', padding: '8px 24px', borderBottom: '1px solid #1e2d45', flexShrink: 0 }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.key
          const count = tabCounts.counts[tab.key]
          const u = tabCounts.unread[tab.key]
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '7px', fontSize: '13px', fontWeight: isActive ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s', background: isActive ? 'rgba(249,115,22,0.12)' : 'transparent', border: isActive ? '1px solid rgba(249,115,22,0.35)' : '1px solid transparent', color: isActive ? '#f97316' : '#64748b' }}
            >
              {tab.label}
              {count > 0 && (
                <span style={{ background: isActive ? '#f97316' : '#1e293b', color: isActive ? '#fff' : '#64748b', borderRadius: '999px', padding: '1px 6px', fontSize: '11px', fontWeight: 700 }}>
                  {count}
                </span>
              )}
              {u > 0 && !isActive && (
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f97316', display: 'inline-block' }} />
              )}
            </button>
          )
        })}
      </div>

      {/* Lista */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '12px' }}>
            <Users size={28} color="#334155" />
            <p style={{ color: '#64748b', fontSize: '14px' }}>
              {search ? `Sin resultados para "${search}"` : 'No hay contactos aquí'}
            </p>
          </div>
        ) : (
          filtered.map(contact => (
            <ContactRow key={contact.id} contact={contact} onMarkRead={handleMarkRead} />
          ))
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
