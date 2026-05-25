import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type MediaType = 'image' | 'audio' | 'video' | 'document' | 'sticker'

const MEDIA_TYPE_MAP: Record<string, MediaType> = {
  imageMessage:    'image',   ImageMessage:    'image',
  videoMessage:    'video',   VideoMessage:    'video',
  audioMessage:    'audio',   AudioMessage:    'audio',
  pttMessage:      'audio',   PTTMessage:      'audio',
  documentMessage: 'document',DocumentMessage: 'document',
  stickerMessage:  'sticker', StickerMessage:  'sticker',
}

const MIME_DEFAULTS: Record<MediaType, string> = {
  image: 'image/jpeg', audio: 'audio/ogg', video: 'video/mp4',
  document: 'application/octet-stream', sticker: 'image/webp',
}

const MEDIA_LABELS: Record<MediaType, string> = {
  image: '📷 Imagen', audio: '🎵 Audio', video: '🎥 Video',
  document: '📄 Documento', sticker: '🔖 Sticker',
}

function detectMediaType(msg: Record<string, unknown>): MediaType | null {
  for (const [key, type] of Object.entries(MEDIA_TYPE_MAP)) {
    if (msg[key]) return type
  }
  return null
}

function getMime(msg: Record<string, unknown>, mediaType: MediaType): string {
  for (const key of Object.keys(MEDIA_TYPE_MAP)) {
    const m = msg[key] as Record<string, unknown> | undefined
    if (m && typeof m.mimetype === 'string') return m.mimetype
  }
  return MIME_DEFAULTS[mediaType]
}

function extFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
    'image/webp': 'webp', 'audio/ogg': 'ogg', 'audio/webm': 'webm',
    'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'video/mp4': 'mp4',
    'image/heic': 'heic', 'audio/opus': 'opus',
  }
  return map[mimeType] || mimeType.split('/')[1] || 'bin'
}

