'use client'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Clock, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { updateContactStatus } from '@/app/actions'
import { formatPhone, timeAgo } from '@/lib/utils'
import type { Contact, ContactStatus } from '@/lib/types'

const STATUS_CONFIG: Record<ContactStatus, { color: string; bg: string; dot: string; label: string }> = {
  nuevo: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', dot: '#3b82f6', label: 'Nuevo' },
  frio: { color: '#64748b', bg: 'rgba(100,116,139,0.1)', dot: '#64748b', label: 'Frío' },
  caliente: { color: '#f97316', bg: 'rgba(249,115,22,0.1)', dot: '#f97316', label: 'Caliente' },
  verificar_pago: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', dot: '#f59e0b', label: 'Verificar pago' },
  pagado: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', dot: '#22c55e', label: 'Pagado' },
}

function getInitials(name?: string | null, phone?: string): string {
  if (name && name.trim()) return name.trim().slice(0, 2).toUpperCase()
  return phone ? phone.slice(-2) : '??'
}

interface Props { contact: Contact }

export default function ContactCard({ contact }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const cfg = STATUS_CONFIG[contact.status]

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
      onClick={() => router.push(`/contact/${contact.id}`)}
      style={{
        background: '#1e293b',
        border: '1px solid #1e2d45',
        borderLeft: `3px solid ${cfg.dot}`,
        borderRadius: '10px',
        padding: '16px',
        cursor: 'pointer',
        opacity: isPending ? 0.6 : 1,
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#2d3f5a'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#1e2d45'; (e.currentTarget as HTMLDivElement).style.borderLeftColor = cfg.dot; (e.currentTarget as HTMLDivElement).style.transform = 'none' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
          {/* Avatar */}
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
            background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: cfg.color }}>
              {getInitials(contact.name, contact.phone)}
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {contact.name || formatPhone(contact.phone)}
            </p>
            {contact.name && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b', fontSize: '12px' }}>
                <Phone size={10} />
                <span>{formatPhone(contact.phone)}</span>
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
          <span style={{
            fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px',
            background: cfg.bg, color: cfg.color,
          }}>
            {cfg.label}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#475569', fontSize: '11px' }}>
            <Clock size={10} />
            <span>{timeAgo(contact.last_message_at)}</span>
          </div>
        </div>
      </div>

      {contact.last_message_preview && (
        <p style={{ fontSize: '12px', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '12px' }}>
          {contact.last_message_preview}
        </p>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {contact.status !== 'verificar_pago' && contact.status !== 'pagado' && (
          <button
            onClick={(e) => quickAction(e, 'verificar_pago')}
            style={{
              flex: 1, padding: '6px 12px',
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: '7px', color: '#f59e0b', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            💰 Quiere pagar
          </button>
        )}
        {contact.status !== 'frio' && contact.status !== 'pagado' && (
          <button
            onClick={(e) => quickAction(e, 'frio')}
            style={{
              flex: 1, padding: '6px 12px',
              background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.2)',
              borderRadius: '7px', color: '#64748b', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            🥶 Frío
          </button>
        )}
        {contact.status === 'pagado' && (
          <div style={{
            flex: 1, padding: '6px 12px', textAlign: 'center',
            background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)',
            borderRadius: '7px', color: '#22c55e', fontSize: '12px', fontWeight: 600,
          }}>
            ✅ Pagado
          </div>
        )}
      </div>
    </div>
  )
}
