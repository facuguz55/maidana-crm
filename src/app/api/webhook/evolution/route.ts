import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type MediaType = 'image' | 'audio' | 'video' | 'document' | 'sticker'

const MEDIA_TYPE_MAP: Record<string, MediaType> = {
  imageMessage:    'image',
  ImageMessage:    'image',
  videoMessage:    'video',
  VideoMessage:    'video',
  audioMessage:    'audio',
  AudioMessage:    'audio',
  pttMessage:      'audio',
  PTTMessage:      'audio',
  documentMessage: 'document',
  DocumentMessage: 'document',
  stickerMessage:  'sticker',
  StickerMessage:  'sticker',
}

const MIME_MAP: Record<MediaType, string> = {
  image:    'image/jpeg',
  audio:    'audio/ogg',
  video:    'video/mp4',
  document: 'application/octet-stream',
  sticker:  'image/webp',
}

const MEDIA_LABELS: Record<MediaType, string> = {
  image:    '📷 Imagen',
  audio:    '🎵 Audio',
  video:    '🎥 Video',
  document: '📄 Documento',
  sticker:  '🔖 Sticker',
}

function detectMediaType(msg: Record<string, unknown>): MediaType | null {
  for (const [key, type] of Object.entries(MEDIA_TYPE_MAP)) {
    if (msg[key]) return type
  }
  return null
}

function getMimeFromMessage(msg: Record<string, unknown>, mediaType: MediaType): string {
  for (const key of Object.keys(MEDIA_TYPE_MAP)) {
    const m = msg[key] as Record<string, unknown> | undefined
    if (m && typeof m.mimetype === 'string') return m.mimetype
  }
  return MIME_MAP[mediaType]
}

