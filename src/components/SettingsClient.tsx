'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle, XCircle, RefreshCw, Zap, MessageSquare, Database, LogOut, Eye, EyeOff } from 'lucide-react'
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
    <div className="bg-slate-950 min-h-[100dvh] flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm flex-shrink-0">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-all active:scale-95"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-bold text-sm text-slate-100">Configuración</h1>
      </div>

      <div className="flex-1 p-4 space-y-3 overflow-y-auto">

        {/* Evolution API */}
        <Section
          icon={Zap}
          title="Evolution API"
          iconColor="text-orange-400"
          iconBg="bg-orange-500/15 border-orange-500/30"
        >
          <Field
            label="URL de la API"
            value={form.evolution_api_url}
            onChange={v => update('evolution_api_url', v)}
            placeholder="https://devgo.santafeia.shop"
          />
          <PasswordField
            label="API Key"
            value={form.evolution_api_key}
            onChange={v => update('evolution_api_key', v)}
            placeholder="tu-api-key"
            show={showApiKey}
            onToggle={() => setShowApiKey(!showApiKey)}
          />
          <Field
            label="Nombre de instancia"
            value={form.instance_name}
            onChange={v => update('instance_name', v)}
            placeholder="marcos_maidana"
          />
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleTest}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition-all active:scale-95 ${
                testResult === 'ok'
                  ? 'bg-green-500/15 border-green-500/30 text-green-400'
                  : testResult === 'error'
                  ? 'bg-red-500/15 border-red-500/30 text-red-400'
                  : 'bg-blue-500/15 border-blue-500/30 text-blue-400 hover:bg-blue-500/25'
              }`}
            >
              {testResult === 'ok'
                ? <><CheckCircle size={13} /> Conectado</>
                : testResult === 'error'
                ? <><XCircle size={13} /> Error</>
                : 'Test conexión'
              }
            </button>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex-1 py-2.5 px-3 bg-orange-500/15 border border-orange-500/30 rounded-xl text-orange-400 text-xs font-bold hover:bg-orange-500/25 transition-all active:scale-95 disabled:opacity-50"
            >
              {isPending ? 'Guardando...' : 'Guardar todo'}
            </button>
          </div>
        </Section>

        {/* Mensaje Formulario */}
        <Section
          icon={MessageSquare}
          title="Mensaje Formulario"
          iconColor="text-blue-400"
          iconBg="bg-blue-500/15 border-blue-500/30"
        >
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">
              Texto enviado al cliente con el link del formulario
            </label>
            <textarea
              value={form.form_message}
              onChange={e => update('form_message', e.target.value)}
              placeholder="Hola! Para completar tu pedido completá este formulario: https://forms.gle/..."
              rows={3}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm resize-none outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 placeholder:text-slate-600 transition-all font-sans"
            />
          </div>
        </Section>

        {/* Google Sheets */}
        <Section
          icon={Database}
          title="Google Sheets"
          iconColor="text-green-400"
          iconBg="bg-green-500/15 border-green-500/30"
        >
          <Field
            label="Google Sheets ID"
            value={form.google_sheets_id}
            onChange={v => update('google_sheets_id', v)}
            placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
          />
          <Field
            label="Nombre de la hoja"
            value={form.sheet_name}
            onChange={v => update('sheet_name', v)}
            placeholder="Respuestas de formulario 1"
          />
          <PasswordField
            label="Google API Key"
            value={form.google_api_key}
            onChange={v => update('google_api_key', v)}
            placeholder="AIza..."
            show={showGoogleKey}
            onToggle={() => setShowGoogleKey(!showGoogleKey)}
          />
          <button
            onClick={handleSyncSheets}
            disabled={syncing}
            className="w-full py-2.5 bg-green-500/15 border border-green-500/30 rounded-xl text-green-400 text-xs font-bold flex items-center justify-center gap-2 transition-all hover:bg-green-500/25 active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
          </button>
          {syncResult && (
            <p className={`text-xs font-medium ${syncResult.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>
              {syncResult}
            </p>
          )}
        </Section>

        <button
          onClick={handleLogout}
          className="w-full py-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-bold flex items-center justify-center gap-2 transition-all hover:bg-red-500/20 active:scale-[0.99]"
        >
          <LogOut size={15} />
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

function Section({
  title,
  icon: Icon,
  iconColor,
  iconBg,
  children,
}: {
  title: string
  icon: React.ElementType
  iconColor: string
  iconBg: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-800/80">
        <div className={`w-7 h-7 rounded-lg ${iconBg} border flex items-center justify-center`}>
          <Icon size={13} className={iconColor} />
        </div>
        <h2 className="text-sm font-bold text-slate-200">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 placeholder:text-slate-600 transition-all"
      />
    </div>
  )
}

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  show,
  onToggle,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  show: boolean
  onToggle: () => void
}) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3.5 py-2.5 pr-10 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 placeholder:text-slate-600 transition-all"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  )
}
