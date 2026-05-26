'use client'
import { useState, useRef, useEffect } from 'react'
import { Send, MessageSquare, Trash2, Mic, MicOff } from 'lucide-react'
import { toast } from 'sonner'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

interface Props { initialMessages: ChatMessage[] }

function renderContent(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return part.split('\n').map((line, j, arr) => (
      <span key={`${i}-${j}`}>{line}{j < arr.length - 1 && <br />}</span>
    ))
  })
}

export default function ChatClient({ initialMessages }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<{ stop(): void } | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function toggleListening() {
    const SR = (window as typeof window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
      || (window as typeof window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition
    if (!SR) { alert('Tu navegador no soporta reconocimiento de voz. Usá Chrome o Edge.'); return }

    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }

    const recognition = new SR() as unknown as {
      lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void;
      onresult: ((e: { results: { 0: { transcript: string }[] }[] }) => void) | null;
      onerror: (() => void) | null; onend: (() => void) | null;
    }
    recognition.lang = 'es-AR'
    recognition.interimResults = false
    recognition.continuous = false

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript
      setInput(prev => (prev ? prev + ' ' + transcript : transcript))
      inputRef.current?.focus()
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  async function send() {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Error al procesar')
        setMessages(prev => prev.filter(m => m.id !== userMsg.id))
        return
      }
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch {
      toast.error('Error de red')
      setMessages(prev => prev.filter(m => m.id !== userMsg.id))
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  async function clearHistory() {
    if (!confirm('¿Borrar todo el historial del chat?')) return
    await fetch('/api/chat/clear', { method: 'POST' })
    setMessages([])
    toast.success('Historial borrado')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e2d45', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '17px', fontWeight: 700, color: '#f8fafc' }}>Asistente IA</h1>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '1px' }}>Consultá, agregá y modificá información</p>
        </div>
        <button
          onClick={clearHistory}
          title="Borrar historial"
          style={{ padding: '7px', background: '#1e293b', border: '1px solid #1e2d45', borderRadius: '8px', color: '#64748b', cursor: 'pointer', display: 'flex' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
          onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Mensajes */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px 16px 8px' }}>
        {messages.length === 0 && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquare size={22} color="#f97316" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#f8fafc', fontSize: '14px', fontWeight: 600 }}>¿En qué te puedo ayudar?</p>
              <p style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>Preguntá sobre ventas, clientes o pedí un análisis</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', maxWidth: '360px' }}>
              {[
                'Mostrá un resumen financiero de hoy',
                'Cuántas ventas hay en estado preparando?',
                'Agregá una venta de Juan Pérez, álbum x2, dirección Rivadavia 123',
              ].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => { setInput(suggestion); inputRef.current?.focus() }}
                  style={{ padding: '8px 14px', background: '#0d1526', border: '1px solid #1e2d45', borderRadius: '8px', color: '#94a3b8', fontSize: '12px', cursor: 'pointer', textAlign: 'left' }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: '12px',
            }}
          >
            <div style={{
              maxWidth: '80%',
              padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              background: msg.role === 'user' ? 'rgba(249,115,22,0.15)' : '#0d1526',
              border: `1px solid ${msg.role === 'user' ? 'rgba(249,115,22,0.3)' : '#1e2d45'}`,
              fontSize: '13px',
              lineHeight: '1.6',
              color: msg.role === 'user' ? '#fed7aa' : '#cbd5e1',
            }}>
              {renderContent(msg.content)}
              <div style={{ fontSize: '10px', color: '#475569', marginTop: '4px', textAlign: 'right' }}>
                {new Date(msg.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '12px' }}>
            <div style={{ padding: '12px 16px', borderRadius: '14px 14px 14px 4px', background: '#0d1526', border: '1px solid #1e2d45', display: 'flex', gap: '4px', alignItems: 'center' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: '6px', height: '6px', borderRadius: '50%', background: '#475569',
                  animation: 'pulse 1.2s ease-in-out infinite',
                  animationDelay: `${i * 0.2}s`,
                }} />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #1e2d45', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', background: '#1e293b', border: '1px solid #1e2d45', borderRadius: '12px', padding: '8px 8px 8px 14px' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribí tu mensaje... (Enter para enviar)"
            rows={1}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none', resize: 'none',
              color: '#f8fafc', fontSize: '13px', lineHeight: '1.5', maxHeight: '120px',
              overflow: 'auto', fontFamily: 'inherit',
            }}
            onInput={e => {
              const t = e.currentTarget
              t.style.height = 'auto'
              t.style.height = Math.min(t.scrollHeight, 120) + 'px'
            }}
          />
          <button
            onClick={toggleListening}
            title={listening ? 'Detener grabación' : 'Hablar'}
            style={{
              width: '34px', height: '34px', borderRadius: '8px', border: 'none', flexShrink: 0,
              background: listening ? 'rgba(239,68,68,0.15)' : '#1e2d45',
              color: listening ? '#ef4444' : '#64748b',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
              animation: listening ? 'micPulse 1s ease-in-out infinite' : 'none',
            }}
          >
            {listening ? <MicOff size={15} /> : <Mic size={15} />}
          </button>
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            style={{
              width: '34px', height: '34px', borderRadius: '8px', border: 'none', flexShrink: 0,
              background: input.trim() && !loading ? '#f97316' : '#1e2d45',
              color: input.trim() && !loading ? '#fff' : '#475569',
              cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
          >
            <Send size={15} />
          </button>
        </div>
        <p style={{ fontSize: '10px', color: '#334155', marginTop: '6px', textAlign: 'center' }}>
          Enter para enviar · Shift+Enter para nueva línea
        </p>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes micPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
          50% { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
        }
      `}</style>
    </div>
  )
}
