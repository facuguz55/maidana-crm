'use client'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Clock, DollarSign, Snowflake } from 'lucide-react'
import { toast } from 'sonner'
import { updateContactStatus } from '@/app/actions'
import { formatPhone, timeAgo } from '@/lib/utils'
import type { Contact, ContactStatus } from '@/lib/types'

const STATUS_CONFIG: Record<ContactStatus, {
  color: string
  bg: string
  border: string
  leftBorder: string
}> = {
  nuevo: {
    color: 'text-blue-400',
    bg: 'bg-blue-500/15',
    border: 'border-blue-500/30',
    leftBorder: 'border-l-blue-500',
  },
  frio: {
    color: 'text-slate-400',
    bg: 'bg-slate-700/30',
    border: 'border-slate-600/30',
    leftBorder: 'border-l-slate-600',
  },
  caliente: {
    color: 'text-orange-400',
    bg: 'bg-orange-500/15',
    border: 'border-orange-500/30',
    leftBorder: 'border-l-orange-500',
  },
  verificar_pago: {
    color: 'text-amber-400',
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/30',
    leftBorder: 'border-l-amber-500',
  },
  pagado: {
    color: 'text-green-400',
    bg: 'bg-green-500/15',
    border: 'border-green-500/30',
    leftBorder: 'border-l-green-500',
  },
}

function getInitials(name?: string | null, phone?: string): string {
  if (name && name.trim()) return name.trim().slice(0, 2).toUpperCase()
  return phone ? phone.slice(-2) : '??'
}

interface Props {
  contact: Contact
}

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
      className={`relative bg-slate-900 border border-slate-700 border-l-2 ${cfg.leftBorder} rounded-xl p-3.5 cursor-pointer transition-all duration-150 hover:bg-slate-800/70 hover:border-slate-700 active:scale-[0.99] ${isPending ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar con iniciales */}
        <div
          className={`flex-shrink-0 w-10 h-10 rounded-xl ${cfg.bg} border ${cfg.border} flex items-center justify-center`}
        >
          <span className={`text-sm font-bold ${cfg.color}`}>
            {getInitials(contact.name, contact.phone)}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="font-semibold text-sm text-slate-100 truncate">
              {contact.name || formatPhone(contact.phone)}
            </span>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Clock size={10} className="text-slate-600" />
              <span className="text-[10px] text-slate-500">{timeAgo(contact.last_message_at)}</span>
            </div>
          </div>

          {contact.name && (
            <p className="text-xs text-slate-500 mb-1">{formatPhone(contact.phone)}</p>
          )}

          {contact.last_message_preview && (
            <p className="text-xs text-slate-600 truncate leading-snug">
              {contact.last_message_preview}
            </p>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 mt-3">
        {contact.status !== 'verificar_pago' && contact.status !== 'pagado' && (
          <button
            onClick={(e) => quickAction(e, 'verificar_pago')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 bg-amber-500/10 border border-amber-500/25 rounded-lg text-amber-400 text-xs font-semibold transition-all hover:bg-amber-500/20 active:scale-[0.97]"
          >
            <DollarSign size={11} />
            Quiere pagar
          </button>
        )}
        {contact.status !== 'frio' && contact.status !== 'pagado' && (
          <button
            onClick={(e) => quickAction(e, 'frio')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 bg-slate-800/60 border border-slate-700/40 rounded-lg text-slate-400 text-xs font-semibold transition-all hover:bg-slate-700/60 active:scale-[0.97]"
          >
            <Snowflake size={11} />
            Frío
          </button>
        )}
        {contact.status === 'pagado' && (
          <div className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 bg-green-500/10 border border-green-500/25 rounded-lg text-green-400 text-xs font-semibold">
            ✅ Pagado
          </div>
        )}
      </div>
    </div>
  )
}
