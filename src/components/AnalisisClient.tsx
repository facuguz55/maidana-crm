'use client'
import { useState } from 'react'
import { Save, Sparkles, TrendingUp, DollarSign, AlertTriangle, Lightbulb, User } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { ProductCost, AnalysisResult } from '@/lib/types'

interface Props { initialCosts: ProductCost[] }

export default function AnalisisClient({ initialCosts }: Props) {
  const [costs, setCosts] = useState<ProductCost[]>(initialCosts)
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS')

  const sym = currency === 'ARS' ? '$' : 'U$S'
  function fmt(n: number) { return `${sym} ${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}` }

  function updateCost(id: number, field: 'cost_per_unit' | 'shipping_cost_per_order', value: string) {
    const num = parseFloat(value.replace(',', '.'))
    if (isNaN(num)) return
    setCosts(prev => prev.map(c => c.id === id ? { ...c, [field]: num } : c))
  }

  async function saveCosts() {
    setSaving(true)
    try {
      const supabase = createClient()
      for (const c of costs) {
        const { error } = await supabase
          .from('product_costs_maidana')
          .update({ cost_per_unit: c.cost_per_unit, shipping_cost_per_order: c.shipping_cost_per_order })
          .eq('id', c.id)
        if (error) throw error
      }
      toast.success('Costos guardados')
    } catch {
      toast.error('Error al guardar costos')
    } finally {
      setSaving(false)
    }
  }

  async function runAnalysis() {
    setAnalyzing(true)
    setResult(null)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ costs }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Error al analizar')
        return
      }
      setResult(data as AnalysisResult)
    } catch {
      toast.error('Error de red')
    } finally {
      setAnalyzing(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    background: '#1e293b', border: '1px solid #1e2d45', borderRadius: '6px',
    color: '#f8fafc', fontSize: '13px', padding: '6px 10px', outline: 'none',
    width: '120px', textAlign: 'right',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto', padding: '20px' }}>
      <div style={{ maxWidth: '800px', width: '100%', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc' }}>Análisis Financiero</h1>
            <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Configurá los costos y ejecutá el análisis con IA</p>
          </div>
          <div style={{ display: 'flex', background: '#0d1526', border: '1px solid #1e2d45', borderRadius: '8px', overflow: 'hidden', alignSelf: 'flex-start' }}>
            {(['ARS', 'USD'] as const).map(c => (
              <button key={c} onClick={() => setCurrency(c)} style={{
                padding: '6px 14px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer',
                background: currency === c ? 'rgba(249,115,22,0.15)' : 'transparent',
                color: currency === c ? '#f97316' : '#64748b',
                borderRight: c === 'ARS' ? '1px solid #1e2d45' : 'none',
              }}>{c === 'ARS' ? '$ ARS' : 'U$S USD'}</button>
            ))}
          </div>
        </div>

        {/* Tabla de costos */}
        <div style={{ background: '#0d1526', border: '1px solid #1e2d45', borderRadius: '12px', marginBottom: '20px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e2d45', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>Costos por Producto</h2>
              <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Editá y guardá antes de analizar</p>
            </div>
            <button
              onClick={saveCosts}
              disabled={saving}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px',
                background: saving ? '#1e293b' : 'rgba(249,115,22,0.15)',
                border: '1px solid rgba(249,115,22,0.3)', borderRadius: '8px',
                color: '#f97316', fontSize: '12px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              <Save size={13} />
              {saving ? 'Guardando...' : 'Guardar costos'}
            </button>
          </div>

          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {costs.length === 0 && (
              <p style={{ textAlign: 'center', color: '#64748b', fontSize: '13px', padding: '12px' }}>No hay productos configurados</p>
            )}
            {costs.map(c => (
              <div key={c.id} style={{ background: '#111e2e', borderRadius: '8px', padding: '12px 14px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc', textTransform: 'capitalize', marginBottom: '10px' }}>{c.product}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Costo por unidad</div>
                    <input
                      style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
                      defaultValue={c.cost_per_unit}
                      onFocus={e => e.target.select()}
                      onBlur={e => updateCost(c.id, 'cost_per_unit', e.target.value)}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Costo de envío</div>
                    <input
                      style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
                      defaultValue={c.shipping_cost_per_order}
                      onFocus={e => e.target.select()}
                      onBlur={e => updateCost(c.id, 'shipping_cost_per_order', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Botón analizar */}
        <button
          onClick={runAnalysis}
          disabled={analyzing}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            padding: '12px', borderRadius: '10px', border: 'none',
            background: analyzing ? '#1e293b' : 'linear-gradient(135deg, #f97316, #ea580c)',
            color: '#fff', fontSize: '14px', fontWeight: 700, cursor: analyzing ? 'not-allowed' : 'pointer',
            marginBottom: '24px', transition: 'opacity 0.15s',
          }}
        >
          <Sparkles size={16} />
          {analyzing ? 'Analizando con IA...' : 'Analizar con IA'}
        </button>

        {/* Resultados */}
        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Cards de métricas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              {[
                { label: 'Ingresos totales', value: fmt(result.total_ingresos), color: '#3b82f6', icon: DollarSign },
                { label: 'Costos totales', value: fmt(result.total_costos), color: '#ef4444', icon: TrendingUp },
                { label: 'Ganancia neta', value: fmt(result.total_ganancia), color: '#22c55e', icon: DollarSign },
                { label: 'Margen', value: `${result.margen_porcentaje.toFixed(1)}%`, color: '#f97316', icon: TrendingUp },
              ].map(({ label, value, color, icon: Icon }) => (
                <div key={label} style={{ background: '#0d1526', border: `1px solid ${color}33`, borderRadius: '10px', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Icon size={14} color={color} />
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Resumen */}
            <div style={{ background: '#0d1526', border: '1px solid #1e2d45', borderRadius: '10px', padding: '16px' }}>
              <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.6' }}>{result.resumen}</p>
            </div>

            {/* Producto + Cliente */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ background: '#0d1526', border: '1px solid #1e2d45', borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Producto más rentable</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#f97316', textTransform: 'capitalize' }}>{result.producto_mas_rentable}</div>
              </div>
              <div style={{ background: '#0d1526', border: '1px solid #1e2d45', borderRadius: '10px', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <User size={12} color="#64748b" />
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Cliente más grande</span>
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>{result.cliente_mas_grande.nombre}</div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  {result.cliente_mas_grande.cantidad} uds · {fmt(result.cliente_mas_grande.ganancia)}
                </div>
              </div>
            </div>

            {/* Alertas */}
            {result.alertas.length > 0 && (
              <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '10px', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <AlertTriangle size={14} color="#f59e0b" />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Alertas</span>
                </div>
                <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
                  {result.alertas.map((a, i) => (
                    <li key={i} style={{ fontSize: '13px', color: '#fcd34d', marginBottom: '4px', lineHeight: '1.5' }}>{a}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recomendaciones */}
            {result.recomendaciones.length > 0 && (
              <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '10px', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <Lightbulb size={14} color="#22c55e" />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Recomendaciones</span>
                </div>
                <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
                  {result.recomendaciones.map((r, i) => (
                    <li key={i} style={{ fontSize: '13px', color: '#86efac', marginBottom: '4px', lineHeight: '1.5' }}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
