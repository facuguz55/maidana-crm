'use client'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Flame, Snowflake, DollarSign, CheckCircle, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { updateContactStatus } from '@/app/actions'
import { formatPhone, timeAgo } from '@/lib/utils'
import type { Contact, ContactStatus } from '@/lib/types'

type Action = { label: string; icon: LucideIcon; target: ContactStatus; color: string; bg: string; border: string }

const STATUS_ACTIONS: Record<ContactStatus, Action[]> = {
  nuevo: [
    { label: 'Caliente',      icon: Flame,       target: 'caliente',      color: '#f97316', bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.3)'  },
    { label: 'Verificar pago',icon: DollarSign,  target: 'verificar_pago',color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)'  },
    { label: 'Frío',          icon: Snowflake,   target: 'frio',          color: '#64748b', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.25)' },
  ],
  caliente: [
    { label: 'Verificar pago',icon: DollarSign,  target: 'verificar_pago',color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)'  },
    { label: 'Frío',          icon: Snowflake,   target: 'frio',          color: '#64748b', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.25)' },
  ],
  frio: [
    { label: 'Caliente',      icon: Flame,       target: 'caliente',      color: '#f97316', bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.3)'  },
    { label: 'Verificar pago',icon: DollarSign,  target: 'verificar_pago',color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)'  },
  ],
  verificar_pago: [
    { label: 'Pagado',        icon: CheckCircle, target: 'pagado',        color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.3)'   },
    { label: 'Frío',          icon: Snowflake,   target: 'frio',          color: '#64748b', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.25)' },
  ],
  pagado: [],
}

const STATUS_CONFIG: Record<ContactStatus, { color: string; bg: string; dot: string; label: string }> = {
  nuevo:          { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  dot: '#3b82f6', label: 'Nuevo' },
  frio:           { color: '#64748b', bg: 'rgba(100,116,139,0.08)', dot: '#64748b', label: 'Frío' },
  caliente:       { color: '#f97316', bg: 'rgba(249,115,22,0.08)',  dot: '#f97316', label: 'Caliente' },
  verificar_pago: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  dot: '#f59e0b', label: 'Verificar pago' },
  pagado:         { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   dot: '#22c55e', label: 'Pagado' },
}

function formatPreview(preview: string | null | undefined): string {
  if (!preview) return 'Sin mensajes'
  if (preview === '[media]') return '📎 Archivo adjunto'
  const mediaMap: Record<string, string> = {
    ImageMessage:    '📷 Imagen',
    VideoMessage:    '🎥 Video',
    AudioMessage:    '🎵 Audio',
    DocumentMessage: '📄 Documento',
    StickerMessage:  '🔖 Sticker',
  }
  for (const [key, label] of Object.entries(mediaMap)) {
    if (preview.includes(key)) return label
  }
  return preview
}

interface Props { contact: Contact }

export default function ContactCard({ contact }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const cfg = STATUS_CONFIG[contact.status]
  const preview = formatPreview(contact.last_message_preview)
  const phone = formatPhone(contact.phone)
  const unread = (contact as Contact & { unread?: boolean }).unread === true

  const actions = STATUS_ACTIONS[contact.status]

  function quickAction(e: React.MouseEvent, action: Action) {
    e.stopPropagation()
    startTransition(async () => {
      try {
        await updateContactStatus(contact.id, action.target)
        toast.success(`Movido a ${action.label}`)
      } catch {
        toast.error('Error al actualizar')
      }
    })
  }

  return (
    <div
      className="contact-card"
      onClick={() => router.push(`/contact/${contact.id}`)}
      style={{
        background: unread ? '#0f1f35' : '#1a2539',
        border: '1px solid #1e2d45',
        borderLeft: `3px solid ${unread ? '#f97316' : cfg.dot}`,
        borderRadius: '10px',
        padding: '14px 16px',
        cursor: 'pointer',
        opacity: isPending ? 0.6 : 1,
        transition: 'all 0.15s',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#1e2d45' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = unread ? '#0f1f35' : '#1a2539' }}
    >
      {/* === DESKTOP layout === */}
      <div className="card-desktop">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <p style={{ fontSize: '15px', fontWeight: 700, color: unread ? '#ffffff' : '#f1f5f9', fontFamily: 'monospace', letterSpacing: '0.02em', margin: 0 }}>
                {phone}
              </p>
              {unread && (
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f97316', flexShrink: 0, boxShadow: '0 0 6px #f97316' }} />
              )}
            </div>
            <span style={{ display: 'inline-block', fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
              {cfg.label}
            </span>
          </div>
          <span style={{ fontSize: '12px', color: '#475569', flexShrink: 0, marginTop: '2px' }}>
            {timeAgo(contact.last_message_at)}
          </span>
        </div>
        <div style={{ padding: '8px 10px', background: '#0f172a', borderRadius: '7px', border: '1px solid #1e2d45' }}>
          <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: 0 }}>
            {preview}
          </p>
        </div>
        {actions.length > 0 && (
          <div style={{ display: 'flex', gap: '6px' }}>
            {actions.map(action => {
              const Icon = action.icon
              return (
                <button
                  key={action.target}
                  onClick={(e) => quickAction(e, action)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '6px 8px', background: action.bg, border: `1px solid ${action.border}`, borderRadius: '7px', color: action.color, fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.15s' }}
                >
                  <Icon size={12} />
                  {action.label}
                </button>
              )
            })}
          </div>
        )}
        {contact.status === 'pagado' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '6px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '7px', color: '#22c55e', fontSize: '12px', fontWeight: 600 }}>
            <CheckCircle size={12} /> Pagado
          </div>
        )}
      </div>

      {/* === MOBILE layout (estilo WhatsApp) === */}
      <div className="card-mobile">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Avatar circular */}
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0,
            background: cfg.bg, border: `2px solid ${cfg.dot}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: '16px', fontWeight: 700, color: cfg.color, fontFamily: 'monospace' }}>
              {contact.phone.slice(-2)}
            </span>
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
              <span style={{ fontSize: '15px', fontWeight: unread ? 800 : 600, color: unread ? '#ffffff' : '#f1f5f9', fontFamily: 'monospace', letterSpacing: '0.01em' }}>
                {phone}
              </span>
              <span style={{ fontSize: '11px', color: unread ? '#f97316' : '#475569', flexShrink: 0, marginLeft: '8px', fontWeight: unread ? 700 : 400 }}>
                {timeAgo(contact.last_message_at)}
              </span>
            </div>
            <p style={{ fontSize: '13px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
              {preview}
            </p>
          </div>

          {/* Badge no leído o dot de estado */}
          {unread
            ? <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f97316', flexShrink: 0, boxShadow: '0 0 6px #f97316' }} />
            : <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
          }
        </div>
      </div>
    </div>
  )
}
