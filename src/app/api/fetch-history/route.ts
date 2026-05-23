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

    // Intentar con formato Node.js primero, luego GO
    let rawMessages: EvolutionMessage[] | null = null

    rawMessages = await fetchNodeFormat(base, settings.evolution_api_key, settings.instance_name, remoteJid)

    if (!rawMessages) {
      rawMessages = await fetchGoFormat(base, settings.evolution_api_key, settings.instance_name, remoteJid)
    }

    if (!rawMessages || rawMessages.length === 0) {
      return NextResponse.json({ ok: true, saved: 0 })
    }

    let saved = 0
    for (const m of rawMessages) {
      const wamid = m.key?.id || null
      const fromMe = m.key?.fromMe ?? false
      const direction: 'inbound' | 'outbound' = fromMe ? 'outbound' : 'inbound'

      const body = extractBody(m)
      if (!body) continue

      const timestamp = m.messageTimestamp
        ? new Date(Number(m.messageTimestamp) * 1000).toISOString()
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

    return NextResponse.json({ ok: true, saved })
  } catch (err) {
    console.error('[fetch-history]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

interface EvolutionMessage {
  key?: { id?: string; fromMe?: boolean; remoteJid?: string }
  message?: Record<string, unknown>
  messageTimestamp?: number | string
}

function extractBody(m: EvolutionMessage): string | null {
  const msg = m.message
  if (!msg) return null

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

  return null
}

async function fetchNodeFormat(
  base: string,
  apiKey: string,
  instanceName: string,
  remoteJid: string,
): Promise<EvolutionMessage[] | null> {
  try {
    const res = await fetch(`${base}/chat/findMessages/${instanceName}`, {
      method: 'POST',
      headers: { 'apikey': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ where: { key: { remoteJid } }, limit: 200 }),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (Array.isArray(data)) return data
    if (Array.isArray(data?.messages)) return data.messages
    return null
  } catch {
    return null
  }
}

async function fetchGoFormat(
  base: string,
  apiKey: string,
  instanceName: string,
  remoteJid: string,
): Promise<EvolutionMessage[] | null> {
  try {
    const url = `${base}/chat/messages/${instanceName}?remoteJid=${encodeURIComponent(remoteJid)}&limit=200`
    const res = await fetch(url, {
      headers: { 'apikey': apiKey },
    })
    if (!res.ok) return null
    const data = await res.json()
    if (Array.isArray(data)) return data
    if (Array.isArray(data?.messages)) return data.messages
    return null
  } catch {
    return null
  }
}
