import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

let lastPayload: unknown = null

export async function POST(req: NextRequest) {
  lastPayload = await req.json()
  return NextResponse.json({ ok: true })
}

export async function GET() {
  return NextResponse.json({ payload: lastPayload })
}
