import { createClient } from '@/lib/supabase/server'
import VentasClient from '@/components/VentasClient'
import type { Order, ProductCost } from '@/lib/types'

export default async function VentasPage() {
  const supabase = await createClient()
  const [{ data: orders }, { data: costs }] = await Promise.all([
    supabase.from('orders').select('*').order('created_at', { ascending: false }),
    supabase.from('product_costs_maidana').select('*'),
  ])

  return (
    <VentasClient
      initialOrders={(orders ?? []) as Order[]}
      initialCosts={(costs ?? []) as ProductCost[]}
    />
  )
}
