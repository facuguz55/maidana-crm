import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { data: settings } = await supabase
    .from('settings')
    .select('evolution_api_url, evolution_api_key, instance_name')
    .eq('id', 1)
    .single()

  if (!settings?.evolution_api_url) {
    return NextResponse.json({ error: 'No settings' }, { status: 400 })
  }

  const base = settings.evolution_api_url.replace(/\/$/, '')
  const key = settings.evolution_api_key
  const instance = settings.instance_name

  const probes = [
    `GET ${base}/`,
    `GET ${base}/docs`,
    `GET ${base}/swagger`,
    `GET ${base}/openapi.json`,
    `GET ${base}/instance/all`,
    `GET ${base}/instance/${instance}`,
    `GET ${base}/instance/${instance}/messages`,
    `GET ${base}/message/${instance}`,
    `GET ${base}/chat/${instance}`,
    `GET ${base}/chat`,
    `GET ${base}/messages`,
  ]

  const results: Record<string, string> = {}

  for (const probe of probes) {
    const url = probe.replace('GET ', '')
    try {
      const res = await fetch(url, { headers: { apikey: key }, signal: AbortSignal.timeout(5000) })
      const text = await res.text().catch(() => '')
      results[url] = `${res.status} — ${text.slice(0, 120)}`
    } catch (e) {
      results[url] = `ERR: ${e}`
    }
  }

  return NextResponse.json({ base, instance, results })
}
