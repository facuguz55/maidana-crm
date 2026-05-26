import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { ProductCost } from '@/lib/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { costs }: { costs: ProductCost[] } = await req.json()

    const { data: orders, error } = await supabase
      .from('orders')
      .select('name, phone, product, quantity, sale_price, status')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!orders || orders.length === 0) {
      return NextResponse.json({ error: 'No hay órdenes para analizar' }, { status: 400 })
    }

    const costsMap: Record<string, ProductCost> = {}
    for (const c of costs) costsMap[c.product.toLowerCase()] = c

    type OrderRow = { name: string; phone: string; product: string | null; quantity: number; sale_price: number | null; status: string }

    let totalIngresos = 0
    let totalCostos = 0
    const clienteMap: Record<string, { cantidad: number; ganancia: number }> = {}
    const productoMap: Record<string, { ingresos: number; costos: number; ganancia: number }> = {}

    for (const o of orders as OrderRow[]) {
      const qty = o.quantity ?? 1
      const price = o.sale_price ?? 0
      const ingreso = price * qty

      const productKey = (o.product ?? 'desconocido').toLowerCase()
      const costInfo = costsMap[productKey]
      const costoPorOrden = costInfo
        ? costInfo.cost_per_unit * qty + costInfo.shipping_cost_per_order
        : 0

      totalIngresos += ingreso
      totalCostos += costoPorOrden

      const ganancia = ingreso - costoPorOrden
      const key = o.name ?? o.phone
      clienteMap[key] = {
        cantidad: (clienteMap[key]?.cantidad ?? 0) + qty,
        ganancia: (clienteMap[key]?.ganancia ?? 0) + ganancia,
      }

      const pk = o.product ?? 'desconocido'
      productoMap[pk] = {
        ingresos: (productoMap[pk]?.ingresos ?? 0) + ingreso,
        costos: (productoMap[pk]?.costos ?? 0) + costoPorOrden,
        ganancia: (productoMap[pk]?.ganancia ?? 0) + ganancia,
      }
    }

    const totalGanancia = totalIngresos - totalCostos
    const margenPorcentaje = totalIngresos > 0 ? (totalGanancia / totalIngresos) * 100 : 0
    const productoMasRentable = Object.entries(productoMap).sort((a, b) => b[1].ganancia - a[1].ganancia)[0]?.[0] ?? '—'
    const clienteMasGrande = Object.entries(clienteMap).sort((a, b) => b[1].ganancia - a[1].ganancia)[0]

    const resumenData = {
      total_ordenes: orders.length,
      total_ingresos: totalIngresos,
      total_costos: totalCostos,
      total_ganancia: totalGanancia,
      margen_porcentaje: margenPorcentaje,
      producto_mas_rentable: productoMasRentable,
      cliente_mas_grande: clienteMasGrande
        ? { nombre: clienteMasGrande[0], cantidad: clienteMasGrande[1].cantidad, ganancia: clienteMasGrande[1].ganancia }
        : null,
      productos: Object.entries(productoMap).map(([p, v]) => ({ producto: p, ...v })),
      ordenes_sin_precio: (orders as OrderRow[]).filter(o => !o.sale_price || o.sale_price === 0).length,
    }

    const prompt = `Sos un analista financiero para un negocio de venta de álbumes y figuritas. Analiza estos datos y respondé SOLO con un JSON válido (sin markdown, sin explicaciones).

Datos del negocio:
${JSON.stringify(resumenData, null, 2)}

Respondé con este JSON exacto:
{
  "resumen": "párrafo de 2-3 oraciones con el estado general del negocio",
  "total_ingresos": número,
  "total_costos": número,
  "total_ganancia": número,
  "margen_porcentaje": número con 1 decimal,
  "producto_mas_rentable": "string",
  "cliente_mas_grande": { "nombre": "string", "cantidad": número, "ganancia": número },
  "alertas": ["alerta 1", "alerta 2"],
  "recomendaciones": ["recomendación 1", "recomendación 2", "recomendación 3"]
}`

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!aiRes.ok) {
      const err = await aiRes.text()
      return NextResponse.json({ error: `AI error: ${err}` }, { status: 502 })
    }

    const aiJson = await aiRes.json()
    const raw = aiJson.content?.[0]?.text ?? ''

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Respuesta de AI inválida' }, { status: 500 })

    const result = JSON.parse(jsonMatch[0])
    return NextResponse.json(result)
  } catch (err) {
    console.error('[analyze]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
