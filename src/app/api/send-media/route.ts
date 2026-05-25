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

// Extensión de archivo por mime type
function extFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
    'image/gif': 'gif', 'image/webp': 'webp', 'image/heic': 'heic',
    'audio/ogg': 'ogg', 'audio/webm': 'webm', 'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3', 'audio/opus': 'opus',
    'video/mp4': 'mp4', 'application/pdf': 'pdf',
  }
  return map[mimeType] || mimeType.split('/')[1] || 'bin'
}

// Sube base64 a Supabase Storage y devuelve la URL pública
async function uploadToStorage(
  base64: string,
  mimeType: string,
  contactId: string,
  mediaType: MediaType,
): Promise<string> {
  const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, '')
  const buffer = Buffer.from(cleanBase64, 'base64')
  const ext = extFromMime(mimeType)
  const path = `${contactId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabase.storage
    .from('crm-media')
    .upload(path, buffer, { contentType: mimeType, upsert: false })

  if (error) throw new Error(`Storage: ${error.message}`)

  const { data: { publicUrl } } = supabase.storage.from('crm-media').getPublicUrl(path)
  return publicUrl
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

    // 1. Subir a Supabase Storage → obtener URL pública
    let publicUrl: string
    try {
      publicUrl = await uploadToStorage(base64, mimeType || 'application/octet-stream', contactId, mediaType)
    } catch (err) {
      console.error('[send-media] Storage upload failed:', err)
      return NextResponse.json({ error: `Error al subir archivo: ${err}` }, { status: 500 })
    }

    // 2. Enviar a Evolution GO API con la URL
    const base = settings.evolution_api_url.replace(/\/$/, '')
    const ext = extFromMime(mimeType || 'application/octet-stream')

    // Evolution GO: /send/media con mediatype
    // Para audio PTT usamos "ptt", para el resto el tipo directo
    const evolutionMediaType = mediaType === 'audio' ? 'ptt' : mediaType

    const evoBody = {
      number: phone,
      mediatype: evolutionMediaType,
      mediaUrl: publicUrl,
      caption: caption || '',
      fileName: fileName || `${mediaType}-${Date.now()}.${ext}`,
      mimetype: mimeType || '',
    }

    const evoRes = await fetch(`${base}/send/media`, {
      method: 'POST',
      headers: {
        'apikey': settings.evolution_api_key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(evoBody),
    })

    if (!evoRes.ok) {
      const errText = await evoRes.text()
      console.error('[send-media] Evolution API error:', errText)
      return NextResponse.json({ error: `Evolution API: ${errText}` }, { status: 502 })
    }

    let wamid: string | null = null
    try {
      const evoData = await evoRes.json()
      wamid = evoData?.key?.id || evoData?.wuid || null
    } catch {}

    // 3. Guardar en DB con la URL pública (no base64)
    const body = caption || MEDIA_LABELS[mediaType as MediaType] || '[media]'

    const { error: dbError } = await supabase.from('messages').insert({
      contact_id: contactId,
      body,
      direction: 'outbound',
      timestamp: new Date().toISOString(),
      wamid,
      media_type: mediaType,
      media_url: publicUrl,
    })
    if (dbError && dbError.code !== '23505') {
      console.error('[send-media insert]', dbError)
    }

    return NextResponse.json({ ok: true, url: publicUrl })
  } catch (err) {
    console.error('[send-media]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
