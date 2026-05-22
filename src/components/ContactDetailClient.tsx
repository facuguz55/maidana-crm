'use client'
import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Copy, Check, Send, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { updateContactStatus, updateContactNotes } from '@/app/actions'
import { createClient } from '@/lib/supabase/client'
import { formatPhone, timeAgo } from '@/lib/utils'
import type { Contact, ContactStatus, Order, Message } from '@/lib/types'

const STATUS_OPTIONS: { value: ContactStatus; label: string }[] = [
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'frio', label: 'Frío' },
  { value: 'caliente', label: 'Caliente' },
  { value: 'verificar_pago', label: 'Verificar Pago' },
  { value: 'pagado', label: 'Pagado' },
]

const STATUS_COLORS: Record<ContactStatus, string> = {
  nuevo: '#3b82f6',
  frio: '#94a3b8',
  caliente: '#f97316',
  verificar_pago: '#f59e0b',
  pagado: '#22c55e',
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

  // Chat state
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll al fondo cuando llegan nuevos mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Realtime subscription para mensajes
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
      // Agregar mensaje localmente (el realtime también lo captará)
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

  return (
    <div style={{ background: '#0f172a', height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid #334155', background: '#1e293b', flexShrink: 0 }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem', display: 'flex' }}
        >
          <ArrowLeft size={22} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: STATUS_COLORS[contact.status], flexShrink: 0 }} />
            <span style={{ fontWeight: 700, fontSize: '1rem', color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {contact.name || formatPhone(contact.phone)}
            </span>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.125rem' }}>
            {formatPhone(contact.phone)} · {timeAgo(contact.last_message_at)}
          </p>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Info sections */}
        <div style={{ padding: '0.875rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

          {/* Status */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '0.875rem' }}>
            <h2 style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.625rem' }}>Estado</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleStatusChange(opt.value)}
                  disabled={isPending}
                  style={{
                    padding: '0.4rem 0.75rem', borderRadius: '0.5rem',
                    border: contact.status === opt.value ? `2px solid ${STATUS_COLORS[opt.value]}` : '1px solid #334155',
                    background: contact.status === opt.value ? `${STATUS_COLORS[opt.value]}20` : 'transparent',
                    color: contact.status === opt.value ? STATUS_COLORS[opt.value] : '#94a3b8',
                    fontSize: '0.78rem', fontWeight: contact.status === opt.value ? 700 : 400, cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Confirm pago */}
          {contact.status === 'verificar_pago' && !showPlanilla && (
            <button
              onClick={handleConfirmPago}
              disabled={isPending}
              style={{ width: '100%', padding: '0.875rem', background: '#22c55e', border: 'none', borderRadius: '0.75rem', color: '#fff', fontSize: '1rem', fontWeight: 700, cursor: 'pointer' }}
            >
              ✅ Confirmar Pago
            </button>
          )}

          {/* Planilla */}
          {(showPlanilla || contact.status === 'pagado') && !order && (
            <div style={{ background: '#1e293b', border: '1px solid #f59e0b50', borderRadius: '0.75rem', padding: '0.875rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
                <h2 style={{ color: '#f59e0b', fontSize: '0.85rem', fontWeight: 700 }}>📋 Planilla para enviar</h2>
                <button
                  onClick={copyPlanilla}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.4rem 0.625rem',
                    background: copied ? '#22c55e20' : 'rgba(249, 115, 22, 0.15)',
                    border: `1px solid ${copied ? '#22c55e40' : 'rgba(249, 115, 22, 0.4)'}`,
                    borderRadius: '0.5rem', color: copied ? '#22c55e' : '#f97316',
                    fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <pre style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.75rem', color: '#94a3b8', fontSize: '0.82rem', whiteSpace: 'pre-wrap', fontFamily: 'monospace', lineHeight: 1.6 }}>
{`Para completar tu pedido, respondé con este formato:

Nombre:
Dirección:
Cantidad:
Teléfono: `}
              </pre>
            </div>
          )}

          {/* Orden registrada */}
          {order && (
            <div style={{ background: '#1e293b', border: '1px solid #22c55e50', borderRadius: '0.75rem', padding: '0.875rem' }}>
              <h2 style={{ color: '#22c55e', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.625rem' }}>📦 Orden registrada</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <Row label="Nombre" value={order.name} />
                <Row label="Dirección" value={order.address} />
                <Row label="Cantidad" value={`${order.quantity} álbumes`} />
                <Row label="Teléfono" value={order.phone} />
                <Row label="Estado" value={order.status} highlight />
              </div>
            </div>
          )}

          {/* Notas */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '0.875rem' }}>
            <h2 style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.625rem' }}>Notas internas</h2>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Escribí notas sobre este contacto..."
              rows={3}
              style={{ width: '100%', padding: '0.625rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', color: '#f8fafc', fontSize: '0.875rem', resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
            />
            <button
              onClick={handleSaveNotes}
              disabled={isPending}
              style={{ marginTop: '0.5rem', padding: '0.5rem 1rem', background: notesSaved ? '#22c55e20' : 'rgba(249, 115, 22, 0.15)', border: `1px solid ${notesSaved ? '#22c55e40' : 'rgba(249, 115, 22, 0.4)'}`, borderRadius: '0.5rem', color: notesSaved ? '#22c55e' : '#f97316', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
            >
              {notesSaved ? '✅ Guardado' : 'Guardar notas'}
            </button>
          </div>

          {/* Separador Chat */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ flex: 1, height: '1px', background: '#334155' }} />
            <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>CONVERSACIÓN</span>
            <div style={{ flex: 1, height: '1px', background: '#334155' }} />
          </div>
        </div>

        {/* Messages list */}
        <div style={{ padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {messages.length === 0 && (
            <p style={{ textAlign: 'center', color: '#475569', fontSize: '0.8rem', padding: '1.5rem 0' }}>Sin mensajes aún</p>
          )}
          {messages.map(msg => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: msg.direction === 'outbound' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '78%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: msg.direction === 'outbound' ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
                  background: msg.direction === 'outbound' ? '#f97316' : '#1e293b',
                  border: msg.direction === 'outbound' ? 'none' : '1px solid #334155',
                  color: msg.direction === 'outbound' ? '#fff' : '#f8fafc',
                  fontSize: '0.875rem',
                  lineHeight: 1.4,
                  wordBreak: 'break-word',
                }}
              >
                <p>{msg.body}</p>
                <p style={{ fontSize: '0.68rem', opacity: 0.7, marginTop: '0.25rem', textAlign: 'right' }}>
                  {formatMsgTime(msg.timestamp)}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} style={{ height: '0.5rem' }} />
        </div>
      </div>

      {/* Chat input bar — fijo al fondo */}
      <div style={{ flexShrink: 0, background: '#1e293b', borderTop: '1px solid #334155', padding: '0.625rem 0.875rem' }}>
        {/* Botón enviar formulario */}
        <button
          onClick={handleSendForm}
          disabled={sending}
          style={{
            width: '100%', marginBottom: '0.5rem',
            padding: '0.5rem',
            background: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            borderRadius: '0.5rem',
            color: '#3b82f6',
            fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
          }}
        >
          <FileText size={14} />
          Enviar Formulario
        </button>

        {/* Input de texto */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
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
            style={{
              flex: 1, padding: '0.625rem 0.75rem',
              background: '#0f172a', border: '1px solid #334155',
              borderRadius: '0.75rem', color: '#f8fafc',
              fontSize: '0.9rem', outline: 'none',
              resize: 'none', fontFamily: 'inherit',
              lineHeight: 1.4, maxHeight: '120px', overflowY: 'auto',
            }}
          />
          <button
            onClick={() => sendMessage(messageText)}
            disabled={sending || !messageText.trim()}
            style={{
              padding: '0.625rem',
              background: messageText.trim() && !sending ? '#f97316' : '#334155',
              border: 'none', borderRadius: '0.75rem',
              color: '#fff', cursor: messageText.trim() && !sending ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'background 0.15s',
            }}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.875rem' }}>
      <span style={{ color: '#64748b', flexShrink: 0 }}>{label}</span>
      <span style={{ color: highlight ? '#f97316' : '#f8fafc', textAlign: 'right', fontWeight: highlight ? 600 : 400 }}>{value}</span>
    </div>
  )
}
