import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type MediaType = 'image' | 'audio' | 'video' | 'document'

const MEDIA_LABELS: Record<MediaType, string> = {
  image:    '📷 Imagen',
  audio:    '🎵 Audio',
  video:    '🎥 Video',
  document: '📄 Documento',
}

export async function POST(req: NextRequest) {
  try {
    const { contactId, phone, mediaType, base64, mimeType, caption, fileName } = await req.json()

    if (!contactId || !phone || !mediaType || !base64) {
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
    const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, '')

    let evoRes: Response | null = null

    if (mediaType === 'audio') {
      // PTT / voz — intentar Node.js primero, luego GO
      evoRes = await fetch(`${base}/message/sendWhatsAppAudio/${settings.instance_name}`, {
        method: 'POST',
        headers: { 'apikey': settings.evolution_api_key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: phone, audio: cleanBase64, delay: 0, encoding: true }),
      })
      if (!evoRes.ok) {
        evoRes = await fetch(`${base}/send/audio`, {
          method: 'POST',
          headers: { 'apikey': settings.evolution_api_key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: phone, audio: cleanBase64 }),
        })
      }
    } else {
      // Imagen / video / documento — intentar Node.js primero, luego GO
      evoRes = await fetch(`${base}/message/sendMedia/${settings.instance_name}`, {
        method: 'POST',
        headers: { 'apikey': settings.evolution_api_key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: phone,
          mediatype: mediaType,
          media: cleanBase64,
          caption: caption || '',
          fileName: fileName || `archivo.${mimeType?.split('/')[1] || 'bin'}`,
        }),
      })
      if (!evoRes.ok) {
        evoRes = await fetch(`${base}/send/media`, {
          method: 'POST',
          headers: { 'apikey': settings.evolution_api_key, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            number: phone,
            media: cleanBase64,
            caption: caption || '',
            fileName: fileName || `archivo.${mimeType?.split('/')[1] || 'bin'}`,
            mediaType: mediaType,
          }),
        })
      }
    }

    if (!evoRes || !evoRes.ok) {
      const errText = await evoRes?.text() || 'sin respuesta'
      return NextResponse.json({ error: `Evolution API: ${errText}` }, { status: 502 })
    }

    let wamid: string | null = null
    try {
      const evoData = await evoRes.json()
      wamid = evoData?.key?.id || evoData?.wuid || null
    } catch {}

    const mediaUrl = `data:${mimeType};base64,${cleanBase64}`
    const body = caption || MEDIA_LABELS[mediaType as MediaType] || '[media]'

    const { error } = await supabase.from('messages').insert({
      contact_id: contactId,
      body,
      direction: 'outbound',
      timestamp: new Date().toISOString(),
      wamid,
      media_type: mediaType,
      media_url: mediaUrl,
    })
    if (error && error.code !== '23505') {
      console.error('[send-media insert]', error)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[send-media]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
