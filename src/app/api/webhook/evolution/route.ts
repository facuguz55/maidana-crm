import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const event = body.event || body.type || ''

    // ---------- Formato Evolution GO (el que usa este servidor) ----------
    // event: "Message", data.Info.Chat, data.Info.IsFromMe, data.Text
    if (event === 'Message' || event === 'message') {
      const info = body.data?.Info
if (!info) return NextResponse.json({ ok: true, skipped: 'no info' })
      if (info.IsFromMe === true) return NextResponse.json({ ok: true, skipped: 'own' })

      const phone: string = info.Chat || info.Sender || ''
      if (!phone || phone.includes('@g.us') || phone.includes('@lid')) {
        return NextResponse.json({ ok: true, skipped: 'group or lid' })
      }

      // Ignorar eventos sin contenido útil
      const tiposIgnorar = ['ReactionMessage', 'ProtocolMessage']
      if (tiposIgnorar.includes(info.Type)) {
        return NextResponse.json({ ok: true, skipped: 'ignored type' })
      }

      const cleanPhone = phone.replace('@s.whatsapp.net', '').replace('@c.us', '')

      // Texto o etiqueta descriptiva del tipo de media
      const mediaLabels: Record<string, string> = {
        ImageMessage:    '📷 Imagen',
        VideoMessage:    '🎥 Video',
        AudioMessage:    '🎵 Audio',
        DocumentMessage: '📄 Documento',
        StickerMessage:  '🔖 Sticker',
      }
      const messageText: string =
        body.data?.Message?.conversation ||
        body.data?.Message?.extendedTextMessage?.text ||
        body.data?.Message?.imageMessage?.caption ||
        body.data?.Message?.videoMessage?.caption ||
        mediaLabels[info.Type] ||
        '[media]'

      await upsertContactAndMessage(cleanPhone, messageText)
      return NextResponse.json({ ok: true })
    }

    // ---------- Formato Evolution Node.js (messages.upsert) ----------
    const validEvents = ['messages.upsert', 'MESSAGES_UPSERT']
    if (!validEvents.includes(event)) {
      return NextResponse.json({ ok: true, skipped: `event: ${event}` })
    }

    const data = body.data || body
    const message = data.messages?.[0] || data.message || data
    const fromMe = message?.key?.fromMe ?? data?.key?.fromMe ?? false
    if (fromMe) return NextResponse.json({ ok: true, skipped: 'own' })

    const phone: string = message?.key?.remoteJid || data?.key?.remoteJid || ''
    if (!phone || phone.includes('@g.us')) {
      return NextResponse.json({ ok: true, skipped: 'no phone or group' })
    }

    const cleanPhone = phone.replace('@s.whatsapp.net', '').replace('@c.us', '')
    const messageText: string =
      message?.message?.conversation ||
      message?.message?.extendedTextMessage?.text ||
      '[media]'

    await upsertContactAndMessage(cleanPhone, messageText)
    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error('[webhook/evolution]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function upsertContactAndMessage(phone: string, messageText: string) {
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
      .update({ last_message_at: now, last_message_preview: messageText.slice(0, 100) })
      .eq('id', existing.id)
  } else {
    const { data: inserted } = await supabase
      .from('contacts')
      .insert({ phone, status: 'nuevo', first_contact_at: now, last_message_at: now, last_message_preview: messageText.slice(0, 100) })
      .select('id')
      .single()
    contactId = inserted?.id
  }

  if (contactId && messageText !== '[media]') {
    await supabase.from('messages').insert({
      contact_id: contactId,
      body: messageText,
      direction: 'inbound',
      timestamp: now,
    })
  }
}
