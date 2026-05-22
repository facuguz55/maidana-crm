'use client'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Phone, Clock, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { updateContactStatus } from '@/app/actions'
import { formatPhone, timeAgo } from '@/lib/utils'
import type { Contact, ContactStatus } from '@/lib/types'

const STATUS_DOT: Record<ContactStatus, string> = {
  nuevo: '#3b82f6',
  frio: '#94a3b8',
  caliente: '#f97316',
  verificar_pago: '#f59e0b',
  pagado: '#22c55e',
}

interface Props {
  contact: Contact
}

export default function ContactCard({ contact }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

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
        border: '1px solid #334155',
        borderRadius: '0.75rem',
        padding: '0.875rem',
        cursor: 'pointer',
        opacity: isPending ? 0.6 : 1,
        transition: 'all 0.15s',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span
              style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: STATUS_DOT[contact.status], flexShrink: 0,
              }}
            />
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {contact.name || formatPhone(contact.phone)}
            </span>
          </div>
          {contact.name && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.375rem' }}>
              <Phone size={11} />
              <span>{formatPhone(contact.phone)}</span>
            </div>
          )}
          {contact.last_message_preview && (
            <p style={{ color: '#64748b', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {contact.last_message_preview}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#64748b', fontSize: '0.75rem', flexShrink: 0 }}>
          <Clock size={11} />
          <span>{timeAgo(contact.last_message_at)}</span>
          <ChevronRight size={14} style={{ color: '#334155', marginLeft: '0.25rem' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
        {contact.status !== 'verificar_pago' && contact.status !== 'pagado' && (
          <button
            onClick={(e) => quickAction(e, 'verificar_pago')}
            style={{
              flex: 1, padding: '0.5rem 0.25rem',
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: '0.5rem', color: '#f59e0b',
              fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            💰 Quiere pagar
          </button>
        )}
        {contact.status !== 'frio' && contact.status !== 'pagado' && (
          <button
            onClick={(e) => quickAction(e, 'frio')}
            style={{
              flex: 1, padding: '0.5rem 0.25rem',
              background: 'rgba(148, 163, 184, 0.1)',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              borderRadius: '0.5rem', color: '#94a3b8',
              fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            🥶 Frío
          </button>
        )}
        {contact.status === 'pagado' && (
          <span style={{
            flex: 1, padding: '0.5rem', textAlign: 'center',
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '0.5rem', color: '#22c55e',
            fontSize: '0.75rem', fontWeight: 600,
          }}>
            ✅ Pagado
          </span>
        )}
      </div>
    </div>
  )
}
