import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SYSTEM = `Sos el asistente de Maidana Albums CRM. Ayudás a Marcos a gestionar su negocio de venta de álbumes y figuritas.

Podés:
- Consultar, agregar y modificar ventas/órdenes
- Dar resúmenes financieros (ingresos, costos, ganancias)
- Responder preguntas sobre clientes y pedidos
- Buscar contactos por nombre o teléfono
- Enviar el formulario de pedido a cualquier contacto por WhatsApp
- Ayudar a analizar el negocio

Siempre respondé en español, de forma clara y directa. Si vas a mostrar números, usá formato legible (ej: $9.200). Cuando uses herramientas, explicá brevemente qué encontraste o hiciste.`

const tools = [
  {
    name: 'get_orders',
    description: 'Obtiene órdenes/ventas. Usar para consultar pedidos, clientes, o estado de ventas.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: { type: 'string', description: 'Buscar por nombre, teléfono o producto (opcional)' },
        status: { type: 'string', enum: ['pagado', 'preparando', 'enviado'], description: 'Filtrar por estado (opcional)' },
        limit: { type: 'number', description: 'Cantidad máxima de resultados (default 100)' },
      },
    },
  },
  {
    name: 'add_order',
    description: 'Agrega una nueva venta/orden al sistema.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Nombre y apellido del cliente' },
        phone: { type: 'string', description: 'Teléfono del cliente' },
        address: { type: 'string', description: 'Dirección de envío' },
        quantity: { type: 'number', description: 'Cantidad de unidades' },
        product: { type: 'string', description: 'Producto comprado (ej: Album, Figurita)' },
        email: { type: 'string', description: 'Email del cliente (opcional)' },
        postal_code: { type: 'string', description: 'Código postal (opcional)' },
        sale_price: { type: 'number', description: 'Precio de venta por unidad (opcional)' },
        status: { type: 'string', enum: ['pagado', 'preparando', 'enviado'], description: 'Estado del pedido (default: pagado)' },
        extra_data: { type: 'string', description: 'Notas adicionales (opcional)' },
      },
      required: ['name', 'phone', 'address', 'quantity'],
    },
  },
  {
    name: 'update_order',
    description: 'Modifica una orden existente. Primero usar get_orders para obtener el ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'ID de la orden a modificar' },
        fields: {
          type: 'object' as const,
          description: 'Campos a actualizar: status, sale_price, unit_cost_override, address, phone, quantity, product, extra_data',
        },
      },
      required: ['id', 'fields'],
    },
  },
  {
    name: 'send_form',
    description: 'Envía el mensaje del formulario de pedido a un contacto por WhatsApp. Buscar primero el contacto con get_contacts para obtener su teléfono e ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contact_id: { type: 'string', description: 'ID del contacto' },
        phone: { type: 'string', description: 'Teléfono del contacto' },
        name: { type: 'string', description: 'Nombre del contacto (para confirmar)' },
      },
      required: ['contact_id', 'phone'],
    },
  },
  {
    name: 'get_contacts',
    description: 'Busca contactos por nombre o teléfono.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: { type: 'string', description: 'Nombre o teléfono a buscar' },
      },
    },
  },
  {
    name: 'get_financial_summary',
    description: 'Calcula el resumen financiero del negocio: ingresos totales, costos, ganancias, margen, por producto y por cliente.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
]

type ToolInput = Record<string, unknown>

