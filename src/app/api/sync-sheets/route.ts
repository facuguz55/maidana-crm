import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '').replace(/^0/, '').replace(/^54/, '54')
}

export async function POST() {
  try {
    const { data: settings } = await supabase
      .from('settings')
      .select('google_sheets_id, sheet_name, google_api_key')
      .eq('id', 1)
      .single()

    if (!settings?.google_sheets_id || !settings?.google_api_key) {
      return NextResponse.json({ error: 'Google Sheets no configurado' }, { status: 400 })
    }

    const sheetName = encodeURIComponent(settings.sheet_name || 'Respuestas de formulario 1')
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${settings.google_sheets_id}/values/${sheetName}?key=${settings.google_api_key}`

    const res = await fetch(url)
    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `Sheets API error: ${err}` }, { status: 502 })
    }

    const json = await res.json()
    const rows: string[][] = json.values ?? []
    if (rows.length <= 1) return NextResponse.json({ synced: 0 })

    // Saltar header (fila 0)
    const dataRows = rows.slice(1)
    let synced = 0

    const [{ data: blocklist }, { data: existing }] = await Promise.all([
      supabase.from('sync_blocklist').select('form_timestamp'),
      supabase.from('orders').select('form_timestamp').not('form_timestamp', 'is', null),
    ])
    const blocked = new Set((blocklist ?? []).map((r: { form_timestamp: string }) => r.form_timestamp))
    const alreadySynced = new Set((existing ?? []).map((r: { form_timestamp: string }) => r.form_timestamp))

    for (const row of dataRows) {
      // Columnas del formulario:
      // [0] Marca temporal  [1] Email form  [2] Nombre y Apellido  [3] Telefono
      // [4] Correo Electrónico  [5] Que compraste  [6] Cantidad  [7] Dirección
      // [8] Codigo Postal  [9] Datos extra
      const [timestamp, , name, phoneRaw, email, product, quantityRaw, address, postalCode, extraData] = row
      if (!timestamp || !name || !phoneRaw) continue
      if (blocked.has(timestamp)) continue
      if (alreadySynced.has(timestamp)) continue

      const phone = normalizePhone(phoneRaw)
      const quantity = parseInt(quantityRaw) || 0

      // Buscar contacto por teléfono (match parcial)
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id')
        .ilike('phone', `%${phone.slice(-8)}%`)
        .limit(1)

      const contactId = contacts?.[0]?.id ?? null

      const { error } = await supabase.from('orders').insert({
        contact_id: contactId,
        name,
        address: address ?? '',
        quantity,
        phone,
        status: 'pagado',
        form_timestamp: timestamp,
        email: email || null,
        product: product || null,
        postal_code: postalCode || null,
        extra_data: extraData || null,
      })

      if (!error) synced++
    }

    return NextResponse.json({ synced })
  } catch (err) {
    console.error('[sync-sheets]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
