import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { url, apiKey } = await req.json()
    if (!url || !apiKey) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    const base = url.replace(/\/$/, '')
    const res = await fetch(`${base}/instance/all`, {
      headers: { 'apikey': apiKey },
    })
    return NextResponse.json({ ok: res.ok, status: res.status })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