// Sube base64 a Supabase Storage y devuelve URL pública
async function uploadBase64ToStorage(
  base64: string,
  mimeType: string,
  contactId: string,
): Promise<string | null> {
  try {
    const clean = base64.includes(',') ? base64.split(',')[1] : base64
    const buffer = Buffer.from(clean, 'base64')
    const ext = extFromMime(mimeType)
    const path = `${contactId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error } = await supabase.storage
      .from('crm-media')
      .upload(path, buffer, { contentType: mimeType, upsert: false })

    if (error) { console.error('[webhook] Storage upload:', error.message); return null }

    const { data: { publicUrl } } = supabase.storage.from('crm-media').getPublicUrl(path)
    return publicUrl
  } catch (e) {
    console.error('[webhook] uploadBase64ToStorage:', e)
    return null
  }
}

// Llama a /message/downloadimage pasando el objeto message completo (DownloadMediaStruct)
async function downloadMediaFromEvolution(
  apiBase: string,
  apiKey: string,
  message: Record<string, unknown>,
): Promise<string | null> {
  try {
    const res = await fetch(`${apiBase}/message/downloadimage`, {
      method: 'POST',
      headers: { 'apikey': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })
    if (!res.ok) {
      console.error('[webhook] downloadimage status:', res.status, await res.text().catch(() => ''))
      return null
    }
    const data = await res.json()
    const b64 = data?.base64 || data?.Base64 || data?.data || (typeof data === 'string' ? data : null)
    return b64 || null
  } catch (e) { console.error('[webhook] downloadimage error:', e); return null }
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

      const ignored = ['ReactionMessage', 'ProtocolMessage']
      if (ignored.includes(info.Type)) {
        return NextResponse.json({ ok: true, skipped: 'ignored type' })
      }

      const cleanPhone = phone.replace('@s.whatsapp.net', '').replace('@c.us', '')
      const remoteJid = `${cleanPhone}@s.whatsapp.net`
      const goMsg = (body.data?.Message ?? {}) as Record<string, unknown>
      const mediaType = detectMediaType(goMsg)

      const messageText: string =
        (goMsg.conversation as string) ||
        ((goMsg.extendedTextMessage as Record<string,string> | undefined)?.text) ||
        ((goMsg.imageMessage as Record<string,string> | undefined)?.caption) ||
        ((goMsg.videoMessage as Record<string,string> | undefined)?.caption) ||
        (mediaType ? MEDIA_LABELS[mediaType] : null) ||
        '[media]'

      const wamid: string | null = info.ID || null
      const isFromMe: boolean = info.IsFromMe === true

      // Resolver media URL
      let mediaUrl: string | null = null
      if (mediaType) {
        const rawB64: string | null = body.data?.Base64 || body.Base64 || body.data?.Data || null
        const mime = getMime(goMsg, mediaType)
        console.log(`[webhook GO] mediaType=${mediaType} wamid=${wamid} hasB64=${!!rawB64} mime=${mime}`)

        if (rawB64) {
          const contactForUpload = await getOrCreateContact(cleanPhone, messageText, mediaType, isFromMe)
          if (contactForUpload) {
            mediaUrl = await uploadBase64ToStorage(rawB64, mime, contactForUpload)
          }
        } else if (wamid) {
          // Intentar descarga para todos los tipos de media (image, audio, video, document)
          const { data: settings } = await supabase.from('settings').select('evolution_api_url, evolution_api_key').eq('id', 1).single()
          if (settings?.evolution_api_url) {
            const apiBase = settings.evolution_api_url.replace(/\/$/, '')
            const b64 = await downloadMediaFromEvolution(apiBase, settings.evolution_api_key, goMsg)
            console.log(`[webhook GO] download result for ${mediaType}: ${b64 ? 'ok' : 'null'}`)
            if (b64) {
              const contactForUpload = await getOrCreateContact(cleanPhone, messageText, mediaType, isFromMe)
              if (contactForUpload) {
                mediaUrl = await uploadBase64ToStorage(b64, mime, contactForUpload)
              }
            }
          }
        }
      }

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
    const remoteJid = `${cleanPhone}@s.whatsapp.net`
    const nodeMsg = (message?.message || {}) as Record<string, unknown>
    const mediaType = detectMediaType(nodeMsg)

    const messageText: string =
      (nodeMsg.conversation as string) ||
      ((nodeMsg.extendedTextMessage as Record<string,string> | undefined)?.text) ||
      ((nodeMsg.imageMessage as Record<string,string> | undefined)?.caption) ||
      ((nodeMsg.videoMessage as Record<string,string> | undefined)?.caption) ||
      (mediaType ? MEDIA_LABELS[mediaType] : null) ||
      '[media]'

    const wamid: string | null = message?.key?.id || null

    let mediaUrl: string | null = null
    if (mediaType) {
      const rawB64: string | null = message?.base64 || data?.base64 || body?.base64 || null
      const mime = getMime(nodeMsg, mediaType)

      if (rawB64) {
        const contactForUpload = await getOrCreateContact(cleanPhone, messageText, mediaType, fromMe)
        if (contactForUpload) {
          mediaUrl = await uploadBase64ToStorage(rawB64, mime, contactForUpload)
        }
      } else if (wamid) {
        const { data: settings } = await supabase.from('settings').select('evolution_api_url, evolution_api_key').eq('id', 1).single()
        if (settings?.evolution_api_url) {
          const apiBase = settings.evolution_api_url.replace(/\/$/, '')
          const b64 = await downloadMediaFromEvolution(apiBase, settings.evolution_api_key, nodeMsg)
          if (b64) {
            const contactForUpload = await getOrCreateContact(cleanPhone, messageText, mediaType, fromMe)
            if (contactForUpload) {
              mediaUrl = await uploadBase64ToStorage(b64, mime, contactForUpload)
            }
          }
        }
      }
    }

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

// Obtiene el ID del contacto (o null) sin crear ni actualizar — solo para subir media
async function getOrCreateContact(
  phone: string,
  _messageText: string,
  _mediaType: MediaType | null,
  _isFromMe: boolean,
): Promise<string | null> {
  const { data } = await supabase.from('contacts').select('id').eq('phone', phone).single()
  return data?.id ?? null
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

  const { data: existing } = await supabase.from('contacts').select('id').eq('phone', phone).single()

  let contactId: string | undefined

  if (existing) {
    contactId = existing.id
    await supabase.from('contacts')
      .update({ last_message_at: now, last_message_preview: preview, unread: true })
      .eq('id', existing.id)
  } else {
    const { data: inserted } = await supabase.from('contacts')
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
