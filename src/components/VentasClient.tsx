'use client'
import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Download, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { updateOrderStatus } from '@/app/actions'
import { createClient } from '@/lib/supabase/client'
import type { Order, OrderStatus } from '@/lib/types'

const ORDER_STATUS_NEXT: Record<OrderStatus, OrderStatus> = {
  pendiente: 'verificado',
  verificado: 'enviado',
  enviado: 'pendiente',
}

const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  pendiente: '#f59e0b',
  verificado: '#3b82f6',
  enviado: '#22c55e',
}

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pendiente: 'Pendiente',
  verificado: 'Verificado',
  enviado: 'Enviado',
}

const FILTERS: { key: OrderStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'pendiente', label: 'Pendiente' },
  { key: 'verificado', label: 'Verificado' },
  { key: 'enviado', label: 'Enviado' },
]

interface Props { initialOrders: Order[] }

export default function VentasClient({ initialOrders }: Props) {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()
  const [syncing, setSyncing] = useState(false)

  // Auto-sync Google Sheets cada 5 minutos
  useEffect(() => {
    const sync = () => fetch('/api/sync-sheets', { method: 'POST' })
      .then(r => r.json())
      .then(d => { if (d.synced > 0) refreshOrders() })
      .catch(() => {})
    const interval = setInterval(sync, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  async function refreshOrders() {
    const supabase = createClient()
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
    if (data) setOrders(data as Order[])
  }

  async function handleSyncNow() {
    setSyncing(true)
    try {
      const res = await fetch('/api/sync-sheets', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        toast.success(`${data.synced} registros sincronizados`)
        await refreshOrders()
      } else {
        toast.error(data.error || 'Error al sincronizar')
      }
    } catch {
      toast.error('Error de red')
    } finally {
      setSyncing(false)
    }
  }

  async function handleStatusToggle(order: Order) {
    const next = ORDER_STATUS_NEXT[order.status]
    startTransition(async () => {
      try {
        await updateOrderStatus(order.id, next)
        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: next } : o))
      } catch {
        toast.error('Error al actualizar estado')
      }
    })
  }

  function exportCSV() {
    const headers = ['Nombre', 'Teléfono', 'Dirección', 'Cantidad', 'Estado', 'Fecha']
    const rows = filtered.map(o => [
      o.name,
      o.phone,
      o.address,
      o.quantity.toString(),
      o.status,
      new Date(o.created_at).toLocaleDateString('es-AR'),
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ventas_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = orders
    .filter(o => filter === 'all' ? true : o.status === filter)
    .filter(o => {
      if (!search) return true
      const q = search.toLowerCase()
      return o.name.toLowerCase().includes(q) || o.phone.includes(q)
    })

  const counts: Record<string, number> = {}
  for (const f of FILTERS) {
    counts[f.key] = f.key === 'all' ? orders.length : orders.filter(o => o.status === f.key).length
  }

  return (
    <div style={{ background: '#0f172a', height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '1rem 1rem 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f97316' }}>💰 Ventas</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleSyncNow} disabled={syncing} style={{ padding: '0.5rem', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <RefreshCw size={18} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button onClick={exportCSV} style={{ padding: '0.5rem', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <Download size={18} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '0.75rem 1rem 0', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o teléfono..."
            style={{ width: '100%', padding: '0.625rem 0.75rem 0.625rem 2.25rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem', color: '#f8fafc', fontSize: '0.875rem', outline: 'none' }}
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', overflowX: 'auto', padding: '0.625rem 1rem', gap: '0.375rem', scrollbarWidth: 'none', flexShrink: 0 }}>
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              flexShrink: 0, padding: '0.4rem 0.75rem',
              borderRadius: '0.5rem',
              border: filter === f.key ? '1px solid #f97316' : '1px solid #334155',
              background: filter === f.key ? 'rgba(249,115,22,0.15)' : 'transparent',
              color: filter === f.key ? '#f97316' : '#94a3b8',
              fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.375rem',
            }}
          >
            {f.label}
            {counts[f.key] > 0 && (
              <span style={{ background: filter === f.key ? '#f97316' : '#334155', color: filter === f.key ? '#fff' : '#94a3b8', borderRadius: '999px', padding: '0 0.375rem', fontSize: '0.7rem', fontWeight: 700 }}>
                {counts[f.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Orders list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        {filtered.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#64748b', padding: '3rem 0', fontSize: '0.875rem' }}>
            {search ? 'Sin resultados' : 'No hay órdenes en esta categoría'}
          </p>
        ) : filtered.map(order => (
          <div key={order.id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '0.875rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc', marginBottom: '0.25rem' }}>{order.name}</p>
                <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>📞 {order.phone}</p>
                <p style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '0.125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 {order.address}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.375rem', flexShrink: 0 }}>
                <span style={{ fontWeight: 700, color: '#f97316', fontSize: '0.9rem' }}>{order.quantity} uds</span>
                <p style={{ color: '#475569', fontSize: '0.72rem' }}>{new Date(order.created_at).toLocaleDateString('es-AR')}</p>
              </div>
            </div>
            <button
              onClick={() => handleStatusToggle(order)}
              disabled={isPending}
              style={{
                marginTop: '0.625rem', padding: '0.4rem 0.875rem',
                background: `${ORDER_STATUS_COLOR[order.status]}20`,
                border: `1px solid ${ORDER_STATUS_COLOR[order.status]}50`,
                borderRadius: '0.5rem',
                color: ORDER_STATUS_COLOR[order.status],
                fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              {ORDER_STATUS_LABEL[order.status]} →
            </button>
          </div>
        ))}
      </div>

      {/* Bottom nav */}
      <BottomNav active="ventas" />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
