import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Solo procesar eventos de tipo messages.upsert
    const event = body.event || body.type
    if (event !== 'messages.upsert') {
      return NextResponse.json({ ok: true, skipped: 'not a message event' })
    }

    const data = body.data || body
    const message = data.messages?.[0] || data.message || data

    // Ignorar mensajes propios
    if (message?.key?.fromMe === true || data?.key?.fromMe === true) {
      return NextResponse.json({ ok: true, skipped: 'own message' })
    }

    const phone: string = message?.key?.remoteJid || data?.key?.remoteJid || ''
    if (!phone) return NextResponse.json({ ok: true, skipped: 'no phone' })

    // Ignorar el número del bot
    const botNumber = '5493425984238'
    if (phone.includes(botNumber)) {
      return NextResponse.json({ ok: true, skipped: 'bot number' })
    }

    // Ignorar grupos
    if (phone.includes('@g.us')) {
      return NextResponse.json({ ok: true, skipped: 'group' })
    }

    const cleanPhone = phone.replace('@s.whatsapp.net', '').replace('@c.us', '')
    const messageText: string =
      message?.message?.conversation ||
      message?.message?.extendedTextMessage?.text ||
      data?.message?.conversation ||
      data?.body ||
      '[media]'

    const now = new Date().toISOString()

    // Buscar contacto existente
    const { data: existing } = await supabase
      .from('contacts')
      .select('id, status')
      .eq('phone', cleanPhone)
      .single()

    if (existing) {
      // Actualizar último mensaje
      await supabase
        .from('contacts')
        .update({
          last_message_at: now,
          last_message_preview: messageText.slice(0, 100),
        })
        .eq('id', existing.id)
    } else {
      // Crear nuevo contacto
      await supabase.from('contacts').insert({
        phone: cleanPhone,
        status: 'nuevo',
        first_contact_at: now,
        last_message_at: now,
        last_message_preview: messageText.slice(0, 100),
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[webhook/evolution]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