async function executeTool(name: string, input: ToolInput): Promise<unknown> {
  if (name === 'get_orders') {
    const limit = (input.limit as number) || 100
    let query = supabase
      .from('orders')
      .select('id, name, phone, product, quantity, sale_price, unit_cost_override, status, address, postal_code, created_at, extra_data')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (input.search) {
      const s = input.search as string
      query = query.or(`name.ilike.%${s}%,phone.ilike.%${s}%,product.ilike.%${s}%`)
    }
    if (input.status) {
      query = query.eq('status', input.status)
    }

    const { data } = await query
    return data ?? []
  }

  if (name === 'add_order') {
    try {
      const { data, error } = await supabase
        .from('orders')
        .insert({ status: 'pagado', ...input })
        .select()
      if (error) {
        const msg = error.message || error.code || JSON.stringify(error)
        console.error('[add_order] Supabase error:', msg)
        return { error: `Error al insertar orden: ${msg}` }
      }
      if (!data || data.length === 0) {
        console.error('[add_order] Insert returned no data')
        return { error: 'El insert no devolvió datos' }
      }
      return { success: true, order: data[0] }
    } catch (e) {
      console.error('[add_order] Exception:', e)
      return { error: `Excepción: ${String(e)}` }
    }
  }

  if (name === 'update_order') {
    const { id, fields } = input as { id: string; fields: ToolInput }
    const { error } = await supabase.from('orders').update(fields).eq('id', id)
    if (error) return { error: error.message || JSON.stringify(error) }
    return { success: true }
  }

  if (name === 'get_contacts') {
    const search = input.search as string | undefined
    let query = supabase
      .from('contacts')
      .select('id, name, phone, status, last_message_at')
      .order('last_message_at', { ascending: false })
      .limit(30)
    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
    }
    const { data } = await query
    return data ?? []
  }

  if (name === 'send_form') {
    const { contact_id, phone } = input as { contact_id: string; phone: string }

    const { data: settings } = await supabase
      .from('settings')
      .select('form_message, evolution_api_url, evolution_api_key, instance_name')
      .eq('id', 1)
      .single()

    if (!settings?.form_message) return { error: 'No hay mensaje de formulario configurado en Settings' }
    if (!settings?.evolution_api_url) return { error: 'Evolution API no configurada' }

    const base = settings.evolution_api_url.replace(/\/$/, '')
    const evoRes = await fetch(`${base}/send/text`, {
      method: 'POST',
      headers: { 'apikey': settings.evolution_api_key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: phone, text: settings.form_message, delay: 0 }),
    })

    if (!evoRes.ok) {
      const err = await evoRes.text()
      return { error: `Evolution API error: ${err}` }
    }

    let wamid: string | null = null
    try { const d = await evoRes.json(); wamid = d?.key?.id || d?.wuid || null } catch {}

    await supabase.from('messages').insert({
      contact_id,
      body: settings.form_message,
      direction: 'outbound',
      timestamp: new Date().toISOString(),
      wamid,
    })

    return { success: true, message: 'Formulario enviado correctamente' }
  }

  if (name === 'get_financial_summary') {
    const [{ data: orders }, { data: costs }] = await Promise.all([
      supabase.from('orders').select('name, phone, product, quantity, sale_price, unit_cost_override'),
      supabase.from('product_costs_maidana').select('*'),
    ])

    const costsMap: Record<string, { cost_per_unit: number; shipping_cost_per_order: number }> = {}
    for (const c of costs ?? []) costsMap[c.product.toLowerCase()] = c

    let totalIngresos = 0
    let totalCostos = 0
    const byProduct: Record<string, { ingresos: number; costos: number; ganancia: number; unidades: number }> = {}
    const byClient: Record<string, { cantidad: number; ganancia: number }> = {}

    for (const o of orders ?? []) {
      const qty = o.quantity ?? 1
      const price = o.sale_price ?? 0
      const ingreso = price * qty
      const productKey = (o.product ?? 'desconocido').toLowerCase()
      const costInfo = costsMap[productKey]
      const costUnit = o.unit_cost_override ?? costInfo?.cost_per_unit ?? 0
      const costo = costUnit * qty + (costInfo?.shipping_cost_per_order ?? 0)
      const ganancia = ingreso - costo

      totalIngresos += ingreso
      totalCostos += costo

      const pk = o.product ?? 'desconocido'
      byProduct[pk] = {
        ingresos: (byProduct[pk]?.ingresos ?? 0) + ingreso,
        costos: (byProduct[pk]?.costos ?? 0) + costo,
        ganancia: (byProduct[pk]?.ganancia ?? 0) + ganancia,
        unidades: (byProduct[pk]?.unidades ?? 0) + qty,
      }

      const ck = o.name ?? o.phone
      byClient[ck] = {
        cantidad: (byClient[ck]?.cantidad ?? 0) + qty,
        ganancia: (byClient[ck]?.ganancia ?? 0) + ganancia,
      }
    }

    const totalGanancia = totalIngresos - totalCostos
    const topCliente = Object.entries(byClient).sort((a, b) => b[1].ganancia - a[1].ganancia)[0]

    return {
      total_ordenes: (orders ?? []).length,
      total_ingresos: totalIngresos,
      total_costos: totalCostos,
      total_ganancia: totalGanancia,
      margen_porcentaje: totalIngresos > 0 ? ((totalGanancia / totalIngresos) * 100).toFixed(1) : '0',
      por_producto: Object.entries(byProduct).map(([p, v]) => ({ producto: p, ...v })),
      cliente_top: topCliente ? { nombre: topCliente[0], ...topCliente[1] } : null,
    }
  }

  return { error: 'Herramienta desconocida' }
}

