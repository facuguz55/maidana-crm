import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const event = body.event || body.type || body.Event || ''
    const validEvents = ['messages.upsert', 'MESSAGE', 'message', 'MESSAGES_UPSERT']
    if (!validEvents.includes(event)) {
      return NextResponse.json({ ok: true, skipped: `event: ${event}` })
    }

    // Soporta formato Evolution GO y Evolution Node
    const data = body.data || body
    const message = data.messages?.[0] || data.message || data

    const fromMe = message?.key?.fromMe ?? data?.key?.fromMe ?? false
    if (fromMe) return NextResponse.json({ ok: true, skipped: 'own message' })

    const phone: string =
      message?.key?.remoteJid ||
      data?.key?.remoteJid ||
      body?.remoteJid ||
      ''

    if (!phone || phone.includes('@g.us')) {
      return NextResponse.json({ ok: true, skipped: 'no phone or group' })
    }

    const cleanPhone = phone
      .replace('@s.whatsapp.net', '')
      .replace('@c.us', '')

    const messageText: string =
      message?.message?.conversation ||
      message?.message?.extendedTextMessage?.text ||
      data?.message?.conversation ||
      data?.body ||
      body?.body ||
      body?.text ||
      '[media]'

    const now = new Date().toISOString()

    // Buscar o crear contacto
    const { data: existing } = await supabase
      .from('contacts')
      .select('id, status')
      .eq('phone', cleanPhone)
      .single()

    let contactId: string

    if (existing) {
      contactId = existing.id
      await supabase
        .from('contacts')
        .update({
          last_message_at: now,
          last_message_preview: messageText.slice(0, 100),
        })
        .eq('id', existing.id)
    } else {
      const { data: inserted } = await supabase
        .from('contacts')
        .insert({
          phone: cleanPhone,
          status: 'nuevo',
          first_contact_at: now,
          last_message_at: now,
          last_message_preview: messageText.slice(0, 100),
        })
        .select('id')
        .single()
      contactId = inserted?.id
    }

    // Guardar mensaje en la tabla messages
    if (contactId && messageText !== '[media]') {
      await supabase.from('messages').insert({
        contact_id: contactId,
        body: messageText,
        direction: 'inbound',
        timestamp: now,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[webhook/evolution]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
