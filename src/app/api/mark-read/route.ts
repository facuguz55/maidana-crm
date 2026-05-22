import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { contactId } = await req.json()
  if (!contactId) return NextResponse.json({ error: 'Missing contactId' }, { status: 400 })
  await supabase.from('contacts').update({ unread: false }).eq('id', contactId)
  return NextResponse.json({ ok: true })
}
