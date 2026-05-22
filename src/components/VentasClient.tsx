'use client'
import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Download, RefreshCw, Package, Users, Settings, TrendingUp, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { updateOrderStatus } from '@/app/actions'
import { createClient } from '@/lib/supabase/client'
import type { Order, OrderStatus } from '@/lib/types'

const ORDER_STATUS_NEXT: Record<OrderStatus, OrderStatus> = {
  pendiente: 'verificado',
  verificado: 'enviado',
  enviado: 'pendiente',
}

const STATUS_CFG: Record<OrderStatus, { color: string; bg: string; label: string }> = {
  pendiente: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Pendiente' },
  verificado: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', label: 'Verificado' },
  enviado: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', label: 'Enviado' },
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

  useEffect(() => {
    const sync = () =>
      fetch('/api/sync-sheets', { method: 'POST' })
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
      o.name, o.phone, o.address, o.quantity.toString(), o.status,
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

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
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
    <div style={{ display: 'flex', height: '100vh', background: '#0f172a' }}>
      {/* Sidebar */}
      <aside style={{
        width: '220px', flexShrink: 0,
        background: '#0d1526', borderRight: '1px solid #1e2d45',
        display: 'flex', flexDirection: 'column',
      }}>
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
        <nav style={{ flex: 1, padding: '12px 10px' }}>
          <NavItem icon={Users} label="Clientes" onClick={() => router.push('/')} />
          <NavItem icon={TrendingUp} label="Ventas" active onClick={() => router.push('/ventas')} />
          <NavItem icon={Settings} label="Configuración" onClick={() => router.push('/settings')} />
        </nav>
        <div style={{ padding: '12px 10px', borderTop: '1px solid #1e2d45' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
              padding: '9px 12px', borderRadius: '8px', border: 'none',
              background: 'transparent', color: '#64748b', fontSize: '13px', cursor: 'pointer',
            }}
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
            <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>Ventas</h1>
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              {orders.reduce((a, o) => a + o.quantity, 0)} unidades en total
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar orden..."
                style={{
                  paddingLeft: '36px', paddingRight: '16px', paddingTop: '8px', paddingBottom: '8px',
                  background: '#1e293b', border: '1px solid #1e2d45',
                  borderRadius: '8px', color: '#f8fafc', fontSize: '13px', outline: 'none', width: '240px',
                }}
              />
            </div>
            <button
              onClick={handleSyncNow}
              disabled={syncing}
              style={{ padding: '8px', background: '#1e293b', border: '1px solid #1e2d45', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}
            >
              <RefreshCw size={15} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
            </button>
            <button
              onClick={exportCSV}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#1e293b', border: '1px solid #1e2d45', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }}
            >
              <Download size={14} />
              Exportar CSV
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '4px', padding: '12px 24px', borderBottom: '1px solid #1e2d45', flexShrink: 0 }}>
          {FILTERS.map(f => {
            const isActive = filter === f.key
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 14px', borderRadius: '7px', fontSize: '13px', fontWeight: 500,
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: isActive ? 'rgba(249,115,22,0.12)' : 'transparent',
                  border: isActive ? '1px solid rgba(249,115,22,0.35)' : '1px solid transparent',
                  color: isActive ? '#f97316' : '#64748b',
                }}
              >
                {f.label}
                {counts[f.key] > 0 && (
                  <span style={{ background: isActive ? '#f97316' : '#1e293b', color: isActive ? '#fff' : '#64748b', borderRadius: '999px', padding: '1px 7px', fontSize: '11px', fontWeight: 700 }}>
                    {counts[f.key]}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {filtered.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '12px' }}>
              <Package size={28} color="#334155" />
              <p style={{ color: '#64748b', fontSize: '14px' }}>No hay órdenes en esta categoría</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e2d45' }}>
                  {['Nombre', 'Teléfono', 'Dirección', 'Cantidad', 'Estado', 'Fecha'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(order => {
                  const cfg = STATUS_CFG[order.status]
                  return (
                    <tr
                      key={order.id}
                      style={{ borderBottom: '1px solid #1e2d45', transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = '#1e293b'}
                      onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px', fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>{order.name}</td>
                      <td style={{ padding: '12px', fontSize: '13px', color: '#94a3b8' }}>{order.phone}</td>
                      <td style={{ padding: '12px', fontSize: '13px', color: '#64748b', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.address}</td>
                      <td style={{ padding: '12px', fontSize: '13px', fontWeight: 700, color: '#f97316' }}>{order.quantity} uds</td>
                      <td style={{ padding: '12px' }}>
                        <button
                          onClick={() => handleStatusToggle(order)}
                          disabled={isPending}
                          style={{
                            padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                            background: cfg.bg, color: cfg.color,
                            border: `1px solid ${cfg.color}40`, cursor: 'pointer', transition: 'opacity 0.15s',
                          }}
                        >
                          {cfg.label} →
                        </button>
                      </td>
                      <td style={{ padding: '12px', fontSize: '12px', color: '#475569' }}>
                        {new Date(order.created_at).toLocaleDateString('es-AR')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function NavItem({ icon: Icon, label, active, onClick }: { icon: React.ElementType; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
        padding: '9px 12px', borderRadius: '8px', marginBottom: '2px',
        border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: active ? 600 : 400,
        background: active ? 'rgba(249,115,22,0.1)' : 'transparent',
        color: active ? '#f97316' : '#94a3b8', transition: 'all 0.15s',
      }}
    >
      <Icon size={16} />
      {label}
    </button>
  )
}
