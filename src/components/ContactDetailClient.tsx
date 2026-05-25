'use client'
import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Copy, Check, Send, FileText, Calendar, Paperclip, Mic, MicOff, X, Play } from 'lucide-react'
import { toast } from 'sonner'
import { updateContactStatus, updateContactNotes, updateContactName, toggleScheduled } from '@/app/actions'
import { createClient } from '@/lib/supabase/client'
import { formatPhone, timeAgo } from '@/lib/utils'
import type { Contact, ContactStatus, Order, Message } from '@/lib/types'

const STATUS_OPTIONS: { value: ContactStatus; label: string; color: string; bg: string }[] = [
  { value: 'nuevo', label: 'General', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  { value: 'frio', label: 'Frío', color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
  { value: 'caliente', label: 'Caliente', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
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
  const [contactName, setContactName] = useState(contact.name ?? '')
  const [nameSaved, setNameSaved] = useState(false)
  const [scheduled, setScheduled] = useState(contact.scheduled ?? false)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [showPlanilla, setShowPlanilla] = useState(false)
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pendingOutbound = useRef<Set<string>>(new Set())
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // Sincronizar historial de mensajes desde Evolution API
  useEffect(() => {
    let cancelled = false
    async function syncHistory() {
      setSyncing(true)
      try {
        const res = await fetch('/api/fetch-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contactId: contact.id, phone: contact.phone }),
        })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          toast.error(`Historial: ${data.error || 'Error al sincronizar'}`)
          return
        }
        if (data.debug) {
          console.log('[fetch-history debug]', data.debug)
        }
        if (data.saved > 0) {
          toast.success(`${data.saved} mensajes sincronizados`)
          const { createClient } = await import('@/lib/supabase/client')
          const supabase = createClient()
          const { data: fresh } = await supabase
            .from('messages')
            .select('*')
            .eq('contact_id', contact.id)
            .order('timestamp', { ascending: true })
          if (fresh && !cancelled) setMessages(fresh as Message[])
        } else if (data.tried) {
          console.log('[fetch-history] Sin mensajes nuevos. Endpoints probados:', data.tried)
        }
      } catch (err) {
        if (!cancelled) toast.error('Historial: error de red')
        console.error('[fetch-history]', err)
      } finally {
        if (!cancelled) setSyncing(false)
      }
    }
    syncHistory()
    return () => { cancelled = true }
  }, [contact.id, contact.phone])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`messages-${contact.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `contact_id=eq.${contact.id}` },
        (payload) => {
          const msg = payload.new as Message

          if (msg.direction === 'outbound') {
            // Si es un mensaje que enviamos desde el CRM, ya está en pantalla (optimistic).
            // Si es un mensaje automático/bot/teléfono, lo mostramos.
            if (pendingOutbound.current.has(msg.body)) {
              pendingOutbound.current.delete(msg.body)
              return // ya está como optimistic
            }
            setMessages(prev => [...prev, msg])
            return
          }

          // Inbound: agregar + sonido + marcar leído
          setMessages(prev => [...prev, msg])
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
      // Registro en pending para que el webhook outbound no duplique
      pendingOutbound.current.add(text)
      setMessages(prev => [...prev, { id: crypto.randomUUID(), contact_id: contact.id, body: text, direction: 'outbound', timestamp: new Date().toISOString(), media_type: null, media_url: null }])
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

  async function handleSaveName() {
    startTransition(async () => {
      try {
        await updateContactName(contact.id, contactName)
        setContact(prev => ({ ...prev, name: contactName.trim() || null }))
        setNameSaved(true)
        setTimeout(() => setNameSaved(false), 2000)
        toast.success('Nombre guardado')
      } catch { toast.error('Error al guardar el nombre') }
    })
  }

  async function handleToggleScheduled() {
    const next = !scheduled
    startTransition(async () => {
      try {
        await toggleScheduled(contact.id, next)
        setScheduled(next)
        toast.success(next ? '📅 Contacto agendado' : 'Agenda removida')
      } catch { toast.error('Error al agendar') }
    })
  }

  async function sendMedia(mediaType: 'image' | 'audio', base64: string, mimeType: string, caption?: string) {
    setSending(true)
    const body = caption || (mediaType === 'image' ? '📷 Imagen' : '🎵 Audio')
    const tempId = crypto.randomUUID()
    const optimistic: Message = {
      id: tempId,
      contact_id: contact.id,
      body,
      direction: 'outbound',
      timestamp: new Date().toISOString(),
      media_type: mediaType,
      media_url: base64,
    }
    // Registrar en pending para que el realtime no duplique cuando el DB insert dispare
    pendingOutbound.current.add(body)
    setMessages(prev => [...prev, optimistic])
    setImagePreview(null)
    try {
      const res = await fetch('/api/send-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: contact.id, phone: contact.phone, mediaType, base64, mimeType, caption }),
      })
      if (!res.ok) {
        const err = await res.json()
        pendingOutbound.current.delete(body)
        setMessages(prev => prev.filter(m => m.id !== tempId))
        toast.error(err.error || 'Error al enviar')
        return
      }
      const result = await res.json()
      if (result.url) {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, media_url: result.url } : m))
      }
    } catch {
      pendingOutbound.current.delete(body)
      setMessages(prev => prev.filter(m => m.id !== tempId))
      toast.error('Error de red al enviar')
    }
    finally { setSending(false) }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { toast.error('Imagen demasiado grande (máx 10MB)'); return }
    const reader = new FileReader()
    reader.onload = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function handleSendImage() {
    if (!imagePreview) return
    const mimeType = imagePreview.split(';')[0].split(':')[1] || 'image/jpeg'
    await sendMedia('image', imagePreview, mimeType)
  }

  // Usamos ref para que stopRecording siempre capture el contact actual sin closure stale
  const contactRef = useRef(contact)
  useEffect(() => { contactRef.current = contact }, [contact])

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      audioChunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.start(100)
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      setRecordingSeconds(0)
      recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000)
    } catch { toast.error('No se pudo acceder al micrófono') }
  }

  async function stopRecording() {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    setIsRecording(false)
    setRecordingSeconds(0)
    recorder.stop()
    recorder.stream.getTracks().forEach(t => t.stop())
    await new Promise<void>(resolve => { recorder.onstop = () => resolve() })
    const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = reader.result as string
      await sendMedia('audio', base64, blob.type)
    }
    reader.readAsDataURL(blob)
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: statusColor, flexShrink: 0, display: 'inline-block' }} />
          <h1 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>{displayName}</h1>
          <span style={{ fontSize: '13px', color: '#64748b' }}>{formatPhone(contact.phone)}</span>
          <span suppressHydrationWarning style={{ fontSize: '12px', color: '#475569' }}>· {timeAgo(contact.last_message_at)}</span>
          {scheduled && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.35)', borderRadius: '999px', fontSize: '11px', color: '#818cf8', fontWeight: 600 }}>
              <Calendar size={10} /> Agendado
            </span>
          )}
        </div>
        <button
          onClick={handleToggleScheduled}
          disabled={isPending}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px',
            background: scheduled ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)',
            border: `1px solid ${scheduled ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.25)'}`,
            borderRadius: '8px', color: scheduled ? '#818cf8' : '#64748b',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer', flexShrink: 0,
          }}
        >
          <Calendar size={14} />
          {scheduled ? 'Agendado ✓' : 'Agendar contacto'}
        </button>
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

          <Section title="Nombre del contacto">
            <input
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveName() }}
              placeholder="Ej: Juan García"
              style={{
                width: '100%', padding: '10px', background: '#0d1526',
                border: '1px solid #1e2d45', borderRadius: '8px',
                color: '#f8fafc', fontSize: '13px',
                outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
            <button
              onClick={handleSaveName}
              disabled={isPending}
              style={{
                marginTop: '8px', padding: '7px 16px', borderRadius: '7px', fontSize: '13px',
                fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                background: nameSaved ? 'rgba(34,197,94,0.12)' : 'rgba(99,102,241,0.12)',
                border: `1px solid ${nameSaved ? '#22c55e40' : 'rgba(99,102,241,0.3)'}`,
                color: nameSaved ? '#22c55e' : '#818cf8',
              }}
            >
              {nameSaved ? '✅ Guardado' : 'Guardar nombre'}
            </button>
          </Section>

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
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e2d45', fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Conversación
            {syncing && <span style={{ fontSize: '10px', color: '#475569', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>sincronizando...</span>}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {messages.length === 0 && (
              <p style={{ textAlign: 'center', color: '#475569', fontSize: '13px', marginTop: '40px' }}>Sin mensajes aún</p>
            )}
            {messages.map(msg => (
              <div key={msg.id} style={{ display: 'flex', justifyContent: msg.direction === 'outbound' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '70%', padding: msg.media_type === 'image' ? '6px' : '10px 14px', fontSize: '13px', lineHeight: 1.5,
                  borderRadius: msg.direction === 'outbound' ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                  background: msg.direction === 'outbound' ? '#f97316' : '#1e293b',
                  border: msg.direction === 'outbound' ? 'none' : '1px solid #1e2d45',
                  color: msg.direction === 'outbound' ? '#fff' : '#f8fafc',
                  wordBreak: 'break-word', overflow: 'hidden',
                }}>
                  {msg.media_type === 'image' && msg.media_url ? (
                    <div>
                      <img
                        src={msg.media_url}
                        alt="imagen"
                        style={{ display: 'block', maxWidth: '100%', maxHeight: '280px', borderRadius: '8px', cursor: 'pointer', objectFit: 'cover' }}
                        onClick={() => window.open(msg.media_url!, '_blank')}
                      />
                      {msg.body && !['📷 Imagen', '[media]'].includes(msg.body) && (
                        <p style={{ padding: '6px 8px 2px', margin: 0 }}>{msg.body}</p>
                      )}
                      <p style={{ fontSize: '10px', opacity: 0.65, margin: '4px 8px 4px', textAlign: 'right' }}>{formatMsgTime(msg.timestamp)}</p>
                    </div>
                  ) : msg.media_type === 'audio' && msg.media_url ? (
                    <div style={{ padding: '4px 0' }}>
                      <audio
                        controls
                        src={msg.media_url}
                        preload="metadata"
                        onLoadedMetadata={(e) => {
                          const a = e.currentTarget
                          if (!isFinite(a.duration) || a.duration === 0) {
                            a.currentTime = 1e101
                            const reset = () => { a.currentTime = 0; a.removeEventListener('timeupdate', reset) }
                            a.addEventListener('timeupdate', reset)
                          }
                        }}
                        style={{ height: '36px', maxWidth: '260px', filter: msg.direction === 'outbound' ? 'invert(1) hue-rotate(180deg)' : 'none' }}
                      />
                      <p style={{ fontSize: '10px', opacity: 0.65, marginTop: '4px', textAlign: 'right' }}>{formatMsgTime(msg.timestamp)}</p>
                    </div>
                  ) : msg.media_type === 'audio' ? (
                    <div>
                      <p style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                        <Play size={14} /> Audio (sin previsualización)
                      </p>
                      <p style={{ fontSize: '10px', opacity: 0.65, marginTop: '4px', textAlign: 'right' }}>{formatMsgTime(msg.timestamp)}</p>
                    </div>
                  ) : msg.media_type === 'video' && msg.media_url ? (
                    <div>
                      <video controls src={msg.media_url} style={{ maxWidth: '100%', maxHeight: '280px', borderRadius: '8px' }} />
                      <p style={{ fontSize: '10px', opacity: 0.65, margin: '4px 0 0', textAlign: 'right' }}>{formatMsgTime(msg.timestamp)}</p>
                    </div>
                  ) : (
                    <div>
                      <p style={{ margin: 0 }}>{msg.body}</p>
                      <p style={{ fontSize: '10px', opacity: 0.65, marginTop: '4px', textAlign: 'right' }}>{formatMsgTime(msg.timestamp)}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Preview de imagen antes de enviar */}
          {imagePreview && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid #1e2d45', background: '#0d1526', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <img src={imagePreview} alt="preview" style={{ height: '80px', maxWidth: '140px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #1e2d45' }} />
                <button
                  onClick={() => setImagePreview(null)}
                  style={{ position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', borderRadius: '50%', background: '#ef4444', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={11} />
                </button>
              </div>
              <button
                onClick={handleSendImage}
                disabled={sending}
                style={{ padding: '8px 16px', background: '#f97316', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: sending ? 'default' : 'pointer' }}
              >
                {sending ? 'Enviando...' : 'Enviar imagen'}
              </button>
            </div>
          )}

          {/* Input */}
          <div style={{ borderTop: '1px solid #1e2d45', padding: '10px 16px', background: '#0d1526' }}>
            {/* Formulario */}
            <button
              onClick={handleSendForm}
              disabled={sending}
              style={{
                width: '100%', marginBottom: '8px', padding: '7px',
                background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)',
                borderRadius: '8px', color: '#3b82f6', fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}
            >
              <FileText size={14} />
              Enviar Formulario
            </button>

            {/* Grabación activa */}
            {isRecording && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s infinite' }} />
                <span style={{ color: '#f8fafc', fontSize: '13px', flex: 1 }}>
                  Grabando... {Math.floor(recordingSeconds / 60).toString().padStart(2, '0')}:{(recordingSeconds % 60).toString().padStart(2, '0')}
                </span>
                <button
                  onClick={stopRecording}
                  style={{ padding: '6px 14px', background: '#ef4444', border: 'none', borderRadius: '7px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <MicOff size={14} /> Enviar
                </button>
              </div>
            )}

            {/* Input de texto + botones */}
            {!isRecording && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
                {/* Adjuntar imagen */}
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelect} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Adjuntar imagen"
                  style={{ width: '40px', height: '40px', flexShrink: 0, background: '#1e293b', border: '1px solid #1e2d45', borderRadius: '10px', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Paperclip size={16} />
                </button>

                {/* Textarea */}
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

                {/* Micrófono o enviar */}
                {messageText.trim() ? (
                  <button
                    onClick={() => sendMessage(messageText)}
                    disabled={sending}
                    style={{ width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0, background: '#f97316', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Send size={16} />
                  </button>
                ) : (
                  <button
                    onClick={startRecording}
                    title="Grabar audio"
                    style={{ width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0, background: '#1e293b', border: '1px solid #1e2d45', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Mic size={16} />
                  </button>
                )}
              </div>
            )}
          </div>
          <style>{`
            @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
          `}</style>
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
