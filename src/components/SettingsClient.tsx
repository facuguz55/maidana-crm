'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle, XCircle, RefreshCw, Zap, MessageSquare, Database, LogOut, Eye, EyeOff, Users, TrendingUp, Settings as SettingsIcon, Package } from 'lucide-react'
import { toast } from 'sonner'
import { saveSettings } from '@/app/actions'
import type { Settings } from '@/lib/types'

interface Props { settings: Settings | null }

export default function SettingsClient({ settings }: Props) {
  const router = useRouter()
  const [form, setForm] = useState({
    evolution_api_url: settings?.evolution_api_url ?? '',
    evolution_api_key: settings?.evolution_api_key ?? '',
    instance_name: settings?.instance_name ?? '',
    google_sheets_id: settings?.google_sheets_id ?? '',
    sheet_name: settings?.sheet_name ?? 'Respuestas de formulario 1',
    google_api_key: settings?.google_api_key ?? '',
    form_message: settings?.form_message ?? '',
  })
  const [isPending, startTransition] = useTransition()
  const [testResult, setTestResult] = useState<'ok' | 'error' | null>(null)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [showGoogleKey, setShowGoogleKey] = useState(false)

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    setTestResult(null)
  }

  async function handleSave() {
    startTransition(async () => {
      try { await saveSettings(form); toast.success('Configuración guardada') }
      catch { toast.error('Error al guardar') }
    })
  }

  async function handleTest() {
    setTestResult(null)
    try {
      const res = await fetch('/api/test-evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: form.evolution_api_url, apiKey: form.evolution_api_key }),
      })
      const data = await res.json()
      setTestResult(data.ok ? 'ok' : 'error')
    } catch { setTestResult('error') }
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

  async function handleLogout() {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0f172a' }}>
      {/* Sidebar */}
      <aside style={{ width: '220px', flexShrink: 0, background: '#0d1526', borderRight: '1px solid #1e2d45', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid #1e2d45' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
          <NavItem icon={TrendingUp} label="Ventas" onClick={() => router.push('/ventas')} />
          <NavItem icon={SettingsIcon} label="Configuración" active onClick={() => {}} />
        </nav>
        <div style={{ padding: '12px 10px', borderTop: '1px solid #1e2d45' }}>
          <button onClick={handleLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', border: 'none', background: 'transparent', color: '#64748b', fontSize: '13px', cursor: 'pointer' }}>
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '24px 32px', borderBottom: '1px solid #1e2d45', background: '#0f172a' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>Configuración</h1>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Integraciones y parámetros del sistema</p>
        </div>

        <div style={{ padding: '24px 32px', maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Evolution API */}
          <Card icon={Zap} iconColor="#f97316" title="Evolution API" subtitle="Configuración de WhatsApp">
            <Field label="URL de la API" value={form.evolution_api_url} onChange={v => update('evolution_api_url', v)} placeholder="https://devgo.santafeia.shop" />
            <PasswordField label="Token de instancia" value={form.evolution_api_key} onChange={v => update('evolution_api_key', v)} placeholder="fe3a40d6-f1a0-413c-a479-..." show={showApiKey} onToggle={() => setShowApiKey(!showApiKey)} />
            <Field label="Nombre de instancia" value={form.instance_name} onChange={v => update('instance_name', v)} placeholder="marcos_maidana" />
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button
                onClick={handleTest}
                style={{
                  flex: 1, padding: '9px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.15s',
                  background: testResult === 'ok' ? 'rgba(34,197,94,0.12)' : testResult === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)',
                  border: `1px solid ${testResult === 'ok' ? '#22c55e40' : testResult === 'error' ? '#ef444440' : '#3b82f640'}`,
                  color: testResult === 'ok' ? '#22c55e' : testResult === 'error' ? '#ef4444' : '#3b82f6',
                }}
              >
                {testResult === 'ok' ? <><CheckCircle size={14} /> Conectado</> : testResult === 'error' ? <><XCircle size={14} /> Error</> : 'Probar conexión'}
              </button>
              <button
                onClick={handleSave}
                disabled={isPending}
                style={{ flex: 1, padding: '9px', background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '8px', color: '#f97316', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                {isPending ? 'Guardando...' : 'Guardar configuración'}
              </button>
            </div>
          </Card>

          {/* Mensaje Formulario */}
          <Card icon={MessageSquare} iconColor="#3b82f6" title="Mensaje del Formulario" subtitle="Texto enviado al cliente con el link">
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>Mensaje</label>
              <textarea
                value={form.form_message}
                onChange={e => update('form_message', e.target.value)}
                placeholder="Hola! Para completar tu pedido completá este formulario: https://forms.gle/..."
                rows={3}
                style={{ width: '100%', padding: '10px 14px', background: '#0d1526', border: '1px solid #1e2d45', borderRadius: '8px', color: '#f8fafc', fontSize: '13px', resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
              />
            </div>
            <button onClick={handleSave} disabled={isPending} style={{ padding: '8px 20px', background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '8px', color: '#f97316', fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginTop: '4px' }}>
              {isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </Card>

          {/* Google Sheets */}
          <Card icon={Database} iconColor="#22c55e" title="Google Sheets" subtitle="Sincronización de órdenes">
            <Field label="Google Sheets ID" value={form.google_sheets_id} onChange={v => update('google_sheets_id', v)} placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" />
            <Field label="Nombre de la hoja" value={form.sheet_name} onChange={v => update('sheet_name', v)} placeholder="Respuestas de formulario 1" />
            <PasswordField label="Google API Key" value={form.google_api_key} onChange={v => update('google_api_key', v)} placeholder="AIza..." show={showGoogleKey} onToggle={() => setShowGoogleKey(!showGoogleKey)} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
              <button
                onClick={handleSyncSheets}
                disabled={syncing}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 20px', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', color: '#22c55e', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
                {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
              </button>
              {syncResult && <span style={{ fontSize: '13px', color: syncResult.startsWith('✅') ? '#22c55e' : '#ef4444' }}>{syncResult}</span>}
            </div>
          </Card>

          <div style={{ borderTop: '1px solid #1e2d45', paddingTop: '20px' }}>
            <button
              onClick={handleLogout}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', color: '#ef4444', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              <LogOut size={15} />
              Cerrar sesión
            </button>
          </div>
        </div>
      </main>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function NavItem({ icon: Icon, label, active, onClick }: { icon: React.ElementType; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', marginBottom: '2px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: active ? 600 : 400, background: active ? 'rgba(249,115,22,0.1)' : 'transparent', color: active ? '#f97316' : '#94a3b8', transition: 'all 0.15s' }}>
      <Icon size={16} />
      {label}
    </button>
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
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {children}
      </div>
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