function buildDataUrl(base64: string, mimeType: string): string {
  const clean = base64.replace(/^data:[^;]+;base64,/, '')
  return `data:${mimeType};base64,${clean}`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const event = body.event || body.type || ''

    // ── Formato Evolution GO ──────────────────────────────────────────────
    if (event === 'Message' || event === 'message') {
      const info = body.data?.Info
      if (!info) return NextResponse.json({ ok: true, skipped: 'no info' })

      const phone: string = info.Chat || info.Sender || ''
      if (!phone || phone.includes('@g.us') || phone.includes('@lid')) {
        return NextResponse.json({ ok: true, skipped: 'group or lid' })
      }

      const tiposIgnorar = ['ReactionMessage', 'ProtocolMessage']
      if (tiposIgnorar.includes(info.Type)) {
        return NextResponse.json({ ok: true, skipped: 'ignored type' })
      }

      const cleanPhone = phone.replace('@s.whatsapp.net', '').replace('@c.us', '')
      const goMsg = body.data?.Message as Record<string, unknown> | undefined
      const mediaType = goMsg ? detectMediaType(goMsg) : null

      const messageText: string =
        goMsg?.conversation as string ||
        (goMsg?.extendedTextMessage as Record<string, string> | undefined)?.text ||
        (goMsg?.imageMessage as Record<string, string> | undefined)?.caption ||
        (goMsg?.videoMessage as Record<string, string> | undefined)?.caption ||
        (mediaType ? MEDIA_LABELS[mediaType] : null) ||
        '[media]'

      const rawBase64: string | null = body.data?.Base64 || body.Base64 || null
      let mediaUrl: string | null = null
      if (rawBase64 && mediaType) {
        const mime = goMsg ? getMimeFromMessage(goMsg, mediaType) : MIME_MAP[mediaType]
        mediaUrl = buildDataUrl(rawBase64, mime)
      }

      const wamid: string | null = info.ID || null
      const isFromMe: boolean = info.IsFromMe === true

      if (isFromMe) {
        await saveOutbound(cleanPhone, messageText, wamid, mediaType, mediaUrl)
      } else {
        await upsertContactAndMessage(cleanPhone, messageText, wamid, mediaType, mediaUrl)
      }
      return NextResponse.json({ ok: true })
    }

    // ── Formato Evolution Node.js (messages.upsert) ───────────────────────
    const validEvents = ['messages.upsert', 'MESSAGES_UPSERT']
    if (!validEvents.includes(event)) {
      return NextResponse.json({ ok: true, skipped: `event: ${event}` })
    }

    const data = body.data || body
    const message = data.messages?.[0] || data.message || data
    const fromMe: boolean = message?.key?.fromMe ?? data?.key?.fromMe ?? false

    const phone: string = message?.key?.remoteJid || data?.key?.remoteJid || ''
    if (!phone || phone.includes('@g.us')) {
      return NextResponse.json({ ok: true, skipped: 'no phone or group' })
    }

    const cleanPhone = phone.replace('@s.whatsapp.net', '').replace('@c.us', '')
    const nodeMsg = (message?.message || {}) as Record<string, unknown>
    const mediaType = detectMediaType(nodeMsg)

    const messageText: string =
      nodeMsg.conversation as string ||
      (nodeMsg.extendedTextMessage as Record<string, string> | undefined)?.text ||
      (nodeMsg.imageMessage as Record<string, string> | undefined)?.caption ||
      (nodeMsg.videoMessage as Record<string, string> | undefined)?.caption ||
      (mediaType ? MEDIA_LABELS[mediaType] : null) ||
      '[media]'

    const rawBase64: string | null = message?.base64 || data?.base64 || body?.base64 || null
    let mediaUrl: string | null = null
    if (rawBase64 && mediaType) {
      const mime = getMimeFromMessage(nodeMsg, mediaType)
      mediaUrl = buildDataUrl(rawBase64, mime)
    }

    const wamid: string | null = message?.key?.id || null

    if (fromMe) {
      await saveOutbound(cleanPhone, messageText, wamid, mediaType, mediaUrl)
    } else {
      await upsertContactAndMessage(cleanPhone, messageText, wamid, mediaType, mediaUrl)
    }
    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error('[webhook/evolution]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function upsertContactAndMessage(
  phone: string,
  messageText: string,
  wamid: string | null,
  mediaType: MediaType | null,
  mediaUrl: string | null,
) {
  const now = new Date().toISOString()
  const preview = mediaType ? MEDIA_LABELS[mediaType] : messageText.slice(0, 100)

  const { data: existing } = await supabase
    .from('contacts')
    .select('id')
    .eq('phone', phone)
    .single()

  let contactId: string | undefined

  if (existing) {
    contactId = existing.id
    await supabase
      .from('contacts')
      .update({ last_message_at: now, last_message_preview: preview, unread: true })
      .eq('id', existing.id)
  } else {
    const { data: inserted } = await supabase
      .from('contacts')
      .insert({ phone, status: 'nuevo', first_contact_at: now, last_message_at: now, last_message_preview: preview, unread: true })
      .select('id')
      .single()
    contactId = inserted?.id
  }

  if (contactId) {
    await insertMessage(contactId, messageText, 'inbound', now, wamid, mediaType, mediaUrl)
  }
}

async function saveOutbound(
  phone: string,
  messageText: string,
  wamid: string | null,
  mediaType: MediaType | null,
  mediaUrl: string | null,
) {
  if (!phone) return
  const { data: contact } = await supabase.from('contacts').select('id').eq('phone', phone).single()
  if (!contact) return
  const now = new Date().toISOString()
  await insertMessage(contact.id, messageText, 'outbound', now, wamid, mediaType, mediaUrl)
}

async function insertMessage(
  contactId: string,
  body: string,
  direction: 'inbound' | 'outbound',
  timestamp: string,
  wamid: string | null,
  mediaType: MediaType | null,
  mediaUrl: string | null,
) {
  const { error } = await supabase.from('messages').insert({
    contact_id: contactId,
    body,
    direction,
    timestamp,
    wamid,
    media_type: mediaType,
    media_url: mediaUrl,
  })
  if (error && error.code !== '23505') {
    console.error('[insertMessage]', error)
  }
}
