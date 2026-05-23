import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MEDIA_LABELS: Record<string, string> = {
  imageMessage:    '📷 Imagen',
  videoMessage:    '🎥 Video',
  audioMessage:    '🎵 Audio',
  documentMessage: '📄 Documento',
  stickerMessage:  '🔖 Sticker',
  pttMessage:      '🎵 Audio',
  ImageMessage:    '📷 Imagen',
  VideoMessage:    '🎥 Video',
  AudioMessage:    '🎵 Audio',
  DocumentMessage: '📄 Documento',
  PTTMessage:      '🎵 Audio',
}

interface EvolutionMessage {
  key?: { id?: string; fromMe?: boolean; remoteJid?: string }
  message?: Record<string, unknown>
  messageTimestamp?: number | string
  // GO format
  Info?: { ID?: string; IsFromMe?: boolean; Timestamp?: number }
  Message?: Record<string, unknown>
}

export async function POST(req: NextRequest) {
  try {
    const { contactId, phone } = await req.json()
    if (!contactId || !phone) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const { data: settings } = await supabase
      .from('settings')
      .select('evolution_api_url, evolution_api_key, instance_name')
      .eq('id', 1)
      .single()

    if (!settings?.evolution_api_url) {
      return NextResponse.json({ error: 'Evolution API no configurada' }, { status: 400 })
    }

    const base = settings.evolution_api_url.replace(/\/$/, '')
    const remoteJid = `${phone}@s.whatsapp.net`
    const tried: string[] = []

    let rawMessages: EvolutionMessage[] | null = null

    // 1. Node.js format: POST /chat/findMessages/{instance}
    const r1 = await tryFetch(tried, 'POST', `${base}/chat/findMessages/${settings.instance_name}`, settings.evolution_api_key, {
      where: { key: { remoteJid } }, limit: 200,
    })
    rawMessages = parseMessages(r1)

    // 2. Node.js format: POST /chat/findMessages/{instance} (different body)
    if (!rawMessages) {
      const r2 = await tryFetch(tried, 'POST', `${base}/chat/findMessages/${settings.instance_name}`, settings.evolution_api_key, {
        remoteJid, limit: 200,
      })
      rawMessages = parseMessages(r2)
    }

    // 3. GO format: GET /chat/messages/{instance}?remoteJid=...
    if (!rawMessages) {
      const r3 = await tryFetch(tried, 'GET', `${base}/chat/messages/${settings.instance_name}?remoteJid=${encodeURIComponent(remoteJid)}&limit=200`, settings.evolution_api_key)
      rawMessages = parseMessages(r3)
    }

    // 4. GO format: GET /messages/{instance}?remoteJid=...
    if (!rawMessages) {
      const r4 = await tryFetch(tried, 'GET', `${base}/messages/${settings.instance_name}?remoteJid=${encodeURIComponent(remoteJid)}&limit=200`, settings.evolution_api_key)
      rawMessages = parseMessages(r4)
    }

    // 5. GO format: POST /chat/fetchMessages/{instance}
    if (!rawMessages) {
      const r5 = await tryFetch(tried, 'POST', `${base}/chat/fetchMessages/${settings.instance_name}`, settings.evolution_api_key, {
        remoteJid, count: 200,
      })
      rawMessages = parseMessages(r5)
    }

    if (!rawMessages || rawMessages.length === 0) {
      return NextResponse.json({ ok: true, saved: 0, tried })
    }

    let saved = 0
    for (const m of rawMessages) {
      const wamid = m.key?.id || m.Info?.ID || null
      const fromMe = m.key?.fromMe ?? m.Info?.IsFromMe ?? false
      const direction: 'inbound' | 'outbound' = fromMe ? 'outbound' : 'inbound'

      const body = extractBody(m)
      if (!body) continue

      const rawTs = m.messageTimestamp || m.Info?.Timestamp
      const timestamp = rawTs
        ? new Date(Number(rawTs) * 1000).toISOString()
        : new Date().toISOString()

      const { error } = await supabase.from('messages').insert({
        contact_id: contactId,
        body,
        direction,
        timestamp,
        wamid,
      })

      if (!error) saved++
      else if (error.code !== '23505') {
        console.error('[fetch-history insert]', error.message)
      }
    }

    return NextResponse.json({ ok: true, saved, tried, debug: `${rawMessages.length} mensajes recibidos de API, ${saved} guardados nuevos` })
  } catch (err) {
    console.error('[fetch-history]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function tryFetch(
  tried: string[],
  method: 'GET' | 'POST',
  url: string,
  apiKey: string,
  body?: Record<string, unknown>,
): Promise<unknown> {
  const label = `${method} ${url.split('?')[0]}`
  tried.push(label)
  try {
    const res = await fetch(url, {
      method,
      headers: { 'apikey': apiKey, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    if (!res.ok) {
      tried[tried.length - 1] += ` → ${res.status}`
      return null
    }
    tried[tried.length - 1] += ' → OK'
    return await res.json()
  } catch (e) {
    tried[tried.length - 1] += ` → ${e}`
    return null
  }
}

function parseMessages(data: unknown): EvolutionMessage[] | null {
  if (!data) return null
  if (Array.isArray(data)) return data.length > 0 ? data : null
  if (typeof data === 'object' && data !== null) {
    const d = data as Record<string, unknown>
    if (Array.isArray(d.messages) && d.messages.length > 0) return d.messages as EvolutionMessage[]
    if (Array.isArray(d.data) && d.data.length > 0) return d.data as EvolutionMessage[]
  }
  return null
}

function extractBody(m: EvolutionMessage): string | null {
  // Node.js format
  const msg = m.message
  if (msg) {
    if (typeof msg.conversation === 'string') return msg.conversation
    const ext = msg.extendedTextMessage as { text?: string } | undefined
    if (ext?.text) return ext.text
    const imgCaption = (msg.imageMessage as { caption?: string } | undefined)?.caption
    if (imgCaption) return imgCaption
    const vidCaption = (msg.videoMessage as { caption?: string } | undefined)?.caption
    if (vidCaption) return vidCaption
    for (const [key, label] of Object.entries(MEDIA_LABELS)) {
      if (msg[key]) return label
    }
  }

  // GO format
  const goMsg = m.Message
  if (goMsg) {
    if (typeof goMsg.conversation === 'string') return goMsg.conversation
    const ext = goMsg.extendedTextMessage as { text?: string } | undefined
    if (ext?.text) return ext.text
    for (const [key, label] of Object.entries(MEDIA_LABELS)) {
      if (goMsg[key]) return label
    }
  }

  return null
}
