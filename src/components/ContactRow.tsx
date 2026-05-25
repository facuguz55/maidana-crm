'use client'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Flame, Snowflake, CheckCircle, Calendar, Trash2, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { updateContactStatus } from '@/app/actions'
import { formatPhone, timeAgo } from '@/lib/utils'
import type { Contact, ContactStatus } from '@/lib/types'

type Action = { label: string; icon: LucideIcon; target: ContactStatus; color: string; bg: string }

const STATUS_ACTIONS: Record<ContactStatus, Action[]> = {
  nuevo:          [
    { label: 'Caliente', icon: Flame,       target: 'caliente', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
    { label: 'Frío',     icon: Snowflake,   target: 'frio',     color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
  ],
  caliente:       [
    { label: 'Pagado', icon: CheckCircle, target: 'pagado', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
    { label: 'Frío',   icon: Snowflake,   target: 'frio',   color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
  ],
  frio:           [
    { label: 'Caliente', icon: Flame,       target: 'caliente', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
    { label: 'Pagado',   icon: CheckCircle, target: 'pagado',   color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  ],
  verificar_pago: [
    { label: 'Pagado', icon: CheckCircle, target: 'pagado', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
    { label: 'Frío',   icon: Snowflake,   target: 'frio',   color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
  ],
  pagado: [],
}

const STATUS_DOT: Record<ContactStatus, string> = {
  nuevo: '#3b82f6', frio: '#475569', caliente: '#f97316', verificar_pago: '#f59e0b', pagado: '#22c55e',
}

function formatPreview(p: string | null | undefined): string {
  if (!p) return 'Sin mensajes'
  const map: Record<string, string> = { ImageMessage: '📷 Imagen', VideoMessage: '🎥 Video', AudioMessage: '🎵 Audio', DocumentMessage: '📄 Documento' }
  for (const [k, v] of Object.entries(map)) if (p.includes(k)) return v
  return p === '[media]' ? '📎 Archivo' : p
}

interface Props { contact: Contact; onMarkRead?: (id: string) => void }

export default function ContactRow({ contact, onMarkRead }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const unread = (contact as Contact & { unread?: boolean }).unread === true
  const isScheduled = contact.scheduled === true
  const actions = STATUS_ACTIONS[contact.status]
  const preview = formatPreview(contact.last_message_preview)
  const phone = formatPhone(contact.phone)
  const displayName = contact.name || phone

  function handleClick() {
    if (unread) onMarkRead?.(contact.id)
    router.push(`/contact/${contact.id}`)
  }

  function quickAction(e: React.MouseEvent, action: Action) {
    e.stopPropagation()
    startTransition(async () => {
      try {
        await updateContactStatus(contact.id, action.target)
        toast.success(`→ ${action.label}`)
      } catch { toast.error('Error') }
    })
  }

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '14px',
        padding: '10px 24px',
        background: unread ? '#0e1e33' : 'transparent',
        borderBottom: '1px solid #1a2a3e',
        cursor: 'pointer',
        opacity: isPending ? 0.5 : 1,
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = unread ? '#132236' : '#141f2e' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = unread ? '#0e1e33' : 'transparent' }}
    >
      {/* Indicador de estado izquierda */}
      <div style={{ width: '10px', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
        {unread
          ? <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f97316', boxShadow: '0 0 5px rgba(249,115,22,0.6)' }} />
          : <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: STATUS_DOT[contact.status], opacity: 0.5 }} />
        }
      </div>

      {/* Info principal */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '3px' }}>
          <span style={{ fontSize: '14px', fontWeight: unread ? 700 : 400, color: unread ? '#fff' : '#94a3b8', letterSpacing: '0.01em', flexShrink: 0 }}>
            {displayName}
          </span>
          {contact.name && (
            <span style={{ fontSize: '11px', color: '#475569', fontFamily: 'monospace' }}>{phone}</span>
          )}
          {isScheduled && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#818cf8', fontWeight: 600, fontFamily: 'inherit' }}>
              <Calendar size={10} /> Agendado
            </span>
          )}
          <span suppressHydrationWarning style={{ fontSize: '12px', color: unread ? '#f97316' : '#475569', fontWeight: unread ? 600 : 400, flexShrink: 0 }}>
            {timeAgo(contact.last_message_at)}
          </span>
        </div>
        <p style={{ fontSize: '12px', color: unread ? '#cbd5e1' : '#475569', fontWeight: unread ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
          {preview}
        </p>
      </div>

      {/* Acciones rápidas — solo en hover via CSS, siempre visibles en desktop */}
      <div className="row-actions" style={{ display: 'flex', gap: '5px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        {actions.map(action => {
          const Icon = action.icon
          return (
            <button
              key={action.target}
              onClick={(e) => quickAction(e, action)}
              title={action.label}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', background: action.bg, border: 'none', borderRadius: '6px', color: action.color, fontSize: '11px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              <Icon size={11} />
              {action.label}
            </button>
          )
        })}
        {contact.status === 'pagado' && (
          <span style={{ fontSize: '11px', color: '#22c55e', fontWeight: 600, padding: '4px 8px' }}>✓ Pagado</span>
        )}
        {contact.status !== 'nuevo' && (
          <button
            onClick={e => { e.stopPropagation(); startTransition(async () => { try { await updateContactStatus(contact.id, 'nuevo'); toast.success('Devuelto a General') } catch { toast.error('Error') } }) }}
            title="Quitar de esta sección"
            style={{ display: 'flex', alignItems: 'center', padding: '4px 6px', background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '6px', color: '#ef4444', cursor: 'pointer' }}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  )
}
