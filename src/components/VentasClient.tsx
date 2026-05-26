'use client'
import { useState, useEffect } from 'react'
import { Search, Download, RefreshCw, Package } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { Order, OrderStatus } from '@/lib/types'

interface Props { initialOrders: Order[] }

const STATUS_LABEL: Record<OrderStatus, string> = {
  pagado: 'Pagado',
  preparando: 'Preparando',
  enviado: 'Enviado',
}
const STATUS_COLOR: Record<OrderStatus, string> = {
  pagado: '#22c55e',
  preparando: '#f59e0b',
  enviado: '#3b82f6',
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const color = STATUS_COLOR[status] ?? '#64748b'
  return (
    <span style={{
      fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '20px',
      background: color + '22', color, border: `1px solid ${color}55`,
      letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

export default function VentasClient({ initialOrders }: Props) {
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [search, setSearch] = useState('')
  const [syncing, setSyncing] = useState(false)

  async function refreshOrders() {
    const supabase = createClient()
    const { data } = await supabase
      .from('orders').select('*').order('created_at', { ascending: false })
    if (data) setOrders(data as Order[])
  }

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => refreshOrders())
      .subscribe()

    const syncSheets = () =>
      fetch('/api/sync-sheets', { method: 'POST' })
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
    const headers = ['Marca temporal', 'Nombre y Apellido', 'Numero de telefono', 'Correo Electronico', 'Que compraste?', 'Cantidad', 'Dirección', 'Codigo Postal', 'Estado', 'Datos extra']
    const rows = filtered.map(o => [
      o.form_timestamp ?? new Date(o.created_at).toLocaleString('es-AR'),
      o.name, o.phone, o.email ?? '', o.product ?? '',
      o.quantity.toString(), o.address, o.postal_code ?? '',
      STATUS_LABEL[o.status] ?? o.status, o.extra_data ?? '',
    ])
    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
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

  const TH: React.CSSProperties = {
    padding: '9px 14px',
    textAlign: 'left',
    fontSize: '11px',
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
    background: '#0d1526',
    borderBottom: '1px solid #1e2d45',
  }
  const TD: React.CSSProperties = {
    padding: '10px 14px',
    fontSize: '13px',
    borderBottom: '1px solid #1a2535',
    verticalAlign: 'top',
    color: '#cbd5e1',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <div
        className="ventas-header"
        style={{ padding: '14px 20px', borderBottom: '1px solid #1e2d45', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}
      >
        <div>
          <h1 style={{ fontSize: '17px', fontWeight: 700, color: '#f8fafc' }}>Ventas</h1>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '1px' }}>
            {filtered.length} órdenes · {totalUnidades} unidades
          </p>
        </div>
        <div className="ventas-search-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              className="ventas-search-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..."
              style={{ paddingLeft: '32px', paddingRight: '12px', paddingTop: '7px', paddingBottom: '7px', background: '#1e293b', border: '1px solid #1e2d45', borderRadius: '8px', color: '#f8fafc', fontSize: '13px', outline: 'none', width: '220px' }}
            />
          </div>
          <button
            onClick={handleSyncNow}
            disabled={syncing}
            title="Sincronizar Sheets"
            style={{ padding: '7px', background: '#1e293b', border: '1px solid #1e2d45', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', display: 'flex', flexShrink: 0 }}
          >
            <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button
            onClick={exportCSV}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', background: '#1e293b', border: '1px solid #1e2d45', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', fontSize: '12px', flexShrink: 0 }}
          >
            <Download size={13} /> CSV
          </button>
        </div>
      </div>

      {/* Tabla — scroll horizontal en mobile y desktop */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '12px' }}>
            <Package size={28} color="#334155" />
            <p style={{ color: '#64748b', fontSize: '14px' }}>
              {search ? `Sin resultados para "${search}"` : 'Todavía no hay órdenes'}
            </p>
          </div>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: 'max-content', minWidth: '100%' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr>
                <th style={TH}>Nombre y Apellido</th>
                <th style={TH}>Teléfono</th>
                <th style={TH}>Correo Electrónico</th>
                <th style={TH}>Qué compró?</th>
                <th style={TH}>Cantidad</th>
                <th style={TH}>Dirección</th>
                <th style={TH}>Cód. Postal</th>
                <th style={TH}>Estado</th>
                <th style={TH}>Datos extra</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(order => (
                <tr
                  key={order.id}
                  style={{ transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = '#111e2e'}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                >
                  <td style={{ ...TD, fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap' }}>{order.name}</td>
                  <td style={{ ...TD, fontFamily: 'monospace', fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{order.phone}</td>
                  <td style={{ ...TD, color: '#64748b' }}>{order.email ?? '—'}</td>
                  <td style={{ ...TD, color: '#cbd5e1' }}>{order.product ?? '—'}</td>
                  <td style={{ ...TD, fontWeight: 700, color: '#f97316', textAlign: 'center', whiteSpace: 'nowrap' }}>{order.quantity}</td>
                  <td style={{ ...TD, color: '#94a3b8' }}>{order.address}</td>
                  <td style={{ ...TD, color: '#64748b', textAlign: 'center', whiteSpace: 'nowrap' }}>{order.postal_code ?? '—'}</td>
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                    <StatusBadge status={order.status} />
                  </td>
                  <td style={{ ...TD, color: '#94a3b8', maxWidth: '280px', whiteSpace: 'normal', lineHeight: '1.4' }}>
                    {order.extra_data ?? '—'}
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
