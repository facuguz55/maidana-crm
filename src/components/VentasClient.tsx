'use client'
import { useState, useEffect } from 'react'
import { Search, Download, RefreshCw, Package } from 'lucide-react'
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
    const channel = supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { refreshOrders() })
      .subscribe()

    const syncSheets = () => fetch('/api/sync-sheets', { method: 'POST' })
      .then(r => r.json())
      .then(d => { if (d.synced > 0) refreshOrders() })
      .catch(() => {})

    syncSheets()
    const interval = setInterval(syncSheets, 5 * 60 * 1000)
    return () => { supabase.removeChannel(channel); clearInterval(interval) }
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
    const headers = ['Fecha', 'Nombre', 'Teléfono', 'Email', 'Qué compró', 'Cantidad', 'Dirección', 'CP', 'Datos extra']
    const rows = filtered.map(o => [
      new Date(o.created_at).toLocaleDateString('es-AR'),
      o.name, o.phone,
      o.email ?? '',
      o.product ?? '',
      o.quantity.toString(),
      o.address,
      o.postal_code ?? '',
      o.extra_data ?? '',
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
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
    return (
      o.name.toLowerCase().includes(q) ||
      o.phone.includes(q) ||
      o.address.toLowerCase().includes(q) ||
      (o.email ?? '').toLowerCase().includes(q) ||
      (o.product ?? '').toLowerCase().includes(q) ||
      (o.extra_data ?? '').toLowerCase().includes(q)
    )
  })

  const totalUnidades = filtered.reduce((a, o) => a + o.quantity, 0)

  const COL: React.CSSProperties = {
    padding: '8px 10px', fontSize: '12px', whiteSpace: 'nowrap',
    overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px',
  }
  const HEAD: React.CSSProperties = {
    padding: '8px 10px', textAlign: 'left', fontSize: '10px',
    fontWeight: 700, color: '#475569', textTransform: 'uppercase',
    letterSpacing: '0.06em', whiteSpace: 'nowrap',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e2d45', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '17px', fontWeight: 700, color: '#f8fafc' }}>Ventas</h1>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '1px' }}>
            {filtered.length} órdenes · {totalUnidades} unidades
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..."
              style={{ paddingLeft: '32px', paddingRight: '12px', paddingTop: '7px', paddingBottom: '7px', background: '#1e293b', border: '1px solid #1e2d45', borderRadius: '8px', color: '#f8fafc', fontSize: '13px', outline: 'none', width: '220px' }}
            />
          </div>
          <button onClick={handleSyncNow} disabled={syncing} title="Sincronizar Sheets" style={{ padding: '7px', background: '#1e293b', border: '1px solid #1e2d45', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}>
            <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', background: '#1e293b', border: '1px solid #1e2d45', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}>
            <Download size={13} /> CSV
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '12px' }}>
            <Package size={28} color="#334155" />
            <p style={{ color: '#64748b', fontSize: '14px' }}>
              {search ? `Sin resultados para "${search}"` : 'Todavía no hay órdenes'}
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '80px' }} />
              <col style={{ width: '160px' }} />
              <col style={{ width: '130px' }} />
              <col style={{ width: '170px' }} />
              <col style={{ width: '140px' }} />
              <col style={{ width: '60px' }} />
              <col style={{ width: '170px' }} />
              <col style={{ width: '60px' }} />
              <col style={{ width: '180px' }} />
            </colgroup>
            <thead style={{ position: 'sticky', top: 0, background: '#0d1526', zIndex: 1, borderBottom: '1px solid #1e2d45' }}>
              <tr>
                {['Fecha', 'Nombre', 'Teléfono', 'Email', 'Qué compró', 'Cant.', 'Dirección', 'CP', 'Datos extra'].map(h => (
                  <th key={h} style={HEAD}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(order => (
                <tr
                  key={order.id}
                  style={{ borderBottom: '1px solid #1a2535', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = '#111e2e'}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                >
                  <td style={{ ...COL, color: '#475569' }}>
                    {new Date(order.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                  </td>
                  <td style={{ ...COL, fontWeight: 600, color: '#f8fafc' }} title={order.name}>{order.name}</td>
                  <td style={{ ...COL, color: '#94a3b8', fontFamily: 'monospace', fontSize: '11px' }}>{order.phone}</td>
                  <td style={{ ...COL, color: '#64748b' }} title={order.email ?? ''}>{order.email ?? <span style={{ color: '#2d3f56' }}>—</span>}</td>
                  <td style={{ ...COL, color: '#cbd5e1' }} title={order.product ?? ''}>{order.product ?? <span style={{ color: '#2d3f56' }}>—</span>}</td>
                  <td style={{ ...COL, fontWeight: 700, color: '#f97316', textAlign: 'center' }}>{order.quantity}</td>
                  <td style={{ ...COL, color: '#64748b' }} title={order.address}>{order.address}</td>
                  <td style={{ ...COL, color: '#475569', textAlign: 'center' }}>{order.postal_code ?? <span style={{ color: '#2d3f56' }}>—</span>}</td>
                  <td style={{ ...COL, color: '#64748b', fontStyle: order.extra_data ? 'normal' : 'italic' }} title={order.extra_data ?? ''}>
                    {order.extra_data ?? <span style={{ color: '#2d3f56' }}>—</span>}
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
