'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
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

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    setTestResult(null)
  }

  async function handleSave() {
    startTransition(async () => {
      try {
        await saveSettings(form)
        toast.success('Configuración guardada')
      } catch {
        toast.error('Error al guardar')
      }
    })
  }

  async function handleTest() {
    setTestResult(null)
    try {
      const res = await fetch(`${form.evolution_api_url}/instance/fetchInstances`, {
        headers: { 'apikey': form.evolution_api_key },
      })
      setTestResult(res.ok ? 'ok' : 'error')
    } catch {
      setTestResult('error')
    }
  }

  async function handleSyncSheets() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/sync-sheets', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setSyncResult(`Error: ${data.error}`)
        toast.error(data.error)
      } else {
        setSyncResult(`✅ ${data.synced} registros sincronizados`)
        toast.success(`${data.synced} registros sincronizados`)
      }
    } catch {
      setSyncResult('Error de red')
      toast.error('Error de red')
    } finally {
      setSyncing(false)
    }
  }

  async function handleLogout() {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ background: '#0f172a', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid #334155', background: '#1e293b', flexShrink: 0 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem', display: 'flex' }}>
          <ArrowLeft size={22} />
        </button>
        <h1 style={{ fontWeight: 700, fontSize: '1rem', color: '#f8fafc' }}>Configuración</h1>
      </div>

      <div style={{ flex: 1, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>

        {/* Evolution API */}
        <Section title="Evolution API">
          <Field label="URL de la API" value={form.evolution_api_url} onChange={v => update('evolution_api_url', v)} placeholder="https://devgo.santafeia.shop" />
          <Field label="API Key" value={form.evolution_api_key} onChange={v => update('evolution_api_key', v)} placeholder="tu-api-key" type="password" />
          <Field label="Nombre de instancia" value={form.instance_name} onChange={v => update('instance_name', v)} placeholder="marcos_maidana" />
          <div style={{ display: 'flex', gap: '0.625rem' }}>
            <button onClick={handleTest} style={{ flex: 1, padding: '0.625rem', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)', borderRadius: '0.5rem', color: '#3b82f6', fontSize: '0.825rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}>
              {testResult === 'ok' ? <><CheckCircle size={14}/> OK</> : testResult === 'error' ? <><XCircle size={14}/> Error</> : 'Test conexión'}
            </button>
            <button onClick={handleSave} disabled={isPending} style={{ flex: 1, padding: '0.625rem', background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.4)', borderRadius: '0.5rem', color: '#f97316', fontSize: '0.825rem', fontWeight: 600, cursor: 'pointer' }}>
              {isPending ? 'Guardando...' : 'Guardar todo'}
            </button>
          </div>
        </Section>

        {/* WhatsApp Form */}
        <Section title="Mensaje Formulario">
          <Field
            label="Texto que se envía al cliente con el link del formulario"
            value={form.form_message}
            onChange={v => update('form_message', v)}
            placeholder="Hola! Para completar tu pedido completá este formulario: https://forms.gle/..."
            multiline
          />
        </Section>

        {/* Google Sheets */}
        <Section title="Google Sheets">
          <Field label="Google Sheets ID" value={form.google_sheets_id} onChange={v => update('google_sheets_id', v)} placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" />
          <Field label="Nombre de la hoja" value={form.sheet_name} onChange={v => update('sheet_name', v)} placeholder="Respuestas de formulario 1" />
          <Field label="Google API Key" value={form.google_api_key} onChange={v => update('google_api_key', v)} placeholder="AIza..." type="password" />

          <button
            onClick={handleSyncSheets}
            disabled={syncing}
            style={{ width: '100%', padding: '0.625rem', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: '0.5rem', color: '#22c55e', fontSize: '0.825rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}
          >
            <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
            {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
          </button>
          {syncResult && <p style={{ fontSize: '0.8rem', color: syncResult.startsWith('✅') ? '#22c55e' : '#ef4444', marginTop: '0.25rem' }}>{syncResult}</p>}
        </Section>

        <button
          onClick={handleLogout}
          style={{ width: '100%', padding: '0.875rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.75rem', color: '#ef4444', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}
        >
          Cerrar sesión
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <h2 style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text', multiline }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string; multiline?: boolean
}) {
  return (
    <div>
      <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.375rem' }}>{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          style={{ width: '100%', padding: '0.625rem 0.75rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', color: '#f8fafc', fontSize: '0.875rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ width: '100%', padding: '0.625rem 0.75rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', color: '#f8fafc', fontSize: '0.875rem', outline: 'none' }}
        />
      )}
    </div>
  )
}
