import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { action, message } = await req.json()

    const { data: settings } = await supabase
      .from('settings')
      .select('evolution_api_url, evolution_api_key')
      .eq('id', 1)
      .single()

    if (!settings?.evolution_api_url) {
      return NextResponse.json({ error: 'No settings' }, { status: 400 })
    }

    const base = settings.evolution_api_url.replace(/\/$/, '')

    if (action === 'test-download' && message) {
      // Probar downloadimage con el objeto message pasado
      const res = await fetch(`${base}/message/downloadimage`, {
        method: 'POST',
        headers: { 'apikey': settings.evolution_api_key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      const text = await res.text()
      let parsed = null
      try { parsed = JSON.parse(text) } catch {}
      return NextResponse.json({ status: res.status, ok: res.ok, raw: text.slice(0, 500), parsed })
    }

    // Default: listar instancias
    const res = await fetch(`${base}/instance/all`, {
      headers: { 'apikey': settings.evolution_api_key },
    })
    const data = await res.json()
    return NextResponse.json({ ok: res.ok, status: res.status, data })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
