'use client'
import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Copy, Check, Send, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { updateContactStatus, updateContactNotes } from '@/app/actions'
import { createClient } from '@/lib/supabase/client'
import { formatPhone, timeAgo } from '@/lib/utils'
import type { Contact, ContactStatus, Order, Message } from '@/lib/types'

const STATUS_OPTIONS: { value: ContactStatus; label: string; color: string; bg: string }[] = [
  { value: 'nuevo', label: 'Nuevo', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  { value: 'frio', label: 'Frío', color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
  { value: 'caliente', label: 'Caliente', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  { value: 'verificar_pago', label: 'Verificar Pago', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  { value: 'pagado', label: 'Pagado', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
]

const STATUS_DOT: Record<ContactStatus, string> = {
  nuevo: '#3b82f6', frio: '#64748b', caliente: '#f97316', verificar_pago: '#f59e0b', pagado: '#22c55e',
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

  // Marcar como leído al abrir el chat
  useEffect(() => {
    fetch('/api/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId: contact.id }),
    }).catch(() => {})
  }, [contact.id])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`messages-${contact.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `contact_id=eq.${contact.id}` },
        (payload) => {
          const msg = payload.new as Message
          // Los mensajes outbound ya se agregan optimisticamente al enviar
          if (msg.direction === 'outbound') return
          setMessages(prev => [...prev, msg])
          // Marcar como leído y reproducir sonido al recibir mensaje
          fetch('/api/mark-read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contactId: contact.id }),
          }).catch(() => {})
          try {
            const ctx = new AudioContext()
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain)
            gain.connect(ctx.destination)
            osc.frequency.value = 880
            gain.gain.setValueAtTime(0.08, ctx.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
            osc.start(ctx.currentTime)
            osc.stop(ctx.currentTime + 0.25)
          } catch {}
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [contact.id])

  async function sendMessage(text: string) {
    if (!text.trim() || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/send-message', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: contact.id, phone: contact.phone, text }),
      })
      if (!res.ok) { const err = await res.json(); toast.error(err.error || 'Error al enviar'); return }
      setMessages(prev => [...prev, { id: crypto.randomUUID(), contact_id: contact.id, body: text, direction: 'outbound', timestamp: new Date().toISOString() }])
      setMessageText('')
    } catch { toast.error('Error de red al enviar') }
    finally { setSending(false) }
  }

  async function handleSendForm() {
    const supabase = createClient()
    const { data: settings } = await supabase.from('settings').select('form_message').eq('id', 1).single()
    const msg = settings?.form_message
    if (!msg) { toast.error('Configurá el mensaje del formulario en Settings'); return }
    await sendMessage(msg)
  }

  async function handleStatusChange(newStatus: ContactStatus) {
    startTransition(async () => {
      try {
        await updateContactStatus(contact.id, newStatus)
        setContact(prev => ({ ...prev, status: newStatus }))
        if (newStatus === 'pagado') setShowPlanilla(true)
        toast.success('Estado actualizado')
      } catch { toast.error('Error al actualizar') }
    })
  }

  async function handleSaveNotes() {
    startTransition(async () => {
      try {
        await updateContactNotes(contact.id, notes)
        setNotesSaved(true)
        setTimeout(() => setNotesSaved(false), 2000)
        toast.success('Notas guardadas')
      } catch { toast.error('Error al guardar') }
    })
  }

  async function handleConfirmPago() {
    startTransition(async () => {
      try {
        await updateContactStatus(contact.id, 'pagado')
        setContact(prev => ({ ...prev, status: 'pagado' }))
        setShowPlanilla(true)
        toast.success('✅ Pago confirmado')
      } catch { toast.error('Error al confirmar') }
    })
  }

  function copyPlanilla() {
    navigator.clipboard.writeText(`Para completar tu pedido, respondé con este formato:\n\nNombre: \nDirección: \nCantidad: \nTeléfono: `)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('¡Planilla copiada!')
  }

  function formatMsgTime(ts: string) {
    return new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  }

  const displayName = contact.name || formatPhone(contact.phone)
  const statusColor = STATUS_DOT[contact.status]

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0f172a', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px', borderBottom: '1px solid #1e2d45', background: '#0d1526',
        display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0,
      }}>
        <button
          onClick={() => router.back()}
          style={{ padding: '8px', background: '#1e293b', border: '1px solid #1e2d45', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}
        >
          <ArrowLeft size={16} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: statusColor, flexShrink: 0, display: 'inline-block' }} />
          <h1 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>{displayName}</h1>
          <span style={{ fontSize: '13px', color: '#64748b' }}>{formatPhone(contact.phone)}</span>
          <span style={{ fontSize: '12px', color: '#475569' }}>· {timeAgo(contact.last_message_at)}</span>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left panel — info */}
        <div style={{ width: '360px', flexShrink: 0, borderRight: '1px solid #1e2d45', overflowY: 'auto', padding: '20px' }}>

          {/* Status */}
          <Section title="Estado">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleStatusChange(opt.value)}
                  disabled={isPending}
                  style={{
                    padding: '6px 14px', borderRadius: '7px', fontSize: '13px', fontWeight: 500,
                    cursor: 'pointer', transition: 'all 0.15s',
                    background: contact.status === opt.value ? opt.bg : 'transparent',
                    border: `1px solid ${contact.status === opt.value ? opt.color + '50' : '#1e2d45'}`,
                    color: contact.status === opt.value ? opt.color : '#64748b',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Section>

          {contact.status === 'verificar_pago' && !showPlanilla && (
            <button
              onClick={handleConfirmPago}
              disabled={isPending}
              style={{
                width: '100%', padding: '12px', marginBottom: '16px',
                background: '#22c55e', border: 'none', borderRadius: '9px',
                color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              ✅ Confirmar Pago
            </button>
          )}

          {(showPlanilla || contact.status === 'pagado') && !order && (
            <Section title="Planilla para enviar">
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                <button
                  onClick={copyPlanilla}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px',
                    background: copied ? 'rgba(34,197,94,0.12)' : 'rgba(249,115,22,0.12)',
                    border: `1px solid ${copied ? '#22c55e40' : '#f9731640'}`,
                    borderRadius: '7px', color: copied ? '#22c55e' : '#f97316',
                    fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <pre style={{ background: '#0d1526', border: '1px solid #1e2d45', borderRadius: '8px', padding: '12px', color: '#94a3b8', fontSize: '12px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', lineHeight: 1.6 }}>
{`Para completar tu pedido, respondé con este formato:\n\nNombre:\nDirección:\nCantidad:\nTeléfono:`}
              </pre>
            </Section>
          )}

          {order && (
            <Section title="Orden registrada">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Row label="Nombre" value={order.name} />
                <Row label="Dirección" value={order.address} />
                <Row label="Cantidad" value={`${order.quantity} álbumes`} />
                <Row label="Teléfono" value={order.phone} />
                <Row label="Estado" value={order.status} highlight />
              </div>
            </Section>
          )}

          <Section title="Notas internas">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Escribí notas sobre este contacto..."
              rows={4}
              style={{
                width: '100%', padding: '10px', background: '#0d1526',
                border: '1px solid #1e2d45', borderRadius: '8px',
                color: '#f8fafc', fontSize: '13px', resize: 'vertical',
                outline: 'none', fontFamily: 'inherit', lineHeight: 1.5,
              }}
            />
            <button
              onClick={handleSaveNotes}
              disabled={isPending}
              style={{
                marginTop: '8px', padding: '7px 16px', borderRadius: '7px', fontSize: '13px',
                fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                background: notesSaved ? 'rgba(34,197,94,0.12)' : 'rgba(249,115,22,0.12)',
                border: `1px solid ${notesSaved ? '#22c55e40' : '#f9731640'}`,
                color: notesSaved ? '#22c55e' : '#f97316',
              }}
            >
              {notesSaved ? '✅ Guardado' : 'Guardar notas'}
            </button>
          </Section>
        </div>

        {/* Right panel — chat */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e2d45', fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Conversación
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {messages.length === 0 && (
              <p style={{ textAlign: 'center', color: '#475569', fontSize: '13px', marginTop: '40px' }}>Sin mensajes aún</p>
            )}
            {messages.map(msg => (
              <div key={msg.id} style={{ display: 'flex', justifyContent: msg.direction === 'outbound' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '65%', padding: '10px 14px', fontSize: '13px', lineHeight: 1.5,
                  borderRadius: msg.direction === 'outbound' ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                  background: msg.direction === 'outbound' ? '#f97316' : '#1e293b',
                  border: msg.direction === 'outbound' ? 'none' : '1px solid #1e2d45',
                  color: msg.direction === 'outbound' ? '#fff' : '#f8fafc',
                  wordBreak: 'break-word',
                }}>
                  <p>{msg.body}</p>
                  <p style={{ fontSize: '10px', opacity: 0.65, marginTop: '4px', textAlign: 'right' }}>
                    {formatMsgTime(msg.timestamp)}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ borderTop: '1px solid #1e2d45', padding: '14px 16px', background: '#0d1526' }}>
            <button
              onClick={handleSendForm}
              disabled={sending}
              style={{
                width: '100%', marginBottom: '10px', padding: '8px',
                background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)',
                borderRadius: '8px', color: '#3b82f6', fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}
            >
              <FileText size={14} />
              Enviar Formulario
            </button>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <textarea
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(messageText) } }}
                placeholder="Escribí un mensaje... (Enter para enviar)"
                rows={2}
                style={{
                  flex: 1, padding: '10px 14px', background: '#1e293b',
                  border: '1px solid #1e2d45', borderRadius: '10px',
                  color: '#f8fafc', fontSize: '13px', resize: 'none',
                  outline: 'none', fontFamily: 'inherit', lineHeight: 1.4,
                  maxHeight: '120px',
                }}
              />
              <button
                onClick={() => sendMessage(messageText)}
                disabled={sending || !messageText.trim()}
                style={{
                  width: '42px', height: '42px', borderRadius: '10px', flexShrink: 0,
                  background: messageText.trim() && !sending ? '#f97316' : '#1e293b',
                  border: 'none', cursor: messageText.trim() && !sending ? 'pointer' : 'default',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s',
                }}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <h2 style={{ fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>{title}</h2>
      <div style={{ background: '#1e293b', border: '1px solid #1e2d45', borderRadius: '10px', padding: '14px' }}>
        {children}
      </div>
    </div>
  )
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '13px' }}>
      <span style={{ color: '#64748b', flexShrink: 0 }}>{label}</span>
      <span style={{ color: highlight ? '#f97316' : '#f8fafc', fontWeight: highlight ? 600 : 400, textAlign: 'right' }}>{value}</span>
    </div>
  )
}
