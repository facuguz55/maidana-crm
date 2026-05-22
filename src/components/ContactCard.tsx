'use client'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { updateContactStatus } from '@/app/actions'
import { formatPhone, timeAgo } from '@/lib/utils'
import type { Contact, ContactStatus } from '@/lib/types'

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

  function quickAction(e: React.MouseEvent, status: ContactStatus) {
    e.stopPropagation()
    startTransition(async () => {
      try {
        await updateContactStatus(contact.id, status)
        toast.success(status === 'verificar_pago' ? '💰 Movido a Verificar Pago' : '🥶 Marcado como Frío')
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
        <div style={{ display: 'flex', gap: '8px' }}>
          {contact.status !== 'verificar_pago' && contact.status !== 'pagado' && (
            <button onClick={(e) => quickAction(e, 'verificar_pago')} style={{ flex: 1, padding: '6px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '7px', color: '#f59e0b', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              💰 Quiere pagar
            </button>
          )}
          {contact.status !== 'frio' && contact.status !== 'pagado' && (
            <button onClick={(e) => quickAction(e, 'frio')} style={{ flex: 1, padding: '6px', background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.2)', borderRadius: '7px', color: '#64748b', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              🥶 Frío
            </button>
          )}
          {contact.status === 'pagado' && (
            <div style={{ flex: 1, padding: '6px', textAlign: 'center', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '7px', color: '#22c55e', fontSize: '12px', fontWeight: 600 }}>
              ✅ Pagado
            </div>
          )}
        </div>
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
