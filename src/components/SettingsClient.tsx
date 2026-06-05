'use client'
import { useState, useTransition } from 'react'
import { RefreshCw, Database, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { saveSettings } from '@/app/actions'
import type { Settings } from '@/lib/types'

interface Props { settings: Settings | null }

export default function SettingsClient({ settings }: Props) {
  const [form, setForm] = useState({
    google_sheets_id: settings?.google_sheets_id ?? '',
    sheet_name: settings?.sheet_name ?? 'Respuestas de formulario 1',
    google_api_key: settings?.google_api_key ?? '',
  })
  const [isPending, startTransition] = useTransition()
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [showGoogleKey, setShowGoogleKey] = useState(false)

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    startTransition(async () => {
      try { await saveSettings(form); toast.success('Configuración guardada') }
      catch { toast.error('Error al guardar') }
    })
  }

  async function handleSyncSheets() {
    setSyncing(true); setSyncResult(null)
    try {
      const res = await fetch('/api/sync-sheets', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setSyncResult(`Error: ${data.error}`); toast.error(data.error) }
      else { setSyncResult(`✅ ${data.synced} registros sincronizados`); toast.success(`${data.synced} registros sincronizados`) }
    } catch { setSyncResult('Error de red'); toast.error('Error de red') }
    finally { setSyncing(false) }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div className="settings-header" style={{ padding: '24px 32px', borderBottom: '1px solid #1e2d45' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>Configuración</h1>
        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Integraciones y parámetros del sistema</p>
      </div>

      <div className="settings-content" style={{ padding: '24px 32px', maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        <Card icon={Database} iconColor="#22c55e" title="Google Sheets" subtitle="Sincronización de órdenes">
          <Field label="Google Sheets ID" value={form.google_sheets_id} onChange={v => update('google_sheets_id', v)} placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" />
          <Field label="Nombre de la hoja" value={form.sheet_name} onChange={v => update('sheet_name', v)} placeholder="Respuestas de formulario 1" />
          <PasswordField label="Google API Key" value={form.google_api_key} onChange={v => update('google_api_key', v)} placeholder="AIza..." show={showGoogleKey} onToggle={() => setShowGoogleKey(!showGoogleKey)} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button onClick={handleSave} disabled={isPending} style={{ padding: '9px 20px', background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '8px', color: '#f97316', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              {isPending ? 'Guardando...' : 'Guardar configuración'}
            </button>
            <button onClick={handleSyncSheets} disabled={syncing} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 20px', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', color: '#22c55e', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
              {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
            </button>
            {syncResult && <span style={{ fontSize: '13px', color: syncResult.startsWith('✅') ? '#22c55e' : '#ef4444' }}>{syncResult}</span>}
          </div>
        </Card>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function Card({ icon: Icon, iconColor, title, subtitle, children }: { icon: React.ElementType; iconColor: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#1e293b', border: '1px solid #1e2d45', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e2d45', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Icon size={16} color={iconColor} />
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>{title}</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>{subtitle}</div>
        </div>
      </div>
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>{children}</div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ width: '100%', padding: '9px 14px', background: '#0d1526', border: '1px solid #1e2d45', borderRadius: '8px', color: '#f8fafc', fontSize: '13px', outline: 'none' }} />
    </div>
  )
}

function PasswordField({ label, value, onChange, placeholder, show, onToggle }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; show: boolean; onToggle: () => void }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ width: '100%', padding: '9px 40px 9px 14px', background: '#0d1526', border: '1px solid #1e2d45', borderRadius: '8px', color: '#f8fafc', fontSize: '13px', outline: 'none' }} />
        <button type="button" onClick={onToggle} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', display: 'flex' }}>
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  )
}
