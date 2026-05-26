'use client'
import { useState, useEffect } from 'react'
import { Search, Download, RefreshCw, Package, Trash2, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { Order, OrderStatus, ProductCost } from '@/lib/types'

interface Props { initialOrders: Order[]; initialCosts: ProductCost[] }

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

export default function VentasClient({ initialOrders, initialCosts }: Props) {
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [search, setSearch] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [editingPrice, setEditingPrice] = useState<{ id: string; value: string } | null>(null)
  const [editingCost, setEditingCost] = useState<{ id: string; value: string } | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const emptyForm = { name: '', phone: '', email: '', product: '', quantity: '1', address: '', postal_code: '', extra_data: '', status: 'pagado' as OrderStatus, unit_cost_override: '', sale_price: '' }
  const [form, setForm] = useState(emptyForm)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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

  function handleProductChange(value: string) {
    setForm(prev => {
      const match = initialCosts.find(c =>
        c.product.toLowerCase() === value.toLowerCase().trim()
      )
      return {
        ...prev,
        product: value,
        unit_cost_override: match ? String(match.cost_per_unit) : prev.unit_cost_override,
      }
    })
  }

  async function addOrder() {
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) {
      toast.error('Nombre, teléfono y dirección son obligatorios')
      return
    }
    const unitCost = form.unit_cost_override.trim() ? parseFloat(form.unit_cost_override.replace(',', '.')) : null
    const salePrice = form.sale_price.trim() ? parseFloat(form.sale_price.replace(',', '.')) : null
    setSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('orders').insert({
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      product: form.product.trim() || null,
      quantity: parseInt(form.quantity) || 1,
      address: form.address.trim(),
      postal_code: form.postal_code.trim() || null,
      extra_data: form.extra_data.trim() || null,
      status: form.status,
      unit_cost_override: unitCost,
      sale_price: salePrice,
    }).select().single()
    if (!error && data) {
      setOrders(prev => [data as Order, ...prev])
      setForm(emptyForm)
      setShowModal(false)
      toast.success('Venta agregada')
    } else {
      toast.error('Error al agregar venta')
    }
    setSaving(false)
  }

  async function deleteOrder(orderId: string) {
    if (!confirm('¿Eliminar esta orden?')) return
    setDeletingId(orderId)
    const supabase = createClient()
    const order = orders.find(o => o.id === orderId)
    const { error } = await supabase.from('orders').delete().eq('id', orderId)
    if (!error) {
      if (order?.form_timestamp) {
        await supabase.from('sync_blocklist').upsert({ form_timestamp: order.form_timestamp })
      }
      setOrders(prev => prev.filter(o => o.id !== orderId))
      toast.success('Orden eliminada')
    } else {
      toast.error('Error al eliminar')
    }
    setDeletingId(null)
  }

  async function saveUnitCost(orderId: string, rawValue: string) {
    const trimmed = rawValue.trim()
    const cost = trimmed === '' ? null : parseFloat(trimmed.replace(',', '.'))
    if (cost !== null && (isNaN(cost) || cost < 0)) { setEditingCost(null); return }
    const supabase = createClient()
    const { error } = await supabase.from('orders').update({ unit_cost_override: cost }).eq('id', orderId)
    if (!error) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, unit_cost_override: cost } : o))
    } else {
      toast.error('Error al guardar costo')
    }
    setEditingCost(null)
  }

  async function saveSalePrice(orderId: string, rawValue: string) {
    const price = parseFloat(rawValue.replace(',', '.'))
    if (isNaN(price) || price < 0) { setEditingPrice(null); return }
    const supabase = createClient()
    const { error } = await supabase.from('orders').update({ sale_price: price }).eq('id', orderId)
    if (!error) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, sale_price: price } : o))
    } else {
      toast.error('Error al guardar precio')
    }
    setEditingPrice(null)
  }

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
  const totalIngresos = filtered.reduce((a, o) => a + (o.sale_price ?? 0) * o.quantity, 0)
  const sinPrecio = filtered.filter(o => !o.sale_price || o.sale_price === 0).length

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
            {totalIngresos > 0 && <span style={{ color: '#22c55e' }}> · ${totalIngresos.toLocaleString('es-AR')}</span>}
            {sinPrecio > 0 && <span style={{ color: '#f59e0b' }}> · {sinPrecio} sin precio</span>}
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
          <button
            onClick={() => setShowModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '8px', color: '#f97316', cursor: 'pointer', fontSize: '12px', fontWeight: 600, flexShrink: 0 }}
          >
            <Plus size={13} /> Nueva
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
                <th style={TH}>Costo unit.</th>
                <th style={TH}>Precio unit.</th>
                <th style={TH}>Total ($)</th>
                <th style={TH}>Estado</th>
                <th style={TH}>Datos extra</th>
                <th style={{ ...TH, width: '40px' }}></th>
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
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}
                    onClick={() => setEditingCost({ id: order.id, value: String(order.unit_cost_override ?? '') })}
                  >
                    {editingCost?.id === order.id ? (
                      <input
                        autoFocus
                        value={editingCost.value}
                        onChange={e => setEditingCost({ id: order.id, value: e.target.value })}
                        onBlur={() => saveUnitCost(order.id, editingCost.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveUnitCost(order.id, editingCost.value); if (e.key === 'Escape') setEditingCost(null) }}
                        style={{ width: '80px', background: '#1e293b', border: '1px solid #f59e0b', borderRadius: '4px', color: '#f8fafc', fontSize: '12px', padding: '2px 6px', outline: 'none' }}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <span style={{ color: order.unit_cost_override ? '#fcd34d' : '#475569', cursor: 'text' }}>
                        {order.unit_cost_override ? `$${order.unit_cost_override.toLocaleString('es-AR')}` : '—'}
                      </span>
                    )}
                  </td>
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}
                    onClick={() => setEditingPrice({ id: order.id, value: String(order.sale_price ?? '') })}
                  >
                    {editingPrice?.id === order.id ? (
                      <input
                        autoFocus
                        value={editingPrice.value}
                        onChange={e => setEditingPrice({ id: order.id, value: e.target.value })}
                        onBlur={() => saveSalePrice(order.id, editingPrice.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveSalePrice(order.id, editingPrice.value); if (e.key === 'Escape') setEditingPrice(null) }}
                        style={{ width: '80px', background: '#1e293b', border: '1px solid #f97316', borderRadius: '4px', color: '#f8fafc', fontSize: '12px', padding: '2px 6px', outline: 'none' }}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <span style={{ color: order.sale_price ? '#f8fafc' : '#475569', cursor: 'text' }}>
                        {order.sale_price ? `$${order.sale_price.toLocaleString('es-AR')}` : '—'}
                      </span>
                    )}
                  </td>
                  <td style={{ ...TD, fontWeight: 600, color: '#22c55e', whiteSpace: 'nowrap' }}>
                    {order.sale_price ? `$${(order.sale_price * order.quantity).toLocaleString('es-AR')}` : '—'}
                  </td>
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                    <StatusBadge status={order.status} />
                  </td>
                  <td style={{ ...TD, color: '#94a3b8', maxWidth: '280px', whiteSpace: 'normal', lineHeight: '1.4' }}>
                    {order.extra_data ?? '—'}
                  </td>
                  <td style={{ ...TD, width: '40px', textAlign: 'center' }}>
                    <button
                      onClick={() => deleteOrder(order.id)}
                      disabled={deletingId === order.id}
                      title="Eliminar orden"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px', color: '#475569', display: 'flex', alignItems: 'center' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Modal nueva venta */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#0d1526', border: '1px solid #1e2d45', borderRadius: '14px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflow: 'auto' }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e2d45', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>Nueva venta</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: 'Nombre y Apellido *', key: 'name', placeholder: 'Ej: Juan Pérez' },
                { label: 'Teléfono *', key: 'phone', placeholder: 'Ej: 3516123456' },
                { label: 'Dirección *', key: 'address', placeholder: 'Ej: San Martín 123, Córdoba' },
                { label: 'Correo electrónico', key: 'email', placeholder: 'Ej: juan@gmail.com' },
                { label: 'Código postal', key: 'postal_code', placeholder: 'Ej: 5000' },
                { label: 'Datos extra', key: 'extra_data', placeholder: 'Notas adicionales...' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '4px' }}>{label}</label>
                  <input
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    style={{ width: '100%', background: '#1e293b', border: '1px solid #1e2d45', borderRadius: '7px', color: '#f8fafc', fontSize: '13px', padding: '8px 12px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
              {/* Producto con auto-completado de costo */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '4px' }}>Qué compró</label>
                <input
                  value={form.product}
                  onChange={e => handleProductChange(e.target.value)}
                  placeholder="Ej: Álbum"
                  list="product-options"
                  style={{ width: '100%', background: '#1e293b', border: '1px solid #1e2d45', borderRadius: '7px', color: '#f8fafc', fontSize: '13px', padding: '8px 12px', outline: 'none', boxSizing: 'border-box' }}
                />
                <datalist id="product-options">
                  {initialCosts.map(c => <option key={c.id} value={c.product} />)}
                </datalist>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '4px' }}>Cantidad *</label>
                  <input
                    type="number" min="1"
                    value={form.quantity}
                    onChange={e => setForm(prev => ({ ...prev, quantity: e.target.value }))}
                    style={{ width: '100%', background: '#1e293b', border: '1px solid #1e2d45', borderRadius: '7px', color: '#f8fafc', fontSize: '13px', padding: '8px 12px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '4px' }}>Estado</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(prev => ({ ...prev, status: e.target.value as OrderStatus }))}
                    style={{ width: '100%', background: '#1e293b', border: '1px solid #1e2d45', borderRadius: '7px', color: '#f8fafc', fontSize: '13px', padding: '8px 12px', outline: 'none', boxSizing: 'border-box' }}
                  >
                    <option value="pagado">Pagado</option>
                    <option value="preparando">Preparando</option>
                    <option value="enviado">Enviado</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '4px' }}>
                    Costo unitario
                    {form.unit_cost_override && <span style={{ color: '#22c55e', marginLeft: '4px' }}>✓ auto</span>}
                  </label>
                  <input
                    type="number" min="0"
                    value={form.unit_cost_override}
                    onChange={e => setForm(prev => ({ ...prev, unit_cost_override: e.target.value }))}
                    placeholder="Ej: 9200"
                    style={{ width: '100%', background: '#1e293b', border: '1px solid #1e2d45', borderRadius: '7px', color: '#f8fafc', fontSize: '13px', padding: '8px 12px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '4px' }}>Precio unitario</label>
                  <input
                    type="number" min="0"
                    value={form.sale_price}
                    onChange={e => setForm(prev => ({ ...prev, sale_price: e.target.value }))}
                    placeholder="Ej: 17000"
                    style={{ width: '100%', background: '#1e293b', border: '1px solid #1e2d45', borderRadius: '7px', color: '#f8fafc', fontSize: '13px', padding: '8px 12px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #1e2d45', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowModal(false)}
                style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #1e2d45', borderRadius: '8px', color: '#64748b', fontSize: '13px', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={addOrder}
                disabled={saving}
                style={{ padding: '8px 20px', background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '8px', color: '#f97316', fontSize: '13px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}
              >
                {saving ? 'Guardando...' : 'Agregar venta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