type AnthropicMessage = {
  role: 'user' | 'assistant'
  content: string | AnthropicContent[]
}

type AnthropicContent =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: ToolInput }
  | { type: 'tool_result'; tool_use_id: string; content: string }

export async function POST(req: Request) {
  try {
    const { message } = await req.json()
    if (!message?.trim()) return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 })

    const { data: history } = await supabase
      .from('chat_messages')
      .select('role, content')
      .order('created_at', { ascending: true })
      .limit(40)

    // Filtrar el historial para garantizar roles alternados (evita error 400 de Anthropic
    // cuando un mensaje anterior quedó huérfano por un fallo de API).
    const cleanHistory: { role: 'user' | 'assistant'; content: string }[] = []
    for (const m of history ?? []) {
      const last = cleanHistory[cleanHistory.length - 1]
      if (last && last.role === m.role) continue
      cleanHistory.push({ role: m.role as 'user' | 'assistant', content: m.content })
    }
    // Si el historial termina con un 'user', eliminarlo para que el mensaje actual sea el último
    if (cleanHistory[cleanHistory.length - 1]?.role === 'user') cleanHistory.pop()

    await supabase.from('chat_messages').insert({ role: 'user', content: message })

    const messages: AnthropicMessage[] = [
      ...cleanHistory,
      { role: 'user', content: message },
    ]

    let iterations = 0
    let finalText = ''

    while (iterations < 6) {
      iterations++

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system: SYSTEM,
          tools,
          messages,
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        return NextResponse.json({ error: `AI error: ${err}` }, { status: 502 })
      }

      const data = await res.json()
      const stopReason = data.stop_reason
      const content: AnthropicContent[] = data.content

      if (stopReason === 'end_turn' || stopReason === 'stop_sequence') {
        finalText = content.find((c): c is { type: 'text'; text: string } => c.type === 'text')?.text ?? ''
        break
      }

      if (stopReason === 'tool_use') {
        messages.push({ role: 'assistant', content })

        const toolResults: AnthropicContent[] = []
        for (const block of content) {
          if (block.type === 'tool_use') {
            const result = await executeTool(block.name, block.input)
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(result),
            })
          }
        }

        messages.push({ role: 'user', content: toolResults })
        continue
      }

      finalText = content.find((c): c is { type: 'text'; text: string } => c.type === 'text')?.text ?? ''
      break
    }

    if (!finalText) finalText = 'No pude procesar la solicitud.'

    await supabase.from('chat_messages').insert({ role: 'assistant', content: finalText })

    return NextResponse.json({ message: finalText })
  } catch (err) {
    console.error('[chat]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
