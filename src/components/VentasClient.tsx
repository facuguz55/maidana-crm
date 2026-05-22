'use client'
import { useState, useEffect } from 'react'
import { Search, Download, RefreshCw, MapPin, Phone, Package } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { Order } from '@/lib/types'

interface Props { initialOrders: Order[] }

export default function VentasClient({ initialOrders }: Props) {
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [search, setSearch] = useState('')
  const [syncing, setSyncing] = useState(false)

  async function refreshOrders() {
    const supabase = createClient()
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
    if (data) setOrders(data as Order[])
  }

  useEffect(() => {
    const supabase = createClient()

    // Realtime en tabla orders
    const channel = supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        refreshOrders()
      })
      .subscribe()

    // Sync Google Sheets al cargar y cada 5 minutos
    const syncSheets = () => fetch('/api/sync-sheets', { method: 'POST' })
      .then(r => r.json())
      .then(d => { if (d.synced > 0) refreshOrders() })
      .catch(() => {})

    syncSheets()
    const interval = setInterval(syncSheets, 5 * 60 * 1000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [])

  async function handleSyncNow() {
    setSyncing(true)
    try {
      const res = await fetch('/api/sync-sheets', { method: 'POST' })
      const data = await res.json()
      if (res.ok) { toast.success(`${data.synced} registros sincronizados`); await refreshOrders() }
      else toast.error(data.error || 'Error al sincronizar')
    } catch { toast.error('Error de red') }
    finally { setSyncing(false) }
  }

  function exportCSV() {
    const headers = ['Nombre', 'Teléfono', 'Dirección', 'Cantidad', 'Fecha']
    const rows = filtered.map(o => [
      o.name, o.phone, o.address, o.quantity.toString(),
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

  const filtered = orders.filter(o => {
    if (!search) return true
    const q = search.toLowerCase()
    return o.name.toLowerCase().includes(q) || o.phone.includes(q) || o.address.toLowerCase().includes(q)
  })

  const totalUnidades = filtered.reduce((a, o) => a + o.quantity, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #1e2d45', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>Ventas</h1>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
            {filtered.length} órdenes · {totalUnidades} unidades
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, teléfono o dirección..."
              style={{ paddingLeft: '36px', paddingRight: '16px', paddingTop: '8px', paddingBottom: '8px', background: '#1e293b', border: '1px solid #1e2d45', borderRadius: '8px', color: '#f8fafc', fontSize: '13px', outline: 'none', width: '300px' }}
            />
          </div>
          <button onClick={handleSyncNow} disabled={syncing} style={{ padding: '8px', background: '#1e293b', border: '1px solid #1e2d45', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}>
            <RefreshCw size={15} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#1e293b', border: '1px solid #1e2d45', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }}>
            <Download size={14} /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '12px' }}>
            <Package size={28} color="#334155" />
            <p style={{ color: '#64748b', fontSize: '14px' }}>
              {search ? `Sin resultados para "${search}"` : 'Todavía no hay órdenes'}
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e2d45' }}>
                {['Nombre', 'Teléfono', 'Dirección', 'Cantidad', 'Fecha'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(order => (
                <tr
                  key={order.id}
                  style={{ borderBottom: '1px solid #1e2d45', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = '#1e293b'}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                >
                  <td style={{ padding: '13px 12px', fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>{order.name}</td>
                  <td style={{ padding: '13px 12px', fontSize: '13px', color: '#94a3b8' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Phone size={11} color="#64748b" />{order.phone}
                    </div>
                  </td>
                  <td style={{ padding: '13px 12px', fontSize: '13px', color: '#64748b', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={11} color="#475569" style={{ flexShrink: 0 }} />{order.address}
                    </div>
                  </td>
                  <td style={{ padding: '13px 12px', fontSize: '14px', fontWeight: 700, color: '#f97316' }}>{order.quantity} uds</td>
                  <td style={{ padding: '13px 12px', fontSize: '12px', color: '#475569' }}>
                    {new Date(order.created_at).toLocaleDateString('es-AR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
