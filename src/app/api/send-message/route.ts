import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { contactId, phone, text } = await req.json()
    if (!contactId || !phone || !text?.trim()) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Obtener settings
    const { data: settings } = await supabase
      .from('settings')
      .select('evolution_api_url, evolution_api_key, instance_name')
      .eq('id', 1)
      .single()

    if (!settings?.evolution_api_url) {
      return NextResponse.json({ error: 'Evolution API no configurada' }, { status: 400 })
    }

    // Enviar mensaje via Evolution GO API
    const base = settings.evolution_api_url.replace(/\/$/, '')
    const evoRes = await fetch(`${base}/send/text`, {
      method: 'POST',
      headers: {
        'apikey': settings.evolution_api_key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ number: phone, text, delay: 0 }),
    })

    if (!evoRes.ok) {
      const errText = await evoRes.text()
      return NextResponse.json({ error: `Evolution API error: ${errText}` }, { status: 502 })
    }

    // Extraer wamid de la respuesta para deduplicar con el webhook outbound
    let wamid: string | null = null
    try {
      const evoData = await evoRes.json()
      wamid = evoData?.key?.id || evoData?.wuid || evoData?.message?.key?.id || null
    } catch {}

    // Guardar en messages (el webhook outbound también lo intentará — el wamid evita duplicado)
    const { error } = await supabase.from('messages').insert({
      contact_id: contactId,
      body: text,
      direction: 'outbound',
      timestamp: new Date().toISOString(),
      wamid,
    })
    if (error && error.code !== '23505') {
      console.error('[send-message insert]', error)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[send-message]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
