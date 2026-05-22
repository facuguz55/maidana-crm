import { createClient } from '@/lib/supabase/server'
import VentasClient from '@/components/VentasClient'
import type { Order } from '@/lib/types'

export default async function VentasPage() {
  const supabase = await createClient()
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })

  return <VentasClient initialOrders={(orders ?? []) as Order[]} />
}
