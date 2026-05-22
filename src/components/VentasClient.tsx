'use client'
import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Download, RefreshCw, MapPin, Phone, TrendingUp, Users, Package } from 'lucide-react'
import { toast } from 'sonner'
import { updateOrderStatus } from '@/app/actions'
import { createClient } from '@/lib/supabase/client'
import type { Order, OrderStatus } from '@/lib/types'

const ORDER_STATUS_NEXT: Record<OrderStatus, OrderStatus> = {
  pendiente: 'verificado',
  verificado: 'enviado',
  enviado: 'pendiente',
}

const ORDER_STATUS_CONFIG: Record<OrderStatus, {
  color: string
  bg: string
  border: string
  label: string
  dot: string
}> = {
  pendiente: { color: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30', label: 'Pendiente', dot: 'bg-amber-500' },
  verificado: { color: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/30', label: 'Verificado', dot: 'bg-blue-500' },
  enviado: { color: 'text-green-400', bg: 'bg-green-500/15', border: 'border-green-500/30', label: 'Enviado', dot: 'bg-green-500' },
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

  const totalUnits = filtered.reduce((acc, o) => acc + o.quantity, 0)

  return (
    <div className="bg-slate-950 h-[100dvh] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between flex-shrink-0 border-b border-slate-700 bg-slate-800/90 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
            <TrendingUp size={15} className="text-orange-500" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100 leading-none">Ventas</h1>
            <p className="text-[10px] text-slate-500 mt-0.5">{totalUnits} unidades</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleSyncNow}
            disabled={syncing}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all active:scale-95"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={exportCSV}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all active:scale-95"
          >
            <Download size={16} />
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
            placeholder="Buscar por nombre o teléfono..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-sm placeholder:text-slate-600 outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div
        className="flex gap-2 px-4 pb-3 overflow-x-auto flex-shrink-0"
        style={{ scrollbarWidth: 'none' }}
      >
        {FILTERS.map(f => {
          const isActive = filter === f.key
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all duration-150 ${
                isActive
                  ? 'bg-orange-500/15 border-orange-500/40 text-orange-400'
                  : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-700'
              }`}
            >
              {f.label}
              {counts[f.key] > 0 && (
                <span
                  className={`rounded-full px-1.5 py-px text-[10px] font-bold leading-none ${
                    isActive ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {counts[f.key]}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Orders list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2.5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center">
              <Package size={22} className="text-slate-600" />
            </div>
            <p className="text-slate-500 text-sm font-medium">
              {search ? 'Sin resultados' : 'No hay órdenes aquí'}
            </p>
          </div>
        ) : (
          filtered.map(order => {
            const cfg = ORDER_STATUS_CONFIG[order.status]
            return (
              <div
                key={order.id}
                className="bg-slate-900 border border-slate-700 rounded-xl p-3.5 transition-all hover:border-slate-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-slate-100 mb-1.5">{order.name}</p>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Phone size={10} className="text-slate-600 flex-shrink-0" />
                      <span className="text-xs text-slate-500">{order.phone}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin size={10} className="text-slate-600 flex-shrink-0" />
                      <span className="text-xs text-slate-600 truncate">{order.address}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="font-bold text-orange-400 text-sm">{order.quantity} uds</span>
                    <span className="text-[10px] text-slate-600">
                      {new Date(order.created_at).toLocaleDateString('es-AR')}
                    </span>
                  </div>
                </div>
                <div className="mt-3">
                  <button
                    onClick={() => handleStatusToggle(order)}
                    disabled={isPending}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all active:scale-95 hover:opacity-80 ${cfg.bg} ${cfg.border} ${cfg.color}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                    <span className="text-slate-600 text-[10px]">→ siguiente</span>
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      <BottomNav active="ventas" />
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
    <div className="flex-shrink-0 bg-slate-900 border-t border-slate-700">
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
