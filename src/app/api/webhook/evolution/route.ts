import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MEDIA_LABELS: Record<string, string> = {
  ImageMessage:    '📷 Imagen',
  VideoMessage:    '🎥 Video',
  AudioMessage:    '🎵 Audio',
  DocumentMessage: '📄 Documento',
  StickerMessage:  '🔖 Sticker',
  PTTMessage:      '🎵 Audio',
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
      const messageText: string =
        body.data?.Message?.conversation ||
        body.data?.Message?.extendedTextMessage?.text ||
        body.data?.Message?.imageMessage?.caption ||
        body.data?.Message?.videoMessage?.caption ||
        MEDIA_LABELS[info.Type] ||
        '[media]'

      const wamid: string | null = info.ID || null
      const isFromMe: boolean = info.IsFromMe === true

      if (isFromMe) {
        await saveOutbound(cleanPhone, messageText, wamid)
      } else {
        await upsertContactAndMessage(cleanPhone, messageText, wamid)
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
    const messageText: string =
      message?.message?.conversation ||
      message?.message?.extendedTextMessage?.text ||
      message?.message?.audioMessage ? '🎵 Audio' :
      message?.message?.imageMessage ? '📷 Imagen' :
      message?.message?.videoMessage ? '🎥 Video' :
      message?.message?.documentMessage ? '📄 Documento' :
      '[media]'
    const wamid: string | null = message?.key?.id || null

    if (fromMe) {
      await saveOutbound(cleanPhone, messageText, wamid)
    } else {
      await upsertContactAndMessage(cleanPhone, messageText, wamid)
    }
    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error('[webhook/evolution]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Guarda mensaje inbound + crea/actualiza contacto
async function upsertContactAndMessage(phone: string, messageText: string, wamid: string | null) {
  const now = new Date().toISOString()

  const { data: existing } = await supabase
    .from('contacts')
    .select('id')
    .eq('phone', phone)
    .single()

  let contactId: string

  if (existing) {
    contactId = existing.id
    await supabase
      .from('contacts')
      .update({ last_message_at: now, last_message_preview: messageText.slice(0, 100), unread: true })
      .eq('id', existing.id)
  } else {
    const { data: inserted } = await supabase
      .from('contacts')
      .insert({ phone, status: 'nuevo', first_contact_at: now, last_message_at: now, last_message_preview: messageText.slice(0, 100), unread: true })
      .select('id')
      .single()
    contactId = inserted?.id
  }

  if (contactId) {
    await insertMessage(contactId, messageText, 'inbound', now, wamid)
  }
}

// Guarda mensaje outbound (enviado por nosotros desde el teléfono, bot, etc.)
async function saveOutbound(phone: string, messageText: string, wamid: string | null) {
  if (!phone) return

  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('phone', phone)
    .single()

  if (!contact) return // ignorar outbound a números que no son clientes

  const now = new Date().toISOString()
  await insertMessage(contact.id, messageText, 'outbound', now, wamid)
}

// Inserta mensaje evitando duplicados por wamid
async function insertMessage(
  contactId: string,
  body: string,
  direction: 'inbound' | 'outbound',
  timestamp: string,
  wamid: string | null,
) {
  const { error } = await supabase.from('messages').insert({
    contact_id: contactId,
    body,
    direction,
    timestamp,
    wamid,
  })
  // 23505 = unique_violation — el mensaje ya fue guardado (duplicado por wamid)
  if (error && error.code !== '23505') {
    console.error('[insertMessage]', error)
  }
}
