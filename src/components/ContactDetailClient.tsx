'use client'
import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Copy, Check, Send, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { updateContactStatus, updateContactNotes } from '@/app/actions'
import { createClient } from '@/lib/supabase/client'
import { formatPhone, timeAgo } from '@/lib/utils'
import type { Contact, ContactStatus, Order, Message } from '@/lib/types'

const STATUS_OPTIONS: { value: ContactStatus; label: string; color: string; bg: string; border: string }[] = [
  { value: 'nuevo', label: 'Nuevo', color: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/40' },
  { value: 'frio', label: 'Frío', color: 'text-slate-400', bg: 'bg-slate-700/40', border: 'border-slate-600/40' },
  { value: 'caliente', label: 'Caliente', color: 'text-orange-400', bg: 'bg-orange-500/15', border: 'border-orange-500/40' },
  { value: 'verificar_pago', label: 'Verificar Pago', color: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/40' },
  { value: 'pagado', label: 'Pagado', color: 'text-green-400', bg: 'bg-green-500/15', border: 'border-green-500/40' },
]

const STATUS_DOT: Record<ContactStatus, string> = {
  nuevo: 'bg-blue-500',
  frio: 'bg-slate-500',
  caliente: 'bg-orange-500',
  verificar_pago: 'bg-amber-500',
  pagado: 'bg-green-500',
}

const STATUS_AVATAR: Record<ContactStatus, { color: string; bg: string; border: string }> = {
  nuevo: { color: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/30' },
  frio: { color: 'text-slate-400', bg: 'bg-slate-700/40', border: 'border-slate-600/30' },
  caliente: { color: 'text-orange-400', bg: 'bg-orange-500/15', border: 'border-orange-500/30' },
  verificar_pago: { color: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30' },
  pagado: { color: 'text-green-400', bg: 'bg-green-500/15', border: 'border-green-500/30' },
}

interface Props {
  contact: Contact
  order: Order | null
  initialMessages: Message[]
}

export default function ContactDetailClient({ contact: initialContact, order, initialMessages }: Props) {
  const router = useRouter()
  const [contact, setContact] = useState(initialContact)
  const [notes, setNotes] = useState(contact.notes ?? '')
  const [notesSaved, setNotesSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [showPlanilla, setShowPlanilla] = useState(false)
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`messages-${contact.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `contact_id=eq.${contact.id}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [contact.id])

  async function sendMessage(text: string) {
    if (!text.trim() || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: contact.id, phone: contact.phone, text }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Error al enviar')
        return
      }
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        contact_id: contact.id,
        body: text,
        direction: 'outbound',
        timestamp: new Date().toISOString(),
      }])
      setMessageText('')
    } catch {
      toast.error('Error de red al enviar')
    } finally {
      setSending(false)
    }
  }

  async function handleSendForm() {
    const supabase = createClient()
    const { data: settings } = await supabase
      .from('settings')
      .select('form_message')
      .eq('id', 1)
      .single()
    const msg = settings?.form_message
    if (!msg) {
      toast.error('Configurá el mensaje del formulario en Settings')
      return
    }
    await sendMessage(msg)
  }

  async function handleStatusChange(newStatus: ContactStatus) {
    startTransition(async () => {
      try {
        await updateContactStatus(contact.id, newStatus)
        setContact(prev => ({ ...prev, status: newStatus }))
        if (newStatus === 'pagado') setShowPlanilla(true)
        toast.success('Estado actualizado')
      } catch {
        toast.error('Error al actualizar')
      }
    })
  }

  async function handleSaveNotes() {
    startTransition(async () => {
      try {
        await updateContactNotes(contact.id, notes)
        setNotesSaved(true)
        setTimeout(() => setNotesSaved(false), 2000)
        toast.success('Notas guardadas')
      } catch {
        toast.error('Error al guardar')
      }
    })
  }

  async function handleConfirmPago() {
    startTransition(async () => {
      try {
        await updateContactStatus(contact.id, 'pagado')
        setContact(prev => ({ ...prev, status: 'pagado' }))
        setShowPlanilla(true)
        toast.success('✅ Pago confirmado')
      } catch {
        toast.error('Error al confirmar')
      }
    })
  }

  function copyPlanilla() {
    const planilla = `Para completar tu pedido, respondé con este formato:\n\nNombre: \nDirección: \nCantidad: \nTeléfono: `
    navigator.clipboard.writeText(planilla)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('¡Planilla copiada!')
  }

  function formatMsgTime(ts: string) {
    const d = new Date(ts)
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  }

  const avatarCfg = STATUS_AVATAR[contact.status]
  const displayName = contact.name || formatPhone(contact.phone)
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <div className="bg-slate-950 h-[100dvh] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 flex items-center gap-3 bg-slate-900/90 backdrop-blur-sm border-b border-slate-800">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-all active:scale-95"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div
            className={`flex-shrink-0 w-9 h-9 rounded-xl ${avatarCfg.bg} border ${avatarCfg.border} flex items-center justify-center`}
          >
            <span className={`text-sm font-bold ${avatarCfg.color}`}>{initials}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[contact.status]}`} />
              <span className="font-bold text-sm text-slate-100 truncate">{displayName}</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {formatPhone(contact.phone)} · {timeAgo(contact.last_message_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-3">

          {/* Status selector */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Estado</h2>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleStatusChange(opt.value)}
                  disabled={isPending}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all active:scale-95 ${
                    contact.status === opt.value
                      ? `${opt.bg} ${opt.border} ${opt.color}`
                      : 'bg-slate-800/50 border-slate-700/50 text-slate-500 hover:text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Confirmar pago */}
          {contact.status === 'verificar_pago' && !showPlanilla && (
            <button
              onClick={handleConfirmPago}
              disabled={isPending}
              className="w-full py-3.5 bg-green-500 hover:bg-green-400 rounded-xl text-white text-sm font-bold transition-all active:scale-[0.99] shadow-lg shadow-green-500/20"
            >
              ✅ Confirmar Pago
            </button>
          )}

          {/* Planilla */}
          {(showPlanilla || contact.status === 'pagado') && !order && (
            <div className="bg-slate-900 border border-amber-500/20 rounded-xl p-3.5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-amber-400 text-sm font-bold">📋 Planilla para enviar</h2>
                <button
                  onClick={copyPlanilla}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all active:scale-95 ${
                    copied
                      ? 'bg-green-500/15 border-green-500/30 text-green-400'
                      : 'bg-orange-500/15 border-orange-500/30 text-orange-400 hover:bg-orange-500/25'
                  }`}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-400 text-xs whitespace-pre-wrap font-mono leading-relaxed">
{`Para completar tu pedido, respondé con este formato:\n\nNombre:\nDirección:\nCantidad:\nTeléfono:`}
              </pre>
            </div>
          )}

          {/* Orden registrada */}
          {order && (
            <div className="bg-slate-900 border border-green-500/20 rounded-xl p-3.5">
              <h2 className="text-green-400 text-sm font-bold mb-3">📦 Orden registrada</h2>
              <div className="space-y-2">
                <Row label="Nombre" value={order.name} />
                <Row label="Dirección" value={order.address} />
                <Row label="Cantidad" value={`${order.quantity} álbumes`} />
                <Row label="Teléfono" value={order.phone} />
                <Row label="Estado" value={order.status} highlight />
              </div>
            </div>
          )}

          {/* Notas */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Notas internas</h2>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Escribí notas sobre este contacto..."
              rows={3}
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-sm resize-none outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 placeholder:text-slate-600 transition-all font-sans"
            />
            <button
              onClick={handleSaveNotes}
              disabled={isPending}
              className={`mt-2.5 px-4 py-2 rounded-lg text-xs font-semibold border transition-all active:scale-95 ${
                notesSaved
                  ? 'bg-green-500/15 border-green-500/30 text-green-400'
                  : 'bg-orange-500/15 border-orange-500/30 text-orange-400 hover:bg-orange-500/25'
              }`}
            >
              {notesSaved ? '✅ Guardado' : 'Guardar notas'}
            </button>
          </div>

          {/* Separador */}
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em]">Conversación</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>
        </div>

        {/* Messages */}
        <div className="px-4 pb-3 space-y-2">
          {messages.length === 0 && (
            <p className="text-center text-slate-600 text-xs py-8">Sin mensajes aún</p>
          )}
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[78%] px-3.5 py-2.5 text-sm leading-snug break-words ${
                  msg.direction === 'outbound'
                    ? 'bg-orange-500 text-white rounded-2xl rounded-br-sm shadow-lg shadow-orange-500/20'
                    : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl rounded-bl-sm'
                }`}
              >
                <p>{msg.body}</p>
                <p className={`text-[10px] mt-1 text-right ${msg.direction === 'outbound' ? 'text-orange-100/60' : 'text-slate-600'}`}>
                  {formatMsgTime(msg.timestamp)}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} className="h-2" />
        </div>
      </div>

      {/* Chat input bar */}
      <div className="flex-shrink-0 bg-slate-900 border-t border-slate-800 p-3 space-y-2">
        <button
          onClick={handleSendForm}
          disabled={sending}
          className="w-full py-2 px-4 bg-blue-500/15 border border-blue-500/30 rounded-xl text-blue-400 text-xs font-semibold flex items-center justify-center gap-2 transition-all hover:bg-blue-500/25 active:scale-[0.99]"
        >
          <FileText size={13} />
          Enviar Formulario
        </button>

        <div className="flex gap-2 items-end">
          <textarea
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage(messageText)
              }
            }}
            placeholder="Escribí un mensaje..."
            rows={1}
            style={{ maxHeight: '120px' }}
            className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm resize-none outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 placeholder:text-slate-600 font-sans leading-snug overflow-y-auto transition-all"
          />
          <button
            onClick={() => sendMessage(messageText)}
            disabled={sending || !messageText.trim()}
            className={`w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all active:scale-95 ${
              messageText.trim() && !sending
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25 hover:bg-orange-400'
                : 'bg-slate-800 text-slate-600'
            }`}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-slate-500 flex-shrink-0">{label}</span>
      <span className={`${highlight ? 'text-orange-400 font-semibold' : 'text-slate-200'} text-right`}>{value}</span>
    </div>
  )
}
